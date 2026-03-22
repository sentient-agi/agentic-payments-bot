// Linux Secret Service Provider (D-Bus, pure JavaScript, no native addons)
//
// Uses dbus-next to communicate directly with org.freedesktop.secrets.
// Works with both GNOME Keyring and KDE Wallet (via its Secret Service bridge).
//
// Falls back to LocalAesProvider on headless systems without D-Bus.

import type { KmsProvider } from "./provider";
import { getLogger } from "../logging/logger";
import { auditLog } from "../db/audit";

const SERVICE_NAME = "openclaw-payments-agent";

interface SecretRecord {
  alias: string;
  type: string;
  createdAt: string;
}

export class DbusSecretServiceProvider implements KmsProvider {
  readonly name = "dbus-secret-service";

  private fallback: KmsProvider | null = null;

  /**
   * Store a secret via the Secret Service API.
   * The label and lookup attributes enable retrieval by key alias.
   */
  async store(keyAlias: string, keyType: string, plaintext: string): Promise<string> {
    try {
      const dbus = await import("dbus-next");
      const bus = dbus.sessionBus();

      try {
        const svcObj = await bus.getProxyObject(
          "org.freedesktop.secrets",
          "/org/freedesktop/secrets"
        );
        const svc = svcObj.getInterface("org.freedesktop.Secret.Service");

        // Open a plain-text session (the D-Bus transport is local)
        const [, sessionPath] = await svc.OpenSession(
          "plain",
          new dbus.Variant("s", "")
        );

        // Build the secret struct: (session, params, value, content_type)
        const secretValue = Buffer.from(plaintext, "utf-8");
        const secretStruct: [string, Buffer, Buffer, string] = [
          sessionPath as string,
          Buffer.alloc(0),
          secretValue,
          "text/plain",
        ];

        // Use the default collection
        const collObj = await bus.getProxyObject(
          "org.freedesktop.secrets",
          "/org/freedesktop/secrets/aliases/default"
        );
        const coll = collObj.getInterface("org.freedesktop.Secret.Collection");

        const properties: Record<string, any> = {
          "org.freedesktop.Secret.Item.Label": new dbus.Variant("s", `${SERVICE_NAME}:${keyAlias}`),
          "org.freedesktop.Secret.Item.Attributes": new dbus.Variant("a{ss}", {
            application: SERVICE_NAME,
            "key-alias": keyAlias,
            "key-type": keyType,
            "created-at": new Date().toISOString(),
          }),
        };

        await coll.CreateItem(properties, secretStruct, true /* replace */);

        getLogger().info("Stored key via D-Bus Secret Service", { keyAlias, keyType });
        auditLog("info", "kms", "key_encrypted_and_stored", {
          keyAlias,
          keyType,
          provider: this.name,
        });

        return keyAlias;
      } finally {
        bus.disconnect();
      }
    } catch (err) {
      return this.handleFallback(err, () => this.fallback!.store(keyAlias, keyType, plaintext));
    }
  }

  async retrieve(keyAlias: string): Promise<string> {
    try {
      const dbus = await import("dbus-next");
      const bus = dbus.sessionBus();

      try {
        const svcObj = await bus.getProxyObject(
          "org.freedesktop.secrets",
          "/org/freedesktop/secrets"
        );
        const svc = svcObj.getInterface("org.freedesktop.Secret.Service");

        // Open a session
        const [, sessionPath] = await svc.OpenSession(
          "plain",
          new dbus.Variant("s", "")
        );

        // Search for the item by attributes
        const [unlocked] = await svc.SearchItems({
          application: SERVICE_NAME,
          "key-alias": keyAlias,
        });

        if (!unlocked || unlocked.length === 0) {
          throw new Error(`Key '${keyAlias}' not found in D-Bus Secret Service`);
        }

        const itemPath = unlocked[0] as string;

        // Unlock if needed
        await svc.Unlock([itemPath]);

        // Get secret
        const itemObj = await bus.getProxyObject("org.freedesktop.secrets", itemPath);
        const item = itemObj.getInterface("org.freedesktop.Secret.Item");
        const [, , secretBytes] = await item.GetSecret(sessionPath as string);

        const plaintext = Buffer.from(secretBytes as Buffer).toString("utf-8");

        getLogger().debug("Retrieved key via D-Bus Secret Service", { keyAlias });
        auditLog("info", "kms", "key_decrypted", {
          keyAlias,
          provider: this.name,
        });

        return plaintext;
      } finally {
        bus.disconnect();
      }
    } catch (err) {
      if (this.fallback) return this.fallback.retrieve(keyAlias);
      // If it's a "not found" error, rethrow it directly
      if (err instanceof Error && err.message.includes("not found")) throw err;
      return this.handleFallback(err, () => this.fallback!.retrieve(keyAlias));
    }
  }

