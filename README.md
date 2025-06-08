# sf-monitor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

Monitor Salesforce governor limits from the command line.

## Prerequisites

- Salesforce CLI installed and authenticated
- Node.js 18+

## Install

```bash
npm install -g sf-monitor
```

## Setup

First, authenticate with Salesforce CLI:
```bash
sf org login web
# or for sandbox:
sf org login web --instance-url https://test.salesforce.com
```

Then run setup:
```bash
sf-monitor setup
```

This will show your authenticated orgs and let you choose one to monitor.

## Usage

```bash
# Check current limits
sf-monitor status

# Monitor once and exit
sf-monitor monitor

# Monitor continuously 
sf-monitor monitor --continuous

# Monitor specific org
sf-monitor status --org my-sandbox
sf-monitor monitor --org production --continuous
```

## What it monitors

- API request limits
- Data and file storage
- Email limits
- Processing limits (Apex, workflows)
- Platform events

## Alerts

Configure during setup:
- Console output (default)
- Email notifications
- Slack webhooks
- Custom webhooks

## Requirements

- Salesforce CLI (`sf` or `sfdx`)
- At least one authenticated Salesforce org
- Node.js 18 or higher

## Authentication

sf-monitor uses your existing Salesforce CLI authentication. No passwords or tokens stored locally.

## License

MIT License