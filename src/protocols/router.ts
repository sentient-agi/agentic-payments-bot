// Protocol Router (AI Output Parser)
//
import { z } from "zod";
import { getConfig } from "../config/loader";
import { getLogger } from "../logging/logger";
import { auditLog } from "../db/audit";

// ─── Payment Intent Schema ──────────────────────────────────────────────────

export const PaymentIntentSchema = z.object({
  protocol: z.enum(["x402", "ap2"]),
  action: z.literal("pay"),
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Amount must be a decimal string"),
  currency: z.string(),
  recipient: z.string().min(1),
  network: z.string().optional().nullable(),
  gateway: z
    .enum([
      "viem",
      "visa",
      "mastercard",
      "paypal",
      "stripe",
      "googlepay",
      "applepay",
      "x402",
      "ap2",
    ])
    .optional()
    .nullable(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;

// ─── AI Output Parser ───────────────────────────────────────────────────────

/**
 * Extracts a JSON payment intent from free-form AI output text.
 * Looks for a JSON object containing the `"protocol"` and `"action"` fields.
 */
export function parsePaymentIntentFromAIOutput(
  aiOutput: string
): PaymentIntent | null {
  const logger = getLogger();

  // Try to find JSON block in the output
  const jsonPatterns = [
    /```json\s*([\s\S]*?)```/,       // fenced code block
    /```\s*([\s\S]*?)```/,            // generic code block
    /(\{[\s\S]*?"protocol"[\s\S]*?\})/,  // raw JSON with protocol field
  ];

  for (const pattern of jsonPatterns) {
    const match = aiOutput.match(pattern);
    if (match?.[1]) {
      try {
        const parsed = JSON.parse(match[1].trim());
        const validated = PaymentIntentSchema.parse(parsed);
        logger.info("Parsed payment intent from AI output", {
          protocol: validated.protocol,
          amount: validated.amount,
          currency: validated.currency,
        });
        return validated;
      } catch {
        // try next pattern
      }
    }
  }

  // Try the entire output as JSON
  try {
    const parsed = JSON.parse(aiOutput.trim());
    return PaymentIntentSchema.parse(parsed);
  } catch {
    logger.debug("No valid payment intent found in AI output");
    return null;
  }
}

// ─── Protocol Router ────────────────────────────────────────────────────────

export type ProtocolRoute = {
  protocol: "x402" | "ap2";
  paymentType: "web3" | "web2" | "x402" | "ap2";
  gateway: string;
};

/**
 * Decides which protocol + payment backend to use based on the parsed intent.
 *
 * Gateway values:
 *   - "viem"         → direct web3 (Viem ETH/ERC-20)
 *   - "stripe", "paypal", "visa", "mastercard", "googlepay", "applepay" → web2
 *   - "x402"         → remote x402 resource payment (client)
 *   - "ap2"          → remote AP2 mandate payment (client)
 */
export function routePaymentIntent(intent: PaymentIntent): ProtocolRoute {
  const config = getConfig();
  const logger = getLogger();

  // Determine payment type
  let paymentType: ProtocolRoute["paymentType"];
  let gateway: string;

  // ── Explicit gateway override ─────────────────────────────────────────
  if (intent.gateway) {
    gateway = intent.gateway;
    if (gateway === "x402") {
      paymentType = "x402";
    } else if (gateway === "ap2") {
      paymentType = "ap2";
    } else if (gateway === "viem") {
      paymentType = "web3";
    } else {
      paymentType = "web2";
    }
  } else {
    // Auto-detect based on recipient's URL with protocol hints → protocol client
    const isUrl = intent.recipient.startsWith("http://") || intent.recipient.startsWith("https://");
    if (isUrl && intent.protocol === "x402") {
      // Recipient is a URL → use x402 client to pay for the remote resource
      paymentType = "x402";
      gateway = "x402";
    } else if (isUrl && intent.protocol === "ap2") {
      // Recipient is a remote AP2 endpoint → use AP2 client
      paymentType = "ap2";
      gateway = "ap2";
    } else {
      // Auto-detect based on protocol and currency
      const cryptoCurrencies = ["USDC", "ETH", "WETH", "DAI", "USDT"];
      if (
        intent.protocol === "x402" ||
        cryptoCurrencies.includes(intent.currency.toUpperCase())
      ) {
        paymentType = "web3";
        gateway = "viem";
      } else {
        paymentType = "web2";
        gateway = "stripe"; // default web2 gateway
      }
    }
  }

  // Validate protocol is enabled
  if (intent.protocol === "x402" && !config.protocols.x402.enabled) {
    throw new Error("x402 protocol is disabled in configuration");
  }
  if (intent.protocol === "ap2" && !config.protocols.ap2.enabled) {
    throw new Error("AP2 protocol is disabled in configuration");
  }

  const route: ProtocolRoute = { protocol: intent.protocol, paymentType, gateway };

  logger.info("Routed payment intent", route);
  auditLog("info", "protocol", "intent_routed", route as unknown as Record<string, unknown>);

  return route;
}
