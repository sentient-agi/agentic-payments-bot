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
    - [x402 Client (Paying for Resources)](#x402-client-paying-for-resources)
    - [x402 Server (Accepting Payments)](#x402-server-accepting-payments)
  - [AP2 Protocol (Agent Payments Protocol)](#ap2-protocol-agent-payments-protocol)
    - [AP2 Client (Submitting Mandates)](#ap2-client-submitting-mandates)
    - [AP2 Server (Processing Mandates)](#ap2-server-processing-mandates)
  - [Protocol Router](#protocol-router)
- [Payment Backends](#payment-backends)
  - [Web3 — Ethereum (Viem)](#web3--ethereum-viem)
  - [Web2 — Stripe](#web2--stripe)
  - [Web2 — PayPal](#web2--paypal)
  - [Web2 — Visa Direct](#web2--visa-direct)
  - [Web2 — Mastercard Send](#web2--mastercard-send)
  - [Web2 — Google Pay](#web2--google-pay)
  - [Web2 — Apple Pay](#web2--apple-pay)
  - [x402 — Remote Resource Payment](#x402--remote-resource-payment)
  - [AP2 — Remote Mandate Payment](#ap2--remote-mandate-payment)
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
  - [x402 Server Endpoints](#x402-server-endpoints)
    - [GET /api/v1/x402/premium/data (Paywall-Protected)](#get-apiv1x402premiumdata-paywall-protected)
    - [GET /api/v1/x402/pricing](#get-apiv1x402pricing)
    - [POST /api/v1/x402/verify](#post-apiv1x402verify)
  - [AP2 Server Endpoints](#ap2-server-endpoints)
    - [POST /api/v1/ap2/mandates](#post-apiv1ap2mandates)
    - [GET /api/v1/ap2/mandates](#get-apiv1ap2mandates)
    - [GET /api/v1/ap2/mandates/:mandateId](#get-apiv1ap2mandatesmandateid)
    - [POST /api/v1/ap2/sign-mandate](#post-apiv1ap2sign-mandate)
    - [POST /api/v1/ap2/payment-credentials](#post-apiv1ap2payment-credentials)
    - [POST /api/v1/ap2/process-payment](#post-apiv1ap2process-payment)
  - [Error Responses](#error-responses)
- [OpenClaw Chat Integration](#openclaw-chat-integration)
  - [Payment Intent JSON Schema](#payment-intent-json-schema)
  - [Protocol Detection Heuristics](#protocol-detection-heuristics)
  - [Chat Confirmation Flow](#chat-confirmation-flow)
- [Usage Examples](#usage-examples)
  - [Example 1 — USDC Payment on Base (Web3)](#example-1--usdc-payment-on-base-web3)
  - [Example 2 — USDC Payment on Ethereum (Web3)](#example-2--usdc-payment-on-ethereum-web3)
  - [Example 3 — USDT Payment on Base (Web3)](#example-3--usdt-payment-on-base-web3)
  - [Example 4 — USDT Payment on Ethereum (Web3)](#example-4--usdt-payment-on-ethereum-web3)
  - [Example 5 — ETH Transfer on Ethereum (Web3)](#example-5--eth-transfer-on-ethereum-web3)
  - [Example 6 — Stripe Payment (Web2)](#example-6--stripe-payment-web2)
  - [Example 7 — PayPal Payment (Web2)](#example-7--paypal-payment-web2)
  - [Example 8 — Visa Direct Payment (Web2)](#example-8--visa-direct-payment-web2)
  - [Example 9 — Mastercard Send Payment (Web2)](#example-9--mastercard-send-payment-web2)
  - [Example 10 — Google Pay Payment (Web2)](#example-10--google-pay-payment-web2)
  - [Example 11 — Apple Pay Payment (Web2)](#example-11--apple-pay-payment-web2)
  - [Example 12 — x402 Remote Resource Payment (Paying Another Service)](#example-12--x402-remote-resource-payment-paying-another-service)
  - [Example 13 — AP2 Remote Mandate Payment (Paying Another Service)](#example-13--ap2-remote-mandate-payment-paying-another-service)
  - [Example 14 — AI Chat-Driven Payment](#example-14--ai-chat-driven-payment)
  - [Example 15 — Policy Violation & Human Confirmation](#example-15--policy-violation--human-confirmation)
  - [Example 16 — Key Management](#example-16--key-management)
  - [Example 17 — x402 Paywall (External Agent Paying You)](#example-17--x402-paywall-external-agent-paying-you)
  - [Example 18 — AP2 Mandate (External Agent Paying You)](#example-18--ap2-mandate-external-agent-paying-you)
- [Development](#development)
  - [Build](#build)
  - [Run Tests](#run-tests)
  - [Project Dependencies](#project-dependencies)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Overview

**agentic-payments-bot** is a payment serivce/gateway/bot/agent/assistant with support for and providing of X402 and AP2 server and client, and providing
an Open Agent Skills Ecosystem compliant skill, that enables AI agents to autonomously initiate, validate, and execute payments
across both blockchain (web3) and traditional (web2) payment rails.

### Key Capabilities

| Capability | Details |
|---|---|
| **Dual protocol support** | x402 (HTTP 402 + onchain settlement) and AP2 (Google's mandate-based agent payments) |
| **Dual role: server + client** | Acts as a **payment gateway** (accepts payments from external agents via x402/AP2 server endpoints) and as a **payment client** (makes payments to external services via all backends) |
| **Web3 transactions** | Ethereum, Base, Polygon via [Viem](https://viem.sh) — native ETH and ERC-20 (USDC, etc.) |
| **Web2 gateways** | Stripe, PayPal, Visa Direct, Mastercard Send, Google Pay, Apple Pay |
| **Protocol gateways** | x402 remote resource payment, AP2 remote mandate submission — paying any service that supports these protocols |
| **Key management** | Pluggable KMS providers: AWS KMS, OS Keyring (KDE Wallet / GNOME Keyring / macOS Keychain / Windows Credential Manager), D-Bus Secret Service, GnuPG, Local AES-256-GCM |
| **Policy engine** | Per-tx limits, daily/weekly/monthly aggregates, time-of-day, blacklist/whitelist, currency restrictions |
| **Human-in-the-loop** | Automatic escalation on policy violations via CLI prompt, chat prompt, or web API |
| **Audit trail** | Every action logged to SQLite `audit_log` table + Winston (stdout/stderr/file) |
| **Three interfaces** | OpenClaw (or other agent) chat, CLI (`agentic-payments-bot`), REST web API |
| **Fully configurable** | Single YAML file controls all behavior |

---

## Architecture

### System Diagram

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           Agent Payments Skill                                    │
│                                                                                   │
│  ┌─────────────────── SERVER SIDE (Accept Payments) ───────────────────────────┐  │
│  │                                                                             │  │
│  │  External Agents ──► x402 Paywall Middleware (HTTP 402 flow)                │  │
│  │                      AP2 Mandate Endpoints (mandate lifecycle)  ──► Payment │  │
│  │                                                                   Execution │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
│  ┌───────────┐   ┌───────────────┐   ┌──────────┐                                 │
│  │  Chat UI  │   │   CLI (term)  │   │ Web API  │                                 │
│  └─────┬─────┘   └───────┬───────┘   └────┬─────┘                                 │
│        │                 │                │                                       │
│        ▼                 ▼                ▼                                       │
│  ┌─────────────────────────────────────────────────┐                              │
│  │              Protocol Router                    │                              │
│  │  (AI output parser → PaymentIntent → routing)   │                              │
│  └────┬──────────┬─────────┬──────────┬────────────┘                              │
│       │          │         │          │                                           │
│  ┌────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐                                      │
│  │ web3   │ │ web2   │ │ x402   │ │ ap2    │                                      │
│  │(Viem)  │ │(Stripe │ │(remote │ │(remote │                                      │
│  │        │ │PayPal  │ │resource│ │mandate │                                      │
│  │        │ │Visa MC │ │client) │ │client) │                                      │
│  │        │ │GPay    │ │        │ │        │                                      │
│  │        │ │APay)   │ │        │ │        │                                      │
│  └────┬───┘ └───┬────┘ └───┬────┘ └───┬────┘                                      │
│       │         │          │          │                                           │
│  ┌────▼─────────▼──────────▼──────────▼────────┐                                  │
│  │            Policy Engine                    │                                  │
│  │  (compliance checks before execution)       │                                  │
│  │  ┌───────────────────────────────────────┐  │                                  │
│  │  │ • Single tx limit    • Blacklist      │  │                                  │
│  │  │ • Daily/Weekly/Mo    • Whitelist      │  │                                  │
│  │  │ • Time-of-day        • Currency       │  │                                  │
│  │  └───────────────────────────────────────┘  │                                  │
│  │       │ (violation?) ──► Human Confirm      │                                  │
│  └───────┼─────────────────────────────────────┘                                  │
│          │                                                                        │
│  ┌───────▼─────────────────────────────────────┐  ┌───────────────┐               │
│  │          Payment Execution                  │  │  KMS Provider │               │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐  │  │ ┌───────────┐ │               │
│  │  │ Viem   │ │ Stripe │ │ PayPal │ │ Visa │  │  │ │ AWS KMS   │ │               │
│  │  │(ETH/   │ │        │ │        │ │ MC   │  │  │ │ OS Keyring│ │               │
│  │  │ ERC20) │ │        │ │        │ │ GPay │  │  │ │ D-Bus SS  │ │               │
│  │  │        │ │        │ │        │ │ APay │  │◄─│ │ GnuPG     │ │               │
│  │  │        │ │        │ │        │ │ x402 │  │  │ │ Local AES │ │               │
│  │  │        │ │        │ │        │ │ AP2  │  │  │ └───────────┘ │               │
│  │  └────────┘ └────────┘ └────────┘ └──────┘  │  └───────────────┘               │
│  └──────────────┬──────────────────────────────┘                                  │
│                 │                                                                 │
│  ┌──────────────▼──────────────────────────────┐                                  │
│  │                  SQLite                     │                                  │
│  │  ┌──────────────┐ ┌──────────┐ ┌──────────┐ │                                  │
│  │  │encrypted_keys│ │transac-  │ │audit_log │ │                                  │
│  │  │              │ │tions     │ │          │ │                                  │
│  │  └──────────────┘ └──────────┘ └──────────┘ │                                  │
│  └─────────────────────────────────────────────┘                                  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
agentic-payments-bot/
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
│   ├── web-api.ts                    # REST API (Express) — includes x402/AP2 server endpoints
│   ├── config/
│   │   └── loader.ts                 # YAML config loader + Zod validation
│   ├── protocols/
│   │   ├── router.ts                 # Protocol router + AI output parser
│   │   ├── x402/
│   │   │   ├── client.ts             # x402 HTTP 402 client (paying for resources)
│   │   │   └── server.ts             # x402 paywall middleware & settlement (accepting payments)
│   │   └── ap2/
│   │       ├── client.ts             # AP2 mandate-based client (submitting mandates)
│   │       └── server.ts             # AP2 mandate lifecycle server (processing mandates)
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

#### Client Side — Making Payments (Agent → External Services)

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
                         │ (detect gateway:     │
                         │  web3/web2/x402/ap2) │
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
                    └─────────┬────────────┘
                              │
              ┌───────────────┼────────────────┐
              │               │                │
     ┌────────▼──────┐ ┌──────▼──────┐ ┌───────▼───────┐
     │ web3 (Viem)   │ │ web2        │ │ Protocol      │
     │ ETH / ERC-20  │ │ Stripe      │ │ Clients       │
     │               │ │ PayPal      │ │               │
     │ Direct chain  │ │ Visa / MC   │ │ x402: discover│
     │ transactions  │ │ GPay / APay │ │ → sign → pay  │
     │               │ │             │ │ → get resource│
     │               │ │             │ │               │
     │               │ │             │ │ AP2: mandate  │
     │               │ │             │ │ → sign → cred │
     │               │ │             │ │ → submit      │
     └────────┬──────┘ └──────┬──────┘ └───────┬───────┘
              │               │                │
              └───────────────┼────────────────┘
                              │
                    ┌─────────▼───────────┐
                    │  Update Transaction │
                    │  + Audit Log        │
                    └─────────────────────┘
```

#### Server Side — Accepting Payments (External Agents → This Service)

```
                    ┌──────────────────────────────────────┐
                    │       External Agent Request         │
                    └───────────┬──────────┬───────────────┘
                                │          │
               x402 path        │          │        AP2 path
         ┌──────────────────────┘          └──────────────────────┐
         │                                                        │
         ▼                                                        ▼
┌────────────────────────┐                          ┌──────────────────────────┐
│ GET /x402/premium/data │                          │ POST /ap2/mandates       │
│ (any paywall route)    │                          │ (accept mandate)         │
└───────────┬────────────┘                          └────────────┬─────────────┘
            │                                                    │
     ┌──────┴──────┐                                             ▼
     │ X-PAYMENT   │                              ┌──────────────────────────┐
     │ header?     │                              │ POST /ap2/sign-mandate   │
     └──┬──────┬───┘                              │ (credential provider)    │
     no │      │ yes                              └────────────┬─────────────┘
        ▼      │                                               │
 ┌────────────┐│                                               ▼
 │ HTTP 402   ││                              ┌──────────────────────────────┐
 │ + payment  ││                              │ POST /ap2/payment-credentials│
 │ requirem.  ││                              │ (issue scoped tokens)        │
 │ in X-PAY-  ││                              └────────────┬─────────────────┘
 │ MENT hdr   ││                                           │
 └────────────┘│                                           ▼
               ▼                              ┌──────────────────────────────┐
    ┌─────────────────────┐                   │ POST /ap2/process-payment    │
    │ Validate payload:   │                   └────────────┬─────────────────┘
    │ • auth fields       │                                │
    │ • amount ≥ required │                                │
    │ • time bounds       │                                │
    │ • payTo matches     │                                │
    └──────────┬──────────┘                                │
               │                                           │
               ▼                                           ▼
    ┌─────────────────────┐             ┌──────────────────────────────┐
    │ Submit to on-chain  │             │ Route to internal backend:   │
    │ facilitator for     │             │ • stripe  • paypal  • card   │
    │ settlement          │             │ • crypto (Viem ETH/ERC-20)   │
    └──────────┬──────────┘             └──────────────┬───────────────┘
               │                                       │
               ▼                                       ▼
    ┌─────────────────────┐             ┌──────────────────────────────┐
    │ HTTP 200            │             │ Return AP2PaymentResult:     │
    │ + resource data     │             │ { mandate_id, status,        │
    │ + X-PAYMENT-RESPONSE│             │   transaction_id, receipt }  │
    │   (settlement proof)│             └──────────────┬───────────────┘
    └──────────┬──────────┘                            │
               │                                       │
               └──────────────┬────────────────────────┘
                              │
                   ┌──────────▼──────────┐
                   │  Audit Log (SQLite  │
                   │  + Winston)         │
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

# Start everything (first run auto-configures OpenClaw + installs skill)
docker compose up -d

# Or explicitly run skill installation first
docker compose --profile setup run --rm install-skill
docker compose up -d

# Check the payment API health
curl http://localhost:3402/api/v1/health

# Run the demo via the CLI helper
DRY_RUN=true docker compose run --rm cli demo

# Run CLI commands
docker compose run --rm --profile cli cli demo --stub-mode success

# Quick dry-run test
DRY_RUN=true docker compose up -d

# Check logs
docker compose logs -f agentic-payments-bot

# View audit log
DRY_RUN=true docker compose run --rm cli audit --limit 30

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
docker compose logs -f agentic-payments-bot

# Stop
docker compose down
```

**Pair OpenClaw with a messaging channel (e.g. Telegram):**

```bash
# Run the OpenClaw CLI inside the running container
docker compose exec agentic-payments-bot openclaw pairing approve telegram
```

---

### What this gives you

| Container | Service | Port | Description |
|---|---|---|---|
| `agentic-payments-bot` | Payment Bot Web API (`npm run web`) | `3402` | REST API for payments, parsing, confirmations, audit |
| `agentic-payments-bot` | OpenClaw Gateway (`openclaw gateway`) | `18789` | Agent gateway (Telegram, Slack, WhatsApp, etc.) |
| `agentic-payments-bot` | OpenClaw Bridge (`openclaw`) | `18790` | Internal bridge for multi-channel routing |
| `agentic-payments-bot` | CLI (on-demand) (`npm run cli`) | — | Runs `agentic-payments-bot` CLI commands against the shared SQLite DB |

Both services share the same SQLite database and encrypted key store through Docker volumes [[1]](https://til.simonwillison.net/llms/openclaw-docker). The payment skill is auto-registered as an OpenClaw skill via the symlink into `~/.openclaw/skills/` [[2]](https://docs.openclaw.ai/tools/skills), so the agent discovers it at startup through the standard skill loading mechanism.

---

## Supported Protocols

### x402 Protocol

[x402](https://x402.org/) is an open payment protocol built by Coinbase that revives the HTTP
`402 Payment Required` status code for internet-native stablecoin payments. It is stateless,
HTTP-native, and developer-friendly.

The skill implements x402 in **both directions** — as a client (paying for resources) and as a
server (accepting payments from external agents).

#### x402 Client (Paying for Resources)

When the skill needs to **pay for** an x402-protected resource (e.g., a premium API endpoint):

1. **Discovery** — The client sends a `GET` request to a resource URL. If `402` is returned, the
   response body (or `X-PAYMENT` header) contains payment details: `scheme`, `network`, `amount`,
   `payTo`, `asset`, and `maxTimeoutSeconds`.
2. **Payment** — The skill signs an EIP-3009 `transferWithAuthorization` using the wallet's
   private key (decrypted from KMS) via Viem. The signed payload is Base64-encoded and sent as
   the `X-PAYMENT` header on a retried `GET` request.
3. **Settlement** — The resource server (or its facilitator) verifies and settles the payment
   onchain. A `200 OK` response is returned with the resource and an `X-PAYMENT-RESPONSE`
   header containing the settlement receipt (including `txHash`).

**Trigger:** Set `gateway: "x402"` in the `PaymentIntent`, or use a URL as the `recipient` with
`protocol: "x402"`. The protocol router will automatically detect this and route to the x402
client.

#### x402 Server (Accepting Payments)

When the skill acts as a **payment provider** that accepts x402 payments from external agents:

1. **Paywall** — Protected routes use the `x402Paywall` Express middleware. When an agent
   requests a resource without an `X-PAYMENT` header, the server responds with `HTTP 402` and
   includes payment requirements in the `X-PAYMENT` response header (Base64-encoded JSON).
2. **Verification** — When the agent retries with an `X-PAYMENT` request header containing a
   signed payment payload, the middleware validates the authorization fields (amount, recipient,
   time bounds) and submits the payload to the on-chain facilitator for settlement.
3. **Access** — After successful settlement, the middleware attaches an `X-PAYMENT-RESPONSE`
   header with the settlement receipt and passes the request through to the actual resource
   handler.

**Server endpoints:**

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/x402/premium/data` | GET | Example paywall-protected resource |
| `/api/v1/x402/pricing` | GET | List all registered x402-priced resources |
| `/api/v1/x402/verify` | POST | Verify a settlement transaction hash |

**Supported networks:** Ethereum Mainnet, Base, Polygon (configurable).

**Supported assets:** USDC (default), any ERC-20 with known contract addresses.

**Reference:** [x402 GitHub](https://github.com/coinbase/x402) ·
[x402 Docs](https://docs.cdp.coinbase.com/x402/welcome) ·
[ERC-8004 Spec](https://www.x402.org/)

### AP2 Protocol (Agent Payments Protocol)

[AP2](https://ap2-protocol.org/) is Google's open protocol for AI agent-driven payments. It uses
cryptographically signed **Mandates** — verifiable credentials that capture user intent and
constraints — to enable agents to transact on behalf of humans.

The skill implements AP2 in **both directions** — as a client (submitting mandates to external
services) and as a server (accepting and processing mandates from external agents).

**AP2 Mandate Types:**

| Mandate | Purpose |
|---|---|
| **IntentMandate** | Captures the user's initial intent (e.g., "buy running shoes under $100") with a max spend ceiling. Signed by the user. |
| **CartMandate** | Locks a specific cart of items and price. Created after the agent finds products. |
| **PaymentMandate** | Authorizes actual payment execution. Contains payment method reference and final amount. |

#### AP2 Client (Submitting Mandates)

When the skill needs to **pay** an external AP2-compliant service:

1. **Create Mandate** — From a `PaymentIntent`, the skill constructs an AP2 mandate with intent
   details, amount constraints, validity window, and delegator info.
2. **Sign Mandate** — The mandate is sent to a credential provider for user signature
   (ECDSA-based verifiable credential).
3. **Obtain Credentials** — Payment credentials are retrieved using the signed mandate and the
   desired payment method type.
4. **Submit Payment** — The signed mandate + credentials are sent to the merchant's payment
   processor for execution.

**Trigger:** Set `gateway: "ap2"` in the `PaymentIntent`, or use a URL as the `recipient` with
`protocol: "ap2"`. The protocol router will automatically detect this and route to the AP2
client.

#### AP2 Server (Processing Mandates)

When the skill acts as a **payment provider** that accepts AP2 mandates from external agents:

1. **Accept Mandate** — External agents `POST` a mandate to `/api/v1/ap2/mandates`. The server
   validates the mandate structure, constraints, and expiry.
2. **Sign Mandate** — Agents can request mandate signing via `/api/v1/ap2/sign-mandate`
   (credential provider role).
3. **Issue Credentials** — Agents obtain tokenized payment credentials scoped to a mandate via
   `/api/v1/ap2/payment-credentials`.
4. **Execute Payment** — Agents submit a mandate + payment method to
   `/api/v1/ap2/process-payment`. The server routes the payment to the appropriate internal
   backend (Stripe, PayPal, Viem, etc.) and returns the result.

**Server endpoints:**

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/ap2/mandates` | POST | Accept a new mandate from an agent |
| `/api/v1/ap2/mandates` | GET | List all mandates |
| `/api/v1/ap2/mandates/:id` | GET | Get mandate status |
| `/api/v1/ap2/sign-mandate` | POST | Sign a mandate (credential provider) |
| `/api/v1/ap2/payment-credentials` | POST | Issue tokenized payment credentials |
| `/api/v1/ap2/process-payment` | POST | Execute mandate against internal payment backends |

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
   - Explicit `gateway` field (if provided): `viem`, `stripe`, `paypal`, `visa`, `mastercard`,
     `googlepay`, `applepay`, **`x402`**, or **`ap2`**
   - URL detection (recipient starting with `http://` or `https://`):
     - `protocol: "x402"` + URL recipient → x402 remote resource payment
     - `protocol: "ap2"` + URL recipient → AP2 remote mandate submission
   - Currency-based heuristic (crypto currencies → web3/viem, fiat → web2/stripe)
   - Protocol hint (x402 → web3, AP2 → either)

**Routing matrix:**

| Gateway Value | Payment Type | Description |
|---|---|---|
| `viem` | `web3` | Direct ETH/ERC-20 transfer via Viem |
| `stripe` | `web2` | Stripe Payment Intents |
| `paypal` | `web2` | PayPal Orders API |
| `visa` | `web2` | Visa Direct Push Payments |
| `mastercard` | `web2` | Mastercard Send API |
| `googlepay` | `web2` | Google Pay token processing |
| `applepay` | `web2` | Apple Pay token processing |
| `x402` | `x402` | Remote x402 resource payment (discover → pay → access) |
| `ap2` | `ap2` | Remote AP2 mandate submission (create → sign → pay) |

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

### x402 — Remote Resource Payment

The x402 client (`src/protocols/x402/client.ts`) is integrated as a **payment backend** alongside
Viem, Stripe, PayPal, etc. When the protocol router determines the payment should go through x402
(e.g., the recipient is a URL of an x402-protected resource), the orchestrator invokes the full
x402 client flow:

1. **Discover** — `GET` the resource URL. If `402` is returned, parse payment requirements from
   the `X-PAYMENT` header or response body.
2. **Sign** — Build an EIP-3009 authorization payload and sign it with the wallet's private key.
3. **Pay** — Re-`GET` the resource with the signed `X-PAYMENT` header.
4. **Receive** — Obtain the resource data and settlement proof from `X-PAYMENT-RESPONSE`.

**Trigger:** Set `gateway: "x402"` in the `PaymentIntent`, or use a URL as the recipient with
`protocol: "x402"`.

**Example intent:**
```json
{
  "protocol": "x402",
  "action": "pay",
  "amount": "1.00",
  "currency": "USDC",
  "recipient": "https://api.example.com/premium/data",
  "network": "base",
  "gateway": "x402"
}
```

In **dry-run mode**, the x402 client flow is fully stubbed — no real HTTP requests or on-chain
transactions are made. The stub returns simulated settlement responses.

### AP2 — Remote Mandate Payment

The AP2 client (`src/protocols/ap2/client.ts`) is integrated as a **payment backend** for paying
any AP2-compliant external service. When the protocol router determines the payment should go
through AP2 (e.g., the recipient is a URL of an AP2 payment processor), the orchestrator invokes
the full AP2 client flow:

1. **Create Mandate** — Build an AP2 mandate from the `PaymentIntent` with intent details, amount
   constraints, validity window, and delegator info.
2. **Sign Mandate** — Send the mandate to the configured credential provider for user signature.
3. **Get Credentials** — Obtain tokenized payment credentials for the signed mandate.
4. **Submit Payment** — Send the signed mandate + credentials to the merchant's payment processor.

**Trigger:** Set `gateway: "ap2"` in the `PaymentIntent`, or use a URL as the recipient with
`protocol: "ap2"`.

**Example intent:**
```json
{
  "protocol": "ap2",
  "action": "pay",
  "amount": "49.99",
  "currency": "USD",
  "recipient": "https://merchant.example.com/ap2/process-payment",
  "gateway": "ap2",
  "description": "Premium subscription",
  "metadata": {
    "payment_method_type": "stripe"
  }
}
```

In **dry-run mode**, the AP2 client flow is fully stubbed — no real HTTP requests are made. The
stub returns simulated mandate and payment responses.

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
  gpg_key_id: "agentic-payments-bot@yourcompany.com"   # fingerprint or email
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
Name-Email: agentic-payments-bot@yourcompany.com
Expire-Date: 2y
%no-protection
%commit
EOF

# Verify it was created
gpg2 --list-keys agentic-payments-bot@yourcompany.com
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
  gpg_key_id: "agentic-payments-bot@yourcompany.com"
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
| `AWS_KMS_KEY_ID` | ✅ (for `aws-kms`) | `aws-kms` | KMS key ARN or alias (e.g., `alias/agentic-payments-bot`) |
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
| `protocol` | `x402_payment_submitted` | After x402 client payment sent |
| `protocol` | `ap2_mandate_signed` | After AP2 client mandate signature |
| `protocol` | `ap2_payment_submitted` | After AP2 client payment execution |
| `x402_server` | `payment_required` | x402 server returned 402 to an agent |
| `x402_server` | `payment_settled` | x402 server settled a payment from an agent |
| `x402_server` | `settlement_failed` | x402 server settlement failed |
| `ap2_server` | `mandate_accepted` | AP2 server accepted a mandate from an agent |
| `ap2_server` | `mandate_signed` | AP2 server signed a mandate |
| `ap2_server` | `credentials_issued` | AP2 server issued payment credentials |
| `ap2_server` | `payment_processed` | AP2 server executed a mandate payment |
| `payment` | `eth_transfer_sent` | After Viem ETH tx broadcast |
| `payment` | `erc20_transfer_sent` | After Viem ERC-20 tx broadcast |
| `payment` | `web3_payment_confirmed` | After on-chain confirmation |
| `payment` | `stripe_intent_created` | After Stripe PaymentIntent |
| `payment` | `paypal_order_created` | After PayPal Order creation |
| `payment` | `visa_payment_submitted` | After Visa Direct push |
| `payment` | `mastercard_payment_submitted` | After MC Send transfer |
| `payment` | `googlepay_payment_processed` | After Google Pay token processed |
| `payment` | `applepay_payment_processed` | After Apple Pay token processed |
| `payment` | `x402_remote_payment_completed` | After x402 client resource access |
| `payment` | `ap2_remote_payment_completed` | After AP2 client mandate submission |
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
git clone https://github.com/sentient-agi/agentic-payments-bot.git
cd agentic-payments-bot

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
npx agentic-payments-bot keys store --alias default_wallet --type web3_private_key --value "0xYOUR_PRIVATE_KEY"

npx agentic-payments-bot keys store --alias stripe_api_key --type stripe_token --value "sk_live_YOUR_STRIPE_KEY"

npx agentic-payments-bot keys store --alias paypal_client_id --type paypal_token --value "YOUR_PAYPAL_CLIENT_ID"
npx agentic-payments-bot keys store --alias paypal_secret --type paypal_token --value "YOUR_PAYPAL_SECRET"

# Google Pay credentials
npx agentic-payments-bot keys store --alias googlepay_merchant_id --type googlepay_token --value "YOUR_GOOGLE_MERCHANT_ID"
npx agentic-payments-bot keys store --alias googlepay_merchant_key --type googlepay_token --value "YOUR_GOOGLE_MERCHANT_KEY"

# Apple Pay credentials
npx agentic-payments-bot keys store --alias applepay_merchant_id --type applepay_token --value "merchant.com.yourapp"
npx agentic-payments-bot keys store --alias applepay_merchant_cert --type applepay_token --value "BASE64_ENCODED_CERT"
npx agentic-payments-bot keys store --alias applepay_merchant_key --type applepay_token --value "BASE64_ENCODED_KEY"
npx agentic-payments-bot keys store --alias applepay_processor_key --type applepay_token --value "YOUR_PROCESSOR_API_KEY"

# 8. Register open agents skill
npx skills add ./agentic-payments-bot
```

### OpenClaw Activation

Once installed, activate in your OpenClaw configuration:

```json
{
  "skills": {
    "allow": ["agentic-payments-bot"]
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
| **x402 remote payments** | Real HTTP to x402 resource, on-chain settlement | Stub: returns fake tx hash and simulated resource data |
| **AP2 remote payments** | Real HTTP to AP2 mandate issuer + credential provider | Stub: returns fake mandate ID and simulated payment result |
| **x402 server (paywall)** | Verifies payment and settles via facilitator | Stub: returns simulated settlement success |
| **AP2 server (mandates)** | Processes mandates against real payment backends | Stubs: routes to stubbed backends (Stripe/PayPal/Viem stubs) |
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

7. **Demo command** — `agentic-payments-bot demo` forces dry-run on, runs 6 sample payments covering all gateways and an over-limit scenario, and prints results:

```bash
agentic-payments-bot demo --stub-mode random
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
agentic-payments-bot --dry-run pay \
  --protocol x402 --amount 5 --currency USDC \
  --to 0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65 --network base
```

**Option 3 — Demo command (always forces dry-run):**
```bash
agentic-payments-bot demo
agentic-payments-bot demo --stub-mode random
agentic-payments-bot demo --stub-mode failure
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

**Mastercard Send stub — success:**
```json
{
  "gateway": "mastercard",
  "transaction_id": "MC-DRYRUN-1739184000000",
  "status": "success",
  "amount": "75.00",
  "currency": "USD"
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

**x402 remote resource stub — success:**
```json
{
  "data": { "dryRun": true, "message": "Simulated x402 resource access" },
  "txHash": "0x8f3a1b2c4d5e6f7a8b9c0d1e2f3a4b5caaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "network": "base"
}
```

**AP2 remote mandate stub — success:**
```json
{
  "mandate_id": "mandate_dryrun_1739184000000",
  "status": "success",
  "transaction_id": "ap2-dryrun-a1b2c3d4e5f6",
  "receipt": {
    "amount": "19.99",
    "currency": "USD",
    "timestamp": "2026-03-06T12:00:00.000Z",
    "reference": "REF-DRYRUN-1739184000000"
  }
}
```

### Demo Command

The `demo` command runs 11 pre-built sample payments across all supported
gateways, protocol clients, and an over-limit policy scenario:

```bash
agentic-payments-bot demo --stub-mode success
```

```
🧪 ════════════════════════════════════════════════
   AGENTIC PAYMENT SKILL — INTERACTIVE DEMO
   Stub mode: success
═══════════════════════════════════════════════════

─── 1️⃣   x402 USDC payment on Base (web3) ───
  ✅ Success | TX: 0x8f3a1b2c...

─── 2️⃣   AP2 Stripe payment (web2) ───
  ✅ Success | ID: pi_dryrun_a1b2c3d4e5f6

─── 3️⃣   AP2 PayPal payment (web2) ───
  ✅ Success | ID: PAYPAL-DRYRUN-A1B2C3D4E5

─── 4️⃣   x402 ETH transfer on Ethereum (web3) ───
  ✅ Success | TX: 0x9c4b2d3e...

─── 5️⃣   AP2 Visa Direct payment (web2) ───
  ✅ Success | ID: VISA-DRYRUN-1739184000000

─── 6️⃣   AP2 Mastercard Send payment (web2) ───
  ✅ Success | ID: MC-DRYRUN-1739184000000

─── 7️⃣   AP2 Google Pay payment (web2) ───
  ✅ Success | ID: GPAY-DRYRUN-A1B2C3D4E5F6

─── 8️⃣   AP2 Apple Pay payment (web2) ───
  ✅ Success | ID: APAY-DRYRUN-A1B2C3D4E5F6

─── 9️⃣   x402 remote resource payment (x402 client) ───
  ✅ Success | x402 TX: 0xabc123def456...

─── 🔟  AP2 remote mandate payment (AP2 client) ───
  ✅ Success | Mandate: mandate_dryrun_1739184000

─── ⚠️   Over-limit payment (triggers policy engine) ───
  ❌ Not executed: Payment rejected by human confirmation.
  ⚠️  Policy: [single_transaction.max_amount_usd] Amount $99999.99 exceeds limit of $1000.00

══════════════════════════════════════════════════
  Demo complete. All transactions are in SQLite.
  Run: agentic-payments-bot audit --limit 30
══════════════════════════════════════════════════
```

After the demo, inspect the results:

```bash
# View all transactions created during the demo
sqlite3 data/payments.db "SELECT id, protocol, gateway, amount, currency, status FROM transactions ORDER BY created_at DESC LIMIT 10;"

# View the full audit trail
agentic-payments-bot audit --limit 30

# Check the generated wallet
agentic-payments-bot keys list
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
| `dryrun_x402_remote` | Simulated x402 remote resource access (client) |
| `dryrun_ap2_remote` | Simulated AP2 remote mandate submission (client) |
| `dryrun_web2_executed` | Web2 payment stub completed |
| `dryrun_web3_confirmed` | Web3 tx stub confirmed |

### Quick Start (Zero Setup Demo)

Run the entire skill with **zero AWS credentials and zero payment gateway accounts**:

```bash
# 1. Clone and install
git clone https://github.com/sentient-agi/agentic-payments-bot.git
cd agentic-payments-bot
npm install
npm run build

# 2. Run the demo (no env vars needed — key auto-generates)
npx agentic-payments-bot demo

# 3. Try individual payments
npx agentic-payments-bot --dry-run pay \
  --protocol x402 --amount 10 --currency USDC \
  --to 0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65 --network base

npx agentic-payments-bot --dry-run pay \
  --protocol ap2 --amount 29.99 --currency USD \
  --to merchant-test --gateway stripe

# 4. Trigger a policy violation (default limit is $1000)
npx agentic-payments-bot --dry-run pay \
  --protocol ap2 --amount 5000 --currency USD \
  --to big-purchase --gateway paypal

# 5. Inspect results
npx agentic-payments-bot --dry-run audit --limit 30
npx agentic-payments-bot --dry-run keys list

# 6. Start the web API in dry-run
npx agentic-payments-bot --dry-run &  # or set dry_run.enabled: true in YAML
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
  name: agentic-payments-bot       # Skill identifier (matches SKILL.md)
  version: 0.6.0                   # Skill version

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

    # Server-side (paywall) configuration
    # When enabled, the web API exposes x402-protected endpoints
    # that external agents can pay to access.
    server:
      enabled: true                # Enable x402 server endpoints
      pay_to_address: "0x..."      # Wallet address that receives x402 payments
                                   # Override via X402_PAY_TO_ADDRESS env var
      default_price: "1000000"     # Default price in asset base units
                                   # (e.g. "1000000" = 1 USDC with 6 decimals)
      default_description: "Access to premium agentic data feed"

  ap2:
    enabled: true                  # Enable/disable AP2 protocol
    mandate_issuer: "https://your-ap2-issuer.example.com"
                                   # URL of your AP2 mandate issuer /
                                   # merchant payment processor
    credential_provider_url: "https://credentials.example.com"
                                   # AP2 credential provider for mandate
                                   # signing and payment credential retrieval
    timeout_ms: 30000              # HTTP request timeout

    # Server-side (mandate processor) configuration
    # When enabled, the web API exposes AP2 mandate lifecycle endpoints
    # for external agents to submit mandates and trigger payments.
    server:
      enabled: true                # Enable AP2 server endpoints
      agent_id: "agentic-payments-bot"
                                   # Agent ID used when this service acts
                                   # as an AP2 client

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
| `protocols.x402` | x402 client + server | `facilitator_url`, `default_network`, `default_asset`, `server.enabled`, `server.pay_to_address`, `server.default_price` |
| `protocols.ap2` | AP2 client + server | `mandate_issuer`, `credential_provider_url`, `server.enabled`, `server.agent_id` |
| `web3.<network>` | EVM chains | `rpc_url`, `chain_id`, `enabled` |
| `web2.<gateway>` | Payment APIs | Gateway-specific URLs, API versions |
| `kms` | Key management | `provider`, `region`, `key_id_env`, `linux_keyring_backend`, `gpg_key_id`, `gpg_binary` |
| `policy` | Compliance | All rule definitions + human confirmation toggle |
| `logging` | Observability | Multi-transport config, audit detail level |
| `web_api` | REST server | `host`, `port`, `cors_origins` |
| `cli` | Terminal UX | Confirmation mode, color output |

---

## CLI Reference

The CLI is available as `agentic-payments-bot` (via npm `bin`) or `npx agentic-payments-bot`.

### Global Options

| Flag | Description | Default |
|---|---|---|
| `-c, --config <path>` | Path to YAML config file | `config/default.yaml` |
| `-V, --version` | Print version | — |
| `-h, --help` | Show help | — |

### `pay` — Execute a Payment

```bash
agentic-payments-bot pay [options]
```

| Option | Required | Description |
|---|---|---|
| `--protocol <x402\|ap2>` | ✅ | Protocol to use |
| `--amount <string>` | ✅ | Decimal amount (e.g., `"10.50"`) |
| `--currency <string>` | ✅ | Currency code (`USDC`, `ETH`, `USD`, `EUR`) |
| `--to <string>` | ✅ | Recipient address, merchant ID, or URL (for x402/AP2 remote payments) |
| `--network <string>` | ❌ | Blockchain network (`ethereum`, `base`, `polygon`, `web2`) |
| `--gateway <string>` | ❌ | Payment gateway (`viem`, `stripe`, `paypal`, `visa`, `mastercard`, `googlepay`, `applepay`, `x402`, `ap2`) |
| `--description <string>` | ❌ | Human-readable description |
| `--wallet <string>` | ❌ | Wallet key alias in encrypted store (default: `default_wallet`) |

**Examples:**

```bash
# x402 USDC payment on Base
agentic-payments-bot pay \
  --protocol x402 \
  --amount 5.00 \
  --currency USDC \
  --to 0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65 \
  --network base

# AP2 Stripe payment
agentic-payments-bot pay \
  --protocol ap2 \
  --amount 49.99 \
  --currency USD \
  --to merchant-12345 \
  --gateway stripe \
  --description "Monthly subscription"

# PayPal payment with custom config
agentic-payments-bot pay \
  --config config/production.yaml \
  --protocol ap2 \
  --amount 25.00 \
  --currency USD \
  --to seller@example.com \
  --gateway paypal

# Visa Direct payment
agentic-payments-bot pay \
  --protocol ap2 \
  --amount 100.00 \
  --currency USD \
  --to 4111111111111111 \
  --gateway visa

# Mastercard Send payment
agentic-payments-bot pay \
  --protocol ap2 \
  --amount 75.00 \
  --currency USD \
  --to 5500000000000004 \
  --gateway mastercard

# x402 remote resource payment (pay for a URL)
agentic-payments-bot pay \
  --protocol x402 \
  --amount 1.00 \
  --currency USDC \
  --to https://api.premium-service.com/v1/data \
  --network base \
  --gateway x402

# AP2 remote mandate submission (pay via AP2 to a URL)
agentic-payments-bot pay \
  --protocol ap2 \
  --amount 19.99 \
  --currency USD \
  --to https://merchant.example.com/ap2/process-payment \
  --gateway ap2
```

### `parse` — Parse AI Output

Extract a `PaymentIntent` JSON from free-form AI text.

```bash
# Direct text
agentic-payments-bot parse '{"protocol":"x402","action":"pay","amount":"10","currency":"USDC","recipient":"0x..."}'

# From stdin (pipe AI model output)
echo '... AI response with embedded JSON ...' | agentic-payments-bot parse -
```

### `keys` — Key Management

Manage encrypted keys/tokens stored in SQLite via AWS KMS.

```bash
# Store a new encrypted key
agentic-payments-bot keys store \
  --alias default_wallet \
  --type web3_private_key \
  --value "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# List all stored keys (metadata only — no plaintext)
agentic-payments-bot keys list

# Delete a key
agentic-payments-bot keys delete stripe_api_key
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
agentic-payments-bot tx <transaction-id>
```

Outputs the full transaction record as JSON, including status, policy violations, tx hash, and
timestamps.

### `audit` — Query Audit Log

```bash
agentic-payments-bot audit [options]
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
agentic-payments-bot audit --category payment --since 2026-02-10T00:00:00Z

# Audit trail for a specific transaction
agentic-payments-bot audit --tx "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

# Recent policy violations
agentic-payments-bot audit --category policy --limit 30
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
  "skill": "agentic-payments-bot",
  "version": "0.6.0",
  "dryRun": false,
  "protocols": {
    "x402": { "enabled": true },
    "ap2": { "enabled": true }
  }
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
| `recipient` | string | ✅ | Destination address, merchant ID, **or URL** (for x402/AP2 remote payments) |
| `network` | string | ❌ | Blockchain network name |
| `gateway` | string | ❌ | Explicit gateway selection: `viem`, `stripe`, `paypal`, `visa`, `mastercard`, `googlepay`, `applepay`, **`x402`**, **`ap2`** |
| `description` | string | ❌ | Human-readable description |
| `metadata` | object | ❌ | Arbitrary metadata (e.g., `paymentToken` for GPay/APay, `payment_method_type` for AP2) |
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
  "confirmationRequired": false,
  "dryRun": false
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
| `category` | string | Filter: `payment`, `policy`, `kms`, `protocol`, `system`, `x402_server`, `ap2_server` |
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

### x402 Server Endpoints

These endpoints allow external agents and services to **pay you** via the x402 protocol.

---

#### `GET /api/v1/x402/premium/data` (Paywall-Protected)

An example x402-protected resource. Returns premium data after successful payment.

**Without `X-PAYMENT` header — Response `402`:**

The server returns payment requirements in the `X-PAYMENT` response header:

```
HTTP/1.1 402 Payment Required
X-PAYMENT: eyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOi4uLn0=
Content-Type: application/json

{
  "error": "Payment Required",
  "accepts": {
    "scheme": "exact",
    "network": "base",
    "maxAmountRequired": "1000000",
    "resource": "/api/v1/x402/premium/data",
    "description": "Access to premium agentic data feed",
    "mimeType": "application/json",
    "payTo": "0x...",
    "maxTimeoutSeconds": 60,
    "asset": "USDC"
  }
}
```

**With valid `X-PAYMENT` header — Response `200`:**

The agent sends a Base64-encoded signed payment payload:

```
GET /api/v1/x402/premium/data
X-PAYMENT: eyJ4NDAyVmVyc2lvbiI6MSwi...
```

On successful settlement:

```
HTTP/1.1 200 OK
X-PAYMENT-RESPONSE: eyJzdWNjZXNzIjp0cnVlLCJ0eEhhc2giOi4uLn0=
Content-Type: application/json

{
  "data": "This is premium data, paid for via x402.",
  "timestamp": "2026-03-06T12:00:00.000Z",
  "source": "agentic-payments-bot"
}
```

**x402 Payment Flow (from the agent's perspective):**

```
Agent                                Server
  │                                    │
  │── GET /api/v1/x402/premium/data ──►│
  │                                    │
  │◄── 402 + X-PAYMENT (requirements)──│
  │                                    │
  │   [sign EIP-3009 authorization]    │
  │                                    │
  │── GET /api/v1/x402/premium/data ──►│
  │   X-PAYMENT: <signed payload>      │
  │                                    │── [verify + settle on-chain]
  │                                    │
  │◄── 200 + X-PAYMENT-RESPONSE ───────│
  │   + resource data                  │
```

---

#### `GET /api/v1/x402/pricing`

List all registered x402-priced resources.

**Response `200`:**
```json
{
  "resources": [
    {
      "route": "/api/v1/x402/premium/data",
      "maxAmountRequired": "1000000",
      "asset": "USDC",
      "network": "base",
      "payTo": "0x...",
      "description": "Access to premium agentic data feed",
      "mimeType": "application/json"
    }
  ]
}
```

---

#### `POST /api/v1/x402/verify`

Verify a settlement transaction hash through the facilitator.

**Request body:**
```json
{
  "txHash": "0xabc123...",
  "network": "base"
}
```

**Response `200`:**
```json
{
  "verified": true,
  "details": {
    "blockNumber": 12345678,
    "from": "0x...",
    "to": "0x...",
    "value": "1000000"
  }
}
```

### AP2 Server Endpoints

These endpoints allow external agents to **pay you** via the AP2 mandate protocol. The server
acts as a mandate issuer, credential provider, and payment processor.

---

#### `POST /api/v1/ap2/mandates`

Accept a new mandate from an external agent.

**Request body:**
```json
{
  "mandate_id": "mandate_1709712000_abc123",
  "version": "1.0",
  "intent": {
    "action": "pay",
    "description": "Purchase premium API access",
    "amount": {
      "value": "49.99",
      "currency": "USD"
    },
    "recipient": {
      "id": "merchant-001",
      "name": "Example Merchant"
    }
  },
  "constraints": {
    "max_amount": "49.99",
    "valid_from": "2026-03-06T00:00:00.000Z",
    "valid_until": "2026-03-06T01:00:00.000Z",
    "single_use": true
  },
  "delegator": {
    "agent_id": "claude-agent-001",
    "user_id": "user-12345"
  }
}
```

**Response `201`:**
```json
{
  "mandate_id": "mandate_1709712000_abc123",
  "status": "accepted"
}
```

**Response `400`:**
```json
{
  "error": "Mandate has expired"
}
```

**Response `409`:**
```json
{
  "error": "Mandate ID already exists",
  "mandate_id": "mandate_1709712000_abc123"
}
```

---

#### `GET /api/v1/ap2/mandates`

List all accepted mandates.

**Response `200`:**
```json
{
  "mandates": [
    {
      "mandate_id": "mandate_1709712000_abc123",
      "status": "accepted",
      "amount": "49.99",
      "currency": "USD",
      "agent_id": "claude-agent-001",
      "created_at": "2026-03-06T12:00:00.000Z",
      "executed_at": null
    }
  ]
}
```

---

#### `GET /api/v1/ap2/mandates/:mandateId`

Get the status of a specific mandate.

**Response `200`:**
```json
{
  "mandate_id": "mandate_1709712000_abc123",
  "status": "executed",
  "created_at": "2026-03-06T12:00:00.000Z",
  "executed_at": "2026-03-06T12:01:00.000Z",
  "transaction_id": "pi_3Abc123..."
}
```

**Response `404`:**
```json
{
  "error": "Mandate not found"
}
```

---

#### `POST /api/v1/ap2/sign-mandate`

Sign a mandate (acting as a credential provider). In production, this verifies the delegator's
identity and signs the mandate with the server's ECDSA key.

**Request body:**
```json
{
  "mandate": {
    "mandate_id": "mandate_1709712000_abc123",
    "version": "1.0",
    "intent": { "..." : "..." },
    "constraints": { "..." : "..." },
    "delegator": { "..." : "..." }
  }
}
```

**Response `200`:**
```json
{
  "signed_mandate": {
    "mandate_id": "mandate_1709712000_abc123",
    "version": "1.0",
    "intent": { "..." : "..." },
    "constraints": { "..." : "..." },
    "delegator": { "..." : "..." },
    "signature": "sig_1709712000_a1b2c3d4"
  }
}
```

---

#### `POST /api/v1/ap2/payment-credentials`

Issue tokenized payment credentials for a specific mandate and payment method.

**Request body:**
```json
{
  "mandate_id": "mandate_1709712000_abc123",
  "payment_method_type": "stripe"
}
```

**Response `200`:**
```json
{
  "type": "stripe",
  "details": {
    "token": "tok_mandate_1709712000_abc123_1709712060000",
    "scoped_to_mandate": "mandate_1709712000_abc123",
    "max_amount": "49.99",
    "currency": "USD"
  }
}
```

**Response `409` (mandate already executed):**
```json
{
  "error": "Mandate already executed (single-use)"
}
```

---

#### `POST /api/v1/ap2/process-payment`

Execute a mandate against the server's internal payment backends. This is the final step in the
AP2 flow — the agent submits a mandate and payment method, and the server routes the payment to
Stripe, PayPal, Viem, or any other configured backend.

**Request body:**
```json
{
  "mandate": {
    "mandate_id": "mandate_1709712000_abc123",
    "version": "1.0",
    "intent": {
      "action": "pay",
      "description": "Premium API access",
      "amount": { "value": "49.99", "currency": "USD" },
      "recipient": { "id": "merchant-001" }
    },
    "constraints": {
      "max_amount": "49.99",
      "valid_from": "2026-03-06T00:00:00.000Z",
      "valid_until": "2026-03-06T01:00:00.000Z",
      "single_use": true
    },
    "delegator": { "agent_id": "claude-agent-001" },
    "signature": "sig_1709712000_a1b2c3d4"
  },
  "payment_method": {
    "type": "stripe",
    "details": {
      "token": "tok_mandate_1709712000_abc123_1709712060000"
    }
  }
}
```

**Supported `payment_method.type` values:**

| Type | Backend | Description |
|---|---|---|
| `stripe` | Stripe | Routes to Stripe Payment Intents API |
| `paypal` | PayPal | Routes to PayPal Orders API |
| `card` | Stripe (default) | Generic card payment, routes to Stripe |
| `crypto` | Viem | On-chain transfer (ETH or ERC-20). Specify `details.network` and optionally `details.wallet_alias`. |
| `bank_transfer` | — | Not yet supported |

**Response `200` (success):**
```json
{
  "mandate_id": "mandate_1709712000_abc123",
  "status": "success",
  "transaction_id": "pi_3Abc123...",
  "receipt": {
    "amount": "49.99",
    "currency": "USD",
    "timestamp": "2026-03-06T12:01:00.000Z",
    "reference": "pi_3Abc123..."
  }
}
```

**Response `202` (pending):**
```json
{
  "mandate_id": "mandate_1709712000_abc123",
  "status": "pending",
  "transaction_id": "pi_3Abc123..."
}
```

**Response `400` (failed):**
```json
{
  "mandate_id": "mandate_1709712000_abc123",
  "status": "failed",
  "error": "Mandate has expired"
}
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
  "recipient": "<address or merchant ID or URL>",
  "network": "ethereum | base | polygon | web2",
  "gateway": "viem | visa | mastercard | paypal | stripe | googlepay | applepay | x402 | ap2 | null",
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
| Target is an HTTP resource returning 402 | **x402** → `x402` gateway (client) |
| Recipient is a URL + `protocol: "x402"` | **x402** → `x402` gateway (client, remote resource payment) |
| User mentions "x402", "stablecoin", "USDC", "onchain" | **x402** |
| Payment involves a mandate, delegated purchase | **AP2** |
| Recipient is a URL + `protocol: "ap2"` | **AP2** → `ap2` gateway (client, remote mandate submission) |
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

> **Tip:** All examples below work in **dry-run mode** (no real payments, no
> credentials needed). Prefix every CLI command with `--dry-run` or set
> `DRY_RUN=true` in your environment.

### Example 1 — USDC Payment on Base (Web3)

**Via CLI:**
```bash
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_KMS_KEY_ID="arn:aws:kms:..."

agentic-payments-bot pay \
  --protocol x402 \
  --amount 5.00 \
  --currency USDC \
  --to 0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65 \
  --network base \
  --gateway viem \
  --wallet default_wallet
  --description "USDC payment on Base"
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

**Via Web API (curl):**
```bash
# Start the web API
npm run web

# In another terminal, execute a payment
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "x402",
    "action": "pay",
    "amount": "5.00",
    "currency": "USDC",
    "recipient": "0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65",
    "network": "base",
    "gateway": "viem",
    "description": "USDC payment on Base"
  }'
```

**Response:**
```json
{
  "success": true,
  "tx": {
    "id": "a1b2c3d4-5678-9012-3456-789012345678",
    "protocol": "x402",
    "gateway": "viem",
    "amount": 5.0,
    "amount_usd": 5.0,
    "currency": "USDC",
    "status": "executed"
  },
  "txHash": "0xabc123...def456",
  "policyResult": { "allowed": true, "violations": [], "requiresHumanConfirmation": false },
  "confirmationRequired": false,
  "dryRun": true
}
```

### Example 2 — USDC Payment on Ethereum (Web3)

**Via CLI:**
```bash
agentic-payments-bot pay \
  --protocol x402 \
  --amount 10.00 \
  --currency USDC \
  --to 0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97 \
  --network ethereum \
  --gateway viem
```

**Via Web API (curl):**
```bash
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "x402",
    "action": "pay",
    "amount": "10.00",
    "currency": "USDC",
    "recipient": "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
    "network": "ethereum",
    "gateway": "viem",
    "description": "USDC payment on Ethereum"
  }'
```

### Example 3 — USDT Payment on Base (Web3)

**Via CLI:**
```bash
agentic-payments-bot pay \
  --protocol x402 \
  --amount 25.00 \
  --currency USDT \
  --to 0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65 \
  --network base \
  --gateway viem
```

**Via Web API (curl):**
```bash
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "x402",
    "action": "pay",
    "amount": "25.00",
    "currency": "USDT",
    "recipient": "0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65",
    "network": "base",
    "gateway": "viem",
    "description": "USDT payment on Base"
  }'
```

### Example 4 — USDT Payment on Ethereum (Web3)

**Via CLI:**
```bash
agentic-payments-bot pay \
  --protocol x402 \
  --amount 50.00 \
  --currency USDT \
  --to 0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97 \
  --network ethereum \
  --gateway viem
```

**Via Web API (curl):**
```bash
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "x402",
    "action": "pay",
    "amount": "50.00",
    "currency": "USDT",
    "recipient": "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
    "network": "ethereum",
    "gateway": "viem",
    "description": "USDT payment on Ethereum"
  }'
```

### Example 5 — ETH Transfer on Ethereum (Web3)

**Via CLI:**
```bash
agentic-payments-bot pay \
  --protocol x402 \
  --amount 0.01 \
  --currency ETH \
  --to 0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97 \
  --network ethereum \
  --gateway viem
```

**Via Web API (curl):**
```bash
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "x402",
    "action": "pay",
    "amount": "0.01",
    "currency": "ETH",
    "recipient": "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
    "network": "ethereum",
    "gateway": "viem",
    "description": "ETH transfer on Ethereum"
  }'
```

### Example 6 — Stripe Payment (Web2)

**Via CLI:**
```bash
agentic-payments-bot pay \
  --protocol ap2 \
  --amount 49.99 \
  --currency USD \
  --to merchant-stripe-001 \
  --network web2 \
  --gateway stripe \
  --description "Stripe payment"
```

**Via Web API (curl):**
```bash
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "ap2",
    "action": "pay",
    "amount": "49.99",
    "currency": "USD",
    "recipient": "merchant-stripe-001",
    "gateway": "stripe",
    "description": "Stripe payment"
  }'
```

**Response:**
```json
{
  "success": true,
  "tx": {
    "id": "b2c3d4e5-6789-0123-4567-890123456789",
    "protocol": "ap2",
    "gateway": "stripe",
    "amount": 49.99,
    "amount_usd": 49.99,
    "currency": "USD",
    "status": "executed"
  },
  "web2Result": {
    "gateway": "stripe",
    "transaction_id": "pi_dryrun_abc123def456",
    "status": "success",
    "amount": "49.99",
    "currency": "USD"
  },
  "policyResult": {
    "allowed": true,
    "violations": [],
    "requiresHumanConfirmation": false
  },
  "confirmationRequired": false,
  "dryRun": true
}
```

### Example 7 — PayPal Payment (Web2)

**Via CLI:**
```bash
agentic-payments-bot pay \
  --protocol ap2 \
  --amount 25.00 \
  --currency USD \
  --to seller@example.com \
  --gateway paypal \
  --description "PayPal payment"
```

**Via Web API (curl):**
```bash
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "ap2",
    "action": "pay",
    "amount": "25.00",
    "currency": "USD",
    "recipient": "seller@example.com",
    "gateway": "paypal",
    "description": "PayPal payment"
  }'
```

**Response:**
```json
{
  "success": true,
  "tx": { "id": "...", "protocol": "ap2", "gateway": "paypal", "status": "executed" },
  "web2Result": {
    "gateway": "paypal",
    "transaction_id": "PAYPAL-DRYRUN-ABC1234567",
    "status": "success",
    "amount": "25.00",
    "currency": "USD",
    "receipt_url": "https://sandbox.paypal.com/dryrun/approval"
  },
  "dryRun": true
}
```

### Example 8 — Visa Direct Payment (Web2)

**Via CLI:**
```bash
agentic-payments-bot pay \
  --protocol ap2 \
  --amount 100.00 \
  --currency USD \
  --to 4111111111111111 \
  --gateway visa \
  --description "Visa Direct push payment"
```

**Via Web API (curl):**
```bash
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "ap2",
    "action": "pay",
    "amount": "100.00",
    "currency": "USD",
    "recipient": "4111111111111111",
    "gateway": "visa",
    "description": "Visa Direct push payment"
  }'
```

### Example 9 — Mastercard Send Payment (Web2)

**Via CLI:**
```bash
agentic-payments-bot pay \
  --protocol ap2 \
  --amount 75.00 \
  --currency USD \
  --to 5111111111111118 \
  --gateway mastercard \
  --description "Mastercard Send payment"
```

**Via Web API (curl):**
```bash
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "ap2",
    "action": "pay",
    "amount": "75.00",
    "currency": "USD",
    "recipient": "5111111111111118",
    "gateway": "mastercard",
    "description": "Mastercard Send payment"
  }'
```

**Response:**
```json
{
  "success": true,
  "tx": {
    "id": "c3d4e5f6-7890-abcd-ef12-345678901234",
    "protocol": "ap2",
    "gateway": "mastercard",
    "amount": 75.0,
    "amount_usd": 75.0,
    "currency": "USD",
    "status": "executed"
  },
  "web2Result": {
    "gateway": "mastercard",
    "transaction_id": "MC-TXN-12345678",
    "status": "success",
    "amount": "75.00",
    "currency": "USD"
  },
  "policyResult": {
    "allowed": true,
    "violations": [],
    "requiresHumanConfirmation": false
  },
  "confirmationRequired": false,
  "dryRun": false
}
```

### Example 10 — Google Pay Payment (Web2)

**Via CLI:**
```bash
agentic-payments-bot pay \
  --protocol ap2 \
  --amount 35.00 \
  --currency USD \
  --to merchant-gpay-001 \
  --gateway googlepay \
  --description "Google Pay payment"
```

> **Note:** The `paymentToken` in `metadata` must be the encrypted payment token
> obtained from the client-side [Google Pay JS API](https://developers.google.com/pay/api).
> The server never generates this token — it only processes it.

> **Note:** In production, `metadata.paymentToken` must be supplied via the Web API
> (the token comes from the client-side Google Pay JS API). The CLI works in dry-run
> mode without it.

**Via Web API (curl):**
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
    "description": "Google Pay payment",
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
    "transaction_id": "GPAY-DRYRUN-ABC123DEF456",
    "status": "success",
    "amount": "35.00",
    "currency": "USD"
  },
  "dryRun": true
}
```

### Example 11 — Apple Pay Payment (Web2)

**Via CLI:**
```bash
agentic-payments-bot pay \
  --protocol ap2 \
  --amount 59.99 \
  --currency USD \
  --to merchant-applepay-001 \
  --gateway applepay \
  --description "Apple Pay payment"
```

> **Note:** The `paymentToken` must be the encrypted token from the client-side
> [Apple Pay JS API](https://developer.apple.com/apple-pay/). The optional
> `validationURL` triggers server-to-server merchant session validation with Apple
> before the token is processed.

> **Note:** In production, `metadata.paymentToken` must be supplied via the Web API
> (the token comes from the client-side Apple Pay JS API). The CLI works in dry-run
> mode without it.

**Via Web API (curl):**
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
    "description": "Apple Pay payment",
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
    "transaction_id": "APAY-DRYRUN-XYZ789ABC012",
    "status": "success",
    "amount": "59.99",
    "currency": "USD",
    "receipt_url": "https://sandbox.apple.com/dryrun/receipt"
  },
  "dryRun": true
}
```

### Example 12 — x402 Remote Resource Payment (Paying Another Service)

This demonstrates the **client side** — your agent pays for access to an x402-protected
resource hosted by another service.

**Via CLI:**
```bash
agentic-payments-bot pay \
  --protocol x402 \
  --amount 1.00 \
  --currency USDC \
  --to https://api.premium-service.com/v1/data \
  --network base \
  --gateway x402 \
  --description "Access premium data via x402"
```

**Via Web API (curl):**
```bash
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "x402",
    "action": "pay",
    "amount": "1.00",
    "currency": "USDC",
    "recipient": "https://api.premium-service.com/v1/data",
    "network": "base",
    "gateway": "x402",
    "description": "Access premium data via x402"
  }'
```

**Response:**
```json
{
  "success": true,
  "tx": {
    "id": "f6789012-3456-def0-1234-567890abcdef",
    "protocol": "x402",
    "gateway": "x402",
    "amount": 1.0,
    "currency": "USDC",
    "recipient": "https://api.premium-service.com/v1/data",
    "status": "executed"
  },
  "txHash": "0xabc123...",
  "policyResult": { "allowed": true, "violations": [], "requiresHumanConfirmation": false },
  "confirmationRequired": false,
  "dryRun": true
}
```

### Example 13 — AP2 Remote Mandate Payment (Paying Another Service)

This demonstrates the **client side** — your agent creates and submits a mandate to an
AP2-compliant external payment processor.

**Via CLI:**
```bash
agentic-payments-bot pay \
  --protocol ap2 \
  --amount 79.99 \
  --currency USD \
  --to https://merchant.example.com/ap2/process-payment \
  --gateway ap2 \
  --description "Annual subscription via AP2"
```

**Via Web API (curl):**
```bash
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "ap2",
    "action": "pay",
    "amount": "79.99",
    "currency": "USD",
    "recipient": "https://merchant.example.com/ap2/process-payment",
    "gateway": "ap2",
    "description": "Annual subscription via AP2",
    "metadata": {
      "payment_method_type": "card"
    }
  }'
```

### Example 14 — AI Chat-Driven Payment

User prompt in OpenClaw chat:

> "Pay 10 USDC to 0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65 on Base for API access"

The agent responds with embedded JSON (per `SKILL.md` instructions):

```text
I'll process this payment for you now:

```json
{
  "protocol": "x402",
  "action": "pay",
  "amount": "10.00",
  "currency": "USDC",
  "recipient": "0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65",
  "network": "base",
  "gateway": "viem",
  "description": "API access payment"
}
```

The payment has been submitted.
```

The skill's protocol router extracts this JSON, validates it, runs policy checks, and executes
the payment.

The skill automatically parses the JSON block using `parsePaymentIntentFromAIOutput()`.

**Via CLI parse:**
```bash
agentic-payments-bot parse '{"protocol":"x402","action":"pay","amount":"5.00","currency":"USDC","recipient":"0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65","network":"base"}'
```

**Via Web API:**
```bash
curl -X POST http://localhost:3402/api/v1/parse \
  -H "Content-Type: application/json" \
  -d '{"text": "{\"protocol\":\"x402\",\"action\":\"pay\",\"amount\":\"5.00\",\"currency\":\"USDC\",\"recipient\":\"0x742d35Cc6635C0532925a3b844Bc9e7595f2bD65\",\"network\":\"base\"}"}'
```

### Example 15 — Policy Violation & Human Confirmation

**Via CLI (over-limit triggers policy engine):**
```bash
agentic-payments-bot pay \
  --protocol ap2 \
  --amount 99999.99 \
  --currency USD \
  --to merchant-big-spender \
  --gateway stripe \
  --description "Large payment (expect policy violation)"
```

The CLI will prompt for human confirmation:
```
⚠️  Policy violations detected:
  • [single_transaction] Amount $99999.99 exceeds single-tx limit of $1000.00

Confirm payment? (yes/no):
```

**Via Web API (returns 202 with confirmation required):**

```bash
# 1. Submit a payment that exceeds the single-transaction limit
curl -X POST http://localhost:3402/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "ap2",
    "action": "pay",
    "amount": "99999.99",
    "currency": "USD",
    "recipient": "merchant-big-spender",
    "gateway": "stripe"
  }'
```

```bash
Response: 202 with confirmationRequired: true
{
  "confirmationRequired": true,
  "confirmationPrompt": "Confirmation required for tx abc123... POST /api/v1/confirm/abc123..."
}
```

```bash
# 2. Check pending confirmations
curl http://localhost:3402/api/v1/pending
```

**Confirm via API:**
```bash
# 3. Approve the payment
curl -X POST http://localhost:3402/api/v1/confirm/<tx-id> \
  -H "Content-Type: application/json" \
  -d '{"confirmed": true, "reason": "One-time approved by CFO"}'
```

### Example 16 — Key Management

```bash
# Store a wallet private key
agentic-payments-bot keys store \
  --alias trading_wallet \
  --type web3_private_key \
  --value "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Store Stripe API key
agentic-payments-bot keys store \
  --alias stripe_api_key \
  --type stripe_token \
  --value "sk_test_..."

# List all stored keys (metadata only, plaintext is NEVER shown)
agentic-payments-bot keys list

# ┌──────────┬───────────────────┬─────────────────┬─────────────────────────────┬─────────────────────┐
# │ id       │ key_type          │ key_alias       │ kms_key_id                  │ created_at          │
# ├──────────┼───────────────────┼─────────────────┼─────────────────────────────┼─────────────────────┤
# │ a1b2...  │ web3_private_key  │ trading_wallet  │ arn:aws:kms:us-east-1:...   │ 2026-02-10 12:00:00 │
# │ c3d4...  │ stripe_token      │ stripe_api_key  │ arn:aws:kms:us-east-1:...   │ 2026-02-10 12:01:00 │
# └──────────┴───────────────────┴─────────────────┴─────────────────────────────┴─────────────────────┘

# Delete a key
agentic-payments-bot keys delete trading_wallet
agentic-payments-bot keys delete stripe_api_key
```

### Example 17 — x402 Paywall (External Agent Paying You)

This demonstrates the **server side** — an external agent pays for access to a
resource protected by the x402 paywall middleware.

**Step 1 — Agent discovers payment requirements:**
```bash
# Agent requests the resource — gets 402 + payment details
curl -v http://localhost:3402/api/v1/x402/premium/data
```

**Response:**
```
< HTTP/1.1 402 Payment Required
< X-PAYMENT: eyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJiYXNlIiwi...
<
{
  "error": "Payment Required",
  "accepts": {
    "scheme": "exact",
    "network": "base",
    "maxAmountRequired": "1000000",
    "asset": "USDC",
    "payTo": "0x...",
    "resource": "/api/v1/x402/premium/data",
    "description": "Access to premium agentic data feed"
  }
}
```

**Step 2 — Agent signs and submits payment:**
```bash
# Agent retries with a signed X-PAYMENT header
curl -v http://localhost:3402/api/v1/x402/premium/data \
  -H "X-PAYMENT: eyJ4NDAyVmVyc2lvbiI6MSwisc2NoZW1lIjoiZXhhY3QiLC..."
```

**Response (success):**
```
< HTTP/1.1 200 OK
< X-PAYMENT-RESPONSE: eyJzdWNjZXNzIjp0cnVlLCJ0eEhhc2giOiIweGFiYy4uLiJ9
<
{
  "data": "This is premium data, paid for via x402.",
  "timestamp": "2026-03-06T12:00:00.000Z",
  "source": "agentic-payments-bot"
}
```

**Step 3 — Check available pricing:**
```bash
curl http://localhost:3402/api/v1/x402/pricing
```

**Response:**
```json
{
  "resources": [
    {
      "route": "/api/v1/x402/premium/data",
      "maxAmountRequired": "1000000",
      "asset": "USDC",
      "network": "base",
      "payTo": "0x...",
      "description": "Access to premium agentic data feed"
    }
  ]
}
```

### Example 18 — AP2 Mandate (External Agent Paying You)

This demonstrates the **server side** — an external agent submits an AP2 mandate
and the server processes the payment internally.

**Step 1 — Agent submits a mandate:**
```bash
curl -X POST http://localhost:3402/api/v1/ap2/mandates \
  -H "Content-Type: application/json" \
  -d '{
    "mandate_id": "mandate_1709712000_demo",
    "version": "1.0",
    "intent": {
      "action": "pay",
      "description": "API access subscription",
      "amount": { "value": "29.99", "currency": "USD" },
      "recipient": { "id": "merchant-001" }
    },
    "constraints": {
      "max_amount": "29.99",
      "valid_from": "2026-03-28T00:00:00.000Z",
      "valid_until": "2026-03-29T00:00:00.000Z",
      "single_use": true
    },
    "delegator": {
      "agent_id": "external-agent-001",
      "user_id": "user-42"
    }
  }'
```

**Response:**
```json
{
  "mandate_id": "mandate_1709712000_demo",
  "status": "accepted"
}
```

**Step 2 — Agent requests mandate signing:**
```bash
curl -X POST http://localhost:3402/api/v1/ap2/sign-mandate \
  -H "Content-Type: application/json" \
  -d '{
    "mandate": {
      "mandate_id": "mandate_1709712000_demo",
      "version": "1.0",
      "intent": {
        "action": "pay",
        "description": "API access subscription",
        "amount": {
          "value": "29.99",
          "currency": "USD"
        },
        "recipient": { "id": "merchant-001" }
      },
      "constraints": {
        "max_amount": "29.99",
        "valid_from": "2026-03-28T00:00:00.000Z",
        "valid_until": "2026-03-29T00:00:00.000Z",
        "single_use": true
      },
      "delegator": { "agent_id": "external-agent-001" }
    }
  }'
```

**Step 3 — Agent obtains payment credentials:**
```bash
curl -X POST http://localhost:3402/api/v1/ap2/payment-credentials \
  -H "Content-Type: application/json" \
  -d '{
    "mandate_id": "mandate_1709712000_demo",
    "payment_method_type": "stripe"
  }'
```

**Step 4 — Agent submits for payment processing:**
```bash
curl -X POST http://localhost:3402/api/v1/ap2/process-payment \
  -H "Content-Type: application/json" \
  -d '{
    "mandate": {
      "mandate_id": "mandate_1709712000_demo",
      "version": "1.0",
      "intent": {
        "action": "pay",
        "description": "API access subscription",
        "amount": {
          "value": "29.99",
          "currency": "USD"
        },
        "recipient": { "id": "merchant-001" }
      },
      "constraints": {
        "max_amount": "29.99",
        "valid_from": "2026-03-28T00:00:00.000Z",
        "valid_until": "2026-03-29T00:00:00.000Z",
        "single_use": true
      },
      "delegator": { "agent_id": "external-agent-001" },
      "signature": "sig_1709712000_a1b2c3d4"
    },
    "payment_method": {
      "type": "stripe",
      "details": { "token": "tok_mandate_1709712000_demo_1709712060000" }
    }
  }'
```

**Response:**
```json
{
  "mandate_id": "mandate_1709712000_demo",
  "status": "success",
  "transaction_id": "pi_3Abc123...",
  "receipt": {
    "amount": "29.99",
    "currency": "USD",
    "timestamp": "2026-03-06T12:01:00.000Z",
    "reference": "pi_3Abc123..."
  }
}
```

**Step 5 — Verify mandate status:**
```bash
curl http://localhost:3402/api/v1/ap2/mandates/mandate_1709712000_demo
```

**Response:**
```json
{
  "mandate_id": "mandate_1709712000_demo",
  "status": "executed",
  "created_at": "2026-03-06T12:00:00.000Z",
  "executed_at": "2026-03-06T12:01:00.000Z",
  "transaction_id": "pi_3Abc123..."
}
```

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
| `better-sqlite3` | `^12.8.0` | SQLite driver (native, synchronous) |
| `yaml` | `^2.7.0` | YAML config parsing |
| `express` | `^5.1.0` | Web API server |
| `commander` | `^13.1.0` | CLI framework |
| `winston` | `^3.17.0` | Multi-transport logging |
| `zod` | `^3.24.0` | Schema validation |
| `uuid` | `^11.1.0` | UUID generation for IDs |
| `readline-sync` | `^1.4.10` | CLI interactive prompts |
| `chalk` | `^5.4.0` | Terminal color output |
| `dotenv` | `^16.5.0` | Environment variable loading |

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
| `D-Bus Secret Service: key not found` | Secret not stored in keyring | Store the key first via `agentic-payments-bot keys store`, or check that the correct keyring is unlocked |
| KDE Wallet prompt on every access | KWallet locked or Secret Service bridge disabled | Unlock KDE Wallet, or enable Secret Service integration in KDE System Settings |
| `@aspect-build/keytar` build failure | Missing C++ build tools for native addon | Install `build-essential` (Linux), Xcode CLI tools (macOS), or Visual Studio Build Tools (Windows). Or use `linux_keyring_backend: "dbus-next"` to avoid native compilation. |
| `Encrypted key not found for alias 'X'` | Key not stored yet | Run `agentic-payments-bot keys store --alias X ...` |
| `Network 'X' is disabled in configuration` | Chain disabled in YAML | Set `web3.X.enabled: true` in config |
| `x402 protocol is disabled in configuration` | Protocol toggle | Set `protocols.x402.enabled: true` |
| `Could not parse a valid payment intent` | AI output doesn't contain valid JSON | Ensure agent uses the exact JSON schema from `SKILL.md` |
| `SQLITE_BUSY` errors | Concurrent writes | Increase `database.busy_timeout_ms` or ensure WAL mode |
| `Policy violations detected` (unexpected) | Aggregate limits hit | Check `agentic-payments-bot audit --category policy` and adjust `policy.rules` |
| Web API not starting | Port conflict | Change `web_api.port` in config |
| `Google Pay requires a 'paymentToken' in metadata` | Missing client-side token | Ensure the Google Pay JS API token is passed in `metadata.paymentToken` |
| `Apple Pay requires a 'paymentToken' in metadata` | Missing client-side token | Ensure the Apple Pay JS API token is passed in `metadata.paymentToken` |
| `Apple Pay merchant validation failed` | Invalid cert or domain | Verify domain is registered with Apple and `applepay_merchant_cert` is valid |
| `x402 settlement failed: Facilitator rejected` | Invalid payment payload or facilitator unreachable | Check `facilitator_url` in config, verify the signed authorization fields (amount, payTo, time bounds) |
| `AP2 mandate has expired` | Mandate `valid_until` is in the past | Create a new mandate with a future expiry |
| `Mandate already executed (single-use)` | Attempting to reuse a single-use mandate | Create a new mandate for each payment |
| `Invalid X-PAYMENT header` | Malformed Base64 or JSON in x402 payment header | Ensure the `X-PAYMENT` header is valid Base64-encoded JSON matching `X402PaymentPayload` |
| `Unsupported payment method type: X` | AP2 payment method not implemented | Use one of: `stripe`, `paypal`, `card`, `crypto` |

### Debugging

1. **Set log level to `debug`** in `config/default.yaml`:
   ```yaml
   logging:
     level: "debug"
   ```

2. **Check the audit log** for full context:
   ```bash
   agentic-payments-bot audit --limit 30
   ```

3. **Inspect a specific transaction:**
   ```bash
   agentic-payments-bot tx <transaction-id>
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
