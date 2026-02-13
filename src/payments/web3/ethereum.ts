// Viem based Transaction Producer
//
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  parseUnits,
  encodeFunctionData,
  type Address,
  type Hash,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, base, polygon } from "viem/chains";
import { getConfig } from "../../config/loader";
import { getLogger } from "../../logging/logger";
import { auditLog } from "../../db/audit";
import { retrieveAndDecrypt } from "../../kms/aws-kms";

// ─── ERC-20 Transfer ABI (minimal) ─────────────────────────────────────────

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

// Well-known stablecoin addresses by network
const USDC_ADDRESSES: Record<string, Address> = {
  ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
};

// ─── Chain Resolver ─────────────────────────────────────────────────────────

function resolveChain(networkName: string): { chain: Chain; rpcUrl: string } {
  const config = getConfig();
  const chainMap: Record<string, Chain> = {
    ethereum: mainnet,
    base: base,
    polygon: polygon,
  };

  const chain = chainMap[networkName];
  if (!chain) {
    throw new Error(`Unsupported network: ${networkName}`);
  }

  const netConfig = config.web3[networkName];
  if (!netConfig?.enabled) {
    throw new Error(`Network '${networkName}' is disabled in configuration`);
  }

  return { chain, rpcUrl: netConfig.rpc_url };
}

// ─── Ethereum Transaction Producer ──────────────────────────────────────────

export interface EthereumTxResult {
  txHash: Hash;
  network: string;
  from: Address;
  to: Address;
  amount: string;
  currency: string;
}

/**
 * Send native ETH to a recipient.
 */
export async function sendEth(
  walletKeyAlias: string,
  to: Address,
  amount: string, // in ETH (e.g. "0.1")
  networkName: string = "ethereum"
): Promise<EthereumTxResult> {
  const logger = getLogger();
  logger.info("web3: Preparing ETH transfer", { to, amount, network: networkName });

  const privateKey = await retrieveAndDecrypt(walletKeyAlias);
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const { chain, rpcUrl } = resolveChain(networkName);

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const txHash = await walletClient.sendTransaction({
    to,
    value: parseEther(amount),
  });

  auditLog("info", "payment", "eth_transfer_sent", {
    txHash,
    from: account.address,
    to,
    amount,
    network: networkName,
  });

  logger.info("web3: ETH transfer sent", { txHash });

  return {
    txHash,
    network: networkName,
    from: account.address,
    to,
    amount,
    currency: "ETH",
  };
}

/**
 * Send ERC-20 token (e.g. USDC) to a recipient.
 */
export async function sendErc20(
  walletKeyAlias: string,
  to: Address,
  amount: string,
  tokenSymbol: string = "USDC",
  networkName: string = "base",
  tokenAddress?: Address,
  decimals: number = 6
): Promise<EthereumTxResult> {
  const logger = getLogger();
  logger.info("web3: Preparing ERC-20 transfer", {
    to,
    amount,
    token: tokenSymbol,
    network: networkName,
  });

  const privateKey = await retrieveAndDecrypt(walletKeyAlias);
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const { chain, rpcUrl } = resolveChain(networkName);

  const contractAddress =
    tokenAddress ?? USDC_ADDRESSES[networkName];
  if (!contractAddress) {
    throw new Error(
      `No known address for ${tokenSymbol} on ${networkName}. Provide tokenAddress.`
    );
  }

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [to, parseUnits(amount, decimals)],
  });

  const txHash = await walletClient.sendTransaction({
    to: contractAddress,
    data,
  });

  auditLog("info", "payment", "erc20_transfer_sent", {
    txHash,
    from: account.address,
    to,
    amount,
    token: tokenSymbol,
    contractAddress,
    network: networkName,
  });

  logger.info("web3: ERC-20 transfer sent", { txHash, token: tokenSymbol });

  return {
    txHash,
    network: networkName,
    from: account.address,
    to,
    amount,
    currency: tokenSymbol,
  };
}

/**
 * Wait for transaction confirmation.
 */
export async function waitForConfirmation(
  txHash: Hash,
  networkName: string = "ethereum"
): Promise<{ status: "success" | "reverted"; blockNumber: bigint }> {
  const { chain, rpcUrl } = resolveChain(networkName);

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    status: receipt.status,
    blockNumber: receipt.blockNumber,
  };
}
