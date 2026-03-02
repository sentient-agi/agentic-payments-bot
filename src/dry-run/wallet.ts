// Local wallet key generation & management
//
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getLogger } from "../logging/logger";
import { auditLog } from "../db/audit";
import { storeEncryptedKey, getEncryptedKey } from "../db/key-store";
import { dryRunEncrypt, dryRunDecrypt } from "./crypto";

/**
 * Generate a new Viem wallet private key, encrypt it with the local
 * dry-run AES-256 key, and store the ciphertext in SQLite.
 * Returns the key alias used for subsequent lookups.
 */
export function dryRunGenerateAndStoreWallet(
  keyAlias: string = "default_wallet"
): { keyAlias: string; address: string } {
  const logger = getLogger();

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const ciphertext = dryRunEncrypt(privateKey);

  storeEncryptedKey(
    "web3_private_key",
    keyAlias,
    ciphertext,
    "dryrun-local-aes256"
  );

  logger.info("[DRY-RUN] Generated and stored wallet", {
    keyAlias,
    address: account.address,
  });
  auditLog("info", "kms", "dryrun_wallet_generated", {
    keyAlias,
    address: account.address,
  });

  return { keyAlias, address: account.address };
}

/**
 * Encrypt an arbitrary token/secret with the local dry-run key and store it.
 */
export function dryRunEncryptAndStore(
  keyAlias: string,
  keyType: string,
  plaintext: string
): string {
  const ciphertext = dryRunEncrypt(plaintext);
  const id = storeEncryptedKey(keyType, keyAlias, ciphertext, "dryrun-local-aes256");

  getLogger().info("[DRY-RUN] Encrypted and stored key", { keyAlias, keyType });
  auditLog("info", "kms", "dryrun_key_stored", { keyAlias, keyType });

  return id;
}

/**
 * Retrieve an encrypted key from SQLite and decrypt with the local
 * dry-run AES-256 key. Returns the plaintext.
 */
export function dryRunRetrieveAndDecrypt(keyAlias: string): string {
  const record = getEncryptedKey(keyAlias);
  if (!record) {
    throw new Error(`[DRY-RUN] Encrypted key not found for alias '${keyAlias}'`);
  }

  const plaintext = dryRunDecrypt(record.ciphertext);

  getLogger().debug("[DRY-RUN] Decrypted key", { keyAlias, keyType: record.key_type });
  auditLog("info", "kms", "dryrun_key_decrypted", { keyAlias, keyType: record.key_type });

  return plaintext;
}

/**
 * Ensure a default wallet exists in dry-run mode.
 * If `default_wallet` is not yet stored, generate one.
 */
export function ensureDryRunWallet(
  keyAlias: string = "default_wallet"
): { keyAlias: string; address: string } {
  const existing = getEncryptedKey(keyAlias);
  if (existing) {
    // Decrypt to derive the address for logging
    const privateKey = dryRunDecrypt(existing.ciphertext);
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    getLogger().info("[DRY-RUN] Using existing wallet", {
      keyAlias,
      address: account.address,
    });
    return { keyAlias, address: account.address };
  }
  return dryRunGenerateAndStoreWallet(keyAlias);
}
