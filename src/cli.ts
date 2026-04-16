#!/usr/bin/env node
// CLI Interface
//
import "dotenv/config";
import { Command } from "commander";
import { bootstrap, executePayment } from "./index";
import { PaymentIntentSchema, type PaymentIntent } from "./protocols/router";
import { encryptAndStore, retrieveAndDecrypt } from "./kms/aws-kms";
import { listEncryptedKeys, deleteEncryptedKey } from "./db/key-store";
import { queryAuditLog } from "./db/audit";
import { getTransactionById } from "./db/transactions";
import { getConfig } from "./config/loader";

const program = new Command();

program
  .name("agentic-payments-bot")
  .description("Agentic Payments Bot — CLI Interface")
  .version("0.6.0")
  .option("-c, --config <path>", "Path to YAML config file", "config/default.yaml")
  .option("--dry-run", "Enable dry-run mode (no real payments, no AWS KMS)");

// ── Helper: resolve dry-run from CLI flag or config ─────────────────────────

function resolveDryRun(): boolean | undefined {
  const opts = program.opts();
  return opts.dryRun === true ? true : undefined;
}

// ── pay command ─────────────────────────────────────────────────────────────

program
  .command("pay")
  .description("Execute a payment")
  .requiredOption("--protocol <protocol>", "Protocol: x402 or ap2")
  .requiredOption("--amount <amount>", "Payment amount (decimal string)")
  .requiredOption("--currency <currency>", "Currency code (USDC, USDT, ETH, WETH, DAI, USD, EUR, ...)")
  .requiredOption("--to <recipient>", "Recipient address, ID or URL")
  .option("--network <network>", "Network (ethereum, base, polygon, web2)")
  .option("--gateway <gateway>", "Gateway (viem, stripe, paypal, visa, mastercard, googlepay, applepay, x402, ap2)")
  .option("--description <desc>", "Payment description")
  .option("--wallet <alias>", "Wallet key alias in key store", "default_wallet")
  .action(async (opts) => {
    const configPath = program.opts().config;
    bootstrap(configPath, resolveDryRun());
    const config = getConfig();

    const intent: PaymentIntent = PaymentIntentSchema.parse({
      protocol: opts.protocol,
      action: "pay",
      amount: opts.amount,
      currency: opts.currency,
      recipient: opts.to,
      network: opts.network ?? null,
      gateway: opts.gateway ?? null,
      description: opts.description,
      metadata: {},
    });

    try {
      const result = await executePayment(intent, "cli", opts.wallet);
      console.log("\n═══════════════════════════════════════");
      if (result.dryRun) {
        console.log("🧪 DRY-RUN — no real payment was made");
      }
      if (result.success) {
        console.log("✅ Payment executed successfully!");
        if (result.txHash) console.log(`   TX Hash: ${result.txHash}`);
        if (result.web2Result)
          console.log(`   Transaction ID: ${result.web2Result.transaction_id}`);
        if (result.x402Result) {
          console.log(`   x402 TX Hash: ${result.x402Result.txHash ?? "N/A"}`);
          console.log(`   x402 Network: ${result.x402Result.network ?? "N/A"}`);
        }
        if (result.ap2Result) {
          console.log(`   AP2 Mandate ID: ${result.ap2Result.mandate_id}`);
          console.log(`   AP2 Transaction: ${result.ap2Result.transaction_id ?? "N/A"}`);
          console.log(`   AP2 Status: ${result.ap2Result.status}`);
        }
      } else {
        console.log("❌ Payment was not executed.");
        if (result.error) console.log(`   Error: ${result.error}`);
      }
      console.log(`   Internal TX ID: ${result.tx.id}`);
      console.log("═══════════════════════════════════════\n");
    } catch (err) {
      console.error("Fatal error:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── parse command (parse AI output) ─────────────────────────────────────────

program
  .command("parse")
  .description("Parse a payment intent from AI output text")
  .argument("<text>", "AI output text (or use - for stdin)")
  .action(async (text: string) => {
    const configPath = program.opts().config;
    bootstrap(configPath, resolveDryRun());

    const { parsePaymentIntentFromAIOutput } = await import("./protocols/router");
    let input = text;

    if (text === "-") {
      input = await new Promise<string>((resolve) => {
        let data = "";
        process.stdin.on("data", (chunk) => (data += chunk));
        process.stdin.on("end", () => resolve(data));
      });
    }

    const intent = parsePaymentIntentFromAIOutput(input);
    if (intent) {
      console.log("Parsed payment intent:");
      console.log(JSON.stringify(intent, null, 2));
    } else {
      console.log("No valid payment intent found in the provided text.");
    }
  });

// ── keys management ─────────────────────────────────────────────────────────

const keysCmd = program.command("keys").description("Manage encrypted keys/tokens");

keysCmd
  .command("store")
  .description("Encrypt and store a key/token via AWS KMS (or local AES in dry-run)")
  .requiredOption("--alias <alias>", "Key alias")
  .requiredOption("--type <type>", "Key type (web3_private_key, stripe_token, etc.)")
  .requiredOption("--value <value>", "Plaintext value to encrypt")
  .action(async (opts) => {
    bootstrap(program.opts().config, resolveDryRun());
    const id = await encryptAndStore(opts.alias, opts.type, opts.value);
    console.log(`✅ Key stored with ID: ${id}, alias: ${opts.alias}`);
  });

keysCmd
  .command("list")
  .description("List all encrypted keys (metadata only)")
  .action(() => {
    bootstrap(program.opts().config, resolveDryRun());
    const keys = listEncryptedKeys();
    if (keys.length === 0) {
      console.log("No encrypted keys stored.");
    } else {
      console.table(keys);
    }
  });

keysCmd
  .command("delete")
  .description("Delete an encrypted key by alias")
  .argument("<alias>", "Key alias")
  .action((alias: string) => {
    bootstrap(program.opts().config, resolveDryRun());
    const deleted = deleteEncryptedKey(alias);
    console.log(deleted ? `✅ Deleted key: ${alias}` : `❌ Key not found: ${alias}`);
  });

// ── transactions ────────────────────────────────────────────────────────────

program
  .command("tx")
  .description("Look up a transaction by ID")
  .argument("<txId>", "Transaction ID")
  .action((txId: string) => {
    bootstrap(program.opts().config, resolveDryRun());
    const tx = getTransactionById(txId);
    if (tx) {
      console.log(JSON.stringify(tx, null, 2));
    } else {
      console.log(`Transaction not found: ${txId}`);
    }
  });

// ── audit ───────────────────────────────────────────────────────────────────

program
  .command("audit")
  .description("Query audit log")
  .option("--category <cat>", "Filter by category")
  .option("--tx <txId>", "Filter by transaction ID")
  .option("--since <iso>", "Filter by timestamp (ISO 8601)")
  .option("--limit <n>", "Max results", "50")
  .action((opts) => {
    bootstrap(program.opts().config, resolveDryRun());
    const entries = queryAuditLog({
      category: opts.category,
      tx_id: opts.tx,
      since: opts.since,
      limit: parseInt(opts.limit, 10),
    });
    if (entries.length === 0) {
      console.log("No audit entries found.");
    } else {
      for (const entry of entries) {
        console.log(JSON.stringify(entry));
      }
    }
  });

// ── demo command ────────────────────────────────────────────────────────────

program
  .command("demo")
  .description("Run an interactive dry-run demo with sample payments")
  .option("--stub-mode <mode>", "Stub mode: success | failure | random", "success")
  .action(async (opts) => {
    // Force dry-run regardless of config
    bootstrap(program.opts().config, true);

    const config = getConfig();
    // Override stub mode for this demo session
    (config as any).dry_run.stub_mode = opts.stubMode;

    console.log("\n🧪 ══════════════════════════════════════════════");
    console.log("   AGENTIC PAYMENT BOT — INTERACTIVE DEMO");
    console.log("   Stub mode: " + opts.stubMode);
    console.log("══════════════════════════════════════════════════\n");

    const demos: Array<{ label: string; intent: PaymentIntent }> = [
      {
        label: "1️⃣   AP2 Stripe payment (web2)",
        intent: PaymentIntentSchema.parse({
          protocol: "ap2",
          action: "pay",
          amount: "49.99",
          currency: "USD",
          recipient: "merchant-demo-001",
          network: "web2",
          gateway: "stripe",
          description: "Demo: AP2 Stripe payment",
        }),
      },
      {
        label: "2️⃣   AP2 PayPal payment (web2)",
        intent: PaymentIntentSchema.parse({
          protocol: "ap2",
          action: "pay",
          amount: "25.00",
          currency: "USD",
          recipient: "seller@demo.example.com",
          network: "web2",
          gateway: "paypal",
          description: "Demo: AP2 PayPal payment",
        }),
      },
      {
        label: "3️⃣   AP2 Visa Direct payment (web2)",
        intent: PaymentIntentSchema.parse({
          protocol: "ap2",
          action: "pay",
          amount: "100.00",
          currency: "USD",
          recipient: "4111111111111111",
          network: "web2",
          gateway: "visa",
          description: "Demo: AP2 Visa Direct push",
        }),
      },
      {
        label: "4️⃣   AP2 Mastercard Send payment (web2)",
        intent: PaymentIntentSchema.parse({
          protocol: "ap2",
          action: "pay",
          amount: "75.00",
          currency: "USD",
          recipient: "5111111111111118",
          network: "web2",
          gateway: "mastercard",
          description: "Demo: AP2 Mastercard Send",
        }),
      },
      {
        label: "5️⃣   AP2 Google Pay payment (web2)",
        intent: PaymentIntentSchema.parse({
          protocol: "ap2",
          action: "pay",
          amount: "35.00",
          currency: "USD",
          recipient: "merchant-gpay-demo",
          network: "web2",
          gateway: "googlepay",
          description: "Demo: AP2 Google Pay payment",
          metadata: { paymentToken: "dryrun-gpay-token" },
        }),
      },
      {
        label: "6️⃣   AP2 Apple Pay payment (web2)",
        intent: PaymentIntentSchema.parse({
          protocol: "ap2",
          action: "pay",
          amount: "59.99",
          currency: "USD",
          recipient: "merchant-applepay-demo",
          network: "web2",
          gateway: "applepay",
          description: "Demo: AP2 Apple Pay payment",
          metadata: { paymentToken: "dryrun-applepay-token" },
        }),
      },
      {
        label: "7️⃣   x402 ETH transfer on Ethereum (web3)",
        intent: PaymentIntentSchema.parse({
          protocol: "x402",
          action: "pay",
          amount: "0.01",
          currency: "ETH",
          recipient: "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
          network: "ethereum",
          gateway: "viem",
          description: "Demo: x402 ETH transfer",
        }),
      },
      {
        label: "8️⃣   x402 USDT payment on Ethereum (web3)",
        intent: PaymentIntentSchema.parse({
          protocol: "x402",
          action: "pay",
          amount: "50.00",
          currency: "USDT",
          recipient: "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
          network: "ethereum",
          gateway: "viem",
          description: "Demo: x402 USDT on Ethereum",
        }),
      },
      {
        label: "9️⃣   x402 USDT payment on Base (web3)",
        intent: PaymentIntentSchema.parse({
          protocol: "x402",
          action: "pay",
          amount: "25.00",
          currency: "USDT",
          recipient: "0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65",
          network: "base",
          gateway: "viem",
          description: "Demo: x402 USDT on Base",
        }),
      },
      {
        label: "🔟   x402 USDC payment on Ethereum (web3)",
        intent: PaymentIntentSchema.parse({
          protocol: "x402",
          action: "pay",
          amount: "10.00",
          currency: "USDC",
          recipient: "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
          network: "ethereum",
          gateway: "viem",
          description: "Demo: x402 USDC on Ethereum",
        }),
      },
      {
        label: "1️⃣1️⃣   x402 USDC payment on Base (web3)",
        intent: PaymentIntentSchema.parse({
          protocol: "x402",
          action: "pay",
          amount: "5.00",
          currency: "USDC",
          recipient: "0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65",
          network: "base",
          gateway: "viem",
          description: "Demo: x402 USDC on Base",
        }),
      },
      {
        label: "1️⃣2️⃣   x402 remote resource payment (X402 protocol client)",
        intent: PaymentIntentSchema.parse({
          protocol: "x402",
          action: "pay",
          amount: "1.00",
          currency: "USDC",
          recipient: "https://api.example.com/premium/data",
          network: "base",
          gateway: "x402",
          description: "Demo: x402 remote resource payment",
        }),
      },
      {
        label: "1️⃣3️⃣   AP2 remote mandate payment (AP2 protocol client)",
        intent: PaymentIntentSchema.parse({
          protocol: "ap2",
          action: "pay",
          amount: "29.99",
          currency: "USD",
          recipient: "https://merchant.example.com/ap2/process-payment",
          gateway: "ap2",
          description: "Demo: AP2 remote mandate payment",
          metadata: { payment_method_type: "stripe" },
        }),
      },
      {
        label: "⚠️1️⃣4️⃣   Over-limit payment (triggers policy engine)",
        intent: PaymentIntentSchema.parse({
          protocol: "ap2",
          action: "pay",
          amount: "99999.99",
          currency: "USD",
          recipient: "merchant-big-spender",
          network: "web2",
          gateway: "stripe",
          description: "Demo: over-limit, expect policy violation",
        }),
      },
    ];

    for (const demo of demos) {
      console.log(`\n─── ${demo.label} ───`);
      try {
        const result = await executePayment(demo.intent, "cli", "default_wallet");
        if (result.success) {
          const idParts: string[] = [];
          if (result.txHash) idParts.push(`TX: ${result.txHash}`);
          if (result.web2Result) idParts.push(`ID: ${result.web2Result.transaction_id}`);
          if (result.x402Result?.txHash) idParts.push(`x402 TX: ${result.x402Result.txHash}`);
          if (result.ap2Result) idParts.push(`Mandate: ${result.ap2Result.mandate_id}`);
          console.log(`  ✅ Success${idParts.length ? " | " + idParts.join(" | ") : ""}`);
        } else {
          console.log(`  ❌ Not executed: ${result.error ?? "confirmation required"}`);
        }
        if (result.policyResult.violations.length > 0) {
          for (const v of result.policyResult.violations) {
            console.log(`  ⚠️  Policy: [${v.rule}] ${v.message}`);
          }
        }
      } catch (err) {
        console.log(`  💥 Error: ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log("\n══════════════════════════════════════════════════");
    console.log("  Demo complete. All transactions are in SQLite.");
    console.log("  Run: openclaw-payment audit --limit 30");
    console.log("══════════════════════════════════════════════════\n");
  });

program.parse();
