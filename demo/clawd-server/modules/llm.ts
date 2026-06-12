import type { Express } from 'express'
import type { KeyPairSigner } from '@solana/kit'
import { Mppx, solana } from '../sdk.js'
import { toWebRequest, send402, proxyWithReceipt } from '../utils.js'
import { USDC_MINT, ENDPOINTS } from '../constants.js'

export function registerLlm(
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

  // OpenAI-compatible completions — 0.01 USDC per request, fee-payer covers tx cost
  app.post('/api/v1/llm/completions', async (req, res) => {
    const result = await mppx.charge({
      amount: '10000',
      currency: USDC_MINT,
      description: 'LLM completion · x402.wtf/api/tide/v1/chat/completions',
    })(toWebRequest(req))

    if (result.status === 402) { send402(res, result.challenge as Response); return }

    try {
      const upstream = await fetch(ENDPOINTS.llm, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      })
      await proxyWithReceipt(res, result, upstream, req.path)
    } catch (err) {
      console.error('llm/completions error:', err)
      res.status(502).json({ error: 'Upstream LLM request failed' })
    }
  })

  // Model list — free
  app.get('/api/v1/llm/models', async (_req, res) => {
    try {
      const upstream = await fetch(ENDPOINTS.models)
      res.status(upstream.status).json(await upstream.json())
    } catch (err) {
      console.error('llm/models error:', err)
      res.status(502).json({ error: 'Could not fetch model list' })
    }
  })
}
