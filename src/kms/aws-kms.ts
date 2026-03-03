// AWS KMS Integration
//
import {
  KMSClient,
  EncryptCommand,
  DecryptCommand,
} from "@aws-sdk/client-kms";
import { getConfig } from "../config/loader";
import { getLogger } from "../logging/logger";
import { auditLog } from "../db/audit";
import { getEncryptedKey, storeEncryptedKey } from "../db/key-store";

let _kmsClient: KMSClient | null = null;

function isDryRun(): boolean {
  return getConfig().dry_run.enabled;
}

function getKmsClient(): KMSClient {
  if (!_kmsClient) {
    const config = getConfig();
    // AWS credentials come ONLY from environment variables:
    //   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN (optional)
    _kmsClient = new KMSClient({ region: config.kms.region });
  }
  return _kmsClient;
}

function getKmsKeyId(): string {
  const config = getConfig();
  const keyId = process.env[config.kms.key_id_env];
  if (!keyId) {
    throw new Error(
      `AWS KMS key ID not found in env var '${config.kms.key_id_env}'. ` +
        `Set the environment variable before running the skill.`
    );
  }
  return keyId;
}

/**
 * Encrypt plaintext and store ciphertext in SQLite.
 * In dry-run mode, uses local AES-256-GCM instead of AWS KMS.
 */
export async function encryptAndStore(
  keyAlias: string,
  keyType: string,
  plaintext: string
): Promise<string> {
  if (isDryRun()) {
    const { dryRunEncryptAndStore } = await import("../dry-run/wallet");
    return dryRunEncryptAndStore(keyAlias, keyType, plaintext);
  }

  const logger = getLogger();
  const kms = getKmsClient();
  const kmsKeyId = getKmsKeyId();

  logger.debug("Encrypting key via AWS KMS", { keyAlias, keyType });

  const result = await kms.send(
    new EncryptCommand({
      KeyId: kmsKeyId,
      Plaintext: Buffer.from(plaintext, "utf-8"),
    })
  );

  if (!result.CiphertextBlob) {
    throw new Error("KMS encryption returned empty ciphertext");
  }

  const ciphertext = Buffer.from(result.CiphertextBlob);
  const id = storeEncryptedKey(keyType, keyAlias, ciphertext, kmsKeyId);

  auditLog("info", "kms", "key_encrypted_and_stored", {
    keyAlias,
    keyType,
    kmsKeyId,
  });

  return id;
}

/**
 * Retrieve encrypted key from SQLite and decrypt.
 * Returns plaintext string. NEVER log this value.
 * In dry-run mode, uses local AES-256-GCM instead of AWS KMS.
 */
export async function retrieveAndDecrypt(keyAlias: string): Promise<string> {
  if (isDryRun()) {
    const { dryRunRetrieveAndDecrypt } = await import("../dry-run/wallet");
    return dryRunRetrieveAndDecrypt(keyAlias);
  }

  const logger = getLogger();
  const kms = getKmsClient();

  const record = getEncryptedKey(keyAlias);
  if (!record) {
    throw new Error(`Encrypted key not found for alias '${keyAlias}'`);
  }

  logger.debug("Decrypting key via AWS KMS", { keyAlias, keyType: record.key_type });

  const result = await kms.send(
    new DecryptCommand({
      CiphertextBlob: record.ciphertext,
      KeyId: record.kms_key_id,
    })
  );

  if (!result.Plaintext) {
    throw new Error("KMS decryption returned empty plaintext");
  }

  auditLog("info", "kms", "key_decrypted", {
    keyAlias,
    keyType: record.key_type,
    // NOTE: plaintext is NEVER included in audit/logs
  });

  return Buffer.from(result.Plaintext).toString("utf-8");
}
