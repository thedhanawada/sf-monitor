# sf-monitor

Salesforce governor limits monitoring toolkit. CLI tool and VS Code extension.

## Packages

- `packages/cli` - npm package (`sf-monitor`)
- `packages/vscode` - VS Code extension 
- `packages/shared` - Common monitoring logic

## CLI Usage

```bash
npm install -g sf-monitor
sf org login web
sf-monitor setup
sf-monitor status
sf-monitor monitor --continuous
```

## VS Code Extension

Install `.vsix` from releases or:

```bash
cd packages/vscode
code .
# Press F5 to launch Extension Development Host
```

Commands: `SF Monitor: Setup Org`, `SF Monitor: Refresh Limits`

## Development

```bash
git clone https://github.com/thedhanawada/sf-monitor.git
cd sf-monitor
npm install
```

### CLI
```bash
npm run cli:start
```

### VS Code Extension  
```bash
cd packages/vscode
code .
# Press F5
```

## Architecture

- **Shared**: jsforce-based monitoring, SF CLI auth, alerting
- **CLI**: Commander.js interface, file-based config
- **VS Code**: TreeView, status bar, webview panels

Uses existing SF CLI authentication. Monitors API limits, storage, email, processing limits.

## License

MIT