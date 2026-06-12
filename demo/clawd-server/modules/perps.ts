import type { Express } from 'express'
import type { KeyPairSigner } from '@solana/kit'
import { Mppx, solana } from '../sdk.js'
import { toWebRequest, send402, proxyWithReceipt } from '../utils.js'
import { USDC_MINT, ENDPOINTS } from '../constants.js'

export function registerPerps(
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

  // Markets list — free
  app.get('/api/v1/perps/markets', async (_req, res) => {
    try {
      const upstream = await fetch(ENDPOINTS.perps)
      res.status(upstream.status).json(await upstream.json())
    } catch (err) {
      console.error('perps/markets error:', err)
      res.status(502).json({ error: 'Could not fetch perps markets' })
    }
  })

  // Live ticker — 0.01 USDC (real-time price data has cost)
  app.get('/api/v1/perps/ticker/:market', async (req, res) => {
    const result = await mppx.charge({
      amount: '10000',
      currency: USDC_MINT,
      description: `Perps ticker · ${req.params.market}`,
    })(toWebRequest(req))

    if (result.status === 402) { send402(res, result.challenge as Response); return }

    try {
      const upstream = await fetch(
        `https://x402.wtf/api/phoenix/market/${encodeURIComponent(req.params.market)}`,
      )
      await proxyWithReceipt(res, result, upstream, req.path)
    } catch (err) {
      console.error('perps/ticker error:', err)
      res.status(502).json({ error: 'Could not fetch perps ticker' })
    }
  })

  // Orderbook — 0.01 USDC
  app.get('/api/v1/perps/orderbook', async (req, res) => {
    const result = await mppx.charge({
      amount: '10000',
      currency: USDC_MINT,
      description: 'Perps orderbook · Phoenix via x402.wtf',
    })(toWebRequest(req))

    if (result.status === 402) { send402(res, result.challenge as Response); return }

    try {
      const qs = req.query.market ? `?market=${req.query.market}` : ''
      const upstream = await fetch(`https://x402.wtf/api/phoenix/orderbook${qs}`)
      await proxyWithReceipt(res, result, upstream, req.path)
    } catch (err) {
      console.error('perps/orderbook error:', err)
      res.status(502).json({ error: 'Could not fetch orderbook' })
    }
  })
}
