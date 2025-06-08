const nodemailer = require('nodemailer');
const https = require('https');
const http = require('http');
const chalk = require('chalk');
const ConfigManager = require('./config');

class AlertManager {
  constructor() {
    this.config = new ConfigManager();
  }

  async sendAlert(alertData) {
    const alertConfig = await this.config.getAlerts();
    
    if (!alertConfig.enabled) {
      return;
    }

    const promises = [];

    for (const alertType of alertConfig.types) {
      switch (alertType) {
        case 'console':
          promises.push(this.sendConsoleAlert(alertData));
          break;
        case 'email':
          promises.push(this.sendEmailAlert(alertData));
          break;
        case 'slack':
          promises.push(this.sendSlackAlert(alertData));
          break;
        case 'webhook':
          promises.push(this.sendWebhookAlert(alertData));
          break;
      }
    }

    await Promise.allSettled(promises);
  }

  async sendConsoleAlert(alertData) {
    const severityColors = {
      info: chalk.blue,
      warning: chalk.yellow,
      critical: chalk.red
    };

    const colorFn = severityColors[alertData.severity] || chalk.white;
    
    console.log(colorFn(`\n🚨 ALERT [${alertData.severity.toUpperCase()}]`));
    console.log(colorFn(`Time: ${alertData.timestamp}`));
    
    if (alertData.org) {
      console.log(colorFn(`Org: ${alertData.org}`));
    }

    if (alertData.limits) {
      console.log(colorFn('\nAffected Limits:'));
      alertData.limits.forEach(limit => {
        console.log(colorFn(`  • ${limit.name}: ${limit.percentage}% (${limit.status})`));
      });
    }

    if (alertData.message) {
      console.log(colorFn(`\nMessage: ${alertData.message}`));
    }

    console.log();
  }

  async sendEmailAlert(alertData) {
    try {
      const config = await this.config.get('alerts.email');
      
      if (!config) {
        throw new Error('Email alert configuration not found');
      }

      const transporter = nodemailer.createTransporter(config.smtp);
      
      const subject = this.formatEmailSubject(alertData);
      const html = this.formatEmailBody(alertData);

      const mailOptions = {
        from: config.from,
        to: config.to.join(', '),
        subject,
        html
      };

      await transporter.sendMail(mailOptions);
      
    } catch (error) {
      console.error(chalk.red('Failed to send email alert:'), error.message);
    }
  }

  formatEmailSubject(alertData) {
    const severityEmoji = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨'
    };

    const emoji = severityEmoji[alertData.severity] || '📢';
    const orgText = alertData.org ? ` - ${alertData.org}` : '';
    
