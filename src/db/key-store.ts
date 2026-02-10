// Encrypted Key Storage
//
import { v4 as uuidv4 } from "uuid";
import { getDb } from "./sqlite";
import { getLogger } from "../logging/logger";
import { auditLog } from "./audit";

export interface EncryptedKeyRecord {
  id: string;
  key_type: string;
  key_alias: string;
  ciphertext: Buffer;
  kms_key_id: string;
  created_at: string;
  updated_at: string;
}

export function storeEncryptedKey(
  keyType: string,
  keyAlias: string,
  ciphertext: Buffer,
  kmsKeyId: string
): string {
  const db = getDb();
  const logger = getLogger();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO encrypted_keys (id, key_type, key_alias, ciphertext, kms_key_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, keyType, keyAlias, ciphertext, kmsKeyId);

  logger.info("Stored encrypted key", { id, keyType, keyAlias });
  auditLog("info", "kms", "key_stored", { id, keyType, keyAlias });
  return id;
}

export function getEncryptedKey(keyAlias: string): EncryptedKeyRecord | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM encrypted_keys WHERE key_alias = ?")
    .get(keyAlias) as EncryptedKeyRecord | undefined;
  return row ?? null;
}

export function listEncryptedKeys(): EncryptedKeyRecord[] {
  const db = getDb();
  return db
    .prepare("SELECT id, key_type, key_alias, kms_key_id, created_at, updated_at FROM encrypted_keys")
    .all() as EncryptedKeyRecord[];
}

export function deleteEncryptedKey(keyAlias: string): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM encrypted_keys WHERE key_alias = ?")
    .run(keyAlias);
  if (result.changes > 0) {
    getLogger().info("Deleted encrypted key", { keyAlias });
    auditLog("warn", "kms", "key_deleted", { keyAlias });
    return true;
  }
  return false;
}
