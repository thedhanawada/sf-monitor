const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const inquirer = require('inquirer');
const chalk = require('chalk');
const SFAuthManager = require('./sfauth');

class ConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.sf-monitor');
    this.configFile = path.join(this.configDir, 'config.json');
    this.orgsFile = path.join(this.configDir, 'orgs.json');
    this.sfAuth = new SFAuthManager();
  }

  async ensureConfigDir() {
    try {
      await fs.access(this.configDir);
    } catch {
      await fs.mkdir(this.configDir, { recursive: true });
    }
  }

  async loadConfig() {
    try {
      await this.ensureConfigDir();
      const data = await fs.readFile(this.configFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return this.getDefaultConfig();
    }
  }

  async saveConfig(config) {
    await this.ensureConfigDir();
    await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));
  }

  async loadOrgs() {
    try {
      await this.ensureConfigDir();
      const data = await fs.readFile(this.orgsFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async saveOrgs(orgs) {
    await this.ensureConfigDir();
    await fs.writeFile(this.orgsFile, JSON.stringify(orgs, null, 2));
  }

  getDefaultConfig() {
    return {
      defaultOrg: null,
      monitoringInterval: 30,
      thresholds: {
        warning: 80,
        critical: 95
      },
      alerts: {
        enabled: true,
        types: []
      },
      logging: {
        level: 'info',
        file: true
      },
      display: {
        format: 'table',
        colors: true
      }
    };
  }

  async get(key) {
    const config = await this.loadConfig();
    return this.getNestedProperty(config, key);
  }

  async set(key, value) {
    const config = await this.loadConfig();
    this.setNestedProperty(config, key, value);
    await this.saveConfig(config);
  }

  async getAll() {
    return await this.loadConfig();
  }

  getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  async getOrgConfig(orgAlias) {
    if (!orgAlias) {
      const config = await this.loadConfig();
      orgAlias = config.defaultOrg;
      
      if (!orgAlias) {
        throw new Error('No org specified and no default org configured. Use --org or run "sf-monitor setup"');
      }
    }

    try {
      // Get org info directly from SF CLI
      const orgInfo = await this.sfAuth.getOrgInfo(orgAlias);
      return {
        username: orgInfo.username,
        accessToken: orgInfo.accessToken,
        instanceUrl: orgInfo.instanceUrl,
        loginUrl: orgInfo.loginUrl,
        orgId: orgInfo.orgId
      };
    } catch (error) {
      throw new Error(`Failed to get org configuration for "${orgAlias}": ${error.message}`);
    }
  }

  async addOrg(alias, config) {
    const orgs = await this.loadOrgs();
    orgs[alias] = config;
    await this.saveOrgs(orgs);
  }

  async removeOrg(alias) {
    const orgs = await this.loadOrgs();
    delete orgs[alias];
    await this.saveOrgs(orgs);
  }

  async listOrgs() {
    const orgs = await this.loadOrgs();
    return Object.keys(orgs);
  }

  async interactiveSetup() {
    console.log(chalk.blue('Welcome to sf-monitor Interactive Setup\n'));

    try {
      // Get authenticated orgs from SF CLI
      const authenticatedOrgs = await this.sfAuth.getAuthenticatedOrgs();
      
      console.log(chalk.green('Found authenticated Salesforce orgs:'));
      authenticatedOrgs.forEach((org, index) => {
        const defaultMarker = org.isDefault ? chalk.green(' (default)') : '';
        console.log(`  ${index + 1}. ${org.alias || org.username}${defaultMarker}`);
      });
      console.log();

      const questions = [
        {
          type: 'list',
          name: 'selectedOrg',
          message: 'Select an org to use with sf-monitor:',
          choices: authenticatedOrgs.map(org => ({
            name: `${org.alias || org.username} (${org.username})`,
            value: org
          }))
        },
        {
          type: 'number',
          name: 'monitoringInterval',
          message: 'Default monitoring interval (seconds):',
          default: 30,
          validate: input => input > 0 || 'Interval must be positive'
        },
        {
          type: 'number',
          name: 'warningThreshold',
          message: 'Warning threshold percentage:',
          default: 80,
          validate: input => input > 0 && input <= 100 || 'Threshold must be between 1-100'
        },
        {
          type: 'number',
          name: 'criticalThreshold',
          message: 'Critical threshold percentage:',
          default: 95,
          validate: input => input > 0 && input <= 100 || 'Threshold must be between 1-100'
        },
        {
          type: 'confirm',
          name: 'setAsDefault',
          message: 'Set this org as the default for sf-monitor?',
          default: true
        },
        {
          type: 'checkbox',
          name: 'alertTypes',
          message: 'Select alert types to configure:',
          choices: [
            { name: 'Console output', value: 'console', checked: true },
            { name: 'Email notifications', value: 'email' },
            { name: 'Slack webhook', value: 'slack' },
            { name: 'Custom webhook', value: 'webhook' }
          ]
        }
      ];

      const answers = await inquirer.prompt(questions);

      // Validate org access
      const orgIdentifier = answers.selectedOrg.alias || answers.selectedOrg.username;
      console.log(chalk.blue(`\nValidating access to ${orgIdentifier}...`));
      
      const isValid = await this.sfAuth.validateOrgAccess(orgIdentifier);
      if (!isValid) {
        throw new Error(`Cannot access org ${orgIdentifier}. Please check your authentication.`);
      }

      console.log(chalk.green('✓ Org access validated successfully\n'));

      // Update main configuration
      const config = await this.loadConfig();
      
      if (answers.setAsDefault) {
        config.defaultOrg = orgIdentifier;
      }
      
      config.monitoringInterval = answers.monitoringInterval;
      config.thresholds.warning = answers.warningThreshold;
      config.thresholds.critical = answers.criticalThreshold;
      config.alerts.types = answers.alertTypes;

      await this.saveConfig(config);

      // Configure alerts if selected
      if (answers.alertTypes.includes('email')) {
        await this.configureEmailAlert();
      }
      
      if (answers.alertTypes.includes('slack')) {
        await this.configureSlackAlert();
      }
      
      if (answers.alertTypes.includes('webhook')) {
        await this.configureWebhookAlert();
      }

      console.log(chalk.green('\n✅ Configuration saved successfully!'));
      console.log(chalk.blue(`Selected org: ${answers.selectedOrg.username}`));
      console.log(chalk.blue(`Default org: ${answers.setAsDefault ? 'Yes' : 'No'}`));
      console.log(chalk.blue(`\nTo start monitoring, run: ${chalk.bold('sf-monitor monitor')}`));
      
    } catch (error) {
      console.error(chalk.red('\nSetup failed:'));
      console.error(chalk.red(error.message));
      
      if (error.message.includes('No authenticated orgs found')) {
        console.log(this.sfAuth.getLoginInstructions());
      }
      
      throw error;
    }
  }

  async configureEmailAlert() {
    const questions = [
      {
        type: 'input',
        name: 'smtpHost',
        message: 'SMTP host:',
        validate: input => input.trim() !== '' || 'SMTP host is required'
      },
      {
        type: 'number',
        name: 'smtpPort',
        message: 'SMTP port:',
        default: 587
      },
      {
        type: 'input',
        name: 'smtpUser',
        message: 'SMTP username:',
        validate: input => input.trim() !== '' || 'Username is required'
      },
      {
        type: 'password',
        name: 'smtpPass',
        message: 'SMTP password:',
        mask: '*'
      },
      {
        type: 'input',
        name: 'fromEmail',
        message: 'From email address:',
        validate: input => input.includes('@') || 'Valid email required'
      },
      {
        type: 'input',
        name: 'toEmails',
        message: 'To email addresses (comma-separated):',
        validate: input => input.trim() !== '' || 'At least one email required'
      }
    ];

    const answers = await inquirer.prompt(questions);
    
    const config = await this.loadConfig();
    config.alerts.email = {
      smtp: {
        host: answers.smtpHost,
        port: answers.smtpPort,
        secure: answers.smtpPort === 465,
        auth: {
          user: answers.smtpUser,
          pass: answers.smtpPass
        }
      },
      from: answers.fromEmail,
      to: answers.toEmails.split(',').map(email => email.trim())
    };
    
    await this.saveConfig(config);
  }

  async configureSlackAlert() {
    const questions = [
      {
        type: 'input',
        name: 'webhookUrl',
        message: 'Slack webhook URL:',
        validate: input => input.startsWith('https://hooks.slack.com/') || 'Invalid Slack webhook URL'
      },
      {
        type: 'input',
        name: 'channel',
        message: 'Slack channel (optional):',
        default: '#alerts'
      }
    ];

    const answers = await inquirer.prompt(questions);
    
    const config = await this.loadConfig();
    config.alerts.slack = {
      webhookUrl: answers.webhookUrl,
      channel: answers.channel
    };
    
    await this.saveConfig(config);
  }

  async configureWebhookAlert() {
    const questions = [
      {
        type: 'input',
        name: 'url',
        message: 'Webhook URL:',
        validate: input => input.startsWith('http') || 'Invalid URL'
      },
      {
        type: 'input',
        name: 'method',
        message: 'HTTP method:',
        default: 'POST'
      },
      {
        type: 'input',
        name: 'headers',
        message: 'Custom headers (JSON format, optional):'
      }
    ];

    const answers = await inquirer.prompt(questions);
    
    const config = await this.loadConfig();
    config.alerts.webhook = {
      url: answers.url,
      method: answers.method,
      headers: answers.headers ? JSON.parse(answers.headers) : {}
    };
    
    await this.saveConfig(config);
  }

  async addAlert(type) {
    switch (type) {
      case 'email':
        await this.configureEmailAlert();
        break;
      case 'slack':
        await this.configureSlackAlert();
        break;
      case 'webhook':
        await this.configureWebhookAlert();
        break;
      default:
        throw new Error(`Unknown alert type: ${type}`);
    }
    
    console.log(chalk.green(`✅ ${type} alert configured successfully`));
  }

  async getAlerts() {
    const config = await this.loadConfig();
    return config.alerts || { enabled: false, types: [] };
  }

  async testAlerts() {
    const AlertManager = require('./alerts');
    const alertManager = new AlertManager();
    
    await alertManager.sendAlert({
      type: 'test',
      severity: 'info',
      message: 'This is a test alert from sf-monitor',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = ConfigManager;