const vscode = require('vscode');

class LimitsTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.limits = [];
        this.isLoading = false;
        this.message = null;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    setLimits(limits) {
        this.limits = limits || [];
        this.message = null;
        this.refresh();
    }

    setLoading(loading) {
        this.isLoading = loading;
        this.refresh();
    }

    setMessage(message) {
        this.message = message;
        this.limits = [];
        this.refresh();
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (this.message) {
            return [new LimitTreeItem(this.message, 'message', vscode.TreeItemCollapsibleState.None)];
        }

        if (this.isLoading) {
            return [new LimitTreeItem('Loading limits...', 'loading', vscode.TreeItemCollapsibleState.None)];
        }

        if (!element) {
            // Root level - return limit categories
            if (this.limits.length === 0) {
                return [new LimitTreeItem('No limits data', 'empty', vscode.TreeItemCollapsibleState.None)];
            }

            // Group limits by status
            const critical = this.limits.filter(l => l.status === 'CRITICAL');
            const warning = this.limits.filter(l => l.status === 'WARNING');
            const ok = this.limits.filter(l => l.status === 'OK');

            const categories = [];

            if (critical.length > 0) {
                categories.push(new CategoryTreeItem('Critical', critical, 'critical'));
            }
            if (warning.length > 0) {
                categories.push(new CategoryTreeItem('Warning', warning, 'warning'));
            }
            if (ok.length > 0) {
                categories.push(new CategoryTreeItem('OK', ok, 'ok'));
            }

            return categories;
        }

        if (element.contextValue === 'category') {
            // Return limits in this category
            return element.limits.map(limit => new LimitTreeItem(
                `${limit.name} (${limit.percentage}%)`,
                'limit',
                vscode.TreeItemCollapsibleState.None,
                limit
            ));
        }

        return [];
    }
}

class CategoryTreeItem extends vscode.TreeItem {
    constructor(label, limits, status) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.limits = limits;
        this.contextValue = 'category';
        this.description = `${limits.length} item${limits.length !== 1 ? 's' : ''}`;
        
        // Set icon based on status
        switch (status) {
            case 'critical':
                this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
                break;
            case 'warning':
                this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'));
                break;
            case 'ok':
                this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('terminal.ansiGreen'));
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('circle-outline');
        }
    }
}

class LimitTreeItem extends vscode.TreeItem {
    constructor(label, contextValue, collapsibleState, limit = null) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
        this.limit = limit;

        if (limit) {
            this.description = `${limit.used.toLocaleString()} / ${limit.max.toLocaleString()}`;
            this.tooltip = this.generateTooltip(limit);
            
            // Set icon and color based on status
            switch (limit.status) {
                case 'CRITICAL':
                    this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
                    break;
                case 'WARNING':
                    this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'));
                    break;
                case 'OK':
                    this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('terminal.ansiGreen'));
                    break;
                default:
                    this.iconPath = new vscode.ThemeIcon('circle-outline');
            }

            // Enable click to view details
            this.command = {
                command: 'sfMonitor.viewLimit',
                title: 'View Details',
                arguments: [limit]
            };
        } else if (contextValue === 'loading') {
            this.iconPath = new vscode.ThemeIcon('loading~spin');
        } else if (contextValue === 'message' || contextValue === 'empty') {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }

    generateTooltip(limit) {
        return new vscode.MarkdownString(
            `**${limit.name}**\\n\\n` +
            `Status: **${limit.status}**\\n` +
            `Usage: **${limit.percentage}%**\\n` +
            `Used: ${limit.used.toLocaleString()}\\n` +
            `Max: ${limit.max.toLocaleString()}\\n` +
            `Remaining: ${limit.remaining?.toLocaleString() || 'N/A'}`
        );
    }
}

module.exports = LimitsTreeProvider;