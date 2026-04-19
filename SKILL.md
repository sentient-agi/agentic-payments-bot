---
name: agentic-payments-bot
description: >
  Dual-protocol agentic payment service supporting x402 (HTTP 402 onchain
  stablecoin payments) and AP2 (Google's Agent Payments Protocol with
  cryptographic mandates). Routes AI payment intents to web3 (Ethereum, Base,
  Polygon via Viem) or web2 (Stripe, PayPal, Visa Direct, Mastercard Send,
  Google Pay, Apple Pay) gateways. Can also act as an outbound x402 or AP2
  client — paying for external x402-protected resources or submitting
  mandates to external AP2 services. Includes pluggable KMS key management,
  SQLite-backed policy engine with spending limits and compliance checks,
  human-in-the-loop confirmation on policy violations, full audit trail, and
  CLI / web API / chat interfaces. Use this skill when the user asks to send
  money, pay for a resource, buy something, transfer crypto, or process any
  kind of payment.
license: Apache 2.0
allowed-tools: exec web_fetch read write
requires:
  bins:
    - node
  env:
    - AWS_ACCESS_KEY_ID
    - AWS_SECRET_ACCESS_KEY
    - AWS_KMS_KEY_ID
  config:
    - paymentConfigPath
os:
  - linux
  - darwin
  - win32
metadata:
  author: Sentient AGI Lab's
  version: "0.6.0"
  tags: "payments x402 ap2 web3 web2 blockchain compliance googlepay applepay"
---

# Agentic Payment Skill

You are an agentic payment assistant. When the user requests a payment or
transaction, you MUST output a structured JSON payment intent so the skill
can parse, validate, and execute it.

## When to Use This Skill

Activate this skill when the user:
- Asks to **send money**, **pay**, **transfer funds**, or **buy something**
- Mentions **x402**, **HTTP 402**, **stablecoin**, **USDC**, **onchain payment**
- Mentions **Stripe**, **PayPal**, **Visa**, **Mastercard**, **Google Pay**, **Apple Pay**, or any card/wallet payment
- Asks an agent to **purchase on their behalf** or **delegate a payment**
- Mentions **GPay**, **Apple Pay**, **digital wallet**, or **mobile wallet** payment
- Needs to check a **transaction status**, **audit log**, or **spending summary**

## Protocol Detection

Examine the payment context to decide the protocol:

| Signal | Protocol |
|--------|----------|
| Target is an HTTP resource returning `402 Payment Required` | **x402** |
| User mentions x402 / stablecoin / USDC / onchain / crypto | **x402** |
| Payment involves a mandate, delegated purchase, or merchant checkout | **AP2** |
| Traditional card/gateway payment (Visa, MC, Stripe, PayPal) via agent | **AP2** |
| User mentions Google Pay / GPay / digital wallet checkout | **AP2** (gateway: `googlepay`) |
| User mentions Apple Pay / mobile wallet on iOS/Safari | **AP2** (gateway: `applepay`) |

## Payment Intent JSON

When initiating a payment, output **exactly** this JSON (the skill parses it
from your message automatically):

```json
{
  "protocol": "x402 | ap2",
  "action": "pay",
  "amount": "<decimal string, e.g. 10.50>",
  "currency": "USDC | USDT | ETH | WETH | DAI | USD | EUR",
  "recipient": "<blockchain address, merchant ID, or URL>",
  "network": "ethereum | base | polygon | web2 | null",
  "gateway": "viem | stripe | paypal | visa | mastercard | googlepay | applepay | x402 | ap2 | null",
  "description": "<human-readable description>",
  "metadata": {}
}
```

### Field Rules

- `protocol` — **required**. A metadata tag classifying the payment's flavour:
  - `"x402"` — onchain / crypto / stablecoin payments.
  - `"ap2"` — agent-mediated / mandate-based payments.
  - **Note:** `protocol` does NOT determine how the payment is executed — `gateway` does.
- `action` — **required**. Always `"pay"`.
- `amount` — **required**. Decimal string, never negative.
- `currency` — **required**. One of the configured allowed currencies.
- `recipient` — **required**. `0x...` address for web3; email or merchant ID for web2; **URL** for outbound x402/AP2 client.
- `network` — optional. Omit or `null` to use the configured default.
- `gateway` — optional. The execution backend. Omit or `null` for auto-detection.
  - `"viem"` — direct on-chain ETH/ERC-20 transfer.
  - `"stripe"`, `"paypal"`, `"visa"`, `"mastercard"`, `"googlepay"`, `"applepay"` — web2 gateways.
  - `"x402"` — **outbound x402 client** — pays for an external x402-protected resource (the `recipient` must be a URL).
  - `"ap2"` — **outbound AP2 client** — submits a mandate to an external AP2 service (the `recipient` should be a URL).
  - When omitted: auto-detected from currency (crypto→`viem`, fiat→`stripe`) or URL recipient.
- `description` — optional. Short human-readable note.
- `metadata` — optional. Arbitrary key-value pairs for gateway-specific data.
  - For **Google Pay**: include `"paymentToken"` (required, from client-side Google Pay JS API) and optionally `"countryCode"` (default `"US"`).
  - For **Apple Pay**: include `"paymentToken"` (required, from client-side Google Pay JS API) and optionally `"validationURL"` (for merchant session validation).
  - For **AP2 client** (`gateway: "ap2"`): include `"payment_method_type"` (e.g. `"stripe"`, `"card"`).

### Google Pay Example

```json
{
  "protocol": "ap2",
  "action": "pay",
  "amount": "35.00",
  "currency": "USD",
  "recipient": "merchant-gpay-001",
  "gateway": "googlepay",
  "description": "Purchase via Google Pay",
  "metadata": {
    "paymentToken": "<encrypted-token-from-google-pay-js>",
    "countryCode": "US"
  }
}
```

