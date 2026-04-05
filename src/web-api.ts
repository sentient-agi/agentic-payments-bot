// Web API (Express)
//
import "dotenv/config";
import express from "express";
import { bootstrap, executePayment, PaymentExecutionResult } from "./index";
import { loadConfig, getConfig } from "./config/loader";
import { initLogger, getLogger } from "./logging/logger";
import { PaymentIntentSchema } from "./protocols/router";
import { getTransactionById } from "./db/transactions";
import { queryAuditLog } from "./db/audit";
import {
  resolvePendingConfirmation,
  getPendingConfirmations,
} from "./policy/feedback";
import {
  x402Paywall,
  createX402Router,
  X402ResourcePricing,
} from "./protocols/x402/server";
import { ap2Router } from "./protocols/ap2/server";

const configPath = process.env.CONFIG_PATH ?? "config/default.yaml";
bootstrap(configPath);

const config = getConfig();
const logger = getLogger();
const app = express();

app.use(express.json());

// ── CORS ────────────────────────────────────────────────────────────────────

app.use((req, res, next) => {
  const origin = req.headers.origin ?? "";
  const allowed = config.web_api.cors_origins.some((pattern) => {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return regex.test(origin);
  });
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization,X-PAYMENT"
    );
    res.setHeader(
      "Access-Control-Expose-Headers",
      "X-PAYMENT,X-PAYMENT-RESPONSE"
    );
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── Health ──────────────────────────────────────────────────────────────────

app.get("/api/v1/health", (_req, res) => {
  res.json({
    status: "ok",
    skill: config.skill.name,
    version: config.skill.version,
    dryRun: config.dry_run.enabled,
    stubMode: config.dry_run.enabled ? config.dry_run.stub_mode : undefined,
    protocols: {
      x402: { enabled: config.protocols.x402.enabled },
      ap2: { enabled: config.protocols.ap2.enabled },
    },
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PROTOCOL SERVER ENDPOINTS — Accept payments from external agents
// ═════════════════════════════════════════════════════════════════════════════

// ── AP2 Server (mandate lifecycle) ──────────────────────────────────────────
// POST /api/v1/ap2/mandates           — Accept a mandate
// GET  /api/v1/ap2/mandates           — List mandates
// GET  /api/v1/ap2/mandates/:id       — Get mandate status
// POST /api/v1/ap2/sign-mandate       — Sign a mandate (credential provider)
// POST /api/v1/ap2/payment-credentials — Issue tokenized credentials
// POST /api/v1/ap2/process-payment    — Execute mandate against payment backends

app.use("/api/v1/ap2", ap2Router);

// ── x402 Server (paywall + management) ──────────────────────────────────────

// Registry of x402-priced resources
const x402PricingRegistry = new Map<string, X402ResourcePricing>();

// Default wallet address for receiving x402 payments (from config or env)
const x402PayToAddress =
  process.env.X402_PAY_TO_ADDRESS ?? "0x0000000000000000000000000000000000000001";

// Register a demo/sample x402-protected resource
const premiumPricing: X402ResourcePricing = {
  maxAmountRequired: "1000000", // 1 USDC (6 decimals)
  asset: "USDC",
  network: config.protocols.x402.default_network,
  payTo: x402PayToAddress,
  description: "Access to premium agentic data feed",
  mimeType: "application/json",
};
x402PricingRegistry.set("/api/v1/x402/premium/data", premiumPricing);

app.get(
  "/api/v1/x402/premium/data",
  x402Paywall(premiumPricing),
  (_req, res) => {
    res.json({
      data: "This is premium data, paid for via x402.",
      timestamp: new Date().toISOString(),
      source: config.skill.name,
    });
  }
);

// x402 management router (pricing list, settlement verification)
app.use("/api/v1/x402", createX402Router(x402PricingRegistry));

// ═════════════════════════════════════════════════════════════════════════════
// GENERIC PAYMENT ENDPOINTS — Internal payment orchestration
// ═════════════════════════════════════════════════════════════════════════════

// ── Execute Payment ─────────────────────────────────────────────────────────

app.post("/api/v1/payment", async (req, res) => {
  try {
    const intent = PaymentIntentSchema.parse(req.body);
    const walletAlias = (req.body.walletKeyAlias as string) ?? "default_wallet";

    const result = await executePayment(intent, "web_api", walletAlias);
    const status = result.success ? 200 : result.confirmationRequired ? 202 : 400;

    res.status(status).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("API payment error", { error: message });
    res.status(400).json({ error: message });
  }
});

// ── Parse AI Output ─────────────────────────────────────────────────────────

app.post("/api/v1/parse", (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text) return res.status(400).json({ error: "Missing 'text' in body" });

  const { parsePaymentIntentFromAIOutput } = require("./protocols/router");
  const intent = parsePaymentIntentFromAIOutput(text);

  if (intent) {
    res.json({ found: true, intent });
  } else {
    res.json({ found: false, intent: null });
  }
});

// ── Confirm / Reject Pending Transactions ───────────────────────────────────

app.post("/api/v1/confirm/:txId", (req, res) => {
  const { txId } = req.params;
  const { confirmed, reason } = req.body as {
    confirmed: boolean;
    reason?: string;
  };

  const resolved = resolvePendingConfirmation(
    txId,
    confirmed,
    "human/web_api",
    reason
  );

  if (resolved) {
    res.json({ success: true, message: `Transaction ${txId} ${confirmed ? "confirmed" : "rejected"}` });
  } else {
    res.status(404).json({ error: `No pending confirmation for tx ${txId}` });
  }
});

// ── List Pending Confirmations ──────────────────────────────────────────────

app.get("/api/v1/pending", (_req, res) => {
  const pending = getPendingConfirmations();
  res.json(
    pending.map((p) => ({
      txId: p.txId,
      amount: p.request.tx.amount,
      currency: p.request.tx.currency,
      recipient: p.request.tx.recipient,
      violations: p.request.violations,
    }))
  );
});

// ── Transaction Lookup ──────────────────────────────────────────────────────

app.get("/api/v1/transactions/:txId", (req, res) => {
  const tx = getTransactionById(req.params.txId);
  if (tx) {
    res.json(tx);
  } else {
    res.status(404).json({ error: "Transaction not found" });
  }
});

// ── Audit Log ───────────────────────────────────────────────────────────────

app.get("/api/v1/audit", (req, res) => {
  const entries = queryAuditLog({
    category: req.query.category as string | undefined,
    tx_id: req.query.tx_id as string | undefined,
    since: req.query.since as string | undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
  });
  res.json(entries);
});

// ── Start Server ────────────────────────────────────────────────────────────

if (require.main === module) {
  const { host, port } = config.web_api;
  app.listen(port, host, () => {
    logger.info(`Web API listening on http://${host}:${port}`);
    logger.info("Protocol server endpoints:");
    logger.info("  x402:  GET /api/v1/x402/premium/data (paywall-protected)");
    logger.info("         GET /api/v1/x402/pricing");
    logger.info("        POST /api/v1/x402/verify");
    logger.info("  AP2:  POST /api/v1/ap2/mandates");
    logger.info("         GET /api/v1/ap2/mandates");
    logger.info("        POST /api/v1/ap2/sign-mandate");
    logger.info("        POST /api/v1/ap2/payment-credentials");
    logger.info("        POST /api/v1/ap2/process-payment");
  });
}

export { app };
