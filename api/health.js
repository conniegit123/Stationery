import { health } from '../server/inventory.js'
import { sendJson } from '../server/http.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed.' })
    return
  }
  const result = await health()
  sendJson(res, result.status, result.json)
}
