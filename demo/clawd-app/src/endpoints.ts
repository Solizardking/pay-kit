export type Endpoint = {
  method: 'GET' | 'POST'
  path: string
  description: string
  cost: string
  params?: Array<{ name: string; default: string }>
  body?: Record<string, unknown>
}

// Demo server runs at localhost:4402 by default.
// Override with VITE_CLAWD_SERVER_URL env var.
const BASE = import.meta.env.VITE_CLAWD_SERVER_URL ?? 'http://localhost:4402'

export const ENDPOINTS: Endpoint[] = [
  {
    method: 'POST',
    path: '/api/v1/llm/completions',
    description: 'OpenAI-compatible LLM completions via x402.wtf',
    cost: '0.01 USDC',
    body: {
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'Hello from Clawd!' }],
      max_tokens: 256,
    },
  },
  {
    method: 'GET',
    path: '/api/v1/llm/models',
    description: 'Available LLM models',
    cost: 'free',
  },
  {
    method: 'GET',
    path: '/api/v1/agents/catalog',
    description: '125 production Solana DeFi agents',
    cost: 'free',
  },
  {
    method: 'GET',
    path: '/api/v1/agents/discovery',
    description: 'CAAP/1.0 agent auth discovery',
    cost: 'free',
  },
  {
    method: 'POST',
    path: '/api/v1/agents/chat',
    description: 'Chat with a registered agent',
    cost: '0.02 USDC',
    body: { agentId: 'solana-autonomous-trader', message: 'Analyse SOL/USDC' },
  },
  {
    method: 'POST',
    path: '/api/v1/agents/attest',
    description: 'CAAP/1.0 attestation — get tier + NFT',
    cost: '0.01 USDC',
    body: { walletAddress: '' },
  },
  {
    method: 'GET',
    path: '/api/v1/skills',
    description: '130+ formally verified skills catalog',
    cost: 'free',
  },
  {
    method: 'GET',
    path: '/api/v1/skills/:slug',
    description: 'Skill detail + attestation block',
    cost: '0.01 USDC',
    params: [{ name: 'slug', default: 'vulcan-trade-execution' }],
  },
  {
    method: 'GET',
    path: '/api/v1/perps/markets',
    description: 'Phoenix perps market list',
    cost: 'free',
  },
  {
    method: 'GET',
    path: '/api/v1/perps/ticker/:market',
    description: 'Live Phoenix perps ticker',
    cost: '0.01 USDC',
    params: [{ name: 'market', default: 'SOL-PERP' }],
  },
  {
    method: 'GET',
    path: '/api/v1/perps/orderbook',
    description: 'Phoenix perps orderbook (top 10)',
    cost: '0.01 USDC',
    params: [{ name: 'market', default: 'SOL-PERP' }],
  },
]

/** Build a full URL from endpoint + param values. */
export function buildUrl(endpoint: Endpoint, paramValues: Record<string, string> = {}): string {
  let path = endpoint.path
  const query: string[] = []

  for (const param of endpoint.params ?? []) {
    const value = paramValues[param.name] ?? param.default
    if (path.includes(`:${param.name}`)) {
      path = path.replace(`:${param.name}`, encodeURIComponent(value))
    } else {
      query.push(`${param.name}=${encodeURIComponent(value)}`)
    }
  }

  const qs = query.length ? `?${query.join('&')}` : ''
  return `${BASE}${path}${qs}`
}

/** Generate a mppx.fetch() code snippet for an endpoint. */
export function buildSnippet(endpoint: Endpoint, paramValues: Record<string, string> = {}): string {
  const url = buildUrl(endpoint, paramValues)
  const bodySection = endpoint.body
    ? `,\n  body: JSON.stringify(${JSON.stringify(endpoint.body, null, 2)})`
    : ''

  return `import { Mppx, solana } from '@solana/mpp/client'

// signer from @solana/kit (Phantom / Backpack / burner keypair)
const method = solana.charge({ signer, rpcUrl: 'https://api.mainnet-beta.solana.com' })
const mppx = Mppx.create({ methods: [method] })

// mppx.fetch() intercepts 402 → signs tx → retries automatically
const response = await mppx.fetch('${url}', {
  method: '${endpoint.method}'${bodySection}
})
const data = await response.json()
console.log(data)`
}
