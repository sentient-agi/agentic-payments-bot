// AP2 Protocol Client
// Based on Google's AP2 Agent Payments Protocol
// [[1]](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
// [[2]](https://ap2-protocol.org/specification/)
//
import { getConfig } from "../../config/loader";
import { getLogger } from "../../logging/logger";
import { auditLog } from "../../db/audit";
import { PaymentIntent } from "../router";

// ─── AP2 Types (based on AP2 spec) ─────────────────────────────────────────

export interface AP2Mandate {
  mandate_id: string;
  version: string;
  intent: {
    action: "purchase" | "pay" | "subscribe";
    description: string;
    amount: {
      value: string;
      currency: string;
    };
    recipient: {
      id: string;
      name?: string;
    };
  };
  constraints: {
    max_amount: string;
    valid_from: string;
    valid_until: string;
    single_use: boolean;
  };
  delegator: {
    agent_id: string;
    user_id?: string;
  };
  signature?: string;
}

export interface AP2PaymentMethodData {
  type: "card" | "bank_transfer" | "crypto" | "paypal" | "stripe";
  details: Record<string, unknown>;
}

export interface AP2PaymentResult {
  mandate_id: string;
  status: "success" | "failed" | "pending";
  transaction_id?: string;
  receipt?: {
    amount: string;
    currency: string;
    timestamp: string;
    reference: string;
  };
  error?: string;
}

// ─── AP2 Client ─────────────────────────────────────────────────────────────

export class AP2Client {
  private mandateIssuerUrl: string;
  private credentialProviderUrl: string;
  private timeoutMs: number;

  constructor() {
    const config = getConfig();
    this.mandateIssuerUrl = config.protocols.ap2.mandate_issuer;
    this.credentialProviderUrl = config.protocols.ap2.credential_provider_url;
    this.timeoutMs = config.protocols.ap2.timeout_ms;
  }

  /**
   * Create a signed mandate from a payment intent.
   * In production, mandates are signed with the user's credential (ECDSA).
   */
  createMandate(
    intent: PaymentIntent,
    agentId: string,
    userId?: string
  ): AP2Mandate {
    const now = new Date();
    const validUntil = new Date(now.getTime() + 3600_000); // 1 hour

    const mandate: AP2Mandate = {
      mandate_id: `mandate_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      version: "1.0",
      intent: {
        action: "pay",
        description: intent.description ?? "Agentic payment",
        amount: {
          value: intent.amount,
          currency: intent.currency,
        },
        recipient: {
          id: intent.recipient,
        },
      },
      constraints: {
        max_amount: intent.amount,
        valid_from: now.toISOString(),
        valid_until: validUntil.toISOString(),
        single_use: true,
      },
      delegator: {
        agent_id: agentId,
        user_id: userId,
      },
    };

    getLogger().info("AP2: Mandate created", {
      mandate_id: mandate.mandate_id,
      amount: intent.amount,
      currency: intent.currency,
    });

    return mandate;
  }

  /**
   * Request user signature on the mandate (via credential provider).
   * In a real implementation this triggers a signing flow.
   */
  async requestMandateSignature(
    mandate: AP2Mandate
  ): Promise<AP2Mandate> {
    const logger = getLogger();
    logger.info("AP2: Requesting mandate signature", {
      mandate_id: mandate.mandate_id,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.credentialProviderUrl}/sign-mandate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandate }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `AP2 mandate signing failed: ${response.status} ${await response.text()}`
        );
      }

      const result = (await response.json()) as { signed_mandate: AP2Mandate };
      auditLog("info", "protocol", "ap2_mandate_signed", {
        mandate_id: mandate.mandate_id,
      });

      return result.signed_mandate;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Retrieve payment credentials for the mandate.
   */
  async getPaymentCredentials(
    mandate: AP2Mandate,
    paymentMethodType: string
  ): Promise<AP2PaymentMethodData> {
    const logger = getLogger();
    logger.debug("AP2: Fetching payment credentials", {
      mandate_id: mandate.mandate_id,
      paymentMethodType,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        `${this.credentialProviderUrl}/payment-credentials`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mandate_id: mandate.mandate_id,
            payment_method_type: paymentMethodType,
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error(
          `AP2 credential fetch failed: ${response.status} ${await response.text()}`
        );
      }

      return (await response.json()) as AP2PaymentMethodData;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Submit the payment to the merchant's payment processor.
   */
  async submitPayment(
    mandate: AP2Mandate,
    paymentMethod: AP2PaymentMethodData,
    merchantProcessorUrl?: string
  ): Promise<AP2PaymentResult> {
    const logger = getLogger();
    const url = merchantProcessorUrl ?? `${this.mandateIssuerUrl}/process-payment`;

    logger.info("AP2: Submitting payment", {
      mandate_id: mandate.mandate_id,
      type: paymentMethod.type,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mandate,
          payment_method: paymentMethod,
        }),
        signal: controller.signal,
      });

      const result = (await response.json()) as AP2PaymentResult;

      auditLog(
        result.status === "success" ? "info" : "error",
        "protocol",
        "ap2_payment_submitted",
        {
          mandate_id: mandate.mandate_id,
          status: result.status,
          transaction_id: result.transaction_id,
        }
      );

      return result;
    } finally {
      clearTimeout(timeout);
    }
  }
}
