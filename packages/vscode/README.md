# SF Monitor - Salesforce Governor Limits Monitor

Real-time monitoring of Salesforce governor limits directly in VS Code. Track API usage, storage limits, and processing quotas while you develop.

## Features

- **Live Governor Limits View** - TreeView in Explorer panel showing all limits categorized by status
- **Status Bar Integration** - Current alert status at a glance  
- **Smart Notifications** - Alerts when limits approach thresholds (80% warning, 95% critical)
- **Continuous Monitoring** - Auto-refresh with configurable intervals
- **Multiple Orgs Support** - Switch between different Salesforce environments
- **Salesforce CLI Integration** - Uses existing authentication, no additional setup

## Quick Start

1. Ensure Salesforce CLI is installed and authenticated: `sf org login web`
2. Open Command Palette (`Cmd+Shift+P`) 
3. Run `SF Monitor: Setup Org`
4. Select your org and start monitoring

## Commands

- `SF Monitor: Setup Org` - Configure org to monitor
- `SF Monitor: Refresh Limits` - Manual refresh
- `SF Monitor: Start Monitoring` - Begin continuous monitoring  
- `SF Monitor: Stop Monitoring` - Stop monitoring

## What it monitors

API requests, data storage, file storage, email limits, processing limits (Apex, workflows), platform events, and more.

## Settings

Configure the extension via VS Code settings (`sfMonitor.*`):

- `sfMonitor.defaultOrg` - Default org to monitor
- `sfMonitor.monitoringInterval` - Monitoring interval in seconds (default: 30)
- `sfMonitor.warningThreshold` - Warning threshold percentage (default: 80)
- `sfMonitor.criticalThreshold` - Critical threshold percentage (default: 95)
- `sfMonitor.showStatusBar` - Show status bar indicator (default: true)
- `sfMonitor.notifications` - Enable notifications (default: true)

## Requirements

- Salesforce CLI (`sf` or `sfdx`)
- At least one authenticated Salesforce org

## Privacy

No credentials stored locally - uses your existing Salesforce CLI authentication.

## Support

- [GitHub Issues](https://github.com/thedhanawada/sf-monitor/issues)
- [Source Code](https://github.com/thedhanawada/sf-monitor)