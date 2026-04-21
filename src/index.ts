// Main Orchestrator (OpenClaw Entry Point)
//
import "dotenv/config";
import { loadConfig, getConfig } from "./config/loader";
import { initLogger, getLogger } from "./logging/logger";
import { initDatabase } from "./db/sqlite";
import { auditLog } from "./db/audit";
import {
  parsePaymentIntentFromAIOutput,
  routePaymentIntent,
  PaymentIntent,
  ProtocolRoute,
} from "./protocols/router";
import { X402Client } from "./protocols/x402/client";
import { AP2Client } from "./protocols/ap2/client";
import { sendEth, sendErc20, waitForConfirmation } from "./payments/web3/ethereum";
import { executeWeb2Payment, Web2PaymentResult } from "./payments/web2/gateways";
import { evaluatePolicy, PolicyResult } from "./policy/engine";
import {
  requestCliConfirmation,
  buildChatConfirmationPrompt,
  registerPendingConfirmation,
  ConfirmationChannel,
  ConfirmationResult,
} from "./policy/feedback";
import {
  createTransaction,
  updateTransactionStatus,
  TransactionRecord,
} from "./db/transactions";
import type { Address, Hash } from "viem";

// ─── Initialize ─────────────────────────────────────────────────────────────

export function bootstrap(configPath?: string, dryRunOverride?: boolean) {
  const config = loadConfig(configPath);

  // CLI --dry-run flag can override the YAML setting
  if (dryRunOverride !== undefined) {
    (config as any).dry_run.enabled = dryRunOverride;
  }

  initLogger(config);
  initDatabase(config);

  const logger = getLogger();

  if (config.dry_run.enabled) {
    logger.warn("╔══════════════════════════════════════════════════╗");
    logger.warn("║            🧪 DRY-RUN MODE ENABLED               ║");
    logger.warn("║  No real payments will be made.                  ║");
    logger.warn("║  AWS KMS is bypassed (local AES-256 encryption). ║");
    logger.warn("║  All gateway responses are simulated stubs.      ║");
    logger.warn("╚══════════════════════════════════════════════════╝");

    // Ensure the local encryption key exists
    const { resolveDryRunEncryptionKey } = require("./dry-run/crypto");
    resolveDryRunEncryptionKey();

    // Ensure a default wallet exists
    const { ensureDryRunWallet } = require("./dry-run/wallet");
    const wallet = ensureDryRunWallet("default_wallet");
    logger.info(`[DRY-RUN] Default wallet: ${wallet.address}`);

    auditLog("info", "system", "dryrun_mode_activated", {
      address: wallet.address,
      stub_mode: config.dry_run.stub_mode,
    });
  }

  logger.info("Agentic Payments Skill bootstrapped", {
    version: config.skill.version,
    dryRun: config.dry_run.enabled,
  });
  auditLog("info", "system", "skill_bootstrapped", {
    version: config.skill.version,
    dryRun: config.dry_run.enabled,
  });
}

// ─── Main Payment Flow ──────────────────────────────────────────────────────

export interface PaymentExecutionResult {
  success: boolean;
  tx: TransactionRecord;
  txHash?: string;
  web2Result?: Web2PaymentResult;
  x402Result?: { data: unknown; txHash?: string; network?: string };
  ap2Result?: { mandate_id: string; transaction_id?: string; status: string };
  policyResult: PolicyResult;
  confirmationRequired: boolean;
  confirmationPrompt?: string; // for chat channel
  error?: string;
  dryRun: boolean;
}

/**
 * Execute a full payment flow:
 * 1. Parse AI output → PaymentIntent
 * 2. Route to protocol + gateway (web3, web2, x402-remote, ap2-remote)
 * 3. Policy engine check
 * 4. Human confirmation if needed
 * 5. Execute payment (or stub in dry-run)
 * 6. Record & audit
 */
