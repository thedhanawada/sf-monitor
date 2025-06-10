const vscode = require('vscode');

class DeploymentMonitorPanel {
    constructor() {
        this.panel = null;
        this.isActive = false;
        this.deploymentData = null;
    }

    show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'sfMonitorDeployment',
            'SF Monitor - Deployment',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        this.panel.webview.html = this.getInitialHtml();
        
        this.panel.onDidDispose(() => {
            this.panel = null;
            this.isActive = false;
        });

        this.panel.webview.onDidReceiveMessage(message => {
            this.handleMessage(message);
        });

        this.isActive = true;
    }

    hide() {
        if (this.panel) {
            this.panel.dispose();
        }
    }

    updateDeploymentData(data) {
        this.deploymentData = data;
        if (this.panel) {
            this.panel.webview.postMessage({
                type: 'deploymentUpdate',
                data: data
            });
        }
    }

    setDeploymentStarted(data) {
        if (this.panel) {
            this.panel.webview.postMessage({
                type: 'deploymentStarted',
                data: data
            });
        }
    }

    setDeploymentCompleted(data) {
        if (this.panel) {
            this.panel.webview.postMessage({
                type: 'deploymentCompleted',
                data: data
            });
        }
    }

    setDeploymentFailed(data) {
        if (this.panel) {
            this.panel.webview.postMessage({
                type: 'deploymentFailed',
                data: data
            });
        }
    }

    addOutputLine(data) {
        if (this.panel) {
            this.panel.webview.postMessage({
                type: 'outputLine',
                data: data
            });
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'ready':
                // Webview is ready, send any pending data
                if (this.deploymentData) {
                    this.updateDeploymentData(this.deploymentData);
                }
                break;
            case 'stopDeployment':
                vscode.commands.executeCommand('sfMonitor.stopDeployment');
                break;
        }
    }

    getInitialHtml() {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>SF Monitor - Deployment</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        padding: 20px;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        margin: 0;
                    }
                    
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 15px;
                        margin-bottom: 20px;
                    }
                    
                    .status-badge {
                        padding: 4px 12px;
                        border-radius: 4px;
                        font-weight: bold;
                        font-size: 12px;
                        text-transform: uppercase;
                    }
                    
                    .status-running { background-color: #1976d2; color: white; }
                    .status-completed { background-color: #388e3c; color: white; }
                    .status-failed { background-color: #d32f2f; color: white; }
                    .status-waiting { background-color: #f57c00; color: white; }
                    
                    .deployment-info {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    
                    .info-card {
                        background-color: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 6px;
                        padding: 15px;
                    }
                    
                    .info-card h3 {
                        margin: 0 0 10px 0;
                        font-size: 14px;
                        color: var(--vscode-descriptionForeground);
                    }
                    
                    .progress-section {
                        margin-bottom: 30px;
                    }
                    
                    .progress-bar {
                        width: 100%;
                        height: 8px;
                        background-color: var(--vscode-progressBar-background);
                        border-radius: 4px;
                        overflow: hidden;
                        margin: 10px 0;
                    }
                    
                    .progress-fill {
                        height: 100%;
                        background-color: var(--vscode-progressBar-foreground);
                        transition: width 0.3s ease;
                        width: 0%;
                    }
                    
                    .metrics-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 15px;
                        margin-bottom: 30px;
                    }
                    
                    .metric-card {
                        background-color: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 6px;
                        padding: 15px;
                        text-align: center;
                    }
                    
                    .metric-value {
                        font-size: 24px;
                        font-weight: bold;
                        margin: 5px 0;
                    }
                    
                    .metric-label {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        text-transform: uppercase;
                    }
                    
                    .metric-delta {
                        font-size: 12px;
                        margin-top: 5px;
                    }
                    
                    .delta-positive { color: #f44336; }
                    .delta-negative { color: #4caf50; }
                    .delta-neutral { color: var(--vscode-descriptionForeground); }
                    
                    .output-section {
                        margin-top: 30px;
                    }
                    
                    .output-container {
                        background-color: var(--vscode-terminal-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 4px;
                        max-height: 300px;
                        overflow-y: auto;
                        font-family: 'Courier New', monospace;
                        font-size: 12px;
                        padding: 10px;
                    }
                    
                    .output-line {
                        margin: 2px 0;
                        white-space: pre-wrap;
                    }
                    
                    .output-stdout { color: var(--vscode-terminal-foreground); }
                    .output-stderr { color: #f44336; }
                    
                    .loading {
                        text-align: center;
                        padding: 40px;
                        color: var(--vscode-descriptionForeground);
                    }
                    
                    .spinner {
                        border: 2px solid var(--vscode-progressBar-background);
                        border-top: 2px solid var(--vscode-progressBar-foreground);
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 10px;
                    }
                    
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    
                    .actions {
                        margin-top: 20px;
                        text-align: center;
                    }
                    
                    .btn {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                    }
                    
                    .btn:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    
                    .btn-danger {
                        background-color: #d32f2f;
                        color: white;
                    }
                    
                    .btn-danger:hover {
                        background-color: #b71c1c;
                    }
                </style>
            </head>
            <body>
                <div id="loading" class="loading">
                    <div class="spinner"></div>
                    <div>Waiting for deployment to start...</div>
                </div>
                
                <div id="content" style="display: none;">
                    <div class="header">
                        <h1>Deployment Monitor</h1>
                        <div id="status-badge" class="status-badge status-waiting">Waiting</div>
                    </div>
                    
                    <div class="deployment-info">
                        <div class="info-card">
                            <h3>Deployment Details</h3>
                            <div><strong>ID:</strong> <span id="deployment-id">-</span></div>
                            <div><strong>Started:</strong> <span id="deployment-started">-</span></div>
                            <div><strong>Duration:</strong> <span id="deployment-duration">-</span></div>
                        </div>
                        
                        <div class="info-card">
                            <h3>Component Progress</h3>
                            <div id="component-progress">
                                <div class="progress-bar">
                                    <div id="component-progress-fill" class="progress-fill"></div>
                                </div>
                                <div><span id="components-deployed">0</span> / <span id="components-total">0</span> components</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <div class="metric-label">API Calls</div>
                            <div id="api-used" class="metric-value">-</div>
                            <div id="api-delta" class="metric-delta">-</div>
                        </div>
                        
                        <div class="metric-card">
                            <div class="metric-label">Async Executions</div>
                            <div id="async-used" class="metric-value">-</div>
                            <div id="async-delta" class="metric-delta">-</div>
                        </div>
                        
                        <div class="metric-card">
                            <div class="metric-label">Data Storage</div>
                            <div id="storage-used" class="metric-value">-</div>
                            <div id="storage-delta" class="metric-delta">-</div>
                        </div>
                        
                        <div class="metric-card">
                            <div class="metric-label">File Storage</div>
                            <div id="file-used" class="metric-value">-</div>
                            <div id="file-delta" class="metric-delta">-</div>
                        </div>
                    </div>
                    
                    <div class="output-section">
                        <h3>Deployment Output</h3>
                        <div id="output-container" class="output-container"></div>
                    </div>
                    
                    <div class="actions">
                        <button id="stop-btn" class="btn btn-danger" onclick="stopDeployment()" style="display: none;">
                            Stop Deployment
                        </button>
                    </div>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    let deploymentStartTime = null;
                    let durationInterval = null;
                    
                    // Notify VS Code that webview is ready
                    vscode.postMessage({ type: 'ready' });
                    
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        switch (message.type) {
                            case 'deploymentStarted':
                                handleDeploymentStarted(message.data);
                                break;
                            case 'deploymentUpdate':
                                handleDeploymentUpdate(message.data);
                                break;
                            case 'deploymentCompleted':
                                handleDeploymentCompleted(message.data);
                                break;
                            case 'deploymentFailed':
                                handleDeploymentFailed(message.data);
                                break;
                            case 'outputLine':
                                addOutputLine(message.data);
                                break;
                        }
                    });
                    
                    function handleDeploymentStarted(data) {
                        document.getElementById('loading').style.display = 'none';
                        document.getElementById('content').style.display = 'block';
                        
                        updateStatus('running', 'In Progress');
                        deploymentStartTime = new Date();
                        
                        if (data.deploymentId) {
                            document.getElementById('deployment-id').textContent = data.deploymentId;
                        }
                        
                        document.getElementById('deployment-started').textContent = deploymentStartTime.toLocaleTimeString();
                        document.getElementById('stop-btn').style.display = 'inline-block';
                        
                        startDurationTimer();
                    }
                    
                    function handleDeploymentUpdate(data) {
                        // Update deployment status
                        if (data.deploymentStatus) {
                            updateComponentProgress(data.deploymentStatus);
                        }
                        
                        // Update metrics
                        if (data.currentLimits) {
                            updateMetrics(data.currentLimits, data.deltas);
                        }
                    }
                    
                    function handleDeploymentCompleted(data) {
                        updateStatus('completed', 'Completed');
                        document.getElementById('stop-btn').style.display = 'none';
                        stopDurationTimer();
                    }
                    
                    function handleDeploymentFailed(data) {
                        updateStatus('failed', 'Failed');
                        document.getElementById('stop-btn').style.display = 'none';
                        stopDurationTimer();
                    }
                    
                    function updateStatus(status, text) {
                        const badge = document.getElementById('status-badge');
                        badge.className = 'status-badge status-' + status;
                        badge.textContent = text;
                    }
                    
                    function updateComponentProgress(deploymentStatus) {
                        const deployed = deploymentStatus.numberComponentsDeployed || 0;
                        const total = deploymentStatus.numberComponentsTotal || 0;
                        const percentage = total > 0 ? (deployed / total) * 100 : 0;
                        
                        document.getElementById('components-deployed').textContent = deployed;
                        document.getElementById('components-total').textContent = total;
                        document.getElementById('component-progress-fill').style.width = percentage + '%';
                    }
                    
                    function updateMetrics(limits, deltas) {
                        updateMetric('api', 'DailyApiRequests', limits, deltas);
                        updateMetric('async', 'DailyAsyncApexExecutions', limits, deltas);
                        updateMetric('storage', 'DataStorageMB', limits, deltas);
                        updateMetric('file', 'FileStorageMB', limits, deltas);
                    }
                    
                    function updateMetric(elementPrefix, limitName, limits, deltas) {
                        const limit = limits[limitName];
                        const delta = deltas && deltas[limitName];
                        
                        if (limit) {
                            document.getElementById(elementPrefix + '-used').textContent = 
                                formatNumber(limit.used) + ' (' + limit.percentage.toFixed(1) + '%)';
                        }
                        
                        if (delta) {
                            const deltaElement = document.getElementById(elementPrefix + '-delta');
                            const deltaValue = delta.usedDelta;
                            const deltaText = deltaValue > 0 ? '+' + formatNumber(deltaValue) : 
                                            deltaValue < 0 ? formatNumber(deltaValue) : '0';
                            
                            deltaElement.textContent = deltaText + ' from baseline';
                            deltaElement.className = 'metric-delta ' + 
                                (deltaValue > 0 ? 'delta-positive' : 
                                 deltaValue < 0 ? 'delta-negative' : 'delta-neutral');
                        }
                    }
                    
                    function addOutputLine(data) {
                        const container = document.getElementById('output-container');
                        const line = document.createElement('div');
                        line.className = 'output-line output-' + data.type;
                        line.textContent = data.data;
                        container.appendChild(line);
                        container.scrollTop = container.scrollHeight;
                    }
                    
                    function startDurationTimer() {
                        durationInterval = setInterval(() => {
                            if (deploymentStartTime) {
                                const duration = new Date() - deploymentStartTime;
                                const seconds = Math.floor(duration / 1000);
                                const minutes = Math.floor(seconds / 60);
                                const remainingSeconds = seconds % 60;
                                
                                document.getElementById('deployment-duration').textContent = 
                                    minutes + ':' + remainingSeconds.toString().padStart(2, '0');
                            }
                        }, 1000);
                    }
                    
                    function stopDurationTimer() {
                        if (durationInterval) {
                            clearInterval(durationInterval);
                            durationInterval = null;
                        }
                    }
                    
                    function formatNumber(num) {
                        return new Intl.NumberFormat().format(num);
                    }
                    
                    function stopDeployment() {
                        vscode.postMessage({ type: 'stopDeployment' });
                    }
                </script>
            </body>
            </html>
        `;
    }
}

module.exports = DeploymentMonitorPanel;