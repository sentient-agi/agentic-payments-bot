// Transaction Records
//
import { v4 as uuidv4 } from "uuid";
import { getDb } from "./sqlite";
import { getLogger } from "../logging/logger";
import { PaymentIntent } from "../protocols/router";

export interface TransactionRecord {
  id: string;
  protocol: string;
  gateway: string | null;
  action: string;
  amount: number;
  amount_usd: number;
  currency: string;
  recipient: string;
  network: string | null;
  status: string;
  tx_hash: string | null;
  error_message: string | null;
  policy_violations: string | null;
  confirmed_by: string | null;
  metadata: string | null;
  created_at: string;
  executed_at: string | null;
  completed_at: string | null;
}

export function createTransaction(
  intent: PaymentIntent,
  amountUsd: number
): TransactionRecord {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO transactions
      (id, protocol, gateway, action, amount, amount_usd, currency,
       recipient, network, status, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    id,
    intent.protocol,
    intent.gateway ?? null,
    intent.action,
    parseFloat(intent.amount),
    amountUsd,
    intent.currency,
    intent.recipient,
    intent.network ?? null,
    JSON.stringify(intent.metadata ?? {}),
    now
  );

  getLogger().info("Transaction created", { id, protocol: intent.protocol, amount: intent.amount });

  return {
    id,
    protocol: intent.protocol,
    gateway: intent.gateway ?? null,
    action: intent.action,
    amount: parseFloat(intent.amount),
    amount_usd: amountUsd,
    currency: intent.currency,
    recipient: intent.recipient,
    network: intent.network ?? null,
    status: "pending",
    tx_hash: null,
    error_message: null,
    policy_violations: null,
    confirmed_by: null,
    metadata: JSON.stringify(intent.metadata ?? {}),
    created_at: now,
    executed_at: null,
    completed_at: null,
  };
}

export function updateTransactionStatus(
  txId: string,
  status: string,
  extra?: {
    tx_hash?: string;
    error_message?: string;
    policy_violations?: string[];
    confirmed_by?: string;
  }
): void {
  const db = getDb();
  const timeField =
    status === "executed" ? "executed_at" : status === "failed" || status === "rejected" ? "completed_at" : null;

  let sql = `UPDATE transactions SET status = ?`;
  const params: unknown[] = [status];

  if (extra?.tx_hash) {
    sql += `, tx_hash = ?`;
    params.push(extra.tx_hash);
  }
  if (extra?.error_message) {
    sql += `, error_message = ?`;
    params.push(extra.error_message);
  }
  if (extra?.policy_violations) {
    sql += `, policy_violations = ?`;
    params.push(JSON.stringify(extra.policy_violations));
  }
  if (extra?.confirmed_by) {
    sql += `, confirmed_by = ?`;
    params.push(extra.confirmed_by);
  }
  if (timeField) {
    sql += `, ${timeField} = datetime('now')`;
  }

  sql += ` WHERE id = ?`;
  params.push(txId);

  db.prepare(sql).run(...params);
  getLogger().debug("Transaction updated", { txId, status });
}

export function getTransactionById(txId: string): TransactionRecord | null {
  return (
    (getDb()
      .prepare("SELECT * FROM transactions WHERE id = ?")
      .get(txId) as TransactionRecord | undefined) ?? null
  );
}

/** Aggregate USD total for a time window */
export function getAggregateInWindow(
  windowStart: string,
  windowEnd: string
): { total_usd: number; count: number } {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_usd), 0) as total_usd, COUNT(*) as count
       FROM transactions
       WHERE status IN ('executed', 'approved', 'pending', 'awaiting_confirmation')
         AND created_at >= ? AND created_at < ?`
    )
    .get(windowStart, windowEnd) as { total_usd: number; count: number };
  return row;
}
