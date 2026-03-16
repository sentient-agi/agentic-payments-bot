# ═══════════════════════════════════════════════════════════════════════════
# Dockerfile — OpenClaw + Agentic Payment Skill (dual-service)
#
# Runs the OpenClaw gateway and the agent-payments-skill web API
# side by side in a single container.
# ═══════════════════════════════════════════════════════════════════════════

# ── Stage 1: Build the payment skill ─────────────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /build

# Install build dependencies for better-sqlite3 (native addon)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy package manifests first for layer caching
COPY package.json package-lock.json tsconfig.json ./

# Install all dependencies (including devDependencies for tsc)
RUN npm ci

# Copy source and config
COPY src/ src/
COPY config/ config/
COPY SKILL.md ./

# Compile TypeScript → dist/
RUN npm run build

# Prune devDependencies for a leaner production image
RUN npm prune --production

# ── Stage 2: Production runtime ──────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

# Install runtime system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        tini \
        python3 \
        make \
        g++ && \
    rm -rf /var/lib/apt/lists/*

# Create a non-root user for both services
RUN groupadd --gid 1000 openclaw && \
    useradd --uid 1000 --gid openclaw --shell /bin/bash --create-home openclaw

# ── Install OpenClaw globally ────────────────────────────────────────────
RUN npm install -g openclaw@latest

# ── Set up the payment skill ────────────────────────────────────────────
WORKDIR /app/agent-payments-skill

# Copy compiled output and production node_modules from builder
COPY --from=builder /build/dist/ ./dist/
COPY --from=builder /build/node_modules/ ./node_modules/
COPY --from=builder /build/package.json ./
COPY --from=builder /build/config/ ./config/
COPY --from=builder /build/SKILL.md ./

# Create runtime directories (data + logs)
RUN mkdir -p /app/agent-payments-skill/data \
             /app/agent-payments-skill/logs \
             /home/openclaw/.openclaw/workspace \
             /home/openclaw/.openclaw/skills

# Symlink the skill into OpenClaw's skills directory
RUN ln -s /app/agent-payments-skill /home/openclaw/.openclaw/skills/agent-payments-skill

# Fix ownership
RUN chown -R openclaw:openclaw /app /home/openclaw

# ── Entrypoint script ───────────────────────────────────────────────────
COPY <<'ENTRYPOINT_SCRIPT' /usr/local/bin/entrypoint.sh
#!/usr/bin/env bash
set -euo pipefail

echo "═══════════════════════════════════════════════════════════"
echo "  🤖💵 OpenClaw + Agentic Payment Skill"
echo "  Payment API port : ${PAYMENT_API_PORT:-3402}"
echo "  OpenClaw gateway : ${OPENCLAW_GATEWAY_PORT:-18789}"
echo "  Dry-run mode     : ${DRY_RUN:-false}"
echo "═══════════════════════════════════════════════════════════"

# ── Start the payment skill web API in the background ──────────────────
cd /app/agent-payments-skill

if [ "${DRY_RUN:-false}" = "true" ]; then
  echo "[payment-skill] Starting in DRY-RUN mode..."
  export CONFIG_PATH="${CONFIG_PATH:-config/default.yaml}"
  # The skill reads dry_run.enabled from YAML; we also support env override
fi

echo "[payment-skill] Launching web API..."
node dist/web-api.js &
PAYMENT_PID=$!

# ── Start OpenClaw gateway ─────────────────────────────────────────────
echo "[openclaw] Starting OpenClaw gateway..."
cd /home/openclaw

openclaw &
OPENCLAW_PID=$!

# ── Trap signals and forward to both processes ─────────────────────────
cleanup() {
  echo "[entrypoint] Shutting down..."
  kill "$PAYMENT_PID" "$OPENCLAW_PID" 2>/dev/null || true
  wait "$PAYMENT_PID" "$OPENCLAW_PID" 2>/dev/null || true
  echo "[entrypoint] All processes stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT SIGQUIT

# ── Wait for either process to exit ───────────────────────────────────
wait -n "$PAYMENT_PID" "$OPENCLAW_PID"
EXIT_CODE=$?

echo "[entrypoint] A process exited with code $EXIT_CODE. Stopping all..."
cleanup
ENTRYPOINT_SCRIPT

RUN chmod +x /usr/local/bin/entrypoint.sh

# ── Ports ────────────────────────────────────────────────────────────────
# 3402  = Payment skill web API
# 18789 = OpenClaw gateway
# 18790 = OpenClaw bridge
EXPOSE 3402 18789 18790

# ── Volumes ──────────────────────────────────────────────────────────────
VOLUME ["/app/agent-payments-skill/data", \
        "/app/agent-payments-skill/logs", \
        "/home/openclaw/.openclaw"]

# ── Runtime config ───────────────────────────────────────────────────────
USER openclaw
ENTRYPOINT ["tini", "--"]
CMD ["/usr/local/bin/entrypoint.sh"]
