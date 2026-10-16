import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import pg from 'pg'

dotenv.config()

const app = express()
const port = Number(process.env.PORT) || 3001

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
})

app.use(cors())
app.use(express.json())

const SELECT_COLUMNS = `
  id,
  item_name,
  category,
  quantity,
  unit_price,
  "SKU" AS sku,
  "Status" AS status,
  "Location" AS location,
  "Reorder Level" AS reorder_level,
  "Notes" AS notes
`

function computeStatus(quantity, reorderLevel) {
  if (quantity <= 0) return 'Out of stock'
  if (reorderLevel != null && quantity <= Number(reorderLevel)) return 'Low stock'
  return 'In stock'
}

function mapRow(row) {
  return {
    id: row.id,
    name: row.item_name,
    sku: row.sku ?? '',
    category: row.category ?? '',
    location: row.location ?? '',
    quantity: Number(row.quantity),
    unitPrice: row.unit_price == null ? '' : Number(row.unit_price),
    reorderLevel: row.reorder_level == null ? '' : Number(row.reorder_level),
    notes: row.notes ?? '',
    status: row.status ?? computeStatus(Number(row.quantity), row.reorder_level),
  }
}

function parseItem(body) {
  const name = String(body.name || '').trim()
  const quantity = Math.max(0, Number(body.quantity) || 0)
  const reorderLevel =
    body.reorderLevel === '' || body.reorderLevel == null
      ? null
      : Math.max(0, Number(body.reorderLevel) || 0)
  const unitPrice =
    body.unitPrice === '' || body.unitPrice == null ? null : Number(body.unitPrice)

  return {
    name,
    sku: String(body.sku || '').trim() || null,
    category: String(body.category || '').trim() || null,
    location: String(body.location || '').trim() || null,
    quantity,
    unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
    reorderLevel,
    notes: String(body.notes || '').trim() || null,
    status: computeStatus(quantity, reorderLevel),
  }
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
})

app.get('/api/inventory', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${SELECT_COLUMNS} FROM public.inventory ORDER BY id`,
    )
    res.json(result.rows.map(mapRow))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/inventory', async (req, res) => {
  try {
    const item = parseItem(req.body)
    if (!item.name) {
      res.status(400).json({ error: 'Item name is required.' })
      return
    }

    const result = await pool.query(
      `INSERT INTO public.inventory
        (item_name, category, quantity, unit_price, "SKU", "Status", "Location", "Reorder Level", "Notes")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${SELECT_COLUMNS}`,
      [
        item.name,
        item.category,
        item.quantity,
        item.unitPrice,
        item.sku,
        item.status,
        item.location,
        item.reorderLevel,
        item.notes,
      ],
    )
    res.status(201).json(mapRow(result.rows[0]))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/inventory/:id', async (req, res) => {
  try {
    const item = parseItem(req.body)
    if (!item.name) {
      res.status(400).json({ error: 'Item name is required.' })
      return
    }

    const result = await pool.query(
      `UPDATE public.inventory SET
        item_name = $1,
        category = $2,
        quantity = $3,
        unit_price = $4,
        "SKU" = $5,
        "Status" = $6,
        "Location" = $7,
        "Reorder Level" = $8,
        "Notes" = $9
       WHERE id = $10
       RETURNING ${SELECT_COLUMNS}`,
      [
        item.name,
        item.category,
        item.quantity,
        item.unitPrice,
        item.sku,
        item.status,
        item.location,
        item.reorderLevel,
        item.notes,
        req.params.id,
      ],
    )

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Item not found.' })
      return
    }
    res.json(mapRow(result.rows[0]))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.patch('/api/inventory/:id/quantity', async (req, res) => {
  try {
    const delta = Number(req.body.delta)
    if (!Number.isFinite(delta)) {
      res.status(400).json({ error: 'A numeric delta is required.' })
      return
    }

    const current = await pool.query(
      `SELECT quantity, "Reorder Level" AS reorder_level
       FROM public.inventory WHERE id = $1`,
      [req.params.id],
    )
    if (!current.rows[0]) {
      res.status(404).json({ error: 'Item not found.' })
      return
    }

    const quantity = Math.max(0, Number(current.rows[0].quantity) + delta)
    const status = computeStatus(quantity, current.rows[0].reorder_level)
    const result = await pool.query(
      `UPDATE public.inventory
       SET quantity = $1, "Status" = $2
       WHERE id = $3
       RETURNING ${SELECT_COLUMNS}`,
      [quantity, status, req.params.id],
    )
    res.json(mapRow(result.rows[0]))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM public.inventory WHERE id = $1 RETURNING id',
      [req.params.id],
    )
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Item not found.' })
      return
    }
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Inventory API listening on http://127.0.0.1:${port}`)
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other process, then run npm run dev again.`)
  } else {
    console.error(error)
  }
  process.exit(1)
})

