import { deleteItem, updateItem } from '../../server/inventory.js'
import { readJsonBody, sendJson } from '../../server/http.js'

export default async function handler(req, res) {
  const id = req.query.id

  if (req.method === 'PUT') {
    const body = await readJsonBody(req)
    const result = await updateItem(id, body)
    sendJson(res, result.status, result.json)
    return
  }

  if (req.method === 'DELETE') {
    const result = await deleteItem(id)
    sendJson(res, result.status, result.json)
    return
  }

  sendJson(res, 405, { error: 'Method not allowed.' })
}
