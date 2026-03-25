#!/bin/bash
set -e

# Deploy the Magically platform to Fly.io
# Prerequisites: fly CLI installed, logged in

APP_NAME="magically-platform"

echo "==> Checking Fly.io auth..."
fly auth whoami

# Create app if it doesn't exist
if ! fly apps list | grep -q "$APP_NAME"; then
  echo "==> Creating app $APP_NAME..."
  fly apps create "$APP_NAME"
fi

# Create volume if it doesn't exist
if ! fly volumes list -a "$APP_NAME" 2>/dev/null | grep -q "magically_data"; then
  echo "==> Creating volume..."
  fly volumes create magically_data --size 1 --region sjc -a "$APP_NAME" -y
fi

# Create the agents app (for running agent containers)
AGENTS_APP="magically-agents"
if ! fly apps list | grep -q "$AGENTS_APP"; then
  echo "==> Creating agents app $AGENTS_APP..."
  fly apps create "$AGENTS_APP"
fi

# Set secrets
echo "==> Setting secrets..."
echo "  Set FLY_AGENTS_APP, FLY_API_TOKEN, and DB_PATH"
fly secrets set \
  FLY_AGENTS_APP="$AGENTS_APP" \
  DB_PATH="/data/magically.db" \
  -a "$APP_NAME"

echo "==> Deploying platform..."
fly deploy -a "$APP_NAME"

echo "==> Done! Platform running at https://$APP_NAME.fly.dev"
echo ""
echo "Next steps:"
echo "  1. Set your OpenRouter API key:"
echo "     curl -X PUT https://$APP_NAME.fly.dev/api/config -H 'Content-Type: application/json' -d '{\"openrouterApiKey\": \"sk-...\"}'"
echo "  2. Set your Fly API token for agent execution:"
echo "     fly secrets set FLY_API_TOKEN=\$(fly tokens create deploy -a $AGENTS_APP) -a $APP_NAME"
