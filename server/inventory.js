import { pool } from './db.js'

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

export async function health() {
  try {
    await pool.query('SELECT 1')
    return { status: 200, json: { ok: true } }
  } catch (error) {
    return { status: 500, json: { ok: false, error: error.message } }
  }
}

export async function listItems() {
  try {
    const result = await pool.query(
      `SELECT ${SELECT_COLUMNS} FROM public.inventory ORDER BY id`,
    )
    return { status: 200, json: result.rows.map(mapRow) }
  } catch (error) {
    return { status: 500, json: { error: error.message } }
  }
}

export async function createItem(body) {
  try {
    const item = parseItem(body)
    if (!item.name) return { status: 400, json: { error: 'Item name is required.' } }

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
    return { status: 201, json: mapRow(result.rows[0]) }
  } catch (error) {
    return { status: 500, json: { error: error.message } }
  }
}

export async function updateItem(id, body) {
  try {
    const item = parseItem(body)
    if (!item.name) return { status: 400, json: { error: 'Item name is required.' } }

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
        id,
      ],
    )

    if (!result.rows[0]) return { status: 404, json: { error: 'Item not found.' } }
    return { status: 200, json: mapRow(result.rows[0]) }
  } catch (error) {
    return { status: 500, json: { error: error.message } }
  }
}

export async function adjustQuantity(id, delta) {
  try {
    if (!Number.isFinite(delta)) {
      return { status: 400, json: { error: 'A numeric delta is required.' } }
    }

    const current = await pool.query(
      `SELECT quantity, "Reorder Level" AS reorder_level
       FROM public.inventory WHERE id = $1`,
      [id],
    )
    if (!current.rows[0]) return { status: 404, json: { error: 'Item not found.' } }

    const quantity = Math.max(0, Number(current.rows[0].quantity) + delta)
    const status = computeStatus(quantity, current.rows[0].reorder_level)
    const result = await pool.query(
      `UPDATE public.inventory
       SET quantity = $1, "Status" = $2
       WHERE id = $3
       RETURNING ${SELECT_COLUMNS}`,
      [quantity, status, id],
    )
    return { status: 200, json: mapRow(result.rows[0]) }
  } catch (error) {
    return { status: 500, json: { error: error.message } }
  }
}

export async function deleteItem(id) {
  try {
    const result = await pool.query(
      'DELETE FROM public.inventory WHERE id = $1 RETURNING id',
      [id],
    )
    if (!result.rows[0]) return { status: 404, json: { error: 'Item not found.' } }
    return { status: 204 }
  } catch (error) {
    return { status: 500, json: { error: error.message } }
  }
}
