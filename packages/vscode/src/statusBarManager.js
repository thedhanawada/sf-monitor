const vscode = require('vscode');

class StatusBarManager {
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left, 
            100
        );
        this.statusBarItem.command = 'sfMonitor.refresh';
        this.isMonitoring = false;
    }

    show() {
        this.statusBarItem.show();
        this.updateDisplay();
    }

    hide() {
        this.statusBarItem.hide();
    }

    setStatus(severity, message) {
        this.severity = severity;
        this.message = message;
        this.updateDisplay();
    }

    setMonitoring(monitoring) {
        this.isMonitoring = monitoring;
        this.updateDisplay();
    }

    updateDisplay() {
        if (!this.statusBarItem) return;

        let icon = '$(shield)';
        let text = 'SF Monitor';
        let color = undefined;
        let backgroundColor = undefined;

        // Set icon and color based on severity
        switch (this.severity) {
            case 'critical':
                icon = '$(error)';
                color = new vscode.ThemeColor('errorForeground');
                backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                break;
            case 'warning':
                icon = '$(warning)';
                color = new vscode.ThemeColor('problemsWarningIcon.foreground');
                backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                break;
            case 'loading':
                icon = '$(loading~spin)';
                break;
            case 'error':
                icon = '$(x)';
                color = new vscode.ThemeColor('errorForeground');
                break;
            case 'info':
            default:
                icon = '$(shield)';
                break;
        }

        // Add monitoring indicator
        if (this.isMonitoring) {
            icon += '$(pulse)';
        }

        // Build the text
        if (this.message) {
            text = `${icon} ${this.message}`;
        } else {
            text = `${icon} SF Monitor`;
        }

        this.statusBarItem.text = text;
        this.statusBarItem.color = color;
        this.statusBarItem.backgroundColor = backgroundColor;
        
        // Update tooltip
        let tooltip = 'Salesforce Governor Limits Monitor';
        if (this.isMonitoring) {
            tooltip += ' (Monitoring Active)';
        }
        if (this.message) {
            tooltip += `\\n${this.message}`;
        }
        tooltip += '\\n\\nClick to refresh limits';
        
        this.statusBarItem.tooltip = tooltip;
    }

    dispose() {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
        }
    }
}

module.exports = StatusBarManager;