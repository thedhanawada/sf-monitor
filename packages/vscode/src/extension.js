const vscode = require('vscode');
const { LimitsMonitor, SFAuthManager } = require('@sf-monitor/shared');
const LimitsTreeProvider = require('./limitsTreeProvider');
const StatusBarManager = require('./statusBarManager');
const NotificationManager = require('./notificationManager');

let limitsTreeProvider;
let statusBarManager;
let notificationManager;
let monitor;
let sfAuth;
let monitoringInterval;

function activate(context) {
    console.log('SF Monitor extension is now active');

    // Initialize components
    monitor = new LimitsMonitor();
    sfAuth = new SFAuthManager();
    limitsTreeProvider = new LimitsTreeProvider();
    statusBarManager = new StatusBarManager();
    notificationManager = new NotificationManager();

    // Register tree data provider
    vscode.window.createTreeView('sfMonitorLimits', {
        treeDataProvider: limitsTreeProvider,
        showCollapseAll: true
    });

    // Set context for when extension is initialized
    vscode.commands.executeCommand('setContext', 'sfMonitor.initialized', true);
    vscode.commands.executeCommand('setContext', 'sfMonitor.monitoring', false);

    // Register commands
    const commands = [
        vscode.commands.registerCommand('sfMonitor.refresh', refreshLimits),
        vscode.commands.registerCommand('sfMonitor.setup', setupOrg),
        vscode.commands.registerCommand('sfMonitor.startMonitoring', startMonitoring),
        vscode.commands.registerCommand('sfMonitor.stopMonitoring', stopMonitoring),
        vscode.commands.registerCommand('sfMonitor.viewLimit', viewLimitDetails),
        vscode.commands.registerCommand('sfMonitor.openSettings', openSettings)
    ];

    // Register event listeners
    const listeners = [
        vscode.workspace.onDidChangeConfiguration(onConfigurationChanged),
        vscode.workspace.onDidSaveTextDocument(onDocumentSaved)
    ];

    // Add all disposables to context
    context.subscriptions.push(...commands, ...listeners);

    // Initialize status bar
    statusBarManager.show();

    // Auto-setup if default org is configured
    initializeExtension();
}

async function initializeExtension() {
    try {
        const config = vscode.workspace.getConfiguration('sfMonitor');
        const defaultOrg = config.get('defaultOrg');
        
        if (defaultOrg) {
            await refreshLimits();
        } else {
            limitsTreeProvider.setMessage('No org configured. Run "SF Monitor: Setup Org" to get started.');
        }
    } catch (error) {
        console.error('Failed to initialize SF Monitor:', error);
        limitsTreeProvider.setMessage('Failed to initialize. Check your Salesforce CLI authentication.');
        vscode.window.showErrorMessage(`SF Monitor initialization failed: ${error.message}`);
    }
}

async function refreshLimits() {
    try {
        limitsTreeProvider.setLoading(true);
        statusBarManager.setStatus('loading', 'Fetching limits...');

        const config = vscode.workspace.getConfiguration('sfMonitor');
        const defaultOrg = config.get('defaultOrg');

        if (!defaultOrg) {
            throw new Error('No default org configured. Run setup first.');
        }

        // Get org info and check limits
        const orgInfo = await sfAuth.getOrgInfo(defaultOrg);
        const result = await monitor.checkLimits(orgInfo);

        // Update UI
        limitsTreeProvider.setLimits(result.limits);
        statusBarManager.setStatus(result.severity, `${result.alertLimits.length} alerts`);

        // Show notifications for new alerts
        if (result.hasAlerts && config.get('notifications')) {
            notificationManager.showAlert(result);
        }

        vscode.window.showInformationMessage(`Limits refreshed for ${orgInfo.username}`);

    } catch (error) {
        console.error('Failed to refresh limits:', error);
        limitsTreeProvider.setMessage(`Error: ${error.message}`);
        statusBarManager.setStatus('error', 'Failed to fetch');
        vscode.window.showErrorMessage(`Failed to refresh limits: ${error.message}`);
    } finally {
        limitsTreeProvider.setLoading(false);
    }
}

async function setupOrg() {
    try {
        // Get authenticated orgs
        const orgs = await sfAuth.getAuthenticatedOrgs();

        if (orgs.length === 0) {
            const loginInstructions = sfAuth.getLoginInstructions();
            vscode.window.showWarningMessage(
                'No authenticated Salesforce orgs found. Please authenticate first using SF CLI.',
                'Show Instructions'
            ).then(selection => {
                if (selection === 'Show Instructions') {
                    vscode.window.showInformationMessage(
                        `Production: ${loginInstructions.production}\\nSandbox: ${loginInstructions.sandbox}`
                    );
                }
            });
            return;
        }

        // Show org picker
        const orgItems = orgs.map(org => ({
            label: org.alias || org.username,
            description: org.username,
            detail: org.instanceUrl,
            org: org
        }));

        const selectedOrg = await vscode.window.showQuickPick(orgItems, {
            placeHolder: 'Select a Salesforce org to monitor',
            ignoreFocusOut: true
        });

        if (!selectedOrg) {
            return;
        }

        // Update configuration
        const config = vscode.workspace.getConfiguration('sfMonitor');
        await config.update('defaultOrg', selectedOrg.org.alias || selectedOrg.org.username, 
                           vscode.ConfigurationTarget.Global);

        vscode.window.showInformationMessage(`Selected org: ${selectedOrg.label}`);
        
        // Refresh limits for new org
        await refreshLimits();

    } catch (error) {
        console.error('Setup failed:', error);
        vscode.window.showErrorMessage(`Setup failed: ${error.message}`);
    }
}

async function startMonitoring() {
    try {
        const config = vscode.workspace.getConfiguration('sfMonitor');
        const interval = config.get('monitoringInterval', 30) * 1000; // Convert to milliseconds

        monitoringInterval = setInterval(async () => {
            await refreshLimits();
        }, interval);

        vscode.commands.executeCommand('setContext', 'sfMonitor.monitoring', true);
        statusBarManager.setMonitoring(true);
        vscode.window.showInformationMessage(`Monitoring started (${interval/1000}s intervals)`);

    } catch (error) {
        console.error('Failed to start monitoring:', error);
        vscode.window.showErrorMessage(`Failed to start monitoring: ${error.message}`);
    }
}

function stopMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }

    vscode.commands.executeCommand('setContext', 'sfMonitor.monitoring', false);
    statusBarManager.setMonitoring(false);
    vscode.window.showInformationMessage('Monitoring stopped');
}

async function viewLimitDetails(limit) {
    if (!limit) {
        return;
    }

    const panel = vscode.window.createWebviewPanel(
        'sfMonitorLimitDetails',
        `SF Monitor - ${limit.name}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    panel.webview.html = generateLimitDetailsHtml(limit);
}

function generateLimitDetailsHtml(limit) {
    const statusColor = limit.status === 'CRITICAL' ? '#dc3545' : 
                       limit.status === 'WARNING' ? '#ffc107' : '#28a745';

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${limit.name} Details</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .header {
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 20px;
                    margin-bottom: 20px;
                }
                .status-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-weight: bold;
                    color: white;
                    background-color: ${statusColor};
                }
                .metric {
                    margin: 15px 0;
                    padding: 15px;
                    background-color: var(--vscode-input-background);
                    border-radius: 4px;
                }
                .metric-label {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .progress-bar {
                    width: 100%;
                    height: 20px;
                    background-color: var(--vscode-progressBar-background);
                    border-radius: 10px;
                    overflow: hidden;
                    margin: 10px 0;
                }
                .progress-fill {
                    height: 100%;
                    background-color: ${statusColor};
                    width: ${limit.percentage}%;
                    transition: width 0.3s ease;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${limit.name}</h1>
                <span class="status-badge">${limit.status}</span>
            </div>
            
            <div class="metric">
                <div class="metric-label">Usage Percentage</div>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
                <div>${limit.percentage}%</div>
            </div>
            
            <div class="metric">
                <div class="metric-label">Used</div>
                <div>${limit.used.toLocaleString()}</div>
            </div>
            
            <div class="metric">
                <div class="metric-label">Maximum</div>
                <div>${limit.max.toLocaleString()}</div>
            </div>
            
            <div class="metric">
                <div class="metric-label">Remaining</div>
                <div>${limit.remaining?.toLocaleString() || 'N/A'}</div>
            </div>
        </body>
        </html>
    `;
}

function openSettings() {
    vscode.commands.executeCommand('workbench.action.openSettings', 'sfMonitor');
}

function onConfigurationChanged(event) {
    if (event.affectsConfiguration('sfMonitor')) {
        // Restart monitoring with new settings if it's currently running
        if (monitoringInterval) {
            stopMonitoring();
            startMonitoring();
        }
        
        // Update status bar visibility
        const config = vscode.workspace.getConfiguration('sfMonitor');
        if (config.get('showStatusBar')) {
            statusBarManager.show();
        } else {
            statusBarManager.hide();
        }
    }
}

async function onDocumentSaved(document) {
    const config = vscode.workspace.getConfiguration('sfMonitor');
    if (config.get('autoRefresh') && document.languageId === 'apex') {
        await refreshLimits();
    }
}

function deactivate() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }
    statusBarManager.dispose();
}

module.exports = {
    activate,
    deactivate
};