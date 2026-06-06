import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import type { Request, Response } from 'express'
import {
  generateKeyPairSigner,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  getBase58Encoder,
  type KeyPairSigner,
} from '@solana/kit'
import { registerLlm } from './modules/llm.js'
import { registerAgents } from './modules/agents.js'
import { registerSkills } from './modules/skills.js'
import { registerPerps } from './modules/perps.js'
import { dim, green, cyan, yellow, magenta, bold } from './utils.js'
import { X402_BASE, ENDPOINTS } from './constants.js'

// ── Recipient + signer ────────────────────────────────────────────────────────
let RECIPIENT = process.env.RECIPIENT
if (!RECIPIENT) {
  const s = await generateKeyPairSigner()
  RECIPIENT = s.address
}

const NETWORK = (process.env.NETWORK ?? 'mainnet') as string
const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
const SECRET_KEY = process.env.MPP_SECRET_KEY ?? crypto.randomBytes(32).toString('hex')

let feePayerSigner: KeyPairSigner
if (process.env.FEE_PAYER_KEY) {
  const bytes = getBase58Encoder().encode(process.env.FEE_PAYER_KEY)
  feePayerSigner = await createKeyPairSignerFromBytes(bytes)
} else {
  feePayerSigner = await generateKeyPairSigner()
}

// ── Express ───────────────────────────────────────────────────────────────────
const app = express()
app.use(express.json())
app.use(cors({ exposedHeaders: ['www-authenticate', 'payment-receipt'] }))

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/v1/health', async (_req: Request, res: Response) => {
  let feePayerBalance: number | undefined
  try {
    const rpc = createSolanaRpc(RPC_URL)
    const { value } = await rpc.getBalance(feePayerSigner.address).send()
    feePayerBalance = Number(value) / 1e9
  } catch { /* rpc may be unavailable on localnet */ }

  res.json({
    ok: true,
    gateway: X402_BASE,
    feePayer: feePayerSigner.address,
    feePayerBalance,
    network: NETWORK,
    endpoints: ENDPOINTS,
  })
})

// ── Modules ───────────────────────────────────────────────────────────────────
registerLlm(app, RECIPIENT, NETWORK, SECRET_KEY, feePayerSigner)
registerAgents(app, RECIPIENT, NETWORK, SECRET_KEY, feePayerSigner)
registerSkills(app, RECIPIENT, NETWORK, SECRET_KEY, feePayerSigner)
registerPerps(app, RECIPIENT, NETWORK, SECRET_KEY, feePayerSigner)

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 4402
app.listen(PORT, () => {
  const routes: Array<{ method: string; path: string; cost: string }> = [
    { method: 'POST', path: '/api/v1/llm/completions',       cost: '0.01 USDC' },
    { method: 'GET',  path: '/api/v1/llm/models',            cost: 'free' },
    { method: 'GET',  path: '/api/v1/agents/catalog',        cost: 'free' },
    { method: 'GET',  path: '/api/v1/agents/discovery',      cost: 'free' },
    { method: 'POST', path: '/api/v1/agents/chat',           cost: '0.02 USDC' },
    { method: 'POST', path: '/api/v1/agents/attest',         cost: '0.01 USDC' },
    { method: 'GET',  path: '/api/v1/skills',                cost: 'free' },
    { method: 'GET',  path: '/api/v1/skills/:slug',          cost: '0.01 USDC' },
    { method: 'POST', path: '/api/v1/skills/attest',         cost: '0.01 USDC' },
    { method: 'GET',  path: '/api/v1/perps/markets',         cost: 'free' },
    { method: 'GET',  path: '/api/v1/perps/ticker/:market',  cost: '0.01 USDC' },
    { method: 'GET',  path: '/api/v1/perps/orderbook',       cost: '0.01 USDC' },
  ]

  const maxMethod = Math.max(...routes.map(r => r.method.length))
  const maxPath   = Math.max(...routes.map(r => r.path.length))

  console.log()
  console.log(bold('  🦞 Clawd x402 demo server'))
  console.log()
  console.log(`  ${dim('Server')}      ${cyan(`http://localhost:${PORT}`)}`)
  console.log(`  ${dim('Gateway')}     ${cyan(X402_BASE)}`)
  console.log(`  ${dim('Recipient')}   ${green(RECIPIENT)}`)
  console.log(`  ${dim('Fee payer')}   ${green(feePayerSigner.address)}`)
  console.log(`  ${dim('Network')}     ${magenta(NETWORK)}`)
  console.log()
  console.log(bold('  Endpoints'))
  console.log()
  for (const r of routes) {
    const m    = r.method === 'POST' ? cyan(r.method) : green(r.method)
    const mPad = ' '.repeat(maxMethod - r.method.length)
    const pPad = ' '.repeat(maxPath   - r.path.length)
    const cost = r.cost !== 'free'
      ? `${yellow(r.cost)}  ${dim('fee-payer covers tx')}`
      : dim('free')
    console.log(`  ${m}${mPad}  ${r.path}${pPad}  ${cost}`)
  }
  console.log()
  console.log(dim('  mppx.fetch() handles 402 → sign → pay → replay automatically'))
  console.log()
})
