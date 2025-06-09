const { execSync } = require('child_process');

class SFAuthManager {
  constructor() {
    this.sfCommand = this.detectSFCommand();
  }

  detectSFCommand() {
    // Try both 'sf' and 'sfdx' commands
    try {
      execSync('sf --version', { stdio: 'ignore' });
      return 'sf';
    } catch {
      try {
        execSync('sfdx --version', { stdio: 'ignore' });
        return 'sfdx';
      } catch {
        throw new Error('Salesforce CLI not found. Please install sf CLI: https://developer.salesforce.com/tools/sfdxcli');
      }
    }
  }

  async getAuthenticatedOrgs() {
    try {
      const command = this.sfCommand === 'sf' ? 'sf org list --json' : 'sfdx force:org:list --json';
      const result = execSync(command, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      
      // Handle different response formats between sf and sfdx
      let orgs = [];
      if (this.sfCommand === 'sf') {
        // SF CLI returns nested structure
        const result = parsed.result;
        orgs = [
          ...(result.nonScratchOrgs || []),
          ...(result.devHubs || []),
          ...(result.sandboxes || [])
        ];
      } else {
        // SFDX returns simpler structure
        orgs = parsed.result.nonScratchOrgs || [];
      }
      
      if (!orgs || orgs.length === 0) {
        throw new Error('No authenticated orgs found');
      }

      // Remove duplicates based on orgId
      const uniqueOrgs = orgs.filter((org, index, self) => 
        index === self.findIndex(o => o.orgId === org.orgId)
      );

      return uniqueOrgs.map(org => ({
        alias: org.alias || org.username,
        username: org.username,
        orgId: org.orgId,
        instanceUrl: org.instanceUrl,
        loginUrl: org.loginUrl,
        isDefault: org.isDefaultDevHubUsername || org.isDefaultUsername
      }));
    } catch (error) {
      if (error.message.includes('No authenticated orgs found')) {
        throw new Error(`No authenticated Salesforce orgs found. Please authenticate first.`);
      }
      throw new Error(`Failed to get authenticated orgs: ${error.message}`);
    }
  }

  async getOrgInfo(orgIdentifier) {
    try {
      const command = this.sfCommand === 'sf' 
        ? `sf org display --target-org ${orgIdentifier} --json`
        : `sfdx force:org:display --targetusername ${orgIdentifier} --json`;
      
      const result = execSync(command, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      const orgInfo = parsed.result;

      return {
        username: orgInfo.username,
        orgId: orgInfo.id,
        instanceUrl: orgInfo.instanceUrl,
        accessToken: orgInfo.accessToken,
        loginUrl: orgInfo.loginUrl || (orgInfo.instanceUrl.includes('test') ? 'https://test.salesforce.com' : 'https://login.salesforce.com')
      };
    } catch (error) {
      throw new Error(`Failed to get org info for '${orgIdentifier}': ${error.message}`);
    }
  }

  async validateOrgAccess(orgIdentifier) {
    try {
      await this.getOrgInfo(orgIdentifier);
      return true;
    } catch (error) {
      return false;
    }
  }

  getLoginInstructions() {
    return {
      production: `${this.sfCommand} org login web`,
      sandbox: `${this.sfCommand} org login web --instance-url https://test.salesforce.com`,
      custom: `${this.sfCommand} org login web --instance-url https://yourcompany.my.salesforce.com`
    };
  }
}

module.exports = SFAuthManager;