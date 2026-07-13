#!/usr/bin/env bash
# Push apps-script/Code.gs to the Apps Script project and redeploy the SAME
# web-app deployment, so the /exec URL never changes.
#
# Requires: clasp installed + logged in (clasp login), and a local .clasp.json
# with the project's scriptId (git-ignored).
set -euo pipefail
cd "$(dirname "$0")/.."

# The deployment ID is the AKfyc... token in the /exec URL (already public in js/config.js).
DEPLOY_ID="${APPS_SCRIPT_DEPLOYMENT_ID:-AKfycbxin3LGQwjzV0m0DhtiaeRDMZvBgTpZpCmGliqknDlu1XPY_OJ84DQl19fxdioGYmYn}"

clasp push -f
clasp redeploy "$DEPLOY_ID" -d "deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Live at https://script.google.com/macros/s/$DEPLOY_ID/exec"
