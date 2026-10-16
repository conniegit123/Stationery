import { adjustQuantity } from '../../../server/inventory.js'
import { readJsonBody, sendJson } from '../../../server/http.js'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    sendJson(res, 405, { error: 'Method not allowed.' })
    return
  }

  const body = await readJsonBody(req)
  const result = await adjustQuantity(req.query.id, Number(body.delta))
  sendJson(res, result.status, result.json)
}
