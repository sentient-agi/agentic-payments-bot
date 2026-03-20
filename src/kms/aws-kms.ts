// AWS KMS Integration
//
// This module remains the public API for all consumers (ethereum.ts,
// gateways.ts, cli.ts). It delegates to the configured KMS provider
// via the factory, with a special case for dry-run mode.

import { getConfig } from "../config/loader";

function isDryRun(): boolean {
  return getConfig().dry_run.enabled;
}

/**
 * Encrypt plaintext and store via the configured KMS provider.
 * In dry-run mode, uses local AES-256-GCM (no external services).
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

  const { getKmsProvider } = await import("./factory");
  const provider = await getKmsProvider();
  return provider.store(keyAlias, keyType, plaintext);
}

/**
 * Retrieve encrypted key and decrypt via the configured KMS provider.
 * Returns plaintext string. NEVER log this value.
 * In dry-run mode, uses local AES-256-GCM (no external services).
 */
export async function retrieveAndDecrypt(keyAlias: string): Promise<string> {
  if (isDryRun()) {
    const { dryRunRetrieveAndDecrypt } = await import("../dry-run/wallet");
    return dryRunRetrieveAndDecrypt(keyAlias);
  }

  const { getKmsProvider } = await import("./factory");
  const provider = await getKmsProvider();
  return provider.retrieve(keyAlias);
}
