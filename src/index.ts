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
    switch (route.paymentType) {
      case "web3": {
        const result = await executeWeb3Payment(intent, route, walletKeyAlias, tx);
        return {
          success: true,
          tx,
          txHash: result.txHash,
          policyResult,
          confirmationRequired: policyResult.requiresHumanConfirmation,
          dryRun,
        };
      }
      case "web2": {
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
      case "x402": {
        const result = await executeX402RemotePayment(intent, walletKeyAlias, tx);
        return {
          success: true,
          tx,
          txHash: result.txHash,
          x402Result: {
            data: result.data,
            txHash: result.txHash,
            network: result.network,
          },
          policyResult,
          confirmationRequired: policyResult.requiresHumanConfirmation,
          dryRun,
        };
      }
      case "ap2": {
        const result = await executeAP2RemotePayment(intent, tx);
        return {
          success: result.status === "success" || result.status === "pending",
          tx,
          ap2Result: {
            mandate_id: result.mandate_id,
            transaction_id: result.transaction_id,
            status: result.status,
          },
          policyResult,
          confirmationRequired: policyResult.requiresHumanConfirmation,
          dryRun,
        };
      }
      default: {
        throw new Error(`Unknown payment type: ${route.paymentType}`);
      }
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

// ─── x402 Remote Resource Payment (Client) ──────────────────────────────────

async function executeX402RemotePayment(
  intent: PaymentIntent,
  walletKeyAlias: string,
  tx: TransactionRecord
): Promise<{ data: unknown; txHash?: string; network?: string }> {
  const logger = getLogger();
  const config = getConfig();
  const dryRun = config.dry_run.enabled;

  const resourceUrl = intent.recipient; // recipient IS the URL for x402 remote
  logger.info("x402 client: paying for remote resource", { resourceUrl });

  // In dry-run, simulate the entire flow
  if (dryRun) {
    const { stubX402Settlement } = await import("./dry-run/stubs");
    const settlement = await stubX402Settlement();
    updateTransactionStatus(tx.id, "executed", { tx_hash: settlement.txHash });

    auditLog("info", "payment", "dryrun_x402_remote", {
      tx_id: tx.id,
      resourceUrl,
      txHash: settlement.txHash,
    });

    return {
      data: { dryRun: true, message: "Simulated x402 resource access" },
      txHash: settlement.txHash,
      network: settlement.network,
    };
  }

  const x402 = new X402Client();

  // Step 1: Discover payment requirements
  const requirements = await x402.discoverPaymentRequirements(resourceUrl);
  if (!requirements) {
    // Resource doesn't require payment — access it directly
    const response = await fetch(resourceUrl);
    const data = await response.json().catch(() => response.text());
    updateTransactionStatus(tx.id, "executed", { tx_hash: "free_access" });
    return { data };
  }

  logger.info("x402 client: payment requirements discovered", {
    amount: requirements.maxAmountRequired,
    asset: requirements.asset,
    payTo: requirements.payTo,
    network: requirements.network,
  });

  // Step 2: Build and sign the EIP-3009 authorization
  const { retrieveAndDecrypt } = await import("./kms/aws-kms");
  const { privateKeyToAccount } = await import("viem/accounts");

  const privateKey = await retrieveAndDecrypt(walletKeyAlias);
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const now = Math.floor(Date.now() / 1000);
  const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;

  const signedAuth = {
    signature: "0x" + "00".repeat(65), // placeholder — production needs EIP-3009 typed data signing
    from: account.address,
    to: requirements.payTo,
    value: requirements.maxAmountRequired,
    validAfter: String(now - 60),
    validBefore: String(now + requirements.maxTimeoutSeconds),
    nonce,
  };

  const payload = x402.buildPaymentPayload(
    intent,
    requirements,
    account.address,
    signedAuth
  );

  // Step 3: Submit payment and access resource
  const { data, settlement } = await x402.submitPayment(resourceUrl, payload);

  if (!settlement.success) {
    throw new Error(`x402 settlement failed: ${settlement.error}`);
  }

  updateTransactionStatus(tx.id, "executed", { tx_hash: settlement.txHash });

  auditLog("info", "payment", "x402_remote_payment_completed", {
    tx_id: tx.id,
    resourceUrl,
    txHash: settlement.txHash,
    network: settlement.network,
  });

  return { data, txHash: settlement.txHash, network: settlement.network };
}

// ─── AP2 Remote Mandate Payment (Client) ────────────────────────────────────

async function executeAP2RemotePayment(
  intent: PaymentIntent,
  tx: TransactionRecord
): Promise<{
  mandate_id: string;
  status: "success" | "failed" | "pending";
  transaction_id?: string;
}> {
  const logger = getLogger();
  const config = getConfig();
  const dryRun = config.dry_run.enabled;

  logger.info("AP2 client: submitting mandate to remote provider", {
    recipient: intent.recipient,
  });

  // In dry-run, simulate the entire flow
  if (dryRun) {
    const { stubAP2Payment } = await import("./dry-run/stubs");
    const result = await stubAP2Payment(intent);
    updateTransactionStatus(tx.id, "executed", {
      tx_hash: result.transaction_id,
    });

    auditLog("info", "payment", "dryrun_ap2_remote", {
      tx_id: tx.id,
      mandate_id: result.mandate_id,
      status: result.status,
    });

    return {
      mandate_id: result.mandate_id,
      status: result.status,
      transaction_id: result.transaction_id,
    };
  }

  const ap2 = new AP2Client();

  // Step 1: Create mandate
  const agentId = config.protocols.ap2.server.agent_id;
  const mandate = ap2.createMandate(intent, agentId);

  // Step 2: Request mandate signature from credential provider
  const signedMandate = await ap2.requestMandateSignature(mandate);

  // Step 3: Get payment credentials
  // Determine payment method type from intent metadata or defaults
  const paymentMethodType =
    (intent.metadata?.payment_method_type as string) ?? "crypto";
  const credentials = await ap2.getPaymentCredentials(
    signedMandate,
    paymentMethodType
  );

  // Step 4: Submit payment to the merchant processor
  // If recipient is a URL, use it as the merchant processor endpoint;
  // otherwise use the default mandate issuer.
  const merchantUrl = intent.recipient.startsWith("http")
    ? intent.recipient
    : undefined;
  const result = await ap2.submitPayment(
    signedMandate,
    credentials,
    merchantUrl
  );

  if (result.status === "success" || result.status === "pending") {
    updateTransactionStatus(tx.id, "executed", {
      tx_hash: result.transaction_id,
    });
  } else {
    updateTransactionStatus(tx.id, "failed", {
      error_message: result.error,
    });
  }

  auditLog("info", "payment", "ap2_remote_payment_completed", {
    tx_id: tx.id,
    mandate_id: result.mandate_id,
    status: result.status,
    transaction_id: result.transaction_id,
  });

  return {
    mandate_id: result.mandate_id,
    status: result.status,
    transaction_id: result.transaction_id,
  };
}

// ─── USD Estimation (simplified) ────────────────────────────────────────────

function estimateUsdAmount(amount: number, currency: string): number {
  // In production, query a price oracle or exchange rate API
  const rates: Record<string, number> = {
    USD: 1,
    USDC: 1,
    USDT: 1,
    DAI: 1,
    EUR: 1.15, // placeholder, use `xe.com` for exchange rate requests
    ETH: 3200, // placeholder
    WETH: 3200, // placeholder
  };
  const rate = rates[currency.toUpperCase()] ?? 1;
  return amount * rate;
}

// Re-export for external use
export { parsePaymentIntentFromAIOutput } from "./protocols/router";
export { bootstrap as init } from "./index";
