import type { Express } from 'express'
import type { KeyPairSigner } from '@solana/kit'
import { Mppx, solana } from '../sdk.js'
import { toWebRequest, send402, proxyWithReceipt } from '../utils.js'
import { USDC_MINT, ENDPOINTS } from '../constants.js'

export function registerAgents(
  app: Express,
  recipient: string,
  network: string,
  secretKey: string,
  feePayerSigner: KeyPairSigner,
) {
  const mppx = Mppx.create({
    secretKey,
    methods: [solana.charge({ recipient, network, signer: feePayerSigner, currency: USDC_MINT, decimals: 6 })],
  })

  // Agent catalog — free (discovery should be open)
  app.get('/api/v1/agents/catalog', async (_req, res) => {
    try {
      const upstream = await fetch(ENDPOINTS.agentCatalog)
      res.status(upstream.status).json(await upstream.json())
    } catch (err) {
      console.error('agents/catalog error:', err)
      res.status(502).json({ error: 'Could not fetch agent catalog' })
    }
  })

  // CAAP/1.0 discovery — free, forwards well-known endpoint
  app.get('/api/v1/agents/discovery', async (_req, res) => {
    try {
      const upstream = await fetch(ENDPOINTS.caapDiscovery)
      res.status(upstream.status).json(await upstream.json())
    } catch (err) {
      console.error('agents/discovery error:', err)
      res.status(502).json({ error: 'Could not fetch CAAP discovery' })
    }
  })

  // Agent chat — 0.02 USDC per turn
  app.post('/api/v1/agents/chat', async (req, res) => {
    const result = await mppx.charge({
      amount: '20000',
      currency: USDC_MINT,
      description: `Agent chat · ${(req.body as { agentId?: string }).agentId ?? 'clawd'}`,
    })(toWebRequest(req))

    if (result.status === 402) { send402(res, result.challenge as Response); return }

    try {
      const upstream = await fetch(ENDPOINTS.agentChat, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      })
      await proxyWithReceipt(res, result, upstream, req.path)
    } catch (err) {
      console.error('agents/chat error:', err)
      res.status(502).json({ error: 'Agent chat upstream failed' })
    }
  })

  // Agent attestation (CAAP/1.0) — 0.01 USDC
  app.post('/api/v1/agents/attest', async (req, res) => {
    const result = await mppx.charge({
      amount: '10000',
      currency: USDC_MINT,
      description: 'CAAP/1.0 attestation · x402.wtf',
    })(toWebRequest(req))

    if (result.status === 402) { send402(res, result.challenge as Response); return }

    try {
      const upstream = await fetch(ENDPOINTS.agentAttest, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      })
      await proxyWithReceipt(res, result, upstream, req.path)
    } catch (err) {
      console.error('agents/attest error:', err)
      res.status(502).json({ error: 'Attestation upstream failed' })
    }
  })
}
