# sf-monitor

Salesforce development observability platform. Real-time monitoring and deployment tracking for Salesforce orgs.

## Packages

- `packages/cli` - CLI tool for terminal-based monitoring
- `packages/vscode` - VS Code extension with UI components
- `packages/shared` - Core monitoring logic using jsforce and SF CLI integration

## Features

### Continuous Org Monitoring
- Real-time governor limits tracking via Salesforce Limits API
- Configurable polling intervals and alert thresholds
- Historical baseline comparison and trend analysis
- Multi-org support with SF CLI authentication integration

### Deployment Monitoring
- SF CLI command interception and real-time deployment tracking
- Metadata API polling for component deployment progress
- Resource usage delta monitoring during deployments
- Live deployment output capture and visualization

### VS Code Integration
- TreeView for org limits with status indicators
- Webview panels for detailed metrics and deployment dashboards
- Status bar integration and contextual notifications
- Command palette integration for all monitoring functions

## CLI Usage

```bash
npm install -g sf-monitor
sf org login web
sf-monitor setup
sf-monitor status
sf-monitor monitor --continuous
```

## VS Code Extension

Install from VS Code marketplace or package locally:

```bash
cd packages/vscode
npm run package-extension
code --install-extension dist/sf-monitor-vscode-*.vsix
```

Available commands:
- `SF Monitor: Setup Org` - Configure monitoring target
- `SF Monitor: Start Deployment Monitoring` - Monitor SF CLI deployments
- `SF Monitor: Show Deployment Panel` - Open deployment dashboard
- `SF Monitor: Refresh Limits` - Manual org limits refresh

## Technical Implementation

### Core Monitoring
- **Limits API**: `/services/data/v59.0/limits` endpoint polling
- **Authentication**: SF CLI token extraction via `sf org display --json`
- **Data Processing**: Real-time threshold analysis and alerting
- **Event System**: EventEmitter-based monitoring updates

### Deployment Tracking
- **Command Interception**: Child process wrapping of SF CLI commands
- **Metadata API**: `checkDeployStatus()` for deployment progress
- **Baseline Capture**: Pre-deployment org state snapshot
- **Delta Calculation**: Resource usage change tracking

### VS Code Architecture
- **Extension Host**: Node.js event loop integration
- **Webview Messaging**: Bidirectional communication for live updates
- **Configuration**: VS Code workspace settings integration
- **Context Management**: VS Code command enablement based on state

## Development

```bash
git clone https://github.com/thedhanawada/sf-monitor.git
cd sf-monitor
npm install
```

### CLI Development
```bash
npm run cli:start
```

### VS Code Extension Development
```bash
cd packages/vscode
code .
# F5 to launch Extension Development Host
```

### Package Structure
```
sf-monitor/
├── packages/
│   ├── shared/         # Core monitoring logic
│   │   ├── monitor.js      # Limits monitoring
│   │   ├── deploymentMonitor.js  # Deployment tracking
│   │   └── sfauth.js       # SF CLI integration
│   ├── cli/            # CLI interface
│   └── vscode/         # VS Code extension
│       ├── src/
│       │   ├── extension.js    # Main extension
│       │   ├── deploymentMonitorPanel.js  # Deployment UI
│       │   └── limitsTreeProvider.js      # TreeView data
│       └── out/        # Webpack compiled output
```

## Requirements

- Node.js 18+
- Salesforce CLI (`sf` or `sfdx`)
- Authenticated Salesforce org access

## License

MIT