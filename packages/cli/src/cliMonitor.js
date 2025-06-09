const { LimitsMonitor } = require('@sf-monitor/shared');
const chalk = require('chalk');
const { table } = require('table');
const cron = require('node-cron');
const ora = require('ora');
const winston = require('winston');
const AlertManager = require('./cliAlerts');
const ConfigManager = require('./config');

class CLILimitsMonitor extends LimitsMonitor {
  constructor(options = {}) {
    super(options);
    this.alertManager = new AlertManager();
    this.config = new ConfigManager();
    this.logger = this.initLogger();
    this.isMonitoring = false;
  }

  initLogger() {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'sf-monitor.log' }),
        new winston.transports.Console({
          format: winston.format.simple(),
          silent: this.options.quiet
        })
      ]
    });
  }

  async connect() {
    const spinner = ora('Connecting to Salesforce...').start();
    
    try {
      const orgConfig = await this.config.getOrgConfig(this.options.org);
      await super.connect(orgConfig);
      spinner.succeed(`Connected to ${orgConfig.username}`);
    } catch (error) {
      spinner.fail('Failed to connect to Salesforce');
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  getStatusColor(status) {
    switch (status) {
      case 'CRITICAL': return chalk.red;
      case 'WARNING': return chalk.yellow;
      default: return chalk.green;
    }
  }

  formatLimitsTable(limits) {
    const headers = ['Limit', 'Used', 'Max', 'Remaining', 'Usage %', 'Status'];
    const rows = [headers];

    limits.forEach(limit => {
      const colorFn = this.getStatusColor(limit.status);
      rows.push([
        limit.name,
        limit.used.toLocaleString(),
        limit.max.toLocaleString(),
        limit.remaining?.toLocaleString() || 'N/A',
        `${limit.percentage}%`,
        colorFn(limit.status)
      ]);
    });

    return table(rows, {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼'
      }
    });
  }

  async checkAndAlert(limits) {
    const alertLimits = limits.filter(limit => 
      limit.status === 'WARNING' || limit.status === 'CRITICAL'
    );

    if (alertLimits.length > 0) {
      await this.alertManager.sendAlert({
        type: 'limits',
        severity: alertLimits.some(l => l.status === 'CRITICAL') ? 'critical' : 'warning',
        limits: alertLimits,
        timestamp: new Date().toISOString(),
        org: this.options.org
      });
    }

    return alertLimits;
  }

  async showStatus() {
    await this.connect();
    
    const spinner = ora('Fetching current limits...').start();
    
    try {
      const orgConfig = await this.config.getOrgConfig(this.options.org);
      const result = await super.checkLimits(orgConfig);
      
      spinner.stop();
      
      console.log(chalk.bold('\n📊 Salesforce Governor Limits Status\n'));
      console.log(this.formatLimitsTable(result.limits));
      
      const alertLimits = await this.checkAndAlert(result.limits);
      
      if (alertLimits.length > 0) {
        console.log(chalk.yellow(`\n⚠️  ${alertLimits.length} limit(s) require attention`));
      } else {
        console.log(chalk.green('\n✅ All limits are within safe thresholds'));
      }
      
    } catch (error) {
      spinner.fail('Failed to fetch limits');
      throw error;
    }
  }

  async start() {
    if (this.isMonitoring) {
      console.log(chalk.yellow('Monitoring is already running'));
      return;
    }

    if (this.options.continuous) {
      await this.startContinuousMonitoring();
    } else {
      await this.showStatus();
    }
  }

  async startContinuousMonitoring() {
    this.isMonitoring = true;
    const interval = parseInt(this.options.interval) || 30;
    
    console.log(chalk.blue(`🔄 Starting continuous monitoring (${interval}s intervals)`));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));

    // Initial check
    await this.performMonitoringCheck();

    // Schedule periodic checks
    const cronExpression = `*/${interval} * * * * *`;
    
    cron.schedule(cronExpression, async () => {
      if (this.isMonitoring) {
        await this.performMonitoringCheck();
      }
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\n🛑 Stopping monitoring...'));
      this.isMonitoring = false;
      process.exit(0);
    });

    // Keep process alive
    process.stdin.resume();
  }

  async performMonitoringCheck() {
    try {
      const orgConfig = await this.config.getOrgConfig(this.options.org);
      const result = await super.checkLimits(orgConfig);

      const timestamp = new Date().toLocaleTimeString();
      
      if (result.hasAlerts) {
        console.log(chalk.red(`[${timestamp}] ⚠️  ${result.alertLimits.length} limit(s) need attention:`));
        result.alertLimits.forEach(limit => {
          const colorFn = this.getStatusColor(limit.status);
          console.log(colorFn(`  • ${limit.name}: ${limit.percentage}% (${limit.status})`));
        });
        
        await this.checkAndAlert(result.limits);
      } else {
        console.log(chalk.green(`[${timestamp}] ✅ All limits OK`));
      }

      this.logger.info('Monitoring check completed', {
        alertLimits: result.alertLimits.length,
        totalLimits: result.limits.length
      });

    } catch (error) {
      console.error(chalk.red(`[${new Date().toLocaleTimeString()}] Error:`, error.message));
      this.logger.error('Monitoring check failed', { error: error.message });
    }
  }

  stop() {
    this.isMonitoring = false;
  }
}

module.exports = CLILimitsMonitor;