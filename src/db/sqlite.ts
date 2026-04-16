// SQLite Setup & Migrations
//
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { AppConfig } from "../config/loader";
import { getLogger } from "../logging/logger";

let _db: Database.Database | null = null;

export function initDatabase(config: AppConfig): Database.Database {
  const logger = getLogger();
  const dbDir = path.dirname(config.database.path);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  _db = new Database(config.database.path);

  if (config.database.wal_mode) {
    _db.pragma("journal_mode = WAL");
  }
  _db.pragma(`busy_timeout = ${config.database.busy_timeout_ms}`);

  runMigrations(_db);
  logger.info("SQLite database initialized", { path: config.database.path });
  return _db;
}

export function getDb(): Database.Database {
  if (!_db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return _db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    -- Encrypted keys/tokens storage (KMS encrypted entries)
    CREATE TABLE IF NOT EXISTS encrypted_keys (
      id          TEXT PRIMARY KEY,
      key_type    TEXT NOT NULL,           -- 'web3_private_key' | 'stripe_token' | 'paypal_token' | 'visa_token' | 'mastercard_token' | 'googlepay_token' | 'applepay_token'
      key_alias   TEXT NOT NULL UNIQUE,    -- human-readable alias
      ciphertext  BLOB NOT NULL,           -- KMS encrypted blob
      kms_key_id  TEXT NOT NULL,           -- KMS key ARN or provider ID used for encryption
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Transaction records for policy engine tracking
    CREATE TABLE IF NOT EXISTS transactions (
      id              TEXT PRIMARY KEY,
      protocol        TEXT NOT NULL,        -- 'x402' | 'ap2'
      gateway         TEXT,                 -- 'viem' | 'stripe' | 'paypal' | 'visa' | 'mastercard' | 'googlepay' | 'applepay' | 'x402' | 'ap2'
      action          TEXT NOT NULL,        -- 'pay'
      amount          REAL NOT NULL,
      amount_usd      REAL NOT NULL,        -- normalized to USD for policy checks
      currency        TEXT NOT NULL,
      recipient       TEXT NOT NULL,
      network         TEXT,
      status          TEXT NOT NULL,        -- 'pending' | 'policy_check' | 'awaiting_confirmation' | 'approved' | 'executed' | 'failed' | 'rejected'
      tx_hash         TEXT,
      error_message   TEXT,
      policy_violations TEXT,               -- JSON array of violation descriptions
      confirmed_by    TEXT,                 -- 'auto' | 'human'
      metadata        TEXT,                 -- JSON
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      executed_at     TEXT,
      completed_at    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_created
      ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_status
      ON transactions(status);
    CREATE INDEX IF NOT EXISTS idx_transactions_recipient
      ON transactions(recipient);

    -- Audit trail (extensive logging)
    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
      level       TEXT NOT NULL,            -- 'info' | 'warn' | 'error' | 'critical'
      category    TEXT NOT NULL,            -- 'payment' | 'policy' | 'kms' | 'protocol' | 'auth' | 'system'
      action      TEXT NOT NULL,            -- 'payment_initiated' | 'policy_evaluated' | 'key_decrypted' | etc.
      tx_id       TEXT,                     -- FK to transactions.id (nullable)
      actor       TEXT,                     -- 'agent' | 'human' | 'system' | 'cli' | 'web_api'
      details     TEXT,                     -- JSON payload with full context
      ip_address  TEXT,
      user_agent  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp
      ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_tx_id
      ON audit_log(tx_id);
    CREATE INDEX IF NOT EXISTS idx_audit_category
      ON audit_log(category);
  `);
}
