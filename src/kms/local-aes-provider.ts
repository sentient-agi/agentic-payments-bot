// Local AES-256-GCM Provider
//
// Used as: (a) dry-run encryption, (b) headless fallback when no
// OS keyring or AWS KMS is available.

import type { KmsProvider } from "./provider";
import { getLogger } from "../logging/logger";
import { auditLog } from "../db/audit";
import {
  storeEncryptedKey,
  getEncryptedKey,
  listEncryptedKeys,
  deleteEncryptedKey,
} from "../db/key-store";
import { dryRunEncrypt, dryRunDecrypt, resolveDryRunEncryptionKey } from "../dry-run/crypto";

const KMS_KEY_LABEL = "local-aes256";

export class LocalAesProvider implements KmsProvider {
  readonly name = "local-aes";

  constructor() {
    // Ensure the local AES key is available (generates one if missing)
    resolveDryRunEncryptionKey();
  }

  async store(keyAlias: string, keyType: string, plaintext: string): Promise<string> {
    const ciphertext = dryRunEncrypt(plaintext);
    const id = storeEncryptedKey(keyType, keyAlias, ciphertext, KMS_KEY_LABEL);

    getLogger().info("Encrypted and stored key (local AES)", { keyAlias, keyType });
    auditLog("info", "kms", "key_encrypted_and_stored", {
      keyAlias,
      keyType,
      provider: this.name,
    });

    return id;
  }

  async retrieve(keyAlias: string): Promise<string> {
    const record = getEncryptedKey(keyAlias);
    if (!record) {
      throw new Error(`Encrypted key not found for alias '${keyAlias}'`);
    }

    const plaintext = dryRunDecrypt(record.ciphertext);

    getLogger().debug("Decrypted key (local AES)", { keyAlias, keyType: record.key_type });
    auditLog("info", "kms", "key_decrypted", {
      keyAlias,
      keyType: record.key_type,
      provider: this.name,
    });

    return plaintext;
  }

  async delete(keyAlias: string): Promise<boolean> {
    return deleteEncryptedKey(keyAlias);
  }

  async list(): Promise<Array<{ alias: string; type: string; storageId: string; createdAt: string }>> {
    return listEncryptedKeys().map((k) => ({
      alias: k.key_alias,
      type: k.key_type,
      storageId: k.id,
      createdAt: k.created_at,
    }));
  }
}