export async function executePayment(
  aiOutputOrIntent: string | PaymentIntent,
  channel: ConfirmationChannel = "cli",
  walletKeyAlias: string = "default_wallet"
): Promise<PaymentExecutionResult> {
  const logger = getLogger();
  const config = getConfig();
  const dryRun = config.dry_run.enabled;

  // ── Step 1: Parse intent ──────────────────────────────────────────────
  let intent: PaymentIntent;
  if (typeof aiOutputOrIntent === "string") {
    const parsed = parsePaymentIntentFromAIOutput(aiOutputOrIntent);
    if (!parsed) {
      throw new Error("Could not parse a valid payment intent from the AI output.");
    }
    intent = parsed;
  } else {
    intent = aiOutputOrIntent;
  }

  // ── Step 2: Route ─────────────────────────────────────────────────────
  const route = routePaymentIntent(intent);

  // Normalize amount to USD (simplified — in production use an oracle / exchange rate API)
  const amountUsd = estimateUsdAmount(parseFloat(intent.amount), intent.currency);

  // ── Step 3: Create transaction record ─────────────────────────────────
  const tx = createTransaction(intent, amountUsd);

  // ── Step 4: Policy engine ─────────────────────────────────────────────
  updateTransactionStatus(tx.id, "policy_check");
  const policyResult = evaluatePolicy(intent, amountUsd);

  if (policyResult.violations.length > 0) {
    updateTransactionStatus(tx.id, "awaiting_confirmation", {
      policy_violations: policyResult.violations.map((v) => v.message),
    });
  }

  // ── Step 5: Human confirmation if required ────────────────────────────
  let confirmation: ConfirmationResult | null = null;

  if (policyResult.requiresHumanConfirmation) {
    const confirmReq = {
      tx: { ...tx, amount_usd: amountUsd },
      violations: policyResult.violations,
      channel,
    };

    if (channel === "cli") {
      confirmation = requestCliConfirmation(confirmReq);
    } else if (channel === "chat") {
      // For chat: return the prompt and wait for async resolution
      const prompt = buildChatConfirmationPrompt(confirmReq);
      return {
        success: false,
        tx,
        policyResult,
        confirmationRequired: true,
        confirmationPrompt: prompt,
        dryRun,
      };
    } else if (channel === "web_api") {
      // For web API: register pending and return immediately
      // The caller should poll or wait for webhook
      registerPendingConfirmation(confirmReq);
      return {
        success: false,
        tx,
        policyResult,
        confirmationRequired: true,
        confirmationPrompt: `Confirmation required for tx ${tx.id}. POST /api/v1/confirm/${tx.id} with {"confirmed": true}`,
        dryRun,
      };
    }

    if (confirmation && !confirmation.confirmed) {
      updateTransactionStatus(tx.id, "rejected", {
        confirmed_by: confirmation.confirmedBy,
        error_message: confirmation.reason ?? "Rejected by human",
      });
      auditLog("warn", "payment", "payment_rejected_by_human", {
        tx_id: tx.id,
        reason: confirmation.reason,
      });
      return {
        success: false,
        tx,
        policyResult,
        confirmationRequired: true,
        error: "Payment rejected by human confirmation.",
        dryRun,
      };
    }

    if (confirmation?.confirmed) {
      updateTransactionStatus(tx.id, "approved", {
        confirmed_by: confirmation.confirmedBy,
      });
    }
  } else {
    updateTransactionStatus(tx.id, "approved", { confirmed_by: "auto" });
  }

  // ── Step 6: Execute payment ───────────────────────────────────────────
  try {
    if (route.paymentType === "web3") {
      const result = await executeWeb3Payment(intent, route, walletKeyAlias, tx);
      return {
        success: true,
        tx,
        txHash: result.txHash,
        policyResult,
        confirmationRequired: policyResult.requiresHumanConfirmation,
        dryRun,
      };
    } else if (route.paymentType === "x402") {
      const x402Client = new X402Client();
      const x402Result = await executeX402ClientPayment(x402Client, intent, walletKeyAlias, tx, dryRun);
      return {
        success: x402Result.success,
        tx,
        txHash: x402Result.txHash,
        policyResult,
        confirmationRequired: policyResult.requiresHumanConfirmation,
        error: x402Result.error,
        dryRun,
      };
    } else if (route.paymentType === "ap2") {
      const ap2Client = new AP2Client();
      const ap2Result = await executeAP2ClientPayment(ap2Client, intent, walletKeyAlias, tx, dryRun);
      return {
        success: ap2Result.success,
        tx,
        policyResult,
        confirmationRequired: policyResult.requiresHumanConfirmation,
        error: ap2Result.error,
        dryRun,
      };
    } else {
      const result = await executeWeb2Payment(route.gateway, intent);
      updateTransactionStatus(tx.id, "executed", {
        tx_hash: result.transaction_id,
      });
      auditLog("info", "payment", dryRun ? "dryrun_web2_executed" : "web2_payment_executed", {
        tx_id: tx.id,
        gateway: route.gateway,
        transaction_id: result.transaction_id,
      });
      return {
        success: result.status === "success" || result.status === "pending",
        tx,
        web2Result: result,
        policyResult,
        confirmationRequired: policyResult.requiresHumanConfirmation,
        dryRun,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateTransactionStatus(tx.id, "failed", { error_message: message });
    auditLog("error", "payment", "payment_execution_failed", {
      tx_id: tx.id,
      error: message,
      dryRun,
    });
    logger.error("Payment execution failed", { tx_id: tx.id, error: message });
    return {
      success: false,
      tx,
      policyResult,
      confirmationRequired: policyResult.requiresHumanConfirmation,
      error: message,
      dryRun,
    };
  }
}

// ─── Web3 Execution Helper ──────────────────────────────────────────────────

async function executeWeb3Payment(
  intent: PaymentIntent,
  route: ProtocolRoute,
  walletKeyAlias: string,
  tx: TransactionRecord
): Promise<{ txHash: string }> {
  const logger = getLogger();
  const dryRun = getConfig().dry_run.enabled;
  const network = intent.network ?? "ethereum";
  const to = intent.recipient as Address;

  let txHash: Hash;

  if (intent.currency.toUpperCase() === "ETH") {
    const result = await sendEth(walletKeyAlias, to, intent.amount, network);
    txHash = result.txHash;
  } else {
    // ERC-20 (USDC, etc.)
    const result = await sendErc20(
      walletKeyAlias,
      to,
      intent.amount,
      intent.currency,
      network
    );
    txHash = result.txHash;
  }

  updateTransactionStatus(tx.id, "executed", { tx_hash: txHash });

  // Optionally wait for confirmation
  const receipt = await waitForConfirmation(txHash, network);
  logger.info(`${dryRun ? "[DRY-RUN] " : ""}web3: Transaction confirmed`, {
    txHash,
    status: receipt.status,
    block: receipt.blockNumber.toString(),
  });

  auditLog("info", "payment", dryRun ? "dryrun_web3_confirmed" : "web3_payment_confirmed", {
    tx_id: tx.id,
    txHash,
    status: receipt.status,
    blockNumber: receipt.blockNumber.toString(),
  });

  return { txHash };
}

// ─── x402 Client Execution Helper ───────────────────────────────────────────

async function executeX402ClientPayment(
  client: InstanceType<typeof X402Client>,
  intent: PaymentIntent,
  walletKeyAlias: string,
  tx: TransactionRecord,
  dryRun: boolean
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const logger = getLogger();

  // In dry-run, simulate the entire flow
  if (dryRun) {
    const { stubX402Settlement } = await import("./dry-run/stubs");
    const result = await stubX402Settlement();
    updateTransactionStatus(tx.id, result.success ? "executed" : "failed", {
      tx_hash: result.txHash,
      error_message: result.error,
    });
    auditLog("info", "payment", "dryrun_x402_client_executed", {
      tx_id: tx.id,
      resource: intent.recipient,
      success: result.success,
    });
    return { success: result.success, txHash: result.txHash, error: result.error };
  }

  // 1. Discover payment requirements
  const details = await client.discoverPaymentRequirements(intent.recipient);
  if (!details) {
    // Resource did not require payment (not 402)
    updateTransactionStatus(tx.id, "executed");
    return { success: true };
  }

  // 2. Build & sign payment (simplified — full EIP-3009 signing omitted for brevity)
  // In production, decode the private key and build a signed authorization
  logger.info("x402 client: discovered payment requirements", {
    resource: intent.recipient,
    amount: details.maxAmountRequired,
    asset: details.asset,
  });

  // For now, submit an unsigned placeholder — real signing requires EIP-3009 flow
  const payload = client.buildPaymentPayload(intent, details, "0x0", {
    signature: "0x0",
    from: "0x0",
    to: details.payTo,
    value: details.maxAmountRequired,
    validAfter: "0",
    validBefore: String(Math.floor(Date.now() / 1000) + 300),
    nonce: String(Date.now()),
  });

  // 3. Submit payment
  const { settlement } = await client.submitPayment(intent.recipient, payload);

  updateTransactionStatus(tx.id, settlement.success ? "executed" : "failed", {
    tx_hash: settlement.txHash,
    error_message: settlement.error,
  });

  return {
    success: settlement.success,
    txHash: settlement.txHash,
    error: settlement.error,
  };
}

// ─── AP2 Client Execution Helper ────────────────────────────────────────────

async function executeAP2ClientPayment(
  client: InstanceType<typeof AP2Client>,
  intent: PaymentIntent,
  _walletKeyAlias: string,
  tx: TransactionRecord,
  dryRun: boolean
): Promise<{ success: boolean; error?: string }> {
  const logger = getLogger();
  const config = getConfig();

  // In dry-run, simulate the entire flow
  if (dryRun) {
    const { stubAP2Payment } = await import("./dry-run/stubs");
    const result = await stubAP2Payment(intent);
    updateTransactionStatus(tx.id, result.status === "success" ? "executed" : "failed", {
      tx_hash: result.transaction_id,
      error_message: result.error,
    });
    auditLog("info", "payment", "dryrun_ap2_client_executed", {
      tx_id: tx.id,
      mandate_id: result.mandate_id,
      success: result.status === "success",
    });
    return { success: result.status === "success", error: result.error };
  }

  // 1. Create mandate
  const agentId = config.protocols.ap2.server.agent_id;
  const mandate = client.createMandate(intent, agentId);

  // 2. Sign mandate
  const signedMandate = await client.requestMandateSignature(mandate);

  // 3. Get payment credentials
  const paymentMethodType =
    (intent.metadata?.payment_method_type as string) ?? "stripe";
  const credentials = await client.getPaymentCredentials(
    signedMandate,
    paymentMethodType
  );

  // 4. Submit payment
  const merchantUrl = intent.recipient.startsWith("http")
    ? intent.recipient
    : undefined;
  const result = await client.submitPayment(
    signedMandate,
    credentials,
    merchantUrl
  );

  updateTransactionStatus(tx.id, result.status === "success" ? "executed" : "failed", {
    tx_hash: result.transaction_id,
    error_message: result.error,
  });

  auditLog(
    result.status === "success" ? "info" : "error",
    "payment",
    "ap2_client_payment_completed",
    {
      tx_id: tx.id,
      mandate_id: result.mandate_id,
      status: result.status,
    }
  );

  return { success: result.status === "success", error: result.error };
}

// ─── USD Estimation (simplified) ────────────────────────────────────────────

function estimateUsdAmount(amount: number, currency: string): number {
  // In production, query a price oracle or exchange rate API
  const rates: Record<string, number> = {
    USD: 1,
    USDC: 1,
    USDT: 1,
    DAI: 1,
    EUR: 1.15,  // placeholder, use `xe.com` for exchange rate requests
    ETH: 2400,  // placeholder
    WETH: 2400, // placeholder
  };
  const rate = rates[currency.toUpperCase()] ?? 1;
  return amount * rate;
}

// Re-export for external use
export { parsePaymentIntentFromAIOutput } from "./protocols/router";
export { bootstrap as init } from "./index";
