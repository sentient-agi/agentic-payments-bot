<p align="center">
  <img height="500px" src="docs/png/banner.png" />
</p>

# 🤖💵 Agentic Payment Service for Open Agent Skills Ecosystem.

> A dual-protocol (x402 + AP2) agentic payment service for Open Agent Skills Ecosystem (including OpenClaw, Claude Code, Codex, Junie, OpenCode, GitHub Copilot, Gemini CLI, etc.),
> with web3 & web2 gateway support, AWS KMS key management, policy engine compliance, audit trail, and human-in-the-loop confirmation.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![OpenClaw Skill](https://img.shields.io/badge/OpenClaw-Skill-ff6b35.svg)](https://openclaw.ai)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-green.svg)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
  - [System Diagram](#system-diagram)
  - [Directory Structure](#directory-structure)
  - [Data Flow](#data-flow)
- [Quick Start with Docker and Docker Compose](#quick-start)
- [Supported Protocols](#supported-protocols)
  - [x402 Protocol](#x402-protocol)
  - [AP2 Protocol (Agent Payments Protocol)](#ap2-protocol-agent-payments-protocol)
  - [Protocol Router](#protocol-router)
- [Payment Backends](#payment-backends)
  - [Web3 — Ethereum (Viem)](#web3--ethereum-viem)
  - [Web2 — Stripe](#web2--stripe)
  - [Web2 — PayPal](#web2--paypal)
  - [Web2 — Visa Direct](#web2--visa-direct)
  - [Web2 — Mastercard Send](#web2--mastercard-send)
  - [Web2 — Google Pay](#web2--google-pay)
  - [Web2 — Apple Pay](#web2--apple-pay)
- [Security](#security)
  - [KMS Provider System](#kms-provider-system)
    - [Provider Overview](#provider-overview)
    - [Provider Selection Logic](#provider-selection-logic)
    - [AWS KMS Provider](#aws-kms-provider)
    - [OS Keyring Provider](#os-keyring-provider)
    - [D-Bus Secret Service Provider](#d-bus-secret-service-provider)
    - [GnuPG Provider](#gnupg-provider)
    - [Local AES Provider](#local-aes-provider)
    - [Provider Comparison Matrix](#provider-comparison-matrix)
    - [Headless Fallback Behavior](#headless-fallback-behavior)
  - [Encrypted Key Storage (SQLite)](#encrypted-key-storage-sqlite)
  - [Environment Variables](#environment-variables)
- [Policy Engine](#policy-engine)
  - [Rule Types](#rule-types)
  - [Time-Based Aggregate Tracking](#time-based-aggregate-tracking)
  - [Human Confirmation Feedback Loop](#human-confirmation-feedback-loop)
- [Audit Trail & Logging](#audit-trail--logging)
  - [SQLite Audit Log](#sqlite-audit-log)
  - [Winston Logger (stdout/stderr/file)](#winston-logger-stdoutstderrfile)
- [Database Schema](#database-schema)
- [Installation](#installation)
- [Dry-Run Mode](#dry-run-mode)
- [Configuration Reference (YAML)](#configuration-reference-yaml)
  - [Full Annotated Configuration](#full-annotated-configuration)
  - [Configuration Sections](#configuration-sections)
- [CLI Reference](#cli-reference)
  - [Global Options](#global-options)
  - [pay — Execute a Payment](#pay--execute-a-payment)
  - [parse — Parse AI Output](#parse--parse-ai-output)
  - [keys — Key Management](#keys--key-management)
  - [tx — Transaction Lookup](#tx--transaction-lookup)
  - [audit — Query Audit Log](#audit--query-audit-log)
- [Web API Reference](#web-api-reference)
  - [Base URL](#base-url)
  - [Endpoints](#endpoints)
    - [GET /api/v1/health](#get-apiv1health)
    - [POST /api/v1/payment](#post-apiv1payment)
    - [POST /api/v1/parse](#post-apiv1parse)
    - [POST /api/v1/confirm/:txId](#post-apiv1confirmtxid)
    - [GET /api/v1/pending](#get-apiv1pending)
    - [GET /api/v1/transactions/:txId](#get-apiv1transactionstxid)
    - [GET /api/v1/audit](#get-apiv1audit)
  - [Error Responses](#error-responses)
- [OpenClaw Chat Integration](#openclaw-chat-integration)
  - [Payment Intent JSON Schema](#payment-intent-json-schema)
  - [Protocol Detection Heuristics](#protocol-detection-heuristics)
  - [Chat Confirmation Flow](#chat-confirmation-flow)
- [Usage Examples](#usage-examples)
  - [Example 1 — x402 USDC Payment via CLI](#example-1--x402-usdc-payment-via-cli)
  - [Example 2 — AP2 Stripe Payment via Web API](#example-2--ap2-stripe-payment-via-web-api)
  - [Example 3 — AI Chat-Driven Payment](#example-3--ai-chat-driven-payment)
  - [Example 4 — Policy Violation & Human Confirmation](#example-4--policy-violation--human-confirmation)
  - [Example 5 — Key Management](#example-5--key-management)
  - [Example 6 — Google Pay Payment via Web API](example-6--google-pay-payment-via-web-api)
  - [Example 7 — Apple Pay Payment via Web API](#example-7--apple-pay-payment-via-web-api)
- [Development](#development)
  - [Build](#build)
  - [Run Tests](#run-tests)
  - [Project Dependencies](#project-dependencies)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Overview

**agent-payments-skill** is an Open Agent Skills Ecosystem compliant skill that enables AI agents to autonomously
initiate, validate, and execute payments across both blockchain (web3) and traditional (web2)
payment rails.

### Key Capabilities

| Capability | Details |
|---|---|
| **Dual protocol support** | x402 (HTTP 402 + onchain settlement) and AP2 (Google's mandate-based agent payments) |
| **Web3 transactions** | Ethereum, Base, Polygon via [Viem](https://viem.sh) — native ETH and ERC-20 (USDC, etc.) |
| **Web2 gateways** | Stripe, PayPal, Visa Direct, Mastercard Send, Google Pay, Apple Pay |
| **Key management** | Pluggable KMS providers: AWS KMS, OS Keyring (KDE Wallet / GNOME Keyring / macOS Keychain / Windows Credential Manager), D-Bus Secret Service, GnuPG, Local AES-256-GCM |
| **Policy engine** | Per-tx limits, daily/weekly/monthly aggregates, time-of-day, blacklist/whitelist, currency restrictions |
| **Human-in-the-loop** | Automatic escalation on policy violations via CLI prompt, chat prompt, or web API |
| **Audit trail** | Every action logged to SQLite `audit_log` table + Winston (stdout/stderr/file) |
| **Three interfaces** | OpenClaw (or other agent) chat, CLI (`agent-payments`), REST web API |
| **Fully configurable** | Single YAML file controls all behavior |

---

## Architecture

### System Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Agent Payments Skill                            │
│  ┌───────────┐   ┌───────────────┐   ┌──────────┐                        │
│  │  Chat UI  │   │   CLI (term)  │   │ Web API  │                        │
│  └─────┬─────┘   └───────┬───────┘   └────┬─────┘                        │
│        │                 │                │                              │
│        ▼                 ▼                ▼                              │
│  ┌─────────────────────────────────────────────────┐                     │
│  │              Protocol Router                    │                     │
│  │  (AI output parser → PaymentIntent → routing)   │                     │
│  └───────────┬─────────────────┬───────────────────┘                     │
│              │                 │                                         │
│     ┌────────▼──────┐  ┌──────▼────────┐                                 │
│     │  x402 Client  │  │  AP2 Client   │                                 │
│     │  (HTTP 402)   │  │  (Mandates)   │                                 │
│     └────────┬──────┘  └──────┬────────┘                                 │
│              │                │                                          │
│  ┌───────────▼────────────────▼───────────────┐                          │
│  │            Policy Engine                   │                          │
│  │  (compliance checks before execution)      │                          │
│  │  ┌──────────────────────────────────────┐  │                          │
│  │  │ • Single tx limit    • Blacklist     │  │                          │
│  │  │ • Daily/Weekly/Mo    • Whitelist     │  │                          │
│  │  │ • Time-of-day        • Currency      │  │                          │
│  │  └──────────────────────────────────────┘  │                          │
│  │       │ (violation?) ──► Human Confirm     │                          │
│  └───────┼────────────────────────────────────┘                          │
│          │                                                               │
│  ┌───────▼──────────────────────────────────────────┐                    │
│  │              Payment Execution                   │                    │
│  │  ┌──────────┐  ┌────────┐  ┌────────┐  ┌──────┐  │ ┌───────────────┐  │
│  │  │  Viem    │  │ Stripe │  │ PayPal │  │ Visa │  │ │  KMS Provider │  │
│  │  │ (ETH/    │  │        │  │        │  │ MC   │  │ │ ┌───────────┐ │  │
│  │  │  ERC20)  │  │        │  │        │  │ GPay │  │ │ │ AWS KMS   │ │  │
│  │  └──────────┘  └────────┘  └────────┘  │ APay │  │ │ │ OS Keyring│ │  │
│  │                                        └──────┘  │ │ │ D-Bus SS  │ │  │
│  │                                                  │◄│ │ GnuPG     │ │  │
│  │                                                  │ │ │ Local AES │ │  │
│  │                                                  │ │ └───────────┘ │  │
│  └──────────────────┬───────────────────────────────┘ └───────────────┘  │
│                     │                                                    │
│  ┌──────────────────▼───────────────────────────────┐                    │
│  │                  SQLite                          │                    │
│  │  ┌──────────────┐  ┌──────────┐  ┌────────────┐  │                    │
│  │  │encrypted_keys│  │ transac- │  │ audit_log  │  │                    │
│  │  │              │  │ tions    │  │            │  │                    │
│  │  └──────────────┘  └──────────┘  └────────────┘  │                    │
│  └──────────────────────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
agent-payments-skill/
├── SKILL.md                          # Open Agent Skills Ecosystem compliant skill definition (YAML frontmatter + markdown)
├── package.json                      # npm package manifest
├── tsconfig.json                     # TypeScript compiler config
├── .env.example                      # Environment variable template
├── .gitignore
├── config/
│   └── default.yaml                  # Master YAML configuration
├── src/
│   ├── index.ts                      # Main entry point / orchestrator
│   ├── cli.ts                        # CLI interface (Commander.js)
│   ├── web-api.ts                    # REST API (Express)
│   ├── config/
│   │   └── loader.ts                 # YAML config loader + Zod validation
│   ├── protocols/
│   │   ├── router.ts                 # Protocol router + AI output parser
│   │   ├── x402/
│   │   │   └── client.ts             # x402 HTTP 402 client
│   │   └── ap2/
│   │       └── client.ts             # AP2 mandate-based client
│   ├── payments/
│   │   ├── web3/
│   │   │   └── ethereum.ts           # Viem-based ETH/ERC-20 tx producer
│   │   └── web2/
│   │       └── gateways.ts           # Stripe, PayPal, Visa, MasterCard, Google Pay, Apple Pay
│   ├── kms/
│   │   ├── provider.ts               # KmsProvider interface (shared contract)
│   │   ├── factory.ts                # Provider factory (selects backend from config)
│   │   ├── aws-kms.ts                # Public API: encryptAndStore / retrieveAndDecrypt
│   │   ├── aws-kms-provider.ts       # AWS KMS provider implementation
│   │   ├── os-keyring-provider.ts    # OS Keyring via @aspect-build/keytar
│   │   ├── dbus-secret-service-provider.ts  # Linux D-Bus Secret Service (dbus-next)
│   │   ├── gpg-provider.ts           # GnuPG encryption for headless Linux
│   │   └── local-aes-provider.ts     # Local AES-256-GCM (fallback / dry-run)
│   ├── dry-run/
│   │   ├── crypto.ts                 # Local AES-256-GCM encryption (no KMS)
│   │   ├── stubs.ts                  # Gateway stub responses (success/failure/random)
│   │   └── wallet.ts                 # Viem key generation + local encrypt/store
│   ├── db/
│   │   ├── sqlite.ts                 # SQLite init + migrations
│   │   ├── key-store.ts              # Encrypted key CRUD
│   │   ├── transactions.ts           # Transaction records + aggregates
│   │   └── audit.ts                  # Audit trail read/write
│   ├── policy/
│   │   ├── engine.ts                 # Policy rule evaluator
│   │   └── feedback.ts               # Human confirmation (CLI/chat/API)
│   └── logging/
│       └── logger.ts                 # Winston multi-transport logger
├── data/                             # (created at runtime)
│   └── payments.db                   # SQLite database
└── logs/                             # (created at runtime)
    └── payment-skill.log             # File log output
```

### Data Flow

```
User/Agent input
       │
       ▼
┌──────────────────┐     ┌──────────────────────┐
│ Parse AI Output  │────►│ Validate JSON Schema │
│ (regex + JSON)   │     │ (Zod PaymentIntent)  │
└──────────────────┘     └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Protocol Router    │
                         │ (x402 or AP2, web3   │
                         │  or web2 detection)  │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Create Transaction   │
                         │ Record (SQLite)      │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌───────────────────────┐
                         │   Policy Engine       │◄── rules from YAML
                         │ • limits check        │◄── aggregates from SQLite
                         │ • blacklist/whitelist │
                         │ • time restrictions   │
                         └──────────┬────────────┘
                                    │
                            ┌───────┴────────┐
                            │  violations?   │
                            └───┬────────┬───┘
                           yes  │        │ no
                                ▼        │
                    ┌───────────────┐    │
                    │ Human Confirm │    │
                    │ (CLI/Chat/API)│    │
                    └───────┬───────┘    │
                     reject │ confirm    │
                       ▼    │    ┌───────┘
                    REJECT  │    │
                            ▼    ▼
                    ┌──────────────────────┐
                    │  Decrypt Keys (KMS)  │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Execute Payment    │
                    │  (Viem / Stripe /   │
                    │   PayPal / Visa /   │
                    │   Mastercard /      │
                    │   Google Pay /      │
                    │   Apple Pay)        │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Update Transaction │
                    │  + Audit Log        │
                    └─────────────────────┘
```

---

## Quick Start

**A quick start guide with Docker and Docker Compose.**

### Usage

**Quick start (dry-run, no credentials needed):**

```bash
# Build and start both services
DRY_RUN=true docker compose up --build -d

# Check the payment API health
curl http://localhost:3402/api/v1/health

# Run the demo via the CLI helper
DRY_RUN=true docker compose run --rm cli demo

# View audit log
DRY_RUN=true docker compose run --rm cli audit --limit 20

# Store a key via CLI
DRY_RUN=true docker compose run --rm cli keys list
```

**Production (with real credentials):**

```bash
# Create a .env file with your secrets
cat > .env <<EOF
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/...
LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-...
OPENCLAW_GATEWAY_TOKEN=your-gateway-token
EOF

# Start
docker compose up --build -d

# Tail logs
docker compose logs -f openclaw-payments

# Stop
docker compose down
```

**Pair OpenClaw with a messaging channel (e.g. Telegram):**

```bash
# Run the OpenClaw CLI inside the running container
docker compose exec openclaw-payments openclaw pairing approve telegram
```

---

### What this gives you

| Container | Service | Port | Description |
|---|---|---|---|
| `openclaw-payments` | Payment Skill Web API | `3402` | REST API for payments, parsing, confirmations, audit |
| `openclaw-payments` | OpenClaw Gateway | `18789` | Agent gateway (Telegram, Slack, WhatsApp, etc.) |
| `openclaw-payments` | OpenClaw Bridge | `18790` | Internal bridge for multi-channel routing |
| `openclaw-payments-cli` | CLI (on-demand) | — | Runs `openclaw-payment` CLI commands against the shared SQLite DB |

Both services share the same SQLite database and encrypted key store through Docker volumes [[1]](https://til.simonwillison.net/llms/openclaw-docker). The payment skill is auto-registered as an OpenClaw skill via the symlink into `~/.openclaw/skills/` [[2]](https://docs.openclaw.ai/tools/skills), so the agent discovers it at startup through the standard skill loading mechanism.

---

## Supported Protocols

### x402 Protocol

[x402](https://x402.org/) is an open payment protocol built by Coinbase that revives the HTTP
`402 Payment Required` status code for internet-native stablecoin payments. It is stateless,
HTTP-native, and developer-friendly.

**How the skill uses x402:**

1. **Discovery** — The client sends a `GET` request to a resource URL. If `402` is returned, the
   response body (or headers) contains payment details: `scheme`, `network`, `amount`, `payTo`,
   `asset`, and `maxTimeoutSeconds`.
2. **Payment** — The skill signs an EIP-3009 `transferWithAuthorization` using the wallet's
   private key (decrypted from KMS) via Viem. The signed payload is Base64-encoded and sent as
   the `X-PAYMENT` header on a retried `GET` request.
3. **Settlement** — The resource server (or its facilitator) verifies and settles the payment
   onchain. A `200 OK` response is returned with the resource and an `X-PAYMENT-RESPONSE`
   header containing the settlement receipt (including `txHash`).

**Supported networks:** Ethereum Mainnet, Base, Polygon (configurable).

**Supported assets:** USDC (default), any ERC-20 with known contract addresses.

**Reference:** [x402 GitHub](https://github.com/coinbase/x402) ·
[x402 Docs](https://docs.cdp.coinbase.com/x402/welcome) ·
[ERC-8004 Spec](https://www.x402.org/)

### AP2 Protocol (Agent Payments Protocol)

[AP2](https://ap2-protocol.org/) is Google's open protocol for AI agent-driven payments. It uses
cryptographically signed **Mandates** — verifiable credentials that capture user intent and
constraints — to enable agents to transact on behalf of humans.

**AP2 Mandate Types:**

| Mandate | Purpose |
|---|---|
| **IntentMandate** | Captures the user's initial intent (e.g., "buy running shoes under $100") with a max spend ceiling. Signed by the user. |
| **CartMandate** | Locks a specific cart of items and price. Created after the agent finds products. |
| **PaymentMandate** | Authorizes actual payment execution. Contains payment method reference and final amount. |

**How the skill uses AP2:**

1. **Create Mandate** — From a `PaymentIntent`, the skill constructs an AP2 mandate with intent
   details, amount constraints, validity window, and delegator info.
2. **Sign Mandate** — The mandate is sent to a credential provider for user signature
   (ECDSA-based verifiable credential).
3. **Obtain Credentials** — Payment credentials are retrieved using the signed mandate and the
   desired payment method type.
4. **Submit Payment** — The signed mandate + credentials are sent to the merchant's payment
   processor for execution.

**Supported payment methods:** Card (Visa/MC via gateway), PayPal, Stripe, Crypto
(transparently routed through the appropriate web2/web3 backend).

**Reference:** [AP2 Specification](https://ap2-protocol.org/specification/) ·
[Google Announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)

### Protocol Router

The protocol router (`src/protocols/router.ts`) is the entry point for all payment requests. It:

1. **Parses AI output** — Extracts JSON `PaymentIntent` from free-form AI text using multiple
   strategies:
   - Fenced JSON code blocks (` ```json ... ``` `)
   - Generic code blocks (` ``` ... ``` `)
   - Raw JSON containing a `"protocol"` field
   - The entire text as JSON (for direct API input)
2. **Validates** with Zod schema enforcement
3. **Routes** to the correct protocol + payment backend based on:
   - Explicit `gateway` field (if provided)
   - Currency-based heuristic (crypto currencies → web3/viem, fiat → web2/stripe)
   - Protocol hint (x402 → web3, AP2 → either)

---

## Payment Backends

### Web3 — Ethereum (Viem)

The Viem-based transaction producer (`src/payments/web3/ethereum.ts`) supports:

| Operation | Function | Details |
|---|---|---|
| **Send ETH** | `sendEth()` | Native ETH transfer on any supported EVM chain |
| **Send ERC-20** | `sendErc20()` | Token transfer (USDC, USDT, DAI, etc.) using `transfer()` ABI |
| **Wait for confirmation** | `waitForConfirmation()` | Polls for on-chain receipt |

**Supported chains** (configurable via YAML):

| Chain | Chain ID | Default RPC |
|---|---|---|
| Ethereum Mainnet | 1 | `https://mainnet.infura.io/v3/...` |
| Base | 8453 | `https://mainnet.base.org` |
| Polygon | 137 | `https://polygon-rpc.com` |

**Well-known USDC addresses** are built-in per chain. Custom token addresses can be passed
directly.

### Web2 — Stripe

Uses the official [Stripe Node.js SDK](https://www.npmjs.com/package/stripe).

- Creates a `PaymentIntent` via `stripe.paymentIntents.create()`
- Amount converted to cents (integer)
- Metadata includes protocol, recipient, and any custom fields
- API key decrypted from AWS KMS at runtime

### Web2 — PayPal

Uses PayPal's REST Checkout API v2.

- OAuth2 client credentials flow for access token
- Creates an Order via `POST /v2/checkout/orders`
- Returns approval URL for user authorization
- Client ID and secret decrypted from AWS KMS

### Web2 — Visa Direct

Uses Visa Direct Push Funds Transfer API.

- `POST /visadirect/fundstransfer/v1/pushfundstransactions`
- Basic auth (user/password from KMS)
- Supports person-to-merchant and person-to-person transfers

### Web2 — Mastercard Send

Uses Mastercard Send Transfer API.

- `POST /send/v1/partners/transfers/payment`
- OAuth 1.0a authentication (consumer key + signing key from KMS)
- Supports credit and debit funding sources

### Web2 — Google Pay

Uses the [Google Pay API](https://developers.google.com/pay/api) for server-side payment token processing.

- The client obtains a payment token via the Google Pay JS API and passes it to the skill
  in `metadata.paymentToken`
- The server processes the token against the Google Pay payment gateway endpoint
- Supports `PAN_ONLY` and `CRYPTOGRAM_3DS` authentication methods
- Configurable card networks: Visa, Mastercard, Amex, Discover, JCB
- Merchant ID and merchant key decrypted from AWS KMS at runtime
- Environment configurable between `TEST` and `PRODUCTION`

**Required metadata fields:**

| Field | Required | Description |
|---|---|---|
| `paymentToken` | ✅ | Encrypted payment token from the Google Pay JS API client |
| `countryCode` | ❌ | ISO 3166-1 alpha-2 country code (default: `US`) |

### Web2 — Apple Pay

Uses the [Apple Pay API](https://developer.apple.com/apple-pay/) for server-side merchant
validation and payment token processing.

- The client obtains an encrypted payment token via the Apple Pay JS API and passes it to
  the skill in `metadata.paymentToken`
- Optional server-to-server merchant session validation with Apple's servers
  (when `metadata.validationURL` is provided)
- Token is forwarded to the payment processor for decryption and authorization
- Configurable supported networks: Visa, Mastercard, Amex, Discover
- Merchant capabilities: 3DS, credit, and debit support
- Requires a verified domain registered with Apple
- Merchant ID, certificate, key, and processor key decrypted from AWS KMS

**Required metadata fields:**

| Field | Required | Description |
|---|---|---|
| `paymentToken` | ✅ | Encrypted payment token from the Apple Pay JS API client |
| `validationURL` | ❌ | Apple's merchant validation URL (for session validation step) |

---

## Security

The skill uses a **pluggable KMS (Key Management System) provider** architecture
for all secret management. Every sensitive credential — web3 wallet private keys
(Viem), API tokens (Stripe, PayPal, Visa, Mastercard, Google Pay, Apple Pay), and
authentication secrets — flows through a single pair of functions:

| Function | Description |
|---|---|
| `encryptAndStore(keyAlias, keyType, plaintext)` | Encrypt and persist a secret |
| `retrieveAndDecrypt(keyAlias)` | Fetch and decrypt a secret for use |

All payment consumers (`ethereum.ts`, `gateways.ts`, `cli.ts`) call these same
two functions regardless of which KMS backend is active. **Plaintext values are
never logged or persisted.**

### KMS Provider System

#### Provider Overview

The `kms.provider` configuration field selects which backend handles secret
encryption and storage:

| Provider | Config Value | Description | Platforms |
|---|---|---|---|
| **AWS KMS** | `aws-kms` | Cloud HSM-backed encryption via AWS Key Management Service. Ciphertext stored in SQLite. | All (requires AWS credentials) |
| **OS Keyring** | `os-keyring` | OS-native keyring integration via [`@aspect-build/keytar`](https://github.com/nicolo-ribaudo/keytar). Secrets stored in the platform's native credential store. | Linux (KDE Wallet / GNOME Keyring), macOS (Keychain), Windows (Credential Manager) |
| **D-Bus Secret Service** | `dbus-secret` | Linux-only pure JavaScript client for the [freedesktop.org Secret Service API](https://specifications.freedesktop.org/secret-service/) via [`dbus-next`](https://github.com/dbusjs/node-dbus-next). No native compilation required. | Linux (GNOME Keyring, KDE Wallet with Secret Service bridge) |
| **GnuPG** | `gpg` | Asymmetric encryption via `gpg2` CLI. Ideal for headless Linux servers without a desktop session. Ciphertext stored in SQLite. | Linux, macOS, Windows (gpg4win) |
| **Local AES** | `local-aes` | Local AES-256-GCM symmetric encryption. Key sourced from an environment variable (auto-generated if missing). Ciphertext stored in SQLite. | All (zero external dependencies) |

#### Provider Selection Logic

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     KMS Provider Selection Logic                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  config.kms.provider = ?                                                 │
│  ┌──────────────────┬───────────────────────────────────────────────────┐│
│  │ "aws-kms"        │ AwsKmsProvider                                    ││
│  │                  │ → AWS KMS encrypt/decrypt + SQLite ciphertext     ││
│  ├──────────────────┼───────────────────────────────────────────────────┤│
│  │ "os-keyring"     │ if Linux:                                         ││
│  │                  │   linux_keyring_backend = "keytar"?               ││
│  │                  │     → OsKeyringProvider (@aspect-build/keytar)    ││
│  │                  │   linux_keyring_backend = "dbus-next"?            ││
│  │                  │     → DbusSecretServiceProvider (dbus-next)       ││
│  │                  │ if macOS / Windows:                               ││
│  │                  │     → OsKeyringProvider (@aspect-build/keytar)    ││
│  │                  │ ⚠ auto-fallback → LocalAesProvider if headless    ││
│  ├──────────────────┼───────────────────────────────────────────────────┤│
│  │ "dbus-secret"    │ DbusSecretServiceProvider (dbus-next, Linux only) ││
│  │                  │ ⚠ auto-fallback → LocalAesProvider if headless    ││
│  ├──────────────────┼───────────────────────────────────────────────────┤│
│  │ "gpg"            │ GpgProvider (gpg2 CLI)                            ││
│  │                  │ → GPG encrypt/decrypt + SQLite ciphertext         ││
│  │                  │ Requires gpg_key_id in config                     ││
│  ├──────────────────┼───────────────────────────────────────────────────┤│
│  │ "local-aes"      │ LocalAesProvider                                  ││
│  │                  │ → AES-256-GCM + SQLite ciphertext                 ││
│  │                  │ Key from env var (auto-generated if missing)      ││
│  └──────────────────┴───────────────────────────────────────────────────┘│
│                                                                          │
│  dry_run.enabled = true?                                                 │
│  → Always uses local AES (bypasses provider entirely)                    │
└──────────────────────────────────────────────────────────────────────────┘
```

#### AWS KMS Provider

Uses [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html)
for HSM-backed encryption. Ciphertext blobs are stored in the `encrypted_keys`
SQLite table.

**Configuration:**
```yaml
kms:
  enabled: true
  provider: "aws-kms"
  region: "us-east-1"
  key_id_env: "AWS_KMS_KEY_ID"
```

**Required environment variables:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_KMS_KEY_ID` (KMS key ARN or alias)
- `AWS_SESSION_TOKEN` (optional, for temporary credentials)

**Important:** AWS credentials are **only** loaded from environment variables.
They are never stored in configuration files or the database.

#### OS Keyring Provider

Integrates with the operating system's native credential store using
[`@aspect-build/keytar`](https://github.com/nicolo-ribaudo/keytar) (a maintained
fork of Atom's `keytar`). Secrets are managed directly by the OS — no ciphertext
is stored in SQLite.

| Platform | Backend | Notes |
|---|---|---|
| **Linux (KDE)** | KDE Wallet (KWallet) | Accessed via D-Bus `org.kde.KWallet` or Secret Service bridge |
| **Linux (GNOME)** | GNOME Keyring | Accessed via D-Bus `org.freedesktop.secrets` |
| **macOS** | Keychain (`Security.framework`) | Transparent integration |
| **Windows** | Credential Manager (DPAPI) | Transparent integration |

**Configuration (Linux with keytar):**
```yaml
kms:
  enabled: true
  provider: "os-keyring"
  linux_keyring_backend: "keytar"   # native addon
```

**Configuration (Linux with dbus-next, no native compilation):**
```yaml
kms:
  enabled: true
  provider: "os-keyring"
  linux_keyring_backend: "dbus-next"   # pure JS
```

**Configuration (macOS / Windows):**
```yaml
kms:
  enabled: true
  provider: "os-keyring"
  # linux_keyring_backend is ignored on non-Linux
```

> **Note:** `@aspect-build/keytar` is a **native Node.js addon** (C++ / N-API)
> and requires compilation or prebuilt binaries. If you want to avoid native
> compilation on Linux, use `linux_keyring_backend: "dbus-next"` or the
> `dbus-secret` provider directly.

**KDE Wallet compatibility check:**

Ensure the Secret Service API is available on your KDE system:
```bash
dbus-send --session --print-reply \
  --dest=org.freedesktop.secrets \
  /org/freedesktop/secrets org.freedesktop.DBus.Peer.Ping
```
If this fails, enable the KDE Wallet Secret Service integration in
**System Settings → KDE Wallet → Secret Service integration**.

#### D-Bus Secret Service Provider

A **pure JavaScript** (zero native compilation) provider that communicates
directly with the [freedesktop.org Secret Service API](https://specifications.freedesktop.org/secret-service/)
over D-Bus using [`dbus-next`](https://github.com/dbusjs/node-dbus-next).

Works with:
- **GNOME Keyring** (native Secret Service provider)
- **KDE Wallet** (via its Secret Service bridge — `kwalletd5`/`kwalletd6`)

**Configuration:**
```yaml
kms:
  enabled: true
  provider: "dbus-secret"
```

This provider can also be selected indirectly:
```yaml
kms:
  enabled: true
  provider: "os-keyring"
  linux_keyring_backend: "dbus-next"   # routes to D-Bus Secret Service
```

> **Linux-only.** This provider is not available on macOS or Windows.

#### GnuPG Provider

Uses [GnuPG](https://gnupg.org/) (`gpg2`) for asymmetric encryption. Ideal
for **headless Linux servers** and CI/CD environments that have no desktop
session, no D-Bus, and no AWS credentials — but do have a GPG keypair.

Secrets are encrypted with the public key and stored as ASCII-armored ciphertext
in the `encrypted_keys` SQLite table. Decryption uses the corresponding private
key from the local GPG keyring. If the private key has a passphrase, `gpg-agent`
handles the prompt.

**Configuration:**
```yaml
kms:
  enabled: true
  provider: "gpg"
  gpg_key_id: "agent-payments@yourcompany.com"   # fingerprint or email
  gpg_binary: "gpg2"                             # path to gpg binary
```

**Setup — generate a dedicated GPG keypair:**
```bash
# Generate a key (non-interactive)
gpg2 --batch --gen-key <<EOF
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: Agent Payments
Name-Email: agent-payments@yourcompany.com
Expire-Date: 2y
%no-protection
%commit
EOF

# Verify it was created
gpg2 --list-keys agent-payments@yourcompany.com
```

**For Docker / CI:** Import the key at container startup:
```bash
echo "$GPG_PRIVATE_KEY_BASE64" | base64 -d | gpg2 --batch --import
```

#### Local AES Provider

Symmetric AES-256-GCM encryption using a 256-bit key from an environment
variable. Ciphertext stored in SQLite. This is the simplest provider — zero
external dependencies, works everywhere.

**Configuration:**
```yaml
kms:
  enabled: true
  provider: "local-aes"
```

The encryption key is read from the `DRYRUN_ENCRYPTION_KEY` environment variable
(64 hex characters = 256 bits). If the variable is missing on first run, a
random key is auto-generated and appended to the `.env` file.

> **⚠️ Guard the `.env` file carefully.** If you lose the encryption key,
> previously encrypted entries become unreadable. The `.env` file is in
> `.gitignore` by default.

#### Example Configurations

##### Desktop Linux (KDE) with keytar:
```yaml
kms:
  enabled: true
  provider: "os-keyring"
  linux_keyring_backend: "keytar"
```

##### Desktop Linux (GNOME) with dbus-next (no native compilation):
```yaml
kms:
  enabled: true
  provider: "os-keyring"
  linux_keyring_backend: "dbus-next"
```

##### Headless Linux server (GPG):
```yaml
kms:
  enabled: true
  provider: "gpg"
  gpg_key_id: "agent-payments@yourcompany.com"
  gpg_binary: "gpg2"
```

##### Headless Linux / Docker (local AES):
```yaml
kms:
  enabled: true
  provider: "local-aes"
```

##### macOS / Windows desktop:
```yaml
kms:
  enabled: true
  provider: "os-keyring"
```

##### Production cloud:
```yaml
kms:
  enabled: true
  provider: "aws-kms"
  region: "us-east-1"
  key_id_env: "AWS_KMS_KEY_ID"
```

#### Provider Comparison Matrix

| | AWS KMS | OS Keyring | D-Bus Secret Service | GnuPG | Local AES |
|---|---|---|---|---|---|
| **Encryption** | AES-256 (HSM-backed) | OS-managed (DPAPI / Keychain / kernel) | Same as OS Keyring | RSA/ECC asymmetric | AES-256-GCM |
| **At-rest storage** | SQLite (ciphertext) | OS keyring DB | OS keyring DB | SQLite (ciphertext) | SQLite (ciphertext) |
| **Key custody** | AWS (cloud HSM) | OS user session | OS user session | Local GPG keyring | Env var / `.env` file |
| **Headless server** | ✅ | ❌ (needs D-Bus session) | ❌ (needs D-Bus session) | ✅ | ✅ |
| **Native addon required** | No | Yes (`keytar`) | No (pure JS) | No (CLI) | No |
| **Linux (KDE)** | ✅ | ✅ (KWallet) | ✅ (KWallet bridge) | ✅ | ✅ |
| **Linux (GNOME)** | ✅ | ✅ (gnome-keyring) | ✅ (gnome-keyring) | ✅ | ✅ |
| **macOS** | ✅ | ✅ (Keychain) | ❌ | ✅ | ✅ |
| **Windows** | ✅ | ✅ (Credential Manager) | ❌ | ✅ (gpg4win) | ✅ |
| **Docker / CI** | ✅ | ❌ | ❌ | ✅ (import keyring) | ✅ |
| **Web3 private key** | ✅ (66 bytes) | ✅ | ✅ | ✅ | ✅ |
| **API tokens** | ✅ | ✅ | ✅ | ✅ | ✅ |

#### Security Comparison

| | AWS KMS | OS Keyring | D-Bus Secret Service | GPG | Local AES |
|---|---|---|---|---|---|
| **Encryption** | AES-256 (HSM-backed) | OS-managed (DPAPI/Keychain/kernel) | Same as OS Keyring | RSA/ECC asymmetric | AES-256-GCM |
| **At-rest storage** | SQLite (ciphertext) | OS keyring DB | OS keyring DB | SQLite (ciphertext) | SQLite (ciphertext) |
| **Key custody** | AWS (cloud HSM) | OS user session | OS user session | Local GPG keyring | Env var / .env file |
| **Headless server** | ✅ | ❌ (needs D-Bus) | ❌ (needs D-Bus) | ✅ | ✅ |
| **Native addon** | No | Yes (keytar) | No (pure JS) | No (CLI) | No |
| **Linux KDE** | ✅ | ✅ (KWallet) | ✅ (KWallet bridge) | ✅ | ✅ |
| **Linux GNOME** | ✅ | ✅ (gnome-keyring) | ✅ (gnome-keyring) | ✅ | ✅ |
| **macOS** | ✅ | ✅ (Keychain) | ❌ | ✅ | ✅ |
| **Windows** | ✅ | ✅ (Credential Mgr) | ❌ | ✅ (gpg4win) | ✅ |
| **Docker/CI** | ✅ | ❌ | ❌ | ✅ (if keyring imported) | ✅ |

#### Headless Fallback Behavior

The **OS Keyring** and **D-Bus Secret Service** providers are designed for
desktop environments with an active user session. When running on a headless
server (no X11 / Wayland, no D-Bus session bus), these providers will
**automatically fall back** to the Local AES provider.

The fallback is logged and audited:
```
[warn] OS keyring unavailable (headless or missing D-Bus session).
       Falling back to local-aes provider.
```

This means you can safely set `provider: "os-keyring"` in your default config
and deploy to both desktop and server environments — the skill will
adapt automatically.

**Recommended per-environment configuration:**

| Environment | Recommended Provider |
|---|---|
| **Developer desktop (Linux KDE/GNOME)** | `os-keyring` (with `linux_keyring_backend: "keytar"` or `"dbus-next"`) |
| **Developer desktop (macOS)** | `os-keyring` |
| **Developer desktop (Windows)** | `os-keyring` |
| **Production cloud (AWS)** | `aws-kms` |
| **Headless Linux server (with GPG)** | `gpg` |
| **Headless Linux / Docker (simple)** | `local-aes` |
| **CI/CD pipeline** | `local-aes` or `aws-kms` |

### Encrypted Key Storage (SQLite)

For providers that store ciphertext (AWS KMS, GnuPG, Local AES), the
`encrypted_keys` table holds the encrypted blobs:

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | UUID |
| `key_type` | TEXT | `web3_private_key`, `stripe_token`, `paypal_token`, `visa_token`, `mastercard_token`, `googlepay_token`, `applepay_token` |
| `key_alias` | TEXT UNIQUE | Human-readable name (e.g., `default_wallet`, `stripe_api_key`) |
| `ciphertext` | BLOB | Encrypted payload |
| `kms_key_id` | TEXT | Provider identifier: KMS key ARN, `gpg:<key_id>`, `local-aes256`, or `dryrun-local-aes256` |
| `created_at` | TEXT | ISO 8601 timestamp |
| `updated_at` | TEXT | ISO 8601 timestamp |

> **Note:** The OS Keyring and D-Bus Secret Service providers store secrets
> directly in the OS credential store and do **not** use the `encrypted_keys`
> SQLite table.

### Environment Variables

| Variable | Required | Provider | Description |
|---|---|---|---|
| `AWS_ACCESS_KEY_ID` | ✅ (for `aws-kms`) | `aws-kms` | AWS IAM access key for KMS |
| `AWS_SECRET_ACCESS_KEY` | ✅ (for `aws-kms`) | `aws-kms` | AWS IAM secret key for KMS |
| `AWS_SESSION_TOKEN` | ❌ | `aws-kms` | Optional, for temporary credentials / STS |
| `AWS_KMS_KEY_ID` | ✅ (for `aws-kms`) | `aws-kms` | KMS key ARN or alias (e.g., `alias/agent-payments`) |
| `AWS_REGION` | ❌ | `aws-kms` | Overrides `kms.region` in config |
| `DRYRUN_ENCRYPTION_KEY` | ❌ | `local-aes` | 256-bit hex key (64 chars). Auto-generated if missing. |
| `CONFIG_PATH` | ❌ | All | Override default config file path (for web API) |

> **⚠️  Never commit secret values to source control.** Use a secrets manager,
> `.env` file with appropriate `.gitignore`, or container environment injection.

---

## Policy Engine

The policy engine (`src/policy/engine.ts`) acts as a **compliance interceptor**. It evaluates
every payment intent against a configurable rule set *before* any real transaction is executed.

### Rule Types

| Rule | Config Key | Description |
|---|---|---|
| **Single transaction limit** | `policy.rules.single_transaction.max_amount_usd` | Maximum USD equivalent for any one payment |
| **Daily aggregate limit** | `policy.rules.daily.max_total_usd` | Max total USD in a rolling 24-hour window |
| **Daily transaction count** | `policy.rules.daily.max_transaction_count` | Max number of transactions in 24 hours |
| **Weekly aggregate limit** | `policy.rules.weekly.max_total_usd` | Max total USD in a rolling 7-day window |
| **Weekly transaction count** | `policy.rules.weekly.max_transaction_count` | Max transactions in 7 days |
| **Monthly aggregate limit** | `policy.rules.monthly.max_total_usd` | Max total USD in a rolling 30-day window |
| **Monthly transaction count** | `policy.rules.monthly.max_transaction_count` | Max transactions in 30 days |
| **Time-of-day restrictions** | `policy.rules.time_restrictions` | Restrict payments to specific UTC hours and days of week |
| **Blacklist** | `policy.rules.blacklist` | Block payments to specific addresses/merchant IDs |
| **Whitelist** | `policy.rules.whitelist` | Only allow payments to specific addresses (when enabled) |
| **Currency restrictions** | `policy.rules.allowed_currencies` | Only allow payments in listed currencies |

### Time-Based Aggregate Tracking

Aggregate limits are computed against the `transactions` table in SQLite using rolling windows:

```
Daily window:   NOW - 24 hours  →  NOW
Weekly window:  NOW - 7 days    →  NOW
Monthly window: NOW - 30 days   →  NOW
```

The engine queries:
```sql
SELECT COALESCE(SUM(amount_usd), 0) as total_usd, COUNT(*) as count
FROM transactions
WHERE status IN ('executed', 'approved', 'pending', 'awaiting_confirmation')
  AND created_at >= ? AND created_at < ?
```

This ensures that even pending/awaiting-confirmation transactions count toward limits,
preventing circumvention by rapid-fire requests.

### Human Confirmation Feedback Loop

When a policy violation with `severity: "block"` is detected and
`require_human_confirmation_on_violation` is `true`, the system pauses execution and requests
human confirmation:

| Channel | Behavior |
|---|---|
| **CLI** | Interactive terminal prompt with violation details. User types `yes` or `no`. |
| **Chat** | Returns a Markdown-formatted confirmation prompt. User replies `confirm <txId>` or `reject <txId>`. |
| **Web API** | Returns `HTTP 202` with the `tx.id`. Client must `POST /api/v1/confirm/:txId` with `{"confirmed": true}`. |

**Confirmation details logged include:**
- Transaction ID
- All violated rules
- Who confirmed/rejected (CLI, chat, web_api)
- Optional rejection reason
- Timestamp

---

## Audit Trail & Logging

The skill implements a dual-write audit strategy: structured records in SQLite and multi-target
log output via Winston.

### SQLite Audit Log

Every significant action writes to the `audit_log` table:

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-incrementing |
| `timestamp` | TEXT | ISO 8601 UTC |
| `level` | TEXT | `info` · `warn` · `error` · `critical` |
| `category` | TEXT | `payment` · `policy` · `kms` · `protocol` · `auth` · `system` |
| `action` | TEXT | Specific action identifier (see table below) |
| `tx_id` | TEXT | Related transaction ID (nullable) |
| `actor` | TEXT | `agent` · `human` · `system` · `cli` · `web_api` |
| `details` | TEXT | JSON payload with full context |
| `ip_address` | TEXT | Requesting IP (web API only) |
| `user_agent` | TEXT | HTTP User-Agent (web API only) |

**Tracked actions:**

| Category | Action | Trigger |
|---|---|---|
| `system` | `skill_bootstrapped` | On startup |
| `protocol` | `intent_routed` | After protocol router decision |
| `protocol` | `x402_payment_submitted` | After x402 payment sent |
| `protocol` | `ap2_mandate_signed` | After AP2 mandate signature |
| `protocol` | `ap2_payment_submitted` | After AP2 payment execution |
| `payment` | `eth_transfer_sent` | After Viem ETH tx broadcast |
| `payment` | `erc20_transfer_sent` | After Viem ERC-20 tx broadcast |
| `payment` | `web3_payment_confirmed` | After on-chain confirmation |
| `payment` | `stripe_intent_created` | After Stripe PaymentIntent |
| `payment` | `paypal_order_created` | After PayPal Order creation |
| `payment` | `visa_payment_submitted` | After Visa Direct push |
| `payment` | `mastercard_payment_submitted` | After MC Send transfer |
| `payment` | `googlepay_payment_processed` | After Google Pay token processed |
| `payment` | `applepay_payment_processed` | After Apple Pay token processed |
| `payment` | `payment_rejected_by_human` | On human rejection |
| `payment` | `payment_execution_failed` | On any execution error |
| `policy` | `violations_detected` | When rules are violated |
| `policy` | `human_confirmed` | Human approved despite violation |
| `policy` | `human_rejected` | Human rejected |
| `kms` | `key_stored` | New key encrypted and stored |
| `kms` | `key_encrypted_and_stored` | Via encryptAndStore() |
| `kms` | `key_decrypted` | Key decrypted for use |
| `kms` | `key_deleted` | Key removed from store |

### Winston Logger (stdout/stderr/file)

Winston is configured with multiple transports (all configurable):

| Transport | Config Key | Default |
|---|---|---|
| Console (stdout) | `logging.stdout` | `true` |
| Console (stderr for errors) | `logging.stderr_errors` | `true` |
| File | `logging.file.enabled` | `true` |
| File path | `logging.file.path` | `./logs/payment-skill.log` |
| Max file size | `logging.file.max_size_mb` | `50` MB |
| Max file count (rotation) | `logging.file.max_files` | `10` |

Audit log entries are simultaneously written to both SQLite and Winston, ensuring coverage
even if one subsystem fails. Audit writes use `try/catch` internally and never crash the
payment flow.

---

## Database Schema

Three tables are created during initialization (`src/db/sqlite.ts`):

### `encrypted_keys`

```sql
CREATE TABLE encrypted_keys (
    id          TEXT PRIMARY KEY,
    key_type    TEXT NOT NULL,
    key_alias   TEXT NOT NULL UNIQUE,
    ciphertext  BLOB NOT NULL,
    kms_key_id  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `transactions`

```sql
CREATE TABLE transactions (
    id                TEXT PRIMARY KEY,
    protocol          TEXT NOT NULL,        -- 'x402' | 'ap2'
    gateway           TEXT,                 -- 'viem' | 'stripe' | 'paypal' | 'visa' | 'mastercard' | 'googlepay' | 'applepay'
    action            TEXT NOT NULL,
    amount            REAL NOT NULL,
    amount_usd        REAL NOT NULL,
    currency          TEXT NOT NULL,
    recipient         TEXT NOT NULL,
    network           TEXT,
    status            TEXT NOT NULL,
    tx_hash           TEXT,
    error_message     TEXT,
    policy_violations TEXT,                 -- JSON array
    confirmed_by      TEXT,                 -- 'auto' | 'human'
    metadata          TEXT,                 -- JSON
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    executed_at       TEXT,
    completed_at      TEXT
);
-- Indexes: idx_transactions_created, idx_transactions_status, idx_transactions_recipient
```

**Transaction statuses:**

```
pending → policy_check → awaiting_confirmation → approved → executed
                       ↘ rejected                       ↘ failed
```

### `audit_log`

```sql
CREATE TABLE audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
    level       TEXT NOT NULL,
    category    TEXT NOT NULL,
    action      TEXT NOT NULL,
    tx_id       TEXT,
    actor       TEXT,
    details     TEXT,             -- JSON
    ip_address  TEXT,
    user_agent  TEXT
);
-- Indexes: idx_audit_timestamp, idx_audit_tx_id, idx_audit_category
```

---

## Installation

### Prerequisites

- **Node.js** ≥ 18.x (for native `fetch`)
- **npm** ≥ 9.x (or pnpm/yarn)
- **SQLite** (bundled via `better-sqlite3`, no system dependency needed)
- **KMS backend** (one of the following):
  - **AWS Account** with KMS key configured (for `aws-kms` provider)
  - **Desktop session** with KDE Wallet / GNOME Keyring / macOS Keychain / Windows Credential Manager (for `os-keyring` provider)
  - **GnuPG** keypair (for `gpg` provider on headless Linux)
  - **Nothing** (for `local-aes` provider — zero-dependency fallback)

### Steps

```bash
# 1. Clone / copy the skill directory
git clone https://github.com/sentient-agi/agent-payments-skill.git
cd agent-payments-skill

# 2. Install dependencies
npm install

# 3. (Optional) Install OS keyring support
#    @aspect-build/keytar — native addon for OS keyring (Linux/macOS/Windows)
npm install @aspect-build/keytar --save-optional
#    dbus-next — pure JS D-Bus client for Linux Secret Service API
npm install dbus-next --save-optional

# 4. Build TypeScript
npm run build

# 5. Configure KMS provider in config/default.yaml (or config/production.yaml)
#    See "KMS Provider System" section for all options.
#
#    For AWS KMS (default):
export AWS_ACCESS_KEY_ID="your-aws-access-key"
export AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
export AWS_KMS_KEY_ID="arn:aws:kms:us-east-1:123456789012:key/your-key-id"
#
#    For OS Keyring — no env vars needed (just set kms.provider: "os-keyring")
#    For Local AES — no env vars needed (key auto-generates)
#    For GPG — set kms.provider: "gpg" and kms.gpg_key_id in YAML

# 6. Customize configuration
cp config/default.yaml config/production.yaml
# Edit config/production.yaml with your RPC URLs, gateway settings, policy rules

# 7. Store encrypted keys (first-time setup)
npx agent-payments keys store --alias default_wallet --type web3_private_key --value "0xYOUR_PRIVATE_KEY"

npx agent-payments keys store --alias stripe_api_key --type stripe_token --value "sk_live_YOUR_STRIPE_KEY"

npx agent-payments keys store --alias paypal_client_id --type paypal_token --value "YOUR_PAYPAL_CLIENT_ID"
npx agent-payments keys store --alias paypal_secret --type paypal_token --value "YOUR_PAYPAL_SECRET"

# Google Pay credentials
npx agent-payments keys store --alias googlepay_merchant_id --type googlepay_token --value "YOUR_GOOGLE_MERCHANT_ID"
npx agent-payments keys store --alias googlepay_merchant_key --type googlepay_token --value "YOUR_GOOGLE_MERCHANT_KEY"

# Apple Pay credentials
npx agent-payments keys store --alias applepay_merchant_id --type applepay_token --value "merchant.com.yourapp"
npx agent-payments keys store --alias applepay_merchant_cert --type applepay_token --value "BASE64_ENCODED_CERT"
npx agent-payments keys store --alias applepay_merchant_key --type applepay_token --value "BASE64_ENCODED_KEY"
npx agent-payments keys store --alias applepay_processor_key --type applepay_token --value "YOUR_PROCESSOR_API_KEY"

# 8. Register open agents skill
npx skills add ./agent-payments-skill
```

### OpenClaw Activation

Once installed, activate in your OpenClaw configuration:

```json
{
  "skills": {
    "allow": ["agent-payments"]
  }
}
```

The agent will now be able to use the payment skill when it detects payment-related prompts.

---

## Dry-Run Mode

Dry-run mode lets you explore every feature of the skill — protocol routing,
policy engine, human-in-the-loop confirmation, audit trail, CLI, and web API —
**without any real payments, real blockchain transactions, or AWS credentials.**

### What Happens in Dry-Run

| Component | Production | Dry-Run |
|---|---|---|
| **AWS KMS** | Encrypts/decrypts via real KMS API | Bypassed — local AES-256-GCM with a key from `DRYRUN_ENCRYPTION_KEY` env var |
| **Encryption key** | KMS key ARN | 256-bit hex key, auto-generated on first run and written to `.env` |
| **Wallet keys** | Viem `generatePrivateKey()` → encrypted via KMS | Viem `generatePrivateKey()` → encrypted via local AES → stored in SQLite |
| **Web3 payments** | Real on-chain transactions via Viem | Stub: returns fake tx hash, simulated confirmation |
| **Web2 payments** | Real API calls to Stripe / PayPal / Visa / MC / Google Pay / Apple Pay | Stub: returns fake transaction IDs, simulated status |
| **Policy engine** | ✅ runs normally | ✅ runs normally |
| **Human confirmation** | ✅ prompts on violations | ✅ prompts on violations |
| **Audit trail** | ✅ writes to SQLite + Winston | ✅ writes to SQLite + Winston (tagged with `dryrun_*` actions) |
| **Transaction records** | ✅ stored in SQLite | ✅ stored in SQLite |

### How Dry-Run Works End-to-End

1. **Activation** — Enable via `dry_run.enabled: true` in YAML, or pass `--dry-run` on the CLI.

2. **Encryption key** — On first run, if `DRYRUN_ENCRYPTION_KEY` is not set, a random 256-bit key is generated, written to `.env`, and loaded into `process.env`. All subsequent runs reuse it.

3. **Wallet generation** — `bootstrap()` calls `ensureDryRunWallet("default_wallet")` which uses Viem's `generatePrivateKey()`, encrypts the key with AES-256-GCM (local, no KMS), and stores the ciphertext in the `encrypted_keys` SQLite table with `kms_key_id = "dryrun-local-aes256"`.

4. **Key storage/retrieval** — `encryptAndStore()` and `retrieveAndDecrypt()` in `aws-kms.ts` check `isDryRun()` at the top. If true, they delegate to `dry-run/wallet.ts` which uses `dry-run/crypto.ts` — never touching AWS.

5. **Payment execution** — `sendEth()`, `sendErc20()`, and `executeWeb2Payment()` detect dry-run and call the appropriate stub from `dry-run/stubs.ts`. Stubs simulate latency, return fake tx hashes / order IDs, and respect the `stub_mode` setting (`success` / `failure` / `random`).

6. **Policy engine runs normally** — even in dry-run, all policy checks and human confirmation flows work identically. This lets you demo the full compliance flow.

7. **Demo command** — `openclaw-payment demo` forces dry-run on, runs 6 sample payments covering all gateways and an over-limit scenario, and prints results:

```bash
openclaw-payment demo --stub-mode random
```

### Enabling Dry-Run

**Option 1 — YAML configuration:**
```yaml
dry_run:
  enabled: true
  encryption_key_env: "DRYRUN_ENCRYPTION_KEY"
  stub_mode: "success"        # "success" | "failure" | "random"
  simulated_latency_ms: 500   # fake network delay
```

**Option 2 — CLI flag (overrides YAML):**
```bash
openclaw-payment --dry-run pay \
  --protocol x402 --amount 5 --currency USDC \
  --to 0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65 --network base
```

**Option 3 — Demo command (always forces dry-run):**
```bash
openclaw-payment demo
openclaw-payment demo --stub-mode random
openclaw-payment demo --stub-mode failure
```

### Encryption Key Lifecycle

```
First run (DRYRUN_ENCRYPTION_KEY not set)
    │
    ├─ Generate random 256-bit key
    ├─ Write to .env:  DRYRUN_ENCRYPTION_KEY=<64 hex chars>
    ├─ Set in process.env for current session
    │
    ▼
Subsequent runs
    │
    ├─ dotenv loads .env on startup
    ├─ DRYRUN_ENCRYPTION_KEY is present
    └─ Same key reuses → same wallet is decryptable
```

> **⚠️ The `.env` file is in `.gitignore`.** If you delete it, a new key is generated
> and previously encrypted entries become unreadable. For reproducible demos, you
> can set `DRYRUN_ENCRYPTION_KEY` to a fixed 64-char hex string.

### Wallet Key Generation

On bootstrap in dry-run mode, the skill:

1. Calls Viem's `generatePrivateKey()` to produce a valid secp256k1 private key
2. Encrypts it with AES-256-GCM using the local dry-run key
3. Stores the ciphertext in the `encrypted_keys` SQLite table
   (with `kms_key_id = "dryrun-local-aes256"`)
4. Derives the public address via `privateKeyToAccount()` and logs it

On subsequent runs, if `default_wallet` already exists in SQLite, the existing
key is reused (decrypted locally, address re-derived).

### Stub Modes

| Mode | Behavior | Use Case |
|---|---|---|
| `success` | All simulated payments return success | Happy-path demos, integration testing |
| `failure` | All simulated payments return failure | Error-handling demos, policy engine testing |
| `random` | ~70% success, ~30% failure | Realistic mixed-outcome demos |

Stubs also simulate configurable network latency (`simulated_latency_ms`) to
make the demo feel realistic.

### Stub Response Examples

**Web3 (Viem) stub — success:**
```json
{
  "txHash": "0x8f3a1b2c4d5e6f7a8b9c0d1e2f3a4b5caaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "network": "base",
  "from": "0x1234...abcd",
  "to": "0x742d...f2bD65",
  "amount": "5.00",
  "currency": "USDC"
}
```

**Stripe stub — success:**
```json
{
  "gateway": "stripe",
  "transaction_id": "pi_dryrun_a1b2c3d4e5f6",
  "status": "success",
  "amount": "49.99",
  "currency": "USD"
}
```

**PayPal stub — success:**
```json
{
  "gateway": "paypal",
  "transaction_id": "PAYPAL-DRYRUN-A1B2C3D4E5",
  "status": "success",
  "amount": "25.00",
  "currency": "USD",
  "receipt_url": "https://sandbox.paypal.com/dryrun/approval"
}
```

**Visa Direct stub — failure (stub_mode: failure):**
```json
{
  "gateway": "visa",
  "transaction_id": "VISA-DRYRUN-1739184000000",
  "status": "failed",
  "amount": "100.00",
  "currency": "USD",
  "error": "[DRY-RUN] Visa push funds declined"
}
```

**Google Pay stub — success:**
```json
{
  "gateway": "googlepay",
  "transaction_id": "GPAY-DRYRUN-A1B2C3D4E5F6",
  "status": "success",
  "amount": "35.00",
  "currency": "USD"
}
```

**Apple Pay stub — success:**
```json
{
  "gateway": "applepay",
  "transaction_id": "APAY-DRYRUN-A1B2C3D4E5F6",
  "status": "success",
  "amount": "59.99",
  "currency": "USD",
  "receipt_url": "https://sandbox.apple.com/dryrun/receipt"
}
```

### Demo Command

The `demo` command runs 8 pre-built sample payments across all supported
gateways and protocols:

```bash
openclaw-payment demo --stub-mode success
```

```
🧪 ════════════════════════════════════════════════
   AGENTIC PAYMENT SKILL — INTERACTIVE DEMO
   Stub mode: success
═══════════════════════════════════════════════════

─── 1️⃣  x402 USDC payment on Base (web3) ───
  ✅ Success | TX: 0x8f3a1b2c...

─── 2️⃣  AP2 Stripe payment (web2) ───
  ✅ Success | ID: pi_dryrun_a1b2c3d4e5f6

─── 3️⃣  AP2 PayPal payment (web2) ───
  ✅ Success | ID: PAYPAL-DRYRUN-A1B2C3D4E5

─── 4️⃣  x402 ETH transfer on Ethereum (web3) ───
  ✅ Success | TX: 0x9c4b2d3e...

─── 5️⃣  AP2 Visa Direct payment (web2) ───
  ✅ Success | ID: VISA-DRYRUN-1739184000000

─── 6️⃣  AP2 Google Pay payment (web2) ───
  ✅ Success | ID: GPAY-DRYRUN-A1B2C3D4E5F6

─── 7️⃣  AP2 Apple Pay payment (web2) ───
  ✅ Success | ID: APAY-DRYRUN-A1B2C3D4E5F6

─── 8️⃣  Over-limit payment (triggers policy engine) ───
  ❌ Not executed: Payment rejected by human confirmation.
  ⚠️  Policy: [single_transaction.max_amount_usd] Amount $99999.99 exceeds limit of $1000.00

══════════════════════════════════════════════════
  Demo complete. All transactions are in SQLite.
  Run: openclaw-payment audit --limit 20
══════════════════════════════════════════════════
```

After the demo, inspect the results:

```bash
# View all transactions created during the demo
sqlite3 data/payments.db "SELECT id, protocol, gateway, amount, currency, status FROM transactions ORDER BY created_at DESC LIMIT 10;"

# View the full audit trail
openclaw-payment audit --limit 30

# Check the generated wallet
openclaw-payment keys list
```

### Dry-Run Configuration Reference

```yaml
dry_run:
  # Master toggle. Overridden by --dry-run CLI flag.
  enabled: false

  # Name of the environment variable holding the 256-bit AES key
  # (64 hex characters). If empty on first run, auto-generated
  # and appended to .env in the project root.
  encryption_key_env: "DRYRUN_ENCRYPTION_KEY"

  # How stubs behave:
  #   "success" — all stubs return successful responses
  #   "failure" — all stubs return error responses
  #   "random"  — ~70% success, ~30% failure (randomized)
  stub_mode: "success"

  # Simulated network latency in milliseconds.
  # Set to 0 for instant responses (useful in tests).
  simulated_latency_ms: 500
```

### Dry-Run Audit Actions

In dry-run mode, audit log entries use `dryrun_*` action prefixes so they are
easily distinguishable from production entries:

| Action | Trigger |
|---|---|
| `dryrun_mode_activated` | On bootstrap when dry-run is enabled |
| `dryrun_wallet_generated` | New wallet key generated and stored |
| `dryrun_key_stored` | Any key/token encrypted with local AES |
| `dryrun_key_decrypted` | Key retrieved and decrypted locally |
| `dryrun_eth_transfer` | Simulated ETH transfer |
| `dryrun_erc20_transfer` | Simulated ERC-20 transfer |
| `dryrun_stripe` | Simulated Stripe payment |
| `dryrun_paypal` | Simulated PayPal payment |
| `dryrun_visa` | Simulated Visa Direct payment |
| `dryrun_mastercard` | Simulated Mastercard Send payment |
| `dryrun_googlepay` | Simulated Google Pay payment |
| `dryrun_applepay` | Simulated Apple Pay payment |
| `dryrun_web2_executed` | Web2 payment stub completed |
| `dryrun_web3_confirmed` | Web3 tx stub confirmed |

### Quick Start (Zero Setup Demo)

Run the entire skill with **zero AWS credentials and zero payment gateway accounts**:

```bash
# 1. Clone and install
git clone https://github.com/sentient-agi/openclaw-payment-skill.git
cd openclaw-payment-skill
npm install
npm run build

# 2. Run the demo (no env vars needed — key auto-generates)
npx openclaw-payment demo

# 3. Try individual payments
npx openclaw-payment --dry-run pay \
  --protocol x402 --amount 10 --currency USDC \
  --to 0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65 --network base

npx openclaw-payment --dry-run pay \
  --protocol ap2 --amount 29.99 --currency USD \
  --to merchant-test --gateway stripe

# 4. Trigger a policy violation (default limit is $1000)
npx openclaw-payment --dry-run pay \
  --protocol ap2 --amount 5000 --currency USD \
  --to big-purchase --gateway paypal

# 5. Inspect results
npx openclaw-payment --dry-run audit --limit 20
npx openclaw-payment --dry-run keys list

# 6. Start the web API in dry-run
npx openclaw-payment --dry-run &  # or set dry_run.enabled: true in YAML
curl http://localhost:3402/api/v1/health
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{"protocol":"x402","action":"pay","amount":"5","currency":"USDC","recipient":"0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65","network":"base"}'
```

---

## Configuration Reference (YAML)

### Full Annotated Configuration

```yaml
# ═══════════════════════════════════════════════════════════════════════
# Agent Payments Skill — Master Configuration
# File: config/default.yaml
# ═══════════════════════════════════════════════════════════════════════

# ── Skill Metadata ───────────────────────────────────────────────────
skill:
  name: agent-payments            # Skill identifier (matches SKILL.md)
  version: 0.2.0                   # Skill version

# ── SQLite Database ──────────────────────────────────────────────────
database:
  path: "./data/payments.db"       # Path to SQLite database file
                                   # (directory created automatically)
  wal_mode: true                   # Enable WAL journal mode (recommended
                                   # for concurrent reads during writes)
  busy_timeout_ms: 5000            # SQLite busy timeout in milliseconds

# ── Protocols ────────────────────────────────────────────────────────
protocols:
  x402:
    enabled: true                  # Enable/disable x402 protocol
    facilitator_url: "https://x402.org/facilitator"
                                   # Facilitator URL for settlement
                                   # verification. Coinbase default:
                                   # https://x402.org/facilitator
    default_network: "base"        # Default chain if not specified in intent
    default_asset: "USDC"          # Default token if not specified
    timeout_ms: 30000              # HTTP request timeout for x402 ops

  ap2:
    enabled: true                  # Enable/disable AP2 protocol
    mandate_issuer: "https://your-ap2-issuer.example.com"
                                   # URL of your AP2 mandate issuer /
                                   # merchant payment processor
    credential_provider_url: "https://credentials.example.com"
                                   # AP2 credential provider for mandate
                                   # signing and payment credential retrieval
    timeout_ms: 30000              # HTTP request timeout

# ── Web3 Networks ────────────────────────────────────────────────────
# Each key is a network name used in PaymentIntent.network
web3:
  ethereum:
    enabled: true
    rpc_url: "https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID"
    chain_id: 1
  base:
    enabled: true
    rpc_url: "https://mainnet.base.org"
    chain_id: 8453
  polygon:
    enabled: true
    rpc_url: "https://polygon-rpc.com"
    chain_id: 137
  # Add more EVM-compatible chains as needed:
  # arbitrum:
  #   enabled: true
  #   rpc_url: "https://arb1.arbitrum.io/rpc"
  #   chain_id: 42161

# ── Web2 Payment Gateways ───────────────────────────────────────────
web2:
  stripe:
    enabled: true
    api_version: "2025-01-27.acacia" # Stripe API version string

  paypal:
    enabled: true
    environment: "sandbox"           # "sandbox" or "live"
    base_url: "https://api-m.sandbox.paypal.com"
                                     # Live: https://api-m.paypal.com

  visa:
    enabled: true
    base_url: "https://sandbox.api.visa.com"
                                     # Live: https://api.visa.com

  mastercard:
    enabled: true
    base_url: "https://sandbox.api.mastercard.com"
                                     # Live: https://api.mastercard.com

  googlepay:
    enabled: true
    environment: "TEST"              # "TEST" or "PRODUCTION"
    base_url: "https://pay.google.com/gp/p"
    allowed_card_networks:           # Card networks accepted via Google Pay
      - "AMEX"
      - "DISCOVER"
      - "JCB"
      - "MASTERCARD"
      - "VISA"
    allowed_auth_methods:            # Token authentication methods
      - "PAN_ONLY"                   # PAN with expiry + billing address
      - "CRYPTOGRAM_3DS"             # 3D Secure device token

  applepay:
    enabled: true
    base_url: "https://apple-pay-gateway.apple.com/paymentservices"
                                     # Apple Pay payment services endpoint
    domain: "your-domain.example.com"
                                     # Must be verified with Apple
    display_name: "OpenClaw Payments"
                                     # Shown on the Apple Pay payment sheet
    supported_networks:              # Card networks accepted via Apple Pay
      - "visa"
      - "masterCard"
      - "amex"
      - "discover"
    merchant_capabilities:           # Supported capabilities
      - "supports3DS"
      - "supportsCredit"
      - "supportsDebit"

# ── AWS KMS ──────────────────────────────────────────────────────────
# NOTE: AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
# must be set as environment variables. They are NEVER read from this file.
kms:
  enabled: true                    # Enable KMS integration

  # ── Provider Selection ─────────────────────────────────────────────
  # Selects which backend handles secret encryption/storage.
  #
  #   "aws-kms"     — AWS KMS (production cloud). Requires AWS env vars.
  #   "os-keyring"  — OS-native keyring: KDE Wallet / GNOME Keyring
  #                    (Linux), Keychain (macOS), Credential Manager
  #                    (Windows). Uses @aspect-build/keytar. Falls back
  #                    to local-aes on headless systems without D-Bus.
  #   "dbus-secret" — Linux-only: D-Bus Secret Service API via dbus-next
  #                    (pure JS, no native compilation). Works with
  #                    GNOME Keyring and KDE Wallet (Secret Service
  #                    bridge). Falls back to local-aes on headless.
  #   "gpg"         — GnuPG encryption. Ideal for headless Linux
  #                    servers without D-Bus. Requires a GPG keypair.
  #   "local-aes"   — Local AES-256-GCM. Key from DRYRUN_ENCRYPTION_KEY
  #                    env var (auto-generated if missing). No external
  #                    dependencies.
  provider: "aws-kms"

  # ── AWS KMS Settings (only when provider is "aws-kms") ─────────────
  region: "us-east-1"             # AWS region for KMS API calls
  key_id_env: "AWS_KMS_KEY_ID"    # Name of env var holding the KMS key ARN
  # AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from environment

  # ── Linux Keyring Backend (only when provider is "os-keyring") ─────
  # Selects the library used for OS keyring access on Linux:
  #   "keytar"    — @aspect-build/keytar (native addon, full cross-platform)
  #   "dbus-next" — Pure JS D-Bus Secret Service client (Linux only,
  #                  no native compilation needed)
  linux_keyring_backend: "keytar"

  # ── GnuPG Settings (only when provider is "gpg") ──────────────────
  # gpg_key_id: "your-fingerprint-or-email@example.com"
  #                                # GPG key fingerprint or email. Required
  #                                # when provider is "gpg".
  # gpg_binary: "gpg2"            # Path to gpg binary (default: gpg2)

# ── Policy Engine ────────────────────────────────────────────────────
policy:
  enabled: true                    # Master switch for policy enforcement

  rules:
    # Per-transaction limits
    single_transaction:
      max_amount_usd: 1000.00      # Max USD per single payment

    # Rolling daily window (24 hours)
    daily:
      max_total_usd: 5000.00       # Max aggregate USD per day
      max_transaction_count: 50     # Max number of transactions per day

    # Rolling weekly window (7 days)
    weekly:
      max_total_usd: 25000.00
      max_transaction_count: 200

    # Rolling monthly window (30 days)
    monthly:
      max_total_usd: 80000.00
      max_transaction_count: 500

    # Time-of-day restrictions (evaluated in UTC)
    time_restrictions:
      enabled: false               # Set to true to enforce
      allowed_hours:
        start: 8                   # 08:00 UTC (inclusive)
        end: 22                    # 22:00 UTC (exclusive)
      allowed_days: [1, 2, 3, 4, 5]
                                   # JS weekday: 0=Sun, 1=Mon, ... 6=Sat
                                   # Default: Mon–Fri only

    # Blacklist — block payments to these addresses/IDs
    blacklist:
      enabled: true
      addresses:
        - "0x0000000000000000000000000000000000000000"
        # Add more:
        # - "0xDEADBEEF..."

    # Whitelist — if enabled, ONLY these addresses are allowed
    whitelist:
      enabled: false               # Usually disabled (restrictive)
      addresses: []
        # - "0xALLOWED_ADDRESS_1"
        # - "merchant-id-1"

    # Allowed currencies
    allowed_currencies:
      - "USDC"
      - "ETH"
      - "USD"
      - "EUR"
      # - "DAI"
      # - "USDT"

  # When violations occur, require human confirmation before proceeding
  require_human_confirmation_on_violation: true

# ── Logging & Audit ─────────────────────────────────────────────────
logging:
  level: "info"                    # Minimum log level: debug|info|warn|error

  stdout: true                     # Log to stdout (console)
  stderr_errors: true              # Route error/warn to stderr

  file:
    enabled: true                  # Log to file
    path: "./logs/payment-skill.log"
    max_size_mb: 50                # Max single file size before rotation
    max_files: 10                  # Keep N rotated files

  audit:
    sqlite: true                   # Write audit records to SQLite audit_log
    verbose: true                  # Include full request/response payloads
                                   # in audit details JSON

# ── Web API Server ──────────────────────────────────────────────────
web_api:
  enabled: true
  host: "0.0.0.0"                 # Bind address
  port: 3402                       # Listen port (3402 = "x402" 😉)
  cors_origins:
    - "http://localhost:*"         # Allowed CORS origins (wildcard supported)
    # - "https://your-app.example.com"

# ── CLI Behavior ────────────────────────────────────────────────────
cli:
  interactive_confirmation: true   # Prompt for confirmation on violations
  colored_output: true             # ANSI color codes in terminal output
```

### Configuration Sections

| Section | Purpose | Key Settings |
|---|---|---|
| `skill` | Metadata | `name`, `version` — must match `SKILL.md` |
| `database` | SQLite | `path`, `wal_mode`, `busy_timeout_ms` |
| `protocols.x402` | x402 client | `facilitator_url`, `default_network`, `default_asset` |
| `protocols.ap2` | AP2 client | `mandate_issuer`, `credential_provider_url` |
| `web3.<network>` | EVM chains | `rpc_url`, `chain_id`, `enabled` |
| `web2.<gateway>` | Payment APIs | Gateway-specific URLs, API versions |
| `kms` | Key management | `provider`, `region`, `key_id_env`, `linux_keyring_backend`, `gpg_key_id`, `gpg_binary` |
| `policy` | Compliance | All rule definitions + human confirmation toggle |
| `logging` | Observability | Multi-transport config, audit detail level |
| `web_api` | REST server | `host`, `port`, `cors_origins` |
| `cli` | Terminal UX | Confirmation mode, color output |

---

## CLI Reference

The CLI is available as `agent-payments` (via npm `bin`) or `npx agent-payments`.

### Global Options

| Flag | Description | Default |
|---|---|---|
| `-c, --config <path>` | Path to YAML config file | `config/default.yaml` |
| `-V, --version` | Print version | — |
| `-h, --help` | Show help | — |

### `pay` — Execute a Payment

```bash
agent-payments pay [options]
```

| Option | Required | Description |
|---|---|---|
| `--protocol <x402\|ap2>` | ✅ | Protocol to use |
| `--amount <string>` | ✅ | Decimal amount (e.g., `"10.50"`) |
| `--currency <string>` | ✅ | Currency code (`USDC`, `ETH`, `USD`, `EUR`) |
| `--to <string>` | ✅ | Recipient address or merchant ID |
| `--network <string>` | ❌ | Blockchain network (`ethereum`, `base`, `polygon`, `web2`) |
| `--gateway <string>` | ❌ | Payment gateway (`viem`, `stripe`, `paypal`, `visa`, `mastercard`, `googlepay`, `applepay`) |
| `--description <string>` | ❌ | Human-readable description |
| `--wallet <string>` | ❌ | Wallet key alias in encrypted store (default: `default_wallet`) |

**Examples:**

```bash
# x402 USDC payment on Base
agent-payments pay \
  --protocol x402 \
  --amount 5.00 \
  --currency USDC \
  --to 0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65 \
  --network base

# AP2 Stripe payment
agent-payments pay \
  --protocol ap2 \
  --amount 49.99 \
  --currency USD \
  --to merchant-12345 \
  --gateway stripe \
  --description "Monthly subscription"

# PayPal payment with custom config
agent-payments pay \
  --config config/production.yaml \
  --protocol ap2 \
  --amount 25.00 \
  --currency USD \
  --to seller@example.com \
  --gateway paypal
```

### `parse` — Parse AI Output

Extract a `PaymentIntent` JSON from free-form AI text.

```bash
# Direct text
agent-payments parse '{"protocol":"x402","action":"pay","amount":"10","currency":"USDC","recipient":"0x..."}'

# From stdin (pipe AI model output)
echo '... AI response with embedded JSON ...' | agent-payments parse -
```

### `keys` — Key Management

Manage encrypted keys/tokens stored in SQLite via AWS KMS.

```bash
# Store a new encrypted key
agent-payments keys store \
  --alias default_wallet \
  --type web3_private_key \
  --value "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# List all stored keys (metadata only — no plaintext)
agent-payments keys list

# Delete a key
agent-payments keys delete stripe_api_key
```

**Key types:**

| Type | Alias Convention | Used By |
|---|---|---|
| `web3_private_key` | `default_wallet` | Viem transaction signing |
| `stripe_token` | `stripe_api_key` | Stripe SDK initialization |
| `paypal_token` | `paypal_client_id`, `paypal_secret` | PayPal OAuth2 |
| `visa_token` | `visa_user_id`, `visa_password` | Visa Direct auth |
| `mastercard_token` | `mastercard_consumer_key`, `mastercard_signing_key` | MC Send auth |
| `googlepay_token` | `googlepay_merchant_id`, `googlepay_merchant_key` | Google Pay token processing |
| `applepay_token` | `applepay_merchant_id`, `applepay_merchant_cert`, `applepay_merchant_key`, `applepay_processor_key` | Apple Pay merchant validation & token processing |

### `tx` — Transaction Lookup

```bash
agent-payments tx <transaction-id>
```

Outputs the full transaction record as JSON, including status, policy violations, tx hash, and
timestamps.

### `audit` — Query Audit Log

```bash
agent-payments audit [options]
```

| Option | Description |
|---|---|
| `--category <string>` | Filter: `payment`, `policy`, `kms`, `protocol`, `system` |
| `--tx <string>` | Filter by transaction ID |
| `--since <ISO 8601>` | Filter by timestamp (e.g., `2026-02-10T00:00:00Z`) |
| `--limit <number>` | Max results (default: `50`) |

**Examples:**

```bash
# All payment audit entries from today
agent-payments audit --category payment --since 2026-02-10T00:00:00Z

# Audit trail for a specific transaction
agent-payments audit --tx "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

# Recent policy violations
agent-payments audit --category policy --limit 20
```

---

## Web API Reference

### Base URL

```
http://<host>:<port>/api/v1
```

Default: `http://0.0.0.0:3402/api/v1`

Start the server:
```bash
# Via npm script
npm run web

# Or directly
node dist/web-api.js

# With custom config
CONFIG_PATH=config/production.yaml node dist/web-api.js
```

### Endpoints

---

#### `GET /api/v1/health`

Health check endpoint.

**Response `200`:**
```json
{
  "status": "ok",
  "skill": "agent-payments",
  "version": "0.2.0"
}
```

---

#### `POST /api/v1/payment`

Execute a payment from a `PaymentIntent`.

**Request body:**
```json
{
  "protocol": "x402",
  "action": "pay",
  "amount": "10.00",
  "currency": "USDC",
  "recipient": "0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65",
  "network": "base",
  "gateway": "viem",
  "description": "API access payment",
  "metadata": {},
  "walletKeyAlias": "default_wallet"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `protocol` | `"x402"` \| `"ap2"` | ✅ | Payment protocol |
| `action` | `"pay"` | ✅ | Action (only `"pay"` supported) |
| `amount` | string | ✅ | Decimal amount |
| `currency` | string | ✅ | Currency code |
| `recipient` | string | ✅ | Destination address or merchant ID |
| `network` | string | ❌ | Blockchain network name |
| `gateway` | string | ❌ | Explicit gateway selection (`viem`, `stripe`, `paypal`, `visa`, `mastercard`, `googlepay`, `applepay`) |
| `description` | string | ❌ | Human-readable description |
| `metadata` | object | ❌ | Arbitrary metadata |
| `walletKeyAlias` | string | ❌ | Key alias (default: `"default_wallet"`) |

**Response `200` (success):**
```json
{
  "success": true,
  "tx": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "protocol": "x402",
    "gateway": "viem",
    "amount": 10.0,
    "amount_usd": 10.0,
    "currency": "USDC",
    "recipient": "0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65",
    "network": "base",
    "status": "executed",
    "created_at": "2026-02-10T12:00:00.000Z"
  },
  "txHash": "0xabc123...",
  "policyResult": {
    "allowed": true,
    "violations": [],
    "requiresHumanConfirmation": false
  },
  "confirmationRequired": false
}
```

**Response `202` (confirmation required):**
```json
{
  "success": false,
  "tx": { "id": "...", "status": "awaiting_confirmation", "..." : "..." },
  "policyResult": {
    "allowed": true,
    "violations": [
      {
        "rule": "single_transaction.max_amount_usd",
        "message": "Amount $1500.00 exceeds single transaction limit of $1000.00",
        "severity": "block"
      }
    ],
    "requiresHumanConfirmation": true
  },
  "confirmationRequired": true,
  "confirmationPrompt": "Confirmation required for tx a1b2c3d4... POST /api/v1/confirm/a1b2c3d4..."
}
```

**Response `400` (validation/execution error):**
```json
{
  "error": "Amount must be a decimal string"
}
```

---

#### `POST /api/v1/parse`

Parse a `PaymentIntent` from free-form AI output text.

**Request body:**
```json
{
  "text": "I've processed the request. Here's the payment:\n```json\n{\"protocol\":\"x402\",\"action\":\"pay\",\"amount\":\"5.00\",\"currency\":\"USDC\",\"recipient\":\"0x...\"}\n```"
}
```

**Response `200`:**
```json
{
  "found": true,
  "intent": {
    "protocol": "x402",
    "action": "pay",
    "amount": "5.00",
    "currency": "USDC",
    "recipient": "0x..."
  }
}
```

**Response `200` (no intent found):**
```json
{
  "found": false,
  "intent": null
}
```

---

#### `POST /api/v1/confirm/:txId`

Confirm or reject a pending transaction that requires human approval.

**URL parameters:**
- `txId` — Transaction ID from the `202` response

**Request body:**
```json
{
  "confirmed": true,
  "reason": "Approved by finance team"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `confirmed` | boolean | ✅ | `true` to approve, `false` to reject |
| `reason` | string | ❌ | Optional note (especially useful for rejections) |

**Response `200`:**
```json
{
  "success": true,
  "message": "Transaction a1b2c3d4... confirmed"
}
```

**Response `404`:**
```json
{
  "error": "No pending confirmation for tx a1b2c3d4..."
}
```

---

#### `GET /api/v1/pending`

List all transactions awaiting human confirmation.

**Response `200`:**
```json
[
  {
    "txId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "amount": 1500.0,
    "currency": "USD",
    "recipient": "merchant-12345",
    "violations": [
      {
        "rule": "single_transaction.max_amount_usd",
        "message": "Amount $1500.00 exceeds single transaction limit of $1000.00",
        "severity": "block"
      }
    ]
  }
]
```

---

#### `GET /api/v1/transactions/:txId`

Retrieve a transaction record by ID.

**Response `200`:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "protocol": "x402",
  "gateway": "viem",
  "action": "pay",
  "amount": 10.0,
  "amount_usd": 10.0,
  "currency": "USDC",
  "recipient": "0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65",
  "network": "base",
  "status": "executed",
  "tx_hash": "0xabc123def456...",
  "error_message": null,
  "policy_violations": null,
  "confirmed_by": "auto",
  "metadata": "{}",
  "created_at": "2026-02-10T12:00:00",
  "executed_at": "2026-02-10T12:00:05",
  "completed_at": null
}
```

**Response `404`:**
```json
{
  "error": "Transaction not found"
}
```

---

#### `GET /api/v1/audit`

Query the audit log with optional filters.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `category` | string | Filter: `payment`, `policy`, `kms`, `protocol`, `system` |
| `tx_id` | string | Filter by transaction ID |
| `since` | string | ISO 8601 timestamp lower bound |
| `limit` | number | Max results (default: `100`) |

**Example:**
```
GET /api/v1/audit?category=policy&since=2026-02-10T00:00:00Z&limit=20
```

**Response `200`:**
```json
[
  {
    "id": 42,
    "timestamp": "2026-02-10T12:00:03",
    "level": "warn",
    "category": "policy",
    "action": "violations_detected",
    "tx_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "actor": "system",
    "details": "{\"violations\":[{\"rule\":\"single_transaction.max_amount_usd\",\"message\":\"...\"}]}",
    "ip_address": null,
    "user_agent": null
  }
]
```

### Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": "Human-readable error description"
}
```

| HTTP Status | Meaning |
|---|---|
| `200` | Success |
| `202` | Accepted — payment pending human confirmation |
| `400` | Bad request (validation error, execution failure) |
| `404` | Resource not found (transaction, pending confirmation) |
| `500` | Internal server error |

---

## OpenClaw Chat Integration

When the skill is activated in OpenClaw, the agent uses the `SKILL.md` instructions to output
structured payment intents during conversation.

### Payment Intent JSON Schema

The agent is instructed to output this exact JSON when a payment is needed:

```json
{
  "protocol": "x402 | ap2",
  "action": "pay",
  "amount": "<decimal string>",
  "currency": "USDC | ETH | USD | EUR",
  "recipient": "<address or merchant ID>",
  "network": "ethereum | base | polygon | web2",
  "gateway": "viem | visa | mastercard | paypal | stripe | googlepay | applepay | null",
  "description": "<human-readable description>",
  "metadata": {}
}
```

The protocol router extracts this JSON from the agent's message (even when surrounded by
natural language) using regex-based extraction.

### Protocol Detection Heuristics

The `SKILL.md` instructs the agent:

| Signal | Routed To |
|---|---|
| Target is an HTTP resource returning 402 | **x402** |
| User mentions "x402", "stablecoin", "USDC", "onchain" | **x402** |
| Payment involves a mandate, delegated purchase | **AP2** |
| Traditional card/gateway payment via agent | **AP2** |
| User mentions "Google Pay", "GPay" | **AP2** → `googlepay` gateway |
| User mentions "Apple Pay" | **AP2** → `applepay` gateway |
| Crypto currency (USDC, ETH, DAI) | **web3** (Viem) |
| Fiat currency (USD, EUR) | **web2** (Stripe default) |

### Chat Confirmation Flow

When a policy violation is detected during a chat-initiated payment:

1. **Skill returns a Markdown prompt** to the agent, which presents it to the user:

   ```
   ⚠️ **Payment Requires Your Confirmation**

   | Field | Value |
   |-------|-------|
   | Transaction ID | `a1b2c3d4...` |
   | Protocol | x402 |
   | Amount | 1500 USDC ($1500.00 USD) |
   | Recipient | `0x742d...` |
   | Gateway | viem |

   **Policy Violations:**
     - **single_transaction.max_amount_usd**: Amount $1500.00 exceeds limit of $1000.00

   Reply **"confirm a1b2c3d4"** to proceed or **"reject a1b2c3d4"** to cancel.
   ```

2. **User responds** in the chat with `confirm <txId>` or `reject <txId>`
3. **Skill parses** the response and resumes/cancels the payment

---

## Usage Examples

### Example 1 — x402 USDC Payment via CLI

Send 5 USDC on Base to a recipient:

```bash
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_KMS_KEY_ID="arn:aws:kms:..."

agent-payments pay \
  --protocol x402 \
  --amount 5.00 \
  --currency USDC \
  --to 0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65 \
  --network base \
  --wallet default_wallet
```

**Output:**
```
2026-02-10T12:00:00.000Z [info] Transaction created { id: 'a1b2...', protocol: 'x402' }
2026-02-10T12:00:00.010Z [info] Policy check passed { amountUsd: 5 }
2026-02-10T12:00:00.020Z [info] web3: Preparing ERC-20 transfer { to: '0x742d...', amount: '5.00' }
2026-02-10T12:00:02.500Z [info] web3: ERC-20 transfer sent { txHash: '0xdef456...' }
2026-02-10T12:00:15.000Z [info] web3: Transaction confirmed { status: 'success', block: '12345678' }

═══════════════════════════════════════
✅ Payment executed successfully!
   TX Hash: 0xdef456...
   Internal TX ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
═══════════════════════════════════════
```

### Example 2 — AP2 Stripe Payment via Web API

```bash
# Start the web API
npm run web

# In another terminal, execute a payment
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "ap2",
    "action": "pay",
    "amount": "49.99",
    "currency": "USD",
    "recipient": "merchant-shop-12345",
    "gateway": "stripe",
    "description": "Premium subscription",
    "metadata": {"plan": "annual"}
  }'
```

**Response:**
```json
{
  "success": true,
  "tx": {
    "id": "b2c3d4e5-f678-9012-bcde-f12345678901",
    "protocol": "ap2",
    "gateway": "stripe",
    "amount": 49.99,
    "amount_usd": 49.99,
    "currency": "USD",
    "status": "executed"
  },
  "web2Result": {
    "gateway": "stripe",
    "transaction_id": "pi_3Abc123...",
    "status": "pending",
    "amount": "49.99",
    "currency": "USD"
  },
  "policyResult": {
    "allowed": true,
    "violations": [],
    "requiresHumanConfirmation": false
  },
  "confirmationRequired": false
}
```

### Example 3 — AI Chat-Driven Payment

User prompt in OpenClaw chat:

> "Pay 10 USDC to 0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65 on Base for API access"

The agent responds with embedded JSON (per `SKILL.md` instructions):

> I'll process that payment for you:
> ```json
> {
>   "protocol": "x402",
>   "action": "pay",
>   "amount": "10.00",
>   "currency": "USDC",
>   "recipient": "0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65",
>   "network": "base",
>   "gateway": "viem",
>   "description": "API access payment"
> }
> ```

The skill's protocol router extracts this JSON, validates it, runs policy checks, and executes
the payment.

### Example 4 — Policy Violation & Human Confirmation

**Via Web API:**

```bash
# 1. Submit a payment that exceeds the single-transaction limit
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "ap2",
    "action": "pay",
    "amount": "1500.00",
    "currency": "USD",
    "recipient": "vendor-99",
    "gateway": "stripe"
  }'

# Response: 202 with confirmationRequired: true
# {
#   "confirmationRequired": true,
#   "confirmationPrompt": "Confirmation required for tx abc123... POST /api/v1/confirm/abc123..."
# }

# 2. Check pending confirmations
curl http://localhost:3402/api/v1/pending

# 3. Approve the payment
curl -X POST http://localhost:3402/api/v1/confirm/abc123... \
  -H "Content-Type: application/json" \
  -d '{"confirmed": true, "reason": "One-time approved by CFO"}'
```

### Example 5 — Key Management

```bash
# Store a wallet private key
agent-payments keys store \
  --alias trading_wallet \
  --type web3_private_key \
  --value "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Store Stripe API key
agent-payments keys store \
  --alias stripe_api_key \
  --type stripe_token \
  --value "sk_live_abcdefghijklmnop"

# List all keys (plaintext is NEVER shown)
agent-payments keys list

# ┌──────────┬───────────────────┬─────────────────┬─────────────────────────────┬─────────────────────┐
# │ id       │ key_type          │ key_alias       │ kms_key_id                  │ created_at          │
# ├──────────┼───────────────────┼─────────────────┼─────────────────────────────┼─────────────────────┤
# │ a1b2...  │ web3_private_key  │ trading_wallet  │ arn:aws:kms:us-east-1:...   │ 2026-02-10 12:00:00 │
# │ c3d4...  │ stripe_token      │ stripe_api_key  │ arn:aws:kms:us-east-1:...   │ 2026-02-10 12:01:00 │
# └──────────┴───────────────────┴─────────────────┴─────────────────────────────┴─────────────────────┘

# Delete a key
agent-payments keys delete trading_wallet
```

### Example 6 — Google Pay Payment via Web API

```bash
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "ap2",
    "action": "pay",
    "amount": "35.00",
    "currency": "USD",
    "recipient": "merchant-gpay-001",
    "gateway": "googlepay",
    "description": "In-app purchase via Google Pay",
    "metadata": {
      "paymentToken": "<encrypted-token-from-google-pay-js-api>",
      "countryCode": "US"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "tx": {
    "id": "d4e5f678-9012-bcde-f123-456789012345",
    "protocol": "ap2",
    "gateway": "googlepay",
    "amount": 35.0,
    "amount_usd": 35.0,
    "currency": "USD",
    "status": "executed"
  },
  "web2Result": {
    "gateway": "googlepay",
    "transaction_id": "GPAY-abc123def456",
    "status": "success",
    "amount": "35.00",
    "currency": "USD"
  },
  "policyResult": {
    "allowed": true,
    "violations": [],
    "requiresHumanConfirmation": false
  },
  "confirmationRequired": false
}
```

> **Note:** The `paymentToken` in `metadata` must be the encrypted payment token
> obtained from the client-side [Google Pay JS API](https://developers.google.com/pay/api).
> The server never generates this token — it only processes it.

### Example 7 — Apple Pay Payment via Web API

```bash
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "ap2",
    "action": "pay",
    "amount": "59.99",
    "currency": "USD",
    "recipient": "merchant-applepay-001",
    "gateway": "applepay",
    "description": "Checkout via Apple Pay",
    "metadata": {
      "paymentToken": "<encrypted-token-from-apple-pay-js-api>",
      "validationURL": "https://apple-pay-gateway-cert.apple.com/paymentservices/startSession"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "tx": {
    "id": "e5f67890-1234-cdef-0123-567890123456",
    "protocol": "ap2",
    "gateway": "applepay",
    "amount": 59.99,
    "amount_usd": 59.99,
    "currency": "USD",
    "status": "executed"
  },
  "web2Result": {
    "gateway": "applepay",
    "transaction_id": "APAY-xyz789abc012",
    "status": "success",
    "amount": "59.99",
    "currency": "USD",
    "receipt_url": "https://example.com/receipt/xyz789"
  },
  "policyResult": {
    "allowed": true,
    "violations": [],
    "requiresHumanConfirmation": false
  },
  "confirmationRequired": false
}
```

> **Note:** The `paymentToken` must be the encrypted token from the client-side
> [Apple Pay JS API](https://developer.apple.com/apple-pay/). The optional
> `validationURL` triggers server-to-server merchant session validation with Apple
> before the token is processed.

---

## Development

### Build

```bash
npm run build        # Compile TypeScript to dist/
```

### Run Tests

```bash
npm test             # Run Jest test suite
```

### Run in Development

```bash
npm run dev          # ts-node src/index.ts
```

### Project Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@coinbase/x402` | `^2.1.0` | x402 facilitator SDK |
| `viem` | `^2.28.0` | Ethereum wallet, signing, tx building |
| `stripe` | `^17.0.0` | Stripe payment SDK |
| `@paypal/paypal-server-sdk` | `^2.0.0` | PayPal payments |
| `@aws-sdk/client-kms` | `^3.750.0` | AWS KMS encrypt/decrypt (`aws-kms` provider) |
| `better-sqlite3` | `^11.8.0` | SQLite driver (native, synchronous) |
| `yaml` | `^2.7.0` | YAML config parsing |
| `express` | `^5.1.0` | Web API server |
| `commander` | `^13.1.0` | CLI framework |
| `winston` | `^3.17.0` | Multi-transport logging |
| `zod` | `^3.24.0` | Schema validation |
| `uuid` | `^11.1.0` | UUID generation for IDs |
| `readline-sync` | `^1.4.10` | CLI interactive prompts |

**Optional dependencies** (install only for the KMS providers you need):

| Package | Version | Purpose | Install Command |
|---|---|---|---|
| `@aspect-build/keytar` | `*` | OS Keyring integration (native addon) — KDE Wallet, GNOME Keyring, macOS Keychain, Windows Credential Manager | `npm install @aspect-build/keytar --save-optional` |
| `dbus-next` | `*` | Linux D-Bus Secret Service API (pure JS, no native compilation) | `npm install dbus-next --save-optional` |

---

## Troubleshooting

### Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| `AWS KMS key ID not found in env var` | Missing `AWS_KMS_KEY_ID` environment variable | Export `AWS_KMS_KEY_ID` before running, or switch to a different `kms.provider` |
| `Unknown KMS provider: 'X'` | Invalid `kms.provider` value in config | Use one of: `aws-kms`, `os-keyring`, `dbus-secret`, `gpg`, `local-aes` |
| `OS keyring unavailable ... Falling back to local-aes` | No D-Bus session (headless server) | Expected behavior — use `gpg` or `local-aes` provider explicitly, or install a D-Bus session |
| `GPG provider requires 'kms.gpg_key_id'` | Missing GPG key ID in config | Set `kms.gpg_key_id` to your GPG key fingerprint or email |
| `gpg2: command not found` | GnuPG not installed | Install `gnupg2` package, or set `kms.gpg_binary` to the correct path |
| `D-Bus Secret Service: key not found` | Secret not stored in keyring | Store the key first via `agent-payments keys store`, or check that the correct keyring is unlocked |
| KDE Wallet prompt on every access | KWallet locked or Secret Service bridge disabled | Unlock KDE Wallet, or enable Secret Service integration in KDE System Settings |
| `@aspect-build/keytar` build failure | Missing C++ build tools for native addon | Install `build-essential` (Linux), Xcode CLI tools (macOS), or Visual Studio Build Tools (Windows). Or use `linux_keyring_backend: "dbus-next"` to avoid native compilation. |
| `Encrypted key not found for alias 'X'` | Key not stored yet | Run `agent-payments keys store --alias X ...` |
| `Network 'X' is disabled in configuration` | Chain disabled in YAML | Set `web3.X.enabled: true` in config |
| `x402 protocol is disabled in configuration` | Protocol toggle | Set `protocols.x402.enabled: true` |
| `Could not parse a valid payment intent` | AI output doesn't contain valid JSON | Ensure agent uses the exact JSON schema from `SKILL.md` |
| `SQLITE_BUSY` errors | Concurrent writes | Increase `database.busy_timeout_ms` or ensure WAL mode |
| `Policy violations detected` (unexpected) | Aggregate limits hit | Check `agent-payments audit --category policy` and adjust `policy.rules` |
| Web API not starting | Port conflict | Change `web_api.port` in config |
| `Google Pay requires a 'paymentToken' in metadata` | Missing client-side token | Ensure the Google Pay JS API token is passed in `metadata.paymentToken` |
| `Apple Pay requires a 'paymentToken' in metadata` | Missing client-side token | Ensure the Apple Pay JS API token is passed in `metadata.paymentToken` |
| `Apple Pay merchant validation failed` | Invalid cert or domain | Verify domain is registered with Apple and `applepay_merchant_cert` is valid |

### Debugging

1. **Set log level to `debug`** in `config/default.yaml`:
   ```yaml
   logging:
     level: "debug"
   ```

2. **Check the audit log** for full context:
   ```bash
   agent-payments audit --limit 20
   ```

3. **Inspect a specific transaction:**
   ```bash
   agent-payments tx <transaction-id>
   ```

4. **Query SQLite directly:**
   ```bash
   sqlite3 data/payments.db "SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;"
   sqlite3 data/payments.db "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 20;"
   ```

---

## License

This project is licensed under the **Apache 2.0 License**. See the [`LICENSE-APACHE`](LICENSE-APACHE) file for the details.

---

> Built with 🤖💵 for the [Open Agent Skills Ecosystem](https://www.npmjs.com/package/skills#supported-agents) and for the [OpenClaw](https://openclaw.ai) ecosystem.
> Protocols: [x402](https://x402.org/) · [AP2](https://ap2-protocol.org/)
