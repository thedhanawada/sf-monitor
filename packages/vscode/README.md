# sf-monitor

Salesforce development observability platform for VS Code. Real-time org monitoring and deployment tracking.

## Core Functionality

### Org State Monitoring
- Salesforce Limits API polling (`/services/data/v59.0/limits`) with configurable intervals
- Real-time tracking of API quotas, storage limits, processing quotas, email limits
- Threshold-based alerting (configurable warning/critical percentages)
- Multi-org support via SF CLI authentication integration
- TreeView integration in VS Code Explorer with status indicators

### Deployment Monitoring
- SF CLI command interception using child process wrapping
- Real-time deployment progress via Metadata API `checkDeployStatus()`
- Baseline org state capture and resource usage delta calculation
- Live deployment output streaming in webview panel
- Component-level deployment tracking and progress visualization

### UI Components
- **TreeView**: Org limits categorized by status in Explorer panel
- **Status Bar**: Current monitoring state and alert indicators
- **Webview Panels**: Detailed limit metrics and deployment dashboards
- **Notifications**: Configurable alerts for threshold breaches

## Installation

Install from VS Code marketplace or package locally:

```bash
git clone https://github.com/thedhanawada/sf-monitor.git
cd sf-monitor/packages/vscode
npm run package-extension
code --install-extension dist/sf-monitor-vscode-*.vsix
```

## Commands

- `SF Monitor: Setup Org` - Configure target org for monitoring
- `SF Monitor: Start Deployment Monitoring` - Monitor SF CLI deployment commands
- `SF Monitor: Show Deployment Panel` - Open deployment dashboard webview
- `SF Monitor: Start/Stop Monitoring` - Control continuous org monitoring
- `SF Monitor: Refresh Limits` - Manual org state refresh

## Configuration

VS Code settings (`sfMonitor.*`):

```json
{
  "sfMonitor.defaultOrg": "myorg@company.com",
  "sfMonitor.monitoringInterval": 30,
  "sfMonitor.warningThreshold": 80,
  "sfMonitor.criticalThreshold": 95,
  "sfMonitor.showStatusBar": true,
  "sfMonitor.notifications": true,
  "sfMonitor.autoRefresh": true
}
```

## Technical Architecture

### Authentication
- SF CLI integration via `sf org display --target-org <org> --json`
- Token extraction and jsforce connection management
- No credential storage - uses existing SF CLI authentication

### Monitoring Engine
- EventEmitter-based architecture for real-time updates
- Configurable polling intervals with automatic threshold checking
- Historical baseline comparison for deployment delta tracking
- Webview messaging API for live UI updates

### Deployment Tracking
- Child process monitoring of SF CLI commands
- Metadata API integration for deployment status polling
- Real-time resource usage tracking during deployments
- Event-driven UI updates via webview messaging

## Monitored Metrics

**API Limits**: Daily API requests, async Apex executions, bulk API requests
**Storage**: Data storage (MB), file storage (MB)
**Email**: Mass email, single email quotas
**Processing**: Hourly time-based workflows, dashboard refreshes, report runs
**Platform Events**: Monthly platform events usage

## Requirements

- VS Code 1.74.0+
- Node.js 18+
- Salesforce CLI (`sf` or `sfdx`)
- Authenticated Salesforce org access

## Source Code

[GitHub Repository](https://github.com/thedhanawada/sf-monitor)