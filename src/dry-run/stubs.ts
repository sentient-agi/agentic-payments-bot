// Web3 and web2 gateway stubs
//
import { v4 as uuidv4 } from "uuid";
import { getConfig } from "../config/loader";
import { getLogger } from "../logging/logger";
import { auditLog } from "../db/audit";
import { PaymentIntent } from "../protocols/router";
import type { EthereumTxResult } from "../payments/web3/ethereum";
import type { Web2PaymentResult } from "../payments/web2/gateways";
import type { X402SettlementResponse } from "../protocols/x402/client";
import type { AP2PaymentResult } from "../protocols/ap2/client";
import type { Hash, Address } from "viem";

// ─── Helpers ────────────────────────────────────────────────────────────────

function shouldSucceed(): boolean {
  const mode = getConfig().dry_run.stub_mode;
  if (mode === "success") return true;
  if (mode === "failure") return false;
  return Math.random() > 0.3; // ~70 % success in random mode
}

async function simulateLatency(): Promise<void> {
  const ms = getConfig().dry_run.simulated_latency_ms;
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function fakeTxHash(): Hash {
  return `0x${uuidv4().replace(/-/g, "")}${"a".repeat(32)}` as Hash;
}

// ─── Web3 Stub ──────────────────────────────────────────────────────────────

export async function stubSendEth(
  fromAddress: Address,
  to: Address,
  amount: string,
  networkName: string
): Promise<EthereumTxResult> {
  const logger = getLogger();
  await simulateLatency();

  if (!shouldSucceed()) {
    throw new Error("[DRY-RUN] Simulated ETH transfer failure: insufficient funds");
  }

  const txHash = fakeTxHash();
  logger.info("[DRY-RUN] Simulated ETH transfer", { txHash, from: fromAddress, to, amount, network: networkName });
  auditLog("info", "payment", "dryrun_eth_transfer", { txHash, from: fromAddress, to, amount, network: networkName });

  return { txHash, network: networkName, from: fromAddress, to, amount, currency: "ETH" };
}

export async function stubSendErc20(
  fromAddress: Address,
  to: Address,
  amount: string,
  tokenSymbol: string,
  networkName: string
): Promise<EthereumTxResult> {
  const logger = getLogger();
  await simulateLatency();

  if (!shouldSucceed()) {
    throw new Error(`[DRY-RUN] Simulated ${tokenSymbol} transfer failure: ERC-20 transfer reverted`);
  }

  const txHash = fakeTxHash();
  logger.info("[DRY-RUN] Simulated ERC-20 transfer", { txHash, from: fromAddress, to, amount, token: tokenSymbol, network: networkName });
  auditLog("info", "payment", "dryrun_erc20_transfer", { txHash, from: fromAddress, to, amount, token: tokenSymbol, network: networkName });

  return { txHash, network: networkName, from: fromAddress, to, amount, currency: tokenSymbol };
}

export async function stubWaitForConfirmation(
  txHash: Hash,
  _networkName: string
): Promise<{ status: "success" | "reverted"; blockNumber: bigint }> {
  await simulateLatency();

  const status = shouldSucceed() ? "success" : "reverted";
  const blockNumber = BigInt(Math.floor(Math.random() * 10_000_000) + 20_000_000);

  getLogger().info("[DRY-RUN] Simulated tx confirmation", { txHash, status, blockNumber: blockNumber.toString() });

  return { status, blockNumber };
}

// ─── Web2 Stubs ─────────────────────────────────────────────────────────────

export async function stubStripePayment(intent: PaymentIntent): Promise<Web2PaymentResult> {
  await simulateLatency();
  const success = shouldSucceed();
  const txId = `pi_dryrun_${uuidv4().slice(0, 12)}`;

  getLogger().info("[DRY-RUN] Simulated Stripe payment", { txId, success, amount: intent.amount });
  auditLog("info", "payment", "dryrun_stripe", { txId, success, amount: intent.amount });

  if (!success) {
    return { gateway: "stripe", transaction_id: txId, status: "failed", amount: intent.amount, currency: intent.currency, error: "[DRY-RUN] Card declined" };
  }
  return { gateway: "stripe", transaction_id: txId, status: "success", amount: intent.amount, currency: intent.currency };
}

export async function stubPaypalPayment(intent: PaymentIntent): Promise<Web2PaymentResult> {
  await simulateLatency();
  const success = shouldSucceed();
  const txId = `PAYPAL-DRYRUN-${uuidv4().slice(0, 10).toUpperCase()}`;

  getLogger().info("[DRY-RUN] Simulated PayPal payment", { txId, success, amount: intent.amount });
  auditLog("info", "payment", "dryrun_paypal", { txId, success, amount: intent.amount });

  if (!success) {
    return { gateway: "paypal", transaction_id: txId, status: "failed", amount: intent.amount, currency: intent.currency, error: "[DRY-RUN] PayPal authorization failed" };
  }
  return { gateway: "paypal", transaction_id: txId, status: "success", amount: intent.amount, currency: intent.currency, receipt_url: "https://sandbox.paypal.com/dryrun/approval" };
}

export async function stubVisaPayment(intent: PaymentIntent): Promise<Web2PaymentResult> {
  await simulateLatency();
  const success = shouldSucceed();
  const txId = `VISA-DRYRUN-${Date.now()}`;

  getLogger().info("[DRY-RUN] Simulated Visa Direct payment", { txId, success, amount: intent.amount });
  auditLog("info", "payment", "dryrun_visa", { txId, success, amount: intent.amount });

  if (!success) {
    return { gateway: "visa", transaction_id: txId, status: "failed", amount: intent.amount, currency: intent.currency, error: "[DRY-RUN] Visa push funds declined" };
  }
  return { gateway: "visa", transaction_id: txId, status: "success", amount: intent.amount, currency: intent.currency };
}

export async function stubMastercardPayment(intent: PaymentIntent): Promise<Web2PaymentResult> {
  await simulateLatency();
  const success = shouldSucceed();
  const txId = `MC-DRYRUN-${Date.now()}`;

  getLogger().info("[DRY-RUN] Simulated Mastercard Send payment", { txId, success, amount: intent.amount });
  auditLog("info", "payment", "dryrun_mastercard", { txId, success, amount: intent.amount });

  if (!success) {
    return { gateway: "mastercard", transaction_id: txId, status: "failed", amount: intent.amount, currency: intent.currency, error: "[DRY-RUN] Mastercard transfer rejected" };
  }
  return { gateway: "mastercard", transaction_id: txId, status: "success", amount: intent.amount, currency: intent.currency };
}

/** Dispatch to the correct web2 stub */
export async function stubWeb2Payment(gateway: string, intent: PaymentIntent): Promise<Web2PaymentResult> {
  switch (gateway) {
    case "stripe":     return stubStripePayment(intent);
    case "paypal":     return stubPaypalPayment(intent);
    case "visa":       return stubVisaPayment(intent);
    case "mastercard": return stubMastercardPayment(intent);
    default:
      throw new Error(`[DRY-RUN] Unsupported web2 gateway stub: ${gateway}`);
  }
}

// ─── Protocol Stubs ─────────────────────────────────────────────────────────

export async function stubX402Settlement(): Promise<X402SettlementResponse> {
  await simulateLatency();
  if (!shouldSucceed()) {
    return { success: false, error: "[DRY-RUN] x402 facilitator settlement failed" };
  }
  return { success: true, txHash: fakeTxHash(), network: getConfig().protocols.x402.default_network };
}

export async function stubAP2Payment(intent: PaymentIntent): Promise<AP2PaymentResult> {
  await simulateLatency();
  const success = shouldSucceed();
  return {
    mandate_id: `mandate_dryrun_${Date.now()}`,
    status: success ? "success" : "failed",
    transaction_id: success ? `ap2-dryrun-${uuidv4().slice(0, 12)}` : undefined,
    receipt: success
      ? {
          amount: intent.amount,
          currency: intent.currency,
          timestamp: new Date().toISOString(),
          reference: `REF-DRYRUN-${Date.now()}`,
        }
      : undefined,
    error: success ? undefined : "[DRY-RUN] AP2 mandate execution failed",
  };
}
