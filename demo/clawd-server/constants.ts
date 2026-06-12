// Mainnet USDC mint
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
export const USDC_DECIMALS = 6

// x402.wtf public endpoints — read from env or fall back to defaults
export const X402_BASE = process.env.X402_BASE_URL ?? 'https://x402.wtf'
export const ENDPOINTS = {
  llm:         `${X402_BASE}/api/tide/v1/chat/completions`,
  models:      `${X402_BASE}/api/tide/v1/models`,
  agentCatalog:`${X402_BASE}/api/agents/catalog`,
  agentChat:   `${X402_BASE}/api/agents/chat`,
  agentAttest: `${X402_BASE}/api/agents/attest`,
  skills:      `${X402_BASE}/api/skills`,
  perps:       `${X402_BASE}/api/perps`,
  perpsTicker: `${X402_BASE}/api/phoenix/meta`,
  caapDiscovery:`${X402_BASE}/.well-known/agent-auth.json`,
} as const