    return `${emoji} sf-monitor Alert [${alertData.severity.toUpperCase()}]${orgText}`;
  }

  formatEmailBody(alertData) {
    let html = `
      <html>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background-color: ${this.getSeverityColor(alertData.severity)}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; font-size: 24px;">🛡️ sf-monitor Alert</h2>
              <p style="margin: 5px 0 0 0; font-size: 16px; opacity: 0.9;">
                ${alertData.severity.toUpperCase()} - ${new Date(alertData.timestamp).toLocaleString()}
              </p>
            </div>
            
            <div style="padding: 20px;">
    `;

    if (alertData.org) {
      html += `
        <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px;">
          <strong>Salesforce Org:</strong> ${alertData.org}
        </div>
      `;
    }

    if (alertData.limits && alertData.limits.length > 0) {
      html += `
        <h3 style="color: #333; margin-bottom: 15px;">Affected Governor Limits</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Limit</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Usage</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Status</th>
            </tr>
          </thead>
          <tbody>
      `;

      alertData.limits.forEach(limit => {
        const statusColor = limit.status === 'CRITICAL' ? '#dc3545' : '#ffc107';
        html += `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${limit.name}</td>
            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">${limit.percentage}%</td>
            <td style="padding: 12px; text-align: center; border-bottom: 1px solid #dee2e6;">
              <span style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                ${limit.status}
              </span>
            </td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;
    }

    if (alertData.message) {
      html += `
        <div style="margin-bottom: 20px; padding: 15px; background-color: #e9ecef; border-radius: 4px;">
          <strong>Message:</strong> ${alertData.message}
        </div>
      `;
    }

    html += `
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #6c757d; font-size: 14px;">
              <p>This alert was generated by sf-monitor - Salesforce Governor Limits Monitor</p>
              <p>To stop receiving these alerts, update your sf-monitor configuration.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
    `;

    return html;
  }

  getSeverityColor(severity) {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'warning': return '#ffc107';
      case 'info': return '#17a2b8';
      default: return '#6c757d';
    }
  }

  async sendSlackAlert(alertData) {
    try {
      const config = await this.config.get('alerts.slack');
      
      if (!config) {
        throw new Error('Slack alert configuration not found');
      }

      const payload = this.formatSlackPayload(alertData, config);
      
      await this.sendWebhookRequest(config.webhookUrl, payload, 'POST');
      
    } catch (error) {
      console.error(chalk.red('Failed to send Slack alert:'), error.message);
    }
  }

  formatSlackPayload(alertData, config) {
    const severityEmojis = {
      info: ':information_source:',
      warning: ':warning:',
      critical: ':rotating_light:'
    };

    const severityColors = {
      info: '#17a2b8',
      warning: '#ffc107',
      critical: '#dc3545'
    };

    const emoji = severityEmojis[alertData.severity] || ':bell:';
    const color = severityColors[alertData.severity] || '#6c757d';

    let fields = [];

    if (alertData.org) {
      fields.push({
        title: 'Salesforce Org',
        value: alertData.org,
        short: true
      });
    }

    fields.push({
      title: 'Severity',
      value: alertData.severity.toUpperCase(),
      short: true
    });

    if (alertData.limits && alertData.limits.length > 0) {
      const limitsText = alertData.limits
        .map(limit => `• ${limit.name}: ${limit.percentage}% (${limit.status})`)
        .join('\n');
      
      fields.push({
        title: 'Affected Limits',
        value: limitsText,
        short: false
      });
    }

    const payload = {
      channel: config.channel,
      username: 'sf-monitor',
      icon_emoji: ':shield:',
      attachments: [{
        color,
        title: `${emoji} sf-monitor Alert`,
        text: alertData.message || 'Governor limits threshold exceeded',
        fields,
        footer: 'sf-monitor',
        ts: Math.floor(new Date(alertData.timestamp).getTime() / 1000)
      }]
    };

    return payload;
  }

  async sendWebhookAlert(alertData) {
    try {
      const config = await this.config.get('alerts.webhook');
      
      if (!config) {
        throw new Error('Webhook alert configuration not found');
      }

      const payload = {
        alert: alertData,
        source: 'sf-monitor',
        version: require('../package.json').version
      };

      await this.sendWebhookRequest(config.url, payload, config.method, config.headers);
      
    } catch (error) {
      console.error(chalk.red('Failed to send webhook alert:'), error.message);
    }
  }

  async sendWebhookRequest(url, payload, method = 'POST', headers = {}) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'sf-monitor/1.0.0',
          ...headers
        }
      };

      const protocol = urlObj.protocol === 'https:' ? https : http;
      
      const req = protocol.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseData);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  async testAlert(type = 'all') {
    const testData = {
      type: 'test',
      severity: 'info',
      message: 'This is a test alert from sf-monitor',
      timestamp: new Date().toISOString(),
      org: 'test-org',
      limits: [
        {
          name: 'Daily API Requests',
          percentage: 85,
          status: 'WARNING',
          used: 85000,
          max: 100000,
          remaining: 15000
        }
      ]
    };

    if (type === 'all') {
      await this.sendAlert(testData);
    } else {
      switch (type) {
        case 'console':
          await this.sendConsoleAlert(testData);
          break;
        case 'email':
          await this.sendEmailAlert(testData);
          break;
        case 'slack':
          await this.sendSlackAlert(testData);
          break;
        case 'webhook':
          await this.sendWebhookAlert(testData);
          break;
        default:
          throw new Error(`Unknown alert type: ${type}`);
      }
    }

    console.log(chalk.green(`✅ Test alert sent successfully (${type})`));
  }
}

module.exports = AlertManager;