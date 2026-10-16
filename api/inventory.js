import { createItem, listItems } from '../server/inventory.js'
import { readJsonBody, sendJson } from '../server/http.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const result = await listItems()
    sendJson(res, result.status, result.json)
    return
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    const result = await createItem(body)
    sendJson(res, result.status, result.json)
    return
  }

  sendJson(res, 405, { error: 'Method not allowed.' })
}
