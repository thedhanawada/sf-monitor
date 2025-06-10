const vscode = require('vscode');

class DeploymentDashboard {
    constructor() {
        this.panel = null;
        this.isActive = false;
        this.currentView = 'list'; // 'list' or 'detail'
        this.selectedDeploymentId = null;
        this.refreshInterval = null;
        this.deployments = [];
    }

    show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'sfMonitorDeploymentDashboard',
            'SF Monitor - Deployments',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        this.panel.webview.html = this.getHtml();
        
        this.panel.onDidDispose(() => {
            this.panel = null;
            this.isActive = false;
            this.stopAutoRefresh();
        });

        this.panel.webview.onDidReceiveMessage(message => {
            this.handleMessage(message);
        });

        this.isActive = true;
        this.startAutoRefresh();
    }

    hide() {
        if (this.panel) {
            this.panel.dispose();
        }
    }

    updateDeployments(deployments) {
        this.deployments = deployments;
        if (this.panel) {
            this.panel.webview.postMessage({
                type: 'deploymentsUpdate',
                data: deployments
            });
        }
    }

    updateSelectedDeployment(deploymentData) {
        if (this.panel && this.currentView === 'detail') {
            this.panel.webview.postMessage({
                type: 'deploymentDetailUpdate',
                data: deploymentData
            });
        }
    }

    setError(error) {
        if (this.panel) {
            this.panel.webview.postMessage({
                type: 'error',
                data: { message: error.message || error }
            });
        }
    }

    setLoading(isLoading) {
        if (this.panel) {
            this.panel.webview.postMessage({
                type: 'loading',
                data: { isLoading }
            });
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'ready':
                // Webview is ready, start fetching deployments
                vscode.commands.executeCommand('sfMonitor.refreshDeployments');
                break;
            case 'selectDeployment':
                this.selectedDeploymentId = message.data.deploymentId;
                this.currentView = 'detail';
                vscode.commands.executeCommand('sfMonitor.selectDeployment', message.data.deploymentId);
                break;
            case 'backToList':
                this.currentView = 'list';
                this.selectedDeploymentId = null;
                break;
            case 'refreshDeployments':
                vscode.commands.executeCommand('sfMonitor.refreshDeployments');
                break;
            case 'startNewDeployment':
                vscode.commands.executeCommand('sfMonitor.startDeploymentMonitoring');
                break;
        }
    }

    startAutoRefresh() {
        // Refresh deployments every 5 seconds
        this.refreshInterval = setInterval(() => {
            if (this.isActive) {
                vscode.commands.executeCommand('sfMonitor.refreshDeployments');
            }
        }, 5000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    getHtml() {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>SF Monitor - Deployment Dashboard</title>
                <style>
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }
                    
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        padding: 20px;
                        line-height: 1.5;
                    }
                    
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 24px;
                        padding-bottom: 16px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    
                    .header h1 {
                        font-size: 24px;
                        font-weight: 600;
                        margin: 0;
                    }
                    
                    .header-actions {
                        display: flex;
                        gap: 12px;
                    }
                    
                    .btn {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }
                    
                    .btn:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    
                    .btn-secondary {
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                    }
                    
                    .btn-secondary:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }
                    
                    .loading {
                        text-align: center;
                        padding: 60px 20px;
                        color: var(--vscode-descriptionForeground);
                    }
                    
                    .spinner {
                        border: 2px solid var(--vscode-progressBar-background);
                        border-top: 2px solid var(--vscode-progressBar-foreground);
                        border-radius: 50%;
                        width: 24px;
                        height: 24px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 16px;
                    }
                    
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    
                    .error {
                        background-color: var(--vscode-inputValidation-errorBackground);
                        border: 1px solid var(--vscode-inputValidation-errorBorder);
                        color: var(--vscode-inputValidation-errorForeground);
                        padding: 16px;
                        border-radius: 4px;
                        margin: 20px 0;
                    }
                    
                    .empty-state {
                        text-align: center;
                        padding: 60px 20px;
                        color: var(--vscode-descriptionForeground);
                    }
                    
                    .empty-state h3 {
                        font-size: 18px;
                        margin-bottom: 8px;
                        color: var(--vscode-foreground);
                    }
                    
                    .deployments-grid {
                        display: grid;
                        gap: 16px;
                        grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
                    }
                    
                    .deployment-card {
                        background-color: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 8px;
                        padding: 20px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        position: relative;
                    }
                    
                    .deployment-card:hover {
                        background-color: var(--vscode-list-hoverBackground);
                        border-color: var(--vscode-focusBorder);
                        transform: translateY(-1px);
                    }
                    
                    .deployment-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 16px;
                    }
                    
                    .deployment-id {
                        font-family: 'Courier New', monospace;
                        font-size: 13px;
                        color: var(--vscode-descriptionForeground);
                        background-color: var(--vscode-badge-background);
                        padding: 4px 8px;
                        border-radius: 4px;
                    }
                    
                    .deployment-status {
                        padding: 4px 12px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: bold;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    
                    .status-inprogress { background-color: #1976d2; color: white; }
                    .status-pending { background-color: #f57c00; color: white; }
                    .status-canceling { background-color: #d32f2f; color: white; }
                    .status-running { background-color: #388e3c; color: white; }
                    .status-completed { background-color: #4caf50; color: white; }
                    .status-failed { background-color: #f44336; color: white; }
                    
                    .deployment-info {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 16px;
                        margin-bottom: 16px;
                    }
                    
                    .deployment-meta {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }
                    
                    .meta-item {
                        display: flex;
                        justify-content: space-between;
                        font-size: 13px;
                    }
                    
                    .meta-label {
                        color: var(--vscode-descriptionForeground);
                    }
                    
                    .meta-value {
                        color: var(--vscode-foreground);
                        font-weight: 500;
                    }
                    
                    .deployment-progress {
                        margin-top: 16px;
                    }
                    
                    .progress-label {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 6px;
                        display: flex;
                        justify-content: space-between;
                    }
                    
                    .progress-bar {
                        width: 100%;
                        height: 6px;
                        background-color: var(--vscode-progressBar-background);
                        border-radius: 3px;
                        overflow: hidden;
                    }
                    
                    .progress-fill {
                        height: 100%;
                        background-color: var(--vscode-progressBar-foreground);
                        transition: width 0.3s ease;
                    }
                    
                    .validation-badge {
                        position: absolute;
                        top: 12px;
                        right: 12px;
                        background-color: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground);
                        padding: 2px 6px;
                        border-radius: 10px;
                        font-size: 10px;
                        font-weight: bold;
                    }
                    
                    .back-button {
                        margin-bottom: 20px;
                    }
                    
                    .deployment-detail {
                        background-color: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 8px;
                        padding: 24px;
                    }
                    
                    .detail-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 24px;
                        padding-bottom: 16px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    
                    .detail-id {
                        font-family: 'Courier New', monospace;
                        font-size: 16px;
                        color: var(--vscode-foreground);
                    }
                    
                    .metrics-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 16px;
                        margin-bottom: 24px;
                    }
                    
                    .metric-card {
                        background-color: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 6px;
                        padding: 16px;
                        text-align: center;
                    }
                    
                    .metric-value {
                        font-size: 24px;
                        font-weight: bold;
                        margin: 4px 0;
                        color: var(--vscode-foreground);
                    }
                    
                    .metric-label {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    
                    .hidden { display: none; }
                </style>
            </head>
            <body>
                <div id="list-view">
                    <div class="header">
                        <h1>Deployment Dashboard</h1>
                        <div class="header-actions">
                            <button class="btn btn-secondary" onclick="refreshDeployments()">
                                <span>🔄</span> Refresh
                            </button>
                            <button class="btn" onclick="startNewDeployment()">
                                <span>🚀</span> New Deployment
                            </button>
                        </div>
                    </div>
                    
                    <div id="loading" class="loading">
                        <div class="spinner"></div>
                        <div>Loading deployments...</div>
                    </div>
                    
                    <div id="error" class="error hidden"></div>
                    
                    <div id="empty-state" class="empty-state hidden">
                        <h3>No Active Deployments</h3>
                        <p>There are no deployments currently running in this org.</p>
                        <br>
                        <button class="btn" onclick="startNewDeployment()">
                            <span>🚀</span> Start New Deployment
                        </button>
                    </div>
                    
                    <div id="deployments-container" class="deployments-grid hidden"></div>
                </div>
                
                <div id="detail-view" class="hidden">
                    <div class="back-button">
                        <button class="btn btn-secondary" onclick="backToList()">
                            <span>←</span> Back to Deployments
                        </button>
                    </div>
                    
                    <div class="deployment-detail">
                        <div class="detail-header">
                            <div class="detail-id" id="detail-deployment-id">Loading...</div>
                            <div id="detail-status" class="deployment-status">-</div>
                        </div>
                        
                        <div class="metrics-grid">
                            <div class="metric-card">
                                <div class="metric-label">Components</div>
                                <div id="detail-components" class="metric-value">-</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-label">Tests</div>
                                <div id="detail-tests" class="metric-value">-</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-label">Duration</div>
                                <div id="detail-duration" class="metric-value">-</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-label">Created By</div>
                                <div id="detail-created-by" class="metric-value">-</div>
                            </div>
                        </div>
                        
                        <div class="deployment-progress">
                            <div class="progress-label">
                                <span>Component Progress</span>
                                <span id="detail-progress-text">-</span>
                            </div>
                            <div class="progress-bar">
                                <div id="detail-progress-fill" class="progress-fill" style="width: 0%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    let currentView = 'list';
                    let deployments = [];
                    
                    // Notify VS Code that webview is ready
                    vscode.postMessage({ type: 'ready' });
                    
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        switch (message.type) {
                            case 'deploymentsUpdate':
                                handleDeploymentsUpdate(message.data);
                                break;
                            case 'deploymentDetailUpdate':
                                handleDeploymentDetailUpdate(message.data);
                                break;
                            case 'loading':
                                handleLoading(message.data.isLoading);
                                break;
                            case 'error':
                                handleError(message.data.message);
                                break;
                        }
                    });
                    
                    function handleDeploymentsUpdate(data) {
                        deployments = data;
                        hideLoading();
                        hideError();
                        renderDeploymentsList();
                    }
                    
                    function handleDeploymentDetailUpdate(data) {
                        if (currentView === 'detail') {
                            renderDeploymentDetail(data);
                        }
                    }
                    
                    function handleLoading(isLoading) {
                        if (isLoading) {
                            showLoading();
                        } else {
                            hideLoading();
                        }
                    }
                    
                    function handleError(message) {
                        hideLoading();
                        showError(message);
                    }
                    
                    function renderDeploymentsList() {
                        const container = document.getElementById('deployments-container');
                        const emptyState = document.getElementById('empty-state');
                        
                        if (deployments.length === 0) {
                            container.classList.add('hidden');
                            emptyState.classList.remove('hidden');
                            return;
                        }
                        
                        emptyState.classList.add('hidden');
                        container.classList.remove('hidden');
                        
                        container.innerHTML = deployments.map(deployment => createDeploymentCard(deployment)).join('');
                    }
                    
                    function createDeploymentCard(deployment) {
                        const progress = deployment.numberComponentsTotal > 0 
                            ? (deployment.numberComponentsDeployed / deployment.numberComponentsTotal) * 100 
                            : 0;
                        
                        const statusClass = 'status-' + (deployment.status || deployment.state || 'unknown').toLowerCase();
                        
                        return \`
                            <div class="deployment-card" onclick="selectDeployment('\${deployment.id}')">
                                \${deployment.isCheckOnly ? '<div class="validation-badge">VALIDATION</div>' : ''}
                                
                                <div class="deployment-header">
                                    <div class="deployment-id">\${deployment.id}</div>
                                    <div class="deployment-status \${statusClass}">
                                        \${deployment.status || deployment.state || 'Unknown'}
                                    </div>
                                </div>
                                
                                <div class="deployment-info">
                                    <div class="deployment-meta">
                                        <div class="meta-item">
                                            <span class="meta-label">Created By</span>
                                            <span class="meta-value">\${deployment.createdBy || 'Unknown'}</span>
                                        </div>
                                        <div class="meta-item">
                                            <span class="meta-label">Duration</span>
                                            <span class="meta-value">\${deployment.duration || '-'}</span>
                                        </div>
                                    </div>
                                    <div class="deployment-meta">
                                        <div class="meta-item">
                                            <span class="meta-label">Components</span>
                                            <span class="meta-value">\${deployment.numberComponentsDeployed || 0}/\${deployment.numberComponentsTotal || 0}</span>
                                        </div>
                                        <div class="meta-item">
                                            <span class="meta-label">Tests</span>
                                            <span class="meta-value">\${deployment.numberTestsCompleted || 0}/\${deployment.numberTestsTotal || 0}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="deployment-progress">
                                    <div class="progress-label">
                                        <span>Progress</span>
                                        <span>\${Math.round(progress)}%</span>
                                    </div>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: \${progress}%"></div>
                                    </div>
                                </div>
                            </div>
                        \`;
                    }
                    
                    function renderDeploymentDetail(deployment) {
                        document.getElementById('detail-deployment-id').textContent = deployment.id;
                        document.getElementById('detail-status').textContent = deployment.status || deployment.state || 'Unknown';
                        document.getElementById('detail-status').className = 'deployment-status status-' + (deployment.status || deployment.state || 'unknown').toLowerCase();
                        document.getElementById('detail-components').textContent = \`\${deployment.numberComponentsDeployed || 0}/\${deployment.numberComponentsTotal || 0}\`;
                        document.getElementById('detail-tests').textContent = \`\${deployment.numberTestsCompleted || 0}/\${deployment.numberTestsTotal || 0}\`;
                        document.getElementById('detail-duration').textContent = deployment.duration || '-';
                        document.getElementById('detail-created-by').textContent = deployment.createdBy || 'Unknown';
                        
                        const progress = deployment.numberComponentsTotal > 0 
                            ? (deployment.numberComponentsDeployed / deployment.numberComponentsTotal) * 100 
                            : 0;
                        document.getElementById('detail-progress-text').textContent = \`\${Math.round(progress)}%\`;
                        document.getElementById('detail-progress-fill').style.width = progress + '%';
                    }
                    
                    function selectDeployment(deploymentId) {
                        currentView = 'detail';
                        document.getElementById('list-view').classList.add('hidden');
                        document.getElementById('detail-view').classList.remove('hidden');
                        
                        vscode.postMessage({ 
                            type: 'selectDeployment', 
                            data: { deploymentId } 
                        });
                    }
                    
                    function backToList() {
                        currentView = 'list';
                        document.getElementById('detail-view').classList.add('hidden');
                        document.getElementById('list-view').classList.remove('hidden');
                        
                        vscode.postMessage({ type: 'backToList' });
                    }
                    
                    function refreshDeployments() {
                        vscode.postMessage({ type: 'refreshDeployments' });
                    }
                    
                    function startNewDeployment() {
                        vscode.postMessage({ type: 'startNewDeployment' });
                    }
                    
                    function showLoading() {
                        document.getElementById('loading').classList.remove('hidden');
                        document.getElementById('deployments-container').classList.add('hidden');
                        document.getElementById('empty-state').classList.add('hidden');
                    }
                    
                    function hideLoading() {
                        document.getElementById('loading').classList.add('hidden');
                    }
                    
                    function showError(message) {
                        const errorEl = document.getElementById('error');
                        errorEl.textContent = message;
                        errorEl.classList.remove('hidden');
                        document.getElementById('deployments-container').classList.add('hidden');
                        document.getElementById('empty-state').classList.add('hidden');
                    }
                    
                    function hideError() {
                        document.getElementById('error').classList.add('hidden');
                    }
                </script>
            </body>
            </html>
        `;
    }
}

module.exports = DeploymentDashboard;