import type { Express } from 'express'
import type { KeyPairSigner } from '@solana/kit'
import { Mppx, solana } from '../sdk.js'
import { toWebRequest, send402, proxyWithReceipt } from '../utils.js'
import { USDC_MINT, ENDPOINTS } from '../constants.js'

export function registerSkills(
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

  // Skills catalog — free
  app.get('/api/v1/skills', async (_req, res) => {
    try {
      const upstream = await fetch(ENDPOINTS.skills)
      res.status(upstream.status).json(await upstream.json())
    } catch (err) {
      console.error('skills/catalog error:', err)
      res.status(502).json({ error: 'Could not fetch skills catalog' })
    }
  })

  // Skill detail — 0.01 USDC (premium skill metadata)
  app.get('/api/v1/skills/:slug', async (req, res) => {
    const result = await mppx.charge({
      amount: '10000',
      currency: USDC_MINT,
      description: `Skill detail · ${req.params.slug}`,
    })(toWebRequest(req))

    if (result.status === 402) { send402(res, result.challenge as Response); return }

    try {
      const upstream = await fetch(`${ENDPOINTS.skills}/${req.params.slug}`)
      await proxyWithReceipt(res, result, upstream, req.path)
    } catch (err) {
      console.error('skills/detail error:', err)
      res.status(502).json({ error: 'Could not fetch skill detail' })
    }
  })

  // Skill attestation — 0.01 USDC
  app.post('/api/v1/skills/attest', async (req, res) => {
    const result = await mppx.charge({
      amount: '10000',
      currency: USDC_MINT,
      description: 'Skill attestation · x402.wtf',
    })(toWebRequest(req))

    if (result.status === 402) { send402(res, result.challenge as Response); return }

    try {
      const upstream = await fetch(`${ENDPOINTS.skills}/attest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      })
      await proxyWithReceipt(res, result, upstream, req.path)
    } catch (err) {
      console.error('skills/attest error:', err)
      res.status(502).json({ error: 'Skill attestation upstream failed' })
    }
  })
}
