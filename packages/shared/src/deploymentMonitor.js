const jsforce = require('jsforce');
const { spawn } = require('child_process');
const EventEmitter = require('events');

class DeploymentMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.conn = null;
    this.deploymentId = null;
    this.isMonitoring = false;
    this.baseline = null;
    this.monitoringInterval = null;
    this.pollingRate = options.pollingRate || 2000; // 2 seconds
  }

  async connect(orgConfig) {
    this.conn = new jsforce.Connection({
      instanceUrl: orgConfig.instanceUrl,
      accessToken: orgConfig.accessToken,
      version: '59.0'
    });
  }

  // Intercept SF CLI deploy commands
  async interceptSFDeploy(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      this.emit('deploymentStarted', { command, args });
      
      // Capture baseline before deployment
      this.captureBaseline().then(() => {
        const sfProcess = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          ...options
        });

        let stdout = '';
        let stderr = '';

        sfProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          
          // Extract deployment ID from SF CLI output
          const deployIdMatch = output.match(/Deploy ID: ([a-zA-Z0-9]{15,18})/);
          if (deployIdMatch) {
            this.deploymentId = deployIdMatch[1];
            this.startRealTimeMonitoring();
          }

          this.emit('deploymentOutput', { type: 'stdout', data: output });
        });

        sfProcess.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          this.emit('deploymentOutput', { type: 'stderr', data: output });
        });

        sfProcess.on('close', (code) => {
          this.stopMonitoring();
          
          if (code === 0) {
            this.emit('deploymentCompleted', { stdout, stderr, deploymentId: this.deploymentId });
            resolve({ success: true, stdout, stderr, deploymentId: this.deploymentId });
          } else {
            this.emit('deploymentFailed', { stdout, stderr, code });
            reject(new Error(`Deployment failed with code ${code}: ${stderr}`));
          }
        });

        sfProcess.on('error', (error) => {
          this.stopMonitoring();
          this.emit('deploymentError', error);
          reject(error);
        });
      }).catch(reject);
    });
  }

  async captureBaseline() {
    try {
      const limits = await this.conn.request('/services/data/v59.0/limits');
      const timestamp = new Date().toISOString();
      
      this.baseline = {
        timestamp,
        limits: this.processLimitsForBaseline(limits),
        orgInfo: await this.getOrgInfo()
      };

      this.emit('baselineCaptured', this.baseline);
    } catch (error) {
      this.emit('error', { type: 'baseline', error: error.message });
    }
  }

  processLimitsForBaseline(rawLimits) {
    const keyMetrics = {};
    
    const importantLimits = [
      'DailyApiRequests',
      'DailyAsyncApexExecutions', 
      'DataStorageMB',
      'FileStorageMB'
    ];

    for (const limitName of importantLimits) {
      if (rawLimits[limitName] && rawLimits[limitName].Max !== null) {
        const used = rawLimits[limitName].Max - (rawLimits[limitName].Remaining || 0);
        keyMetrics[limitName] = {
          used,
          max: rawLimits[limitName].Max,
          remaining: rawLimits[limitName].Remaining,
          percentage: rawLimits[limitName].Max > 0 ? (used / rawLimits[limitName].Max) * 100 : 0
        };
      }
    }

    return keyMetrics;
  }

  async getOrgInfo() {
    try {
      const orgQuery = await this.conn.query("SELECT Id, Name, OrganizationType, InstanceName FROM Organization LIMIT 1");
      return orgQuery.records[0];
    } catch (error) {
      return null;
    }
  }

  startRealTimeMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.emit('monitoringStarted', { deploymentId: this.deploymentId });

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performMonitoringCheck();
      } catch (error) {
        this.emit('error', { type: 'monitoring', error: error.message });
      }
    }, this.pollingRate);
  }

  async performMonitoringCheck() {
    if (!this.isMonitoring || !this.deploymentId) return;

    try {
      // Get deployment status
      const deploymentStatus = await this.getDeploymentStatus();
      
      // Get current limits
      const currentLimits = await this.conn.request('/services/data/v59.0/limits');
      const processedLimits = this.processLimitsForBaseline(currentLimits);
      
      // Calculate deltas from baseline
      const deltas = this.calculateDeltas(processedLimits);
      
      const monitoringData = {
        timestamp: new Date().toISOString(),
        deploymentStatus,
        currentLimits: processedLimits,
        deltas,
        deploymentId: this.deploymentId
      };

      this.emit('monitoringUpdate', monitoringData);

      // Check for completion
      if (deploymentStatus && (deploymentStatus.done || deploymentStatus.state === 'Failed')) {
        this.stopMonitoring();
      }

    } catch (error) {
      this.emit('error', { type: 'monitoring', error: error.message });
    }
  }

  async getDeploymentStatus() {
    if (!this.deploymentId) return null;

    try {
      // Query deployment status via Metadata API
      const deployResult = await this.conn.metadata.checkDeployStatus(this.deploymentId);
      
      return {
        id: this.deploymentId,
        done: deployResult.done,
        success: deployResult.success,
        state: deployResult.state || 'InProgress',
        numberComponentsDeployed: deployResult.numberComponentsDeployed || 0,
        numberComponentsTotal: deployResult.numberComponentsTotal || 0,
        numberTestsCompleted: deployResult.numberTestsCompleted || 0,
        numberTestsTotal: deployResult.numberTestsTotal || 0,
        runTestsEnabled: deployResult.runTestsEnabled || false,
        details: deployResult.details || []
      };
    } catch (error) {
      // Fallback: try querying DeployRequest if available
      try {
        const deployQuery = await this.conn.query(`
          SELECT Id, Status, CreatedDate, CompletedDate, ErrorMessage 
          FROM DeployRequest 
          WHERE Id = '${this.deploymentId}' 
          LIMIT 1
        `);
        
        if (deployQuery.records.length > 0) {
          const record = deployQuery.records[0];
          return {
            id: this.deploymentId,
            done: record.Status === 'Completed' || record.Status === 'Failed',
            success: record.Status === 'Completed',
            state: record.Status,
            errorMessage: record.ErrorMessage
          };
        }
      } catch (queryError) {
        // If both methods fail, return minimal status
        return {
          id: this.deploymentId,
          done: false,
          state: 'Unknown',
          error: error.message
        };
      }
    }
  }

  calculateDeltas(currentLimits) {
    if (!this.baseline || !this.baseline.limits) return {};

    const deltas = {};
    
    for (const [limitName, current] of Object.entries(currentLimits)) {
      const baseline = this.baseline.limits[limitName];
      if (baseline) {
        deltas[limitName] = {
          usedDelta: current.used - baseline.used,
          percentageDelta: current.percentage - baseline.percentage,
          trend: current.used > baseline.used ? 'increasing' : current.used < baseline.used ? 'decreasing' : 'stable'
        };
      }
    }

    return deltas;
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    this.emit('monitoringStopped', { deploymentId: this.deploymentId });
  }

  // Helper method to start deployment monitoring from deployment ID
  async monitorExistingDeployment(deploymentId) {
    this.deploymentId = deploymentId;
    await this.captureBaseline();
    this.startRealTimeMonitoring();
  }

  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      deploymentId: this.deploymentId,
      hasBaseline: !!this.baseline,
      pollingRate: this.pollingRate
    };
  }
}

module.exports = DeploymentMonitor;