import cors from 'cors'
import express from 'express'
import {
  adjustQuantity,
  createItem,
  deleteItem,
  health,
  listItems,
  updateItem,
} from './inventory.js'

const app = express()
app.use(cors())
app.use(express.json())

function send(res, result) {
  if (result.json === undefined) {
    res.status(result.status).end()
    return
  }
  res.status(result.status).json(result.json)
}

app.get('/api/health', async (_req, res) => {
  send(res, await health())
})

app.get('/api/inventory', async (_req, res) => {
  send(res, await listItems())
})

app.post('/api/inventory', async (req, res) => {
  send(res, await createItem(req.body))
})

app.put('/api/inventory/:id', async (req, res) => {
  send(res, await updateItem(req.params.id, req.body))
})

app.patch('/api/inventory/:id/quantity', async (req, res) => {
  send(res, await adjustQuantity(req.params.id, Number(req.body.delta)))
})

app.delete('/api/inventory/:id', async (req, res) => {
  send(res, await deleteItem(req.params.id))
})

export default app
