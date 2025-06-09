const vscode = require('vscode');

class NotificationManager {
    constructor() {
        this.lastAlertTime = new Map(); // Track last alert time per limit to avoid spam
        this.alertCooldown = 5 * 60 * 1000; // 5 minutes cooldown
    }

    showAlert(result) {
        if (!result.hasAlerts) {
            return;
        }

        const now = Date.now();
        const criticalLimits = result.alertLimits.filter(l => l.status === 'CRITICAL');
        const warningLimits = result.alertLimits.filter(l => l.status === 'WARNING');

        // Show critical alerts
        if (criticalLimits.length > 0) {
            this.showCriticalAlert(criticalLimits, now);
        }

        // Show warning alerts (less frequently)
        if (warningLimits.length > 0) {
            this.showWarningAlert(warningLimits, now);
        }
    }

    showCriticalAlert(limits, now) {
        const newCriticalLimits = limits.filter(limit => {
            const lastAlert = this.lastAlertTime.get(`critical_${limit.name}`);
            return !lastAlert || (now - lastAlert) > this.alertCooldown;
        });

        if (newCriticalLimits.length === 0) {
            return;
        }

        const message = newCriticalLimits.length === 1
            ? `🚨 CRITICAL: ${newCriticalLimits[0].name} at ${newCriticalLimits[0].percentage}%`
            : `🚨 CRITICAL: ${newCriticalLimits.length} limits need immediate attention`;

        vscode.window.showErrorMessage(message, 'View Details', 'Dismiss').then(selection => {
            if (selection === 'View Details') {
                vscode.commands.executeCommand('workbench.view.explorer');
                vscode.commands.executeCommand('sfMonitorLimits.focus');
            }
        });

        // Update last alert time
        newCriticalLimits.forEach(limit => {
            this.lastAlertTime.set(`critical_${limit.name}`, now);
        });
    }

    showWarningAlert(limits, now) {
        const newWarningLimits = limits.filter(limit => {
            const lastAlert = this.lastAlertTime.get(`warning_${limit.name}`);
            return !lastAlert || (now - lastAlert) > this.alertCooldown * 2; // Longer cooldown for warnings
        });

        if (newWarningLimits.length === 0) {
            return;
        }

        const message = newWarningLimits.length === 1
            ? `⚠️ WARNING: ${newWarningLimits[0].name} at ${newWarningLimits[0].percentage}%`
            : `⚠️ WARNING: ${newWarningLimits.length} limits approaching threshold`;

        vscode.window.showWarningMessage(message, 'View Details', 'Dismiss').then(selection => {
            if (selection === 'View Details') {
                vscode.commands.executeCommand('workbench.view.explorer');
                vscode.commands.executeCommand('sfMonitorLimits.focus');
            }
        });

        // Update last alert time
        newWarningLimits.forEach(limit => {
            this.lastAlertTime.set(`warning_${limit.name}`, now);
        });
    }

    showSuccessMessage(message) {
        vscode.window.showInformationMessage(`✅ ${message}`);
    }

    showErrorMessage(message) {
        vscode.window.showErrorMessage(`❌ ${message}`);
    }

    showSetupNotification() {
        vscode.window.showInformationMessage(
            'SF Monitor: No Salesforce org configured. Would you like to set one up?',
            'Setup Now',
            'Later'
        ).then(selection => {
            if (selection === 'Setup Now') {
                vscode.commands.executeCommand('sfMonitor.setup');
            }
        });
    }

    showMonitoringStarted(interval) {
        vscode.window.showInformationMessage(
            `🔄 SF Monitor: Started monitoring (${interval}s intervals)`,
            'Stop Monitoring'
        ).then(selection => {
            if (selection === 'Stop Monitoring') {
                vscode.commands.executeCommand('sfMonitor.stopMonitoring');
            }
        });
    }

    clearAlertHistory() {
        this.lastAlertTime.clear();
    }
}

module.exports = NotificationManager;