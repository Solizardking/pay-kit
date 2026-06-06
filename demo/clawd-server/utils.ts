import type { Request as ExpressReq, Response as ExpressRes } from 'express'

export const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`
export const green  = (s: string) => `\x1b[32m${s}\x1b[0m`
export const cyan   = (s: string) => `\x1b[36m${s}\x1b[0m`
export const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`
export const magenta= (s: string) => `\x1b[35m${s}\x1b[0m`
export const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`

/** Log a successful payment with receipt reference. */
export function logPayment(path: string, response: Response) {
  const receipt = response.headers.get('Payment-Receipt')
  if (!receipt) return
  try {
    const json = JSON.parse(Buffer.from(receipt, 'base64url').toString()) as { reference?: string }
    if (json.reference) {
      console.log(`  ${green('✓')} ${path}  ${dim('tx:')} ${cyan(json.reference)}`)
    }
  } catch { /* ignore malformed receipts */ }
}

/** Convert an Express request to a Web API Request for mppx. */
export function toWebRequest(req: ExpressReq): globalThis.Request {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value[0] : value)
  }
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`
  const init: RequestInit = { method: req.method, headers }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = JSON.stringify(req.body)
  }
  return new globalThis.Request(url, init)
}

/** Forward a 402 challenge back to the Express response. */
export function send402(res: ExpressRes, challenge: Response): void {
  void (async () => {
    res.writeHead(challenge.status, Object.fromEntries(challenge.headers))
    res.end(await challenge.text())
  })()
}

/** Proxy an upstream response through the mppx receipt wrapper. */
export async function proxyWithReceipt(
  res: ExpressRes,
  result: { withReceipt(r: Response): unknown },
  upstream: globalThis.Response,
  path: string,
): Promise<void> {
  const data = await upstream.json()
  const response = result.withReceipt(
    Response.json(data, { status: upstream.status }),
  ) as Response
  logPayment(path, response)
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(await response.text())
}