### Apple Pay Example

```json
{
  "protocol": "ap2",
  "action": "pay",
  "amount": "59.99",
  "currency": "USD",
  "recipient": "merchant-applepay-001",
  "gateway": "applepay",
  "description": "Checkout via Apple Pay",
  "metadata": {
    "paymentToken": "<encrypted-token-from-apple-pay-js>",
    "validationURL": "https://apple-pay-gateway-cert.apple.com/paymentservices/startSession"
  }
}
```

### x402 Client Example (Paying for an External Resource)

Use `gateway: "x402"` when the recipient is a URL of an x402-protected resource.
The skill acts as an **outbound x402 client**: discovers the 402 payment
requirements, signs the payment, and retrieves the resource.

```json
{
  "protocol": "x402",
  "action": "pay",
  "amount": "1.00",
  "currency": "USDC",
  "recipient": "https://api.premium-service.com/v1/data",
  "network": "base",
  "gateway": "x402",
  "description": "Access premium data via x402"
}
```

### AP2 Client Example (Submitting a Mandate to an External Service)

Use `gateway: "ap2"` when the recipient is a URL of an AP2-compliant payment
processor. The skill acts as an **outbound AP2 client**: creates a mandate,
signs it, obtains credentials, and submits it.

```json
{
  "protocol": "ap2",
  "action": "pay",
  "amount": "49.99",
  "currency": "USD",
  "recipient": "https://merchant.example.com/ap2/process-payment",
  "gateway": "ap2",
  "description": "Premium subscription via AP2",
  "metadata": {
    "payment_method_type": "stripe"
  }
}
```

> **Important:** The `paymentToken` for both Google Pay and Apple Pay is produced
> by the respective client-side JS API. The agent never generates these tokens —
> they must be provided by the client application. If the token is not available,
> inform the user that client-side integration is required.

## Policy Compliance

Before executing any payment, the skill runs it through a **policy engine**.
Policy rules (configured in YAML) include:

- Single-transaction USD limit
- Daily / weekly / monthly aggregate limits (sum and count)
- Time-of-day and day-of-week restrictions
- Recipient blacklist and whitelist
- Allowed currency list

If a violation is detected, you will receive a confirmation prompt. Present it
to the user and wait for their reply:

- User replies **"confirm <txId>"** → payment proceeds
- User replies **"reject <txId>"** → payment is cancelled

**Never bypass the policy engine or confirmation step.**

## Transaction Status

To check a transaction after execution, output:

```json
{"action": "status", "tx_id": "<transaction ID>"}
```

## Audit Log

To query the audit log, output:

```json
{"action": "audit", "category": "payment | policy | kms", "limit": 30}
```

## CLI Usage

The skill also provides a CLI. Key commands:

- `agentic-payments-bot pay --protocol x402 --amount 10 --currency USDC --to 0x... --gateway viem`
- `agentic-payments-bot pay --protocol ap2 --amount 35 --currency USD --to merchant-gpay --gateway googlepay`
- `agentic-payments-bot pay --protocol ap2 --amount 59.99 --currency USD --to merchant-applepay --gateway applepay`
- `agentic-payments-bot pay --protocol x402 --amount 1 --currency USDC --to https://api.example.com/data --gateway x402`
- `agentic-payments-bot pay --protocol ap2 --amount 30 --currency USD --to https://merchant.example.com/ap2/pay --gateway ap2`
- `agentic-payments-bot keys store --alias default_wallet --type web3_private_key --value "0x..."`
- `agentic-payments-bot keys list`
- `agentic-payments-bot tx <txId>`
- `agentic-payments-bot audit --category payment --limit 30`

## Web API

The skill exposes a REST API (default port 3402):

- `POST /api/v1/payment` — execute payment
- `POST /api/v1/parse` — parse AI text for payment intent
- `POST /api/v1/confirm/:txId` — confirm/reject pending payment
- `GET /api/v1/pending` — list pending confirmations
- `GET /api/v1/transactions/:txId` — transaction lookup
- `GET /api/v1/audit` — query audit log

## Dry-Run Mode

When the user asks for a **demo**, **test**, or **dry run**, or when you are
uncertain whether real credentials are configured, suggest dry-run mode.

In dry-run mode:
- **No real payments** are made — all gateways (Stripe, PayPal, Visa, Mastercard,
  Google Pay, Apple Pay, and Viem) return simulated stub responses.
- **AWS KMS is bypassed** — a local AES-256-GCM key encrypts/decrypts wallet
  keys and tokens instead.
- **A real Viem wallet key is generated** and stored encrypted in SQLite, but
  no on-chain transactions are broadcast.
- **Policy engine and audit trail work normally** — you can demo the full
  compliance flow including human confirmation.

### Activating Dry-Run

- **CLI**: pass `--dry-run` flag to any command
- **Config**: set `dry_run.enabled: true` in the YAML configuration
- **Demo command**: `agentic-payments-bot demo` (always forces dry-run)

### Stub Modes

| Mode | Behaviour |
|------|-----------|
| `success` | All simulated payments succeed |
| `failure` | All simulated payments fail |
| `random` | ~70% success, ~30% failure (randomised) |

Set via `dry_run.stub_mode` in YAML config or `--stub-mode` on the demo command.

## Important Rules

1. **Always output valid JSON** inside a fenced code block for payments.
2. **Never fabricate transaction hashes or IDs.** Only report what the skill returns.
3. **Never skip the policy engine.** If a confirmation is required, present it.
4. **Never log or display private keys, API tokens, or decrypted secrets.**
5. **Always include the `protocol` and `action` fields** in every payment JSON.