  async delete(keyAlias: string): Promise<boolean> {
    try {
      const dbus = await import("dbus-next");
      const bus = dbus.sessionBus();

      try {
        const svcObj = await bus.getProxyObject(
          "org.freedesktop.secrets",
          "/org/freedesktop/secrets"
        );
        const svc = svcObj.getInterface("org.freedesktop.Secret.Service");

        const [unlocked] = await svc.SearchItems({
          application: SERVICE_NAME,
          "key-alias": keyAlias,
        });

        if (!unlocked || unlocked.length === 0) return false;

        const itemPath = unlocked[0] as string;
        const itemObj = await bus.getProxyObject("org.freedesktop.secrets", itemPath);
        const item = itemObj.getInterface("org.freedesktop.Secret.Item");
        await item.Delete();

        auditLog("warn", "kms", "key_deleted", {
          keyAlias,
          provider: this.name,
        });

        return true;
      } finally {
        bus.disconnect();
      }
    } catch (err) {
      if (this.fallback) return this.fallback.delete(keyAlias);
      throw err;
    }
  }

  async list(): Promise<Array<{ alias: string; type: string; storageId: string; createdAt: string }>> {
    try {
      const dbus = await import("dbus-next");
      const bus = dbus.sessionBus();

      try {
        const svcObj = await bus.getProxyObject(
          "org.freedesktop.secrets",
          "/org/freedesktop/secrets"
        );
        const svc = svcObj.getInterface("org.freedesktop.Secret.Service");

        const [unlocked] = await svc.SearchItems({
          application: SERVICE_NAME,
        });

        const results: Array<{ alias: string; type: string; storageId: string; createdAt: string }> = [];

        for (const itemPath of (unlocked ?? [])) {
          const itemObj = await bus.getProxyObject("org.freedesktop.secrets", itemPath as string);
          const itemProps = itemObj.getInterface("org.freedesktop.DBus.Properties");
          const attrs = await itemProps.Get(
            "org.freedesktop.Secret.Item",
            "Attributes"
          );
          const attrMap = attrs.value as Record<string, string>;

          results.push({
            alias: attrMap["key-alias"] ?? "unknown",
            type: attrMap["key-type"] ?? "unknown",
            storageId: `dbus:${itemPath}`,
            createdAt: attrMap["created-at"] ?? "unknown",
          });
        }

        return results;
      } finally {
        bus.disconnect();
      }
    } catch (err) {
      if (this.fallback) return this.fallback.list();
      throw err;
    }
  }

  private async handleFallback<T>(err: unknown, fn: () => Promise<T>): Promise<T> {
    if (this.fallback) return fn();

    const logger = getLogger();
    logger.warn(
      "D-Bus Secret Service unavailable. Falling back to local-aes provider.",
      { error: err instanceof Error ? err.message : String(err) }
    );
    auditLog("warn", "kms", "dbus_secret_service_fallback_to_local_aes", {
      reason: err instanceof Error ? err.message : String(err),
    });

    const { LocalAesProvider } = await import("./local-aes-provider");
    this.fallback = new LocalAesProvider();
    return fn();
  }
}
