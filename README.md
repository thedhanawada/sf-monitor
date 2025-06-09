# sf-monitor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

Salesforce monitoring toolkit for governor limits, flows, performance, and debugging. Available as both a CLI tool and VS Code extension.

## Packages

This monorepo contains:

- **[CLI Package](./packages/cli)** - Command-line interface (`sf-monitor`)
- **[VS Code Extension](./packages/vscode)** - Visual Studio Code extension
- **[Shared Package](./packages/shared)** - Common utilities and logic

## CLI Installation & Usage

### Install
```bash
npm install -g sf-monitor
```

### Setup
```bash
# Authenticate with Salesforce CLI first
sf org login web

# Run setup
sf-monitor setup
```

### Usage
```bash
# Check current limits
sf-monitor status

# Monitor once and exit
sf-monitor monitor

# Monitor continuously 
sf-monitor monitor --continuous

# Monitor specific org
sf-monitor status --org my-sandbox
```

## VS Code Extension

### Installation
1. Download the `.vsix` file from releases
2. Install via VS Code: `Extensions > Install from VSIX`

### Features
- **Real-time Governor Limits View** in Explorer panel
- **Status Bar Indicator** showing current alert status
- **Automatic Monitoring** with configurable intervals
- **Rich Notifications** for limit breaches
- **Detailed Limit Views** with usage charts
- **Integration with Salesforce CLI** for authentication

### Commands
- `SF Monitor: Setup Org` - Configure org to monitor
- `SF Monitor: Refresh Limits` - Manually refresh limits
- `SF Monitor: Start Monitoring` - Begin continuous monitoring
- `SF Monitor: Stop Monitoring` - Stop monitoring

## What it monitors

- API request limits
- Data and file storage
- Email limits
- Processing limits (Apex, workflows)
- Platform events

## Development

### Prerequisites
- Node.js 18+
- Salesforce CLI (`sf` or `sfdx`)
- At least one authenticated Salesforce org

### Setup Development Environment
```bash
# Clone the repository
git clone https://github.com/thedhanawada/sf-monitor.git
cd sf-monitor

# Install dependencies
npm install

# Build all packages
npm run build
```

### CLI Development
```bash
# Run CLI in development
npm run cli:start

# Test CLI package
cd packages/cli
npm test
```

### VS Code Extension Development
```bash
# Compile extension
npm run vscode:compile

# Watch for changes
npm run vscode:watch

# Package extension
npm run vscode:package
```

## Architecture

### Shared Core
The `@sf-monitor/shared` package contains:
- **LimitsMonitor** - Core monitoring logic using jsforce
- **SFAuthManager** - Salesforce CLI integration
- **AlertManager** - Multi-channel alerting system

### CLI Package
- Command-line interface built with Commander.js
- Interactive setup with Inquirer.js
- Table formatting and colorized output
- Configuration management

### VS Code Extension
- TreeView provider for limits display
- Status bar integration
- Webview panels for detailed views
- VS Code settings integration
- Command palette commands

## Configuration

### CLI Configuration
Stored in `~/.sf-monitor/config.json`:
```json
{
  "defaultOrg": "my-org",
  "monitoringInterval": 30,
  "thresholds": {
    "warning": 80,
    "critical": 95
  }
}
```

### VS Code Configuration
Available in VS Code settings (`sfMonitor.*`):
- `sfMonitor.defaultOrg` - Default org to monitor
- `sfMonitor.monitoringInterval` - Monitoring interval in seconds
- `sfMonitor.warningThreshold` - Warning threshold percentage
- `sfMonitor.criticalThreshold` - Critical threshold percentage
- `sfMonitor.showStatusBar` - Show status bar indicator
- `sfMonitor.notifications` - Enable VS Code notifications

## Authentication

sf-monitor uses your existing Salesforce CLI authentication. No passwords or tokens stored locally.

## License

MIT License