const { AlertManager } = require('@sf-monitor/shared');
const chalk = require('chalk');
const ConfigManager = require('./config');

class CLIAlertManager extends AlertManager {
  constructor() {
    super();
    this.config = new ConfigManager();
  }

  async sendAlert(alertData) {
    const alertConfig = await this.config.getAlerts();
    
    if (!alertConfig.enabled) {
      return;
    }

    const promises = [];

    for (const alertType of alertConfig.types) {
      switch (alertType) {
        case 'console':
          promises.push(this.sendConsoleAlert(alertData));
          break;
        case 'email':
          const emailConfig = await this.config.get('alerts.email');
          promises.push(this.sendEmailAlert(alertData, emailConfig));
          break;
        case 'slack':
          const slackConfig = await this.config.get('alerts.slack');
          promises.push(this.sendSlackAlert(alertData, slackConfig));
          break;
        case 'webhook':
          const webhookConfig = await this.config.get('alerts.webhook');
          promises.push(this.sendWebhookAlert(alertData, webhookConfig));
          break;
      }
    }

    await Promise.allSettled(promises);
  }

  async sendConsoleAlert(alertData) {
    const severityColors = {
      info: chalk.blue,
      warning: chalk.yellow,
      critical: chalk.red
    };

    const colorFn = severityColors[alertData.severity] || chalk.white;
    
    console.log(colorFn(`\n🚨 ALERT [${alertData.severity.toUpperCase()}]`));
    console.log(colorFn(`Time: ${alertData.timestamp}`));
    
    if (alertData.org) {
      console.log(colorFn(`Org: ${alertData.org}`));
    }

    if (alertData.limits) {
      console.log(colorFn('\nAffected Limits:'));
      alertData.limits.forEach(limit => {
        console.log(colorFn(`  • ${limit.name}: ${limit.percentage}% (${limit.status})`));
      });
    }

    if (alertData.message) {
      console.log(colorFn(`\nMessage: ${alertData.message}`));
    }

    console.log();
  }

  async testAlert(type = 'all') {
    const testData = {
      type: 'test',
      severity: 'info',
      message: 'This is a test alert from sf-monitor',
      timestamp: new Date().toISOString(),
      org: 'test-org',
      limits: [
        {
          name: 'Daily API Requests',
          percentage: 85,
          status: 'WARNING',
          used: 85000,
          max: 100000,
          remaining: 15000
        }
      ]
    };

    if (type === 'all') {
      await this.sendAlert(testData);
    } else {
      switch (type) {
        case 'console':
          await this.sendConsoleAlert(testData);
          break;
        case 'email':
          const emailConfig = await this.config.get('alerts.email');
          await this.sendEmailAlert(testData, emailConfig);
          break;
        case 'slack':
          const slackConfig = await this.config.get('alerts.slack');
          await this.sendSlackAlert(testData, slackConfig);
          break;
        case 'webhook':
          const webhookConfig = await this.config.get('alerts.webhook');
          await this.sendWebhookAlert(testData, webhookConfig);
          break;
        default:
          throw new Error(`Unknown alert type: ${type}`);
      }
    }

    console.log(chalk.green(`✅ Test alert sent successfully (${type})`));
  }
}

module.exports = CLIAlertManager;