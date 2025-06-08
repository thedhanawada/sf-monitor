#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { version } = require('../package.json');
const LimitsMonitor = require('../src/monitor');
const ConfigManager = require('../src/config');

const program = new Command();

program
  .name('sf-monitor')
  .description('Real-time Salesforce Governor Limits Monitor CLI')
  .version(version);

program
  .command('monitor')
  .description('Start monitoring Salesforce governor limits')
  .option('-o, --org <org>', 'Salesforce org username or alias')
  .option('-i, --interval <seconds>', 'Monitoring interval in seconds', '30')
  .option('-t, --threshold <percentage>', 'Alert threshold percentage', '80')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .option('--continuous', 'Run continuous monitoring')
  .action(async (options) => {
    try {
      const monitor = new LimitsMonitor(options);
      await monitor.start();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Manage sf-monitor configuration')
  .option('--set <key=value>', 'Set configuration value')
  .option('--get <key>', 'Get configuration value')
  .option('--list', 'List all configuration')
  .action(async (options) => {
    try {
      const config = new ConfigManager();
      
      if (options.set) {
        const [key, value] = options.set.split('=');
        await config.set(key, value);
        console.log(chalk.green(`✓ Configuration updated: ${key} = ${value}`));
      } else if (options.get) {
        const value = await config.get(options.get);
        console.log(`${options.get}: ${value}`);
      } else if (options.list) {
        const allConfig = await config.getAll();
        console.table(allConfig);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Interactive setup for sf-monitor')
  .action(async () => {
    try {
      const config = new ConfigManager();
      await config.interactiveSetup();
      console.log(chalk.green('✓ sf-monitor setup completed!'));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current limits status for configured orgs')
  .option('-o, --org <org>', 'Specific org to check')
  .action(async (options) => {
    try {
      const monitor = new LimitsMonitor(options);
      await monitor.showStatus();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('alerts')
  .description('Manage alert configurations')
  .option('--add <type>', 'Add alert type (email, slack, webhook)')
  .option('--list', 'List configured alerts')
  .option('--test', 'Test alert configurations')
  .action(async (options) => {
    try {
      const config = new ConfigManager();
      
      if (options.add) {
        await config.addAlert(options.add);
      } else if (options.list) {
        const alerts = await config.getAlerts();
        console.table(alerts);
      } else if (options.test) {
        await config.testAlerts();
        console.log(chalk.green('✓ Alert test completed'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('Invalid command:'), program.args.join(' '));
  console.log('See --help for a list of available commands.');
  process.exit(1);
});

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse(process.argv);