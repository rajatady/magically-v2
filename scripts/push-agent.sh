#!/bin/bash
set -e

# Push an agent's Docker image to Fly.io registry
# Usage: ./scripts/push-agent.sh <agent-id>
# Example: ./scripts/push-agent.sh hello-world

AGENT_ID="${1:?Usage: push-agent.sh <agent-id>}"
AGENTS_APP="magically-agents"
AGENT_DIR="agents/$AGENT_ID"

if [ ! -f "$AGENT_DIR/manifest.json" ]; then
  echo "Error: $AGENT_DIR/manifest.json not found"
  exit 1
fi

VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$AGENT_DIR/manifest.json','utf-8')).version)")
IMAGE="registry.fly.io/$AGENTS_APP:$AGENT_ID-$VERSION"
LOCAL_TAG="magically-agent-$AGENT_ID:$VERSION"

echo "==> Building agent image: $LOCAL_TAG"

# Check if runtime block exists in manifest
HAS_RUNTIME=$(node -e "const m=JSON.parse(require('fs').readFileSync('$AGENT_DIR/manifest.json','utf-8')); console.log(m.runtime ? 'yes' : 'no')")

if [ "$HAS_RUNTIME" = "no" ]; then
  echo "Agent has no runtime block — lightweight agent, no Docker needed."
  exit 0
fi

# Generate Dockerfile from manifest
BASE=$(node -e "const m=JSON.parse(require('fs').readFileSync('$AGENT_DIR/manifest.json','utf-8')); console.log(m.runtime.base)")
SYSTEM=$(node -e "const m=JSON.parse(require('fs').readFileSync('$AGENT_DIR/manifest.json','utf-8')); console.log((m.runtime.system||[]).join(' '))")
INSTALL=$(node -e "const m=JSON.parse(require('fs').readFileSync('$AGENT_DIR/manifest.json','utf-8')); console.log(m.runtime.install||'')")

DOCKERFILE="$AGENT_DIR/.Dockerfile.magically"
cat > "$DOCKERFILE" <<EOF
FROM $BASE
RUN apt-get update && apt-get install -y nodejs npm $SYSTEM && rm -rf /var/lib/apt/lists/*
WORKDIR /agent
COPY . /agent/
${INSTALL:+RUN $INSTALL}
EOF

echo "==> Building Docker image..."
docker build -f "$DOCKERFILE" -t "$LOCAL_TAG" "$AGENT_DIR"
rm "$DOCKERFILE"

echo "==> Tagging as $IMAGE"
docker tag "$LOCAL_TAG" "$IMAGE"

echo "==> Pushing to Fly registry..."
fly auth docker
docker push "$IMAGE"

echo "==> Done! Image available at: $IMAGE"
echo "   The platform will use this image when running $AGENT_ID functions."
