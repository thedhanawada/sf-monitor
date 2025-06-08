const { execSync } = require('child_process');
const chalk = require('chalk');

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
        throw new Error(`No authenticated Salesforce orgs found. Please authenticate first:
        
${chalk.blue('For production/dev orgs:')}
  ${this.sfCommand} org login web

${chalk.blue('For sandbox orgs:')}
  ${this.sfCommand} org login web --instance-url https://test.salesforce.com

${chalk.blue('Then run:')}
  limitguard setup`);
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
      throw new Error(`Failed to get org info for '${orgIdentifier}': ${error.message}
      
Make sure the org is authenticated and the alias/username is correct.
Run '${this.sfCommand} org list' to see available orgs.`);
    }
  }

  async validateOrgAccess(orgIdentifier) {
    try {
      await this.getOrgInfo(orgIdentifier);
      return true;
    } catch (error) {
      console.error(chalk.red(`Failed to validate org access: ${error.message}`));
      return false;
    }
  }

  async refreshOrgAuth(orgIdentifier) {
    try {
      const command = this.sfCommand === 'sf'
        ? `sf org open --target-org ${orgIdentifier} --url-only`
        : `sfdx force:org:open --targetusername ${orgIdentifier} --urlonly`;
      
      execSync(command, { stdio: 'ignore' });
      console.log(chalk.green(`✓ Refreshed authentication for ${orgIdentifier}`));
      return true;
    } catch (error) {
      console.error(chalk.red(`Failed to refresh authentication: ${error.message}`));
      return false;
    }
  }

  getLoginInstructions() {
    return `
${chalk.blue('To authenticate with Salesforce:')}

${chalk.white('Production/Developer orgs:')}
  ${this.sfCommand} org login web

${chalk.white('Sandbox orgs:')}
  ${this.sfCommand} org login web --instance-url https://test.salesforce.com

${chalk.white('With custom domain:')}
  ${this.sfCommand} org login web --instance-url https://yourcompany.my.salesforce.com

${chalk.blue('After authentication, run:')}
  limitguard setup
`;
  }
}

module.exports = SFAuthManager;