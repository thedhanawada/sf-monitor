const jsforce = require('jsforce');
const winston = require('winston');

class LimitsMonitor {
  constructor(options = {}) {
    this.options = options;
    this.conn = null;
    this.logger = this.initLogger();
    
    // Default thresholds
    this.thresholds = {
      warning: parseInt(options.threshold) || 80,
      critical: 95
    };
  }

  initLogger() {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
          silent: this.options.quiet
        })
      ]
    });
  }

  async connect(orgConfig) {
    this.conn = new jsforce.Connection({
      instanceUrl: orgConfig.instanceUrl,
      accessToken: orgConfig.accessToken,
      version: '59.0'
    });
    
    this.logger.info(`Connected to Salesforce org: ${orgConfig.username}`);
  }

  async getLimits() {
    try {
      const limits = await this.conn.request('/services/data/v59.0/limits');
      return this.processLimitsData(limits);
    } catch (error) {
      throw new Error(`Failed to fetch limits: ${error.message}`);
    }
  }

  processLimitsData(rawLimits) {
    const processedLimits = [];
    
    // Key limits to monitor
    const keyLimits = [
      'DailyApiRequests',
      'DailyAsyncApexExecutions',
      'DailyBulkApiRequests',
      'DailyScratchOrgs',
      'DailyStreamingApiEvents',
      'DailyWorkflowEmails',
      'DataStorageMB',
      'FileStorageMB',
      'HourlyAsyncReportRuns',
      'HourlyDashboardRefreshes',
      'HourlyDashboardResults',
      'HourlyDashboardStatuses',
      'HourlyODataCallout',
      'HourlySyncReportRuns',
      'HourlyTimeBasedWorkflow',
      'MassEmail',
      'MonthlyPlatformEventsUsedMB',
      'SingleEmail',
      'StreamingApiConcurrentClients'
    ];

    for (const [limitName, limitData] of Object.entries(rawLimits)) {
      if (keyLimits.includes(limitName) && limitData.Max !== null) {
        const used = limitData.Remaining !== null ? limitData.Max - limitData.Remaining : 0;
        const percentage = limitData.Max > 0 ? (used / limitData.Max) * 100 : 0;
        
        processedLimits.push({
          name: this.formatLimitName(limitName),
          used,
          max: limitData.Max,
          remaining: limitData.Remaining,
          percentage: Math.round(percentage * 100) / 100,
          status: this.getStatus(percentage)
        });
      }
    }

    return processedLimits.sort((a, b) => b.percentage - a.percentage);
  }

  formatLimitName(name) {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  }

  getStatus(percentage) {
    if (percentage >= this.thresholds.critical) return 'CRITICAL';
    if (percentage >= this.thresholds.warning) return 'WARNING';
    return 'OK';
  }

  getStatusSeverity(status) {
    switch (status) {
      case 'CRITICAL': return 'critical';
      case 'WARNING': return 'warning';
      default: return 'info';
    }
  }

  async checkLimits(orgConfig) {
    await this.connect(orgConfig);
    const limits = await this.getLimits();
    
    const alertLimits = limits.filter(limit => 
      limit.status === 'WARNING' || limit.status === 'CRITICAL'
    );

    return {
      limits,
      alertLimits,
      hasAlerts: alertLimits.length > 0,
      severity: alertLimits.some(l => l.status === 'CRITICAL') ? 'critical' : 
                alertLimits.length > 0 ? 'warning' : 'info'
    };
  }
}

module.exports = LimitsMonitor;