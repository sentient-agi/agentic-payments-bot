// Configuration Loader & Types
//
import * as fs from "fs";
import * as path from "path";
import YAML from "yaml";
import { z } from "zod";

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const TimeRestrictionSchema = z.object({
  enabled: z.boolean(),
  allowed_hours: z.object({ start: z.number(), end: z.number() }),
  allowed_days: z.array(z.number()),
});

const PolicyRulesSchema = z.object({
  single_transaction: z.object({ max_amount_usd: z.number() }),
  daily: z.object({
    max_total_usd: z.number(),
    max_transaction_count: z.number(),
  }),
  weekly: z.object({
    max_total_usd: z.number(),
    max_transaction_count: z.number(),
  }),
  monthly: z.object({
    max_total_usd: z.number(),
    max_transaction_count: z.number(),
  }),
  time_restrictions: TimeRestrictionSchema,
  whitelist: z.object({
    enabled: z.boolean(),
    addresses: z.array(z.string()),
  }),
  blacklist: z.object({
    enabled: z.boolean(),
    addresses: z.array(z.string()),
  }),
  allowed_currencies: z.array(z.string()),
});

const ConfigSchema = z.object({
  skill: z.object({ name: z.string(), version: z.string() }),
  dry_run: z.object({
    enabled: z.boolean().default(false),
    encryption_key_env: z.string().default("DRYRUN_ENCRYPTION_KEY"),
    stub_mode: z.enum(["success", "failure", "random"]).default("success"),
    simulated_latency_ms: z.number().default(500),
  }).default({ enabled: false, encryption_key_env: "DRYRUN_ENCRYPTION_KEY", stub_mode: "success", simulated_latency_ms: 500 }),
  database: z.object({
    path: z.string(),
    wal_mode: z.boolean().default(true),
    busy_timeout_ms: z.number().default(5000),
  }),
  protocols: z.object({
    x402: z.object({
      enabled: z.boolean(),
      facilitator_url: z.string(),
      default_network: z.string(),
      default_asset: z.string(),
      timeout_ms: z.number(),
    }),
    ap2: z.object({
      enabled: z.boolean(),
      mandate_issuer: z.string(),
      credential_provider_url: z.string(),
      timeout_ms: z.number(),
    }),
  }),
  web3: z.record(
    z.string(),
    z.object({
      enabled: z.boolean(),
      rpc_url: z.string(),
      chain_id: z.number(),
    })
  ),
  web2: z.object({
    stripe: z.object({ enabled: z.boolean(), api_version: z.string() }),
    paypal: z.object({
      enabled: z.boolean(),
      environment: z.string(),
      base_url: z.string(),
    }),
    visa: z.object({ enabled: z.boolean(), base_url: z.string() }),
    mastercard: z.object({ enabled: z.boolean(), base_url: z.string() }),
    googlepay: z.object({
      enabled: z.boolean(),
      environment: z.enum(["TEST", "PRODUCTION"]).default("TEST"),
      base_url: z.string(),
      allowed_card_networks: z.array(z.string()).default(["AMEX", "DISCOVER", "JCB", "MASTERCARD", "VISA"]),
      allowed_auth_methods: z.array(z.string()).default(["PAN_ONLY", "CRYPTOGRAM_3DS"]),
    }),
    applepay: z.object({
      enabled: z.boolean(),
      base_url: z.string(),
      domain: z.string(),
      display_name: z.string().default("OpenClaw Payments"),
      supported_networks: z.array(z.string()).default(["visa", "masterCard", "amex", "discover"]),
      merchant_capabilities: z.array(z.string()).default(["supports3DS", "supportsCredit", "supportsDebit"]),
    }),
  }),
  kms: z.object({
    enabled: z.boolean(),
    provider: z
      .enum(["aws-kms", "os-keyring", "dbus-secret", "gpg", "local-aes"])
      .default("aws-kms"),
    region: z.string().optional().default("us-east-1"),
    key_id_env: z.string().optional().default("AWS_KMS_KEY_ID"),
    // Linux-specific: which library to use for os-keyring provider
    linux_keyring_backend: z
      .enum(["keytar", "dbus-next"])
      .optional()
      .default("keytar"),
    // GnuPG provider settings
    gpg_key_id: z.string().optional(),   // GPG key fingerprint or email
    gpg_binary: z.string().optional().default("gpg2"),  // path to gpg binary
  }),
  policy: z.object({
    enabled: z.boolean(),
    rules: PolicyRulesSchema,
    require_human_confirmation_on_violation: z.boolean(),
  }),
  logging: z.object({
    level: z.enum(["debug", "info", "warn", "error"]),
    stdout: z.boolean(),
    stderr_errors: z.boolean(),
    file: z.object({
      enabled: z.boolean(),
      path: z.string(),
      max_size_mb: z.number(),
      max_files: z.number(),
    }),
    audit: z.object({ sqlite: z.boolean(), verbose: z.boolean() }),
  }),
  web_api: z.object({
    enabled: z.boolean(),
    host: z.string(),
    port: z.number(),
    cors_origins: z.array(z.string()),
  }),
  cli: z.object({
    interactive_confirmation: z.boolean(),
    colored_output: z.boolean(),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;
export type PolicyRules = z.infer<typeof PolicyRulesSchema>;

// ─── Loader ─────────────────────────────────────────────────────────────────

let _config: AppConfig | null = null;

export function loadConfig(
  configPath?: string
): AppConfig {
  const resolved = configPath ?? path.resolve(process.cwd(), "config", "default.yaml");
  const raw = fs.readFileSync(resolved, "utf-8");
  const parsed = YAML.parse(raw);
  _config = ConfigSchema.parse(parsed);
  return _config;
}

export function getConfig(): AppConfig {
  if (!_config) {
    throw new Error("Config not loaded. Call loadConfig() first.");
  }
  return _config;
}
