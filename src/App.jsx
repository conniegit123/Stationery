import { useEffect, useMemo, useState } from 'react'

const CATEGORIES = ['Paper', 'Writing', 'Desk', 'Filing', 'Filling', 'Electronics', 'Other']

const emptyForm = {
  name: '',
  sku: '',
  category: 'Paper',
  location: '',
  quantity: 0,
  reorderLevel: 5,
  unitPrice: '',
  notes: '',
}

function stockStatus(item) {
  const raw = String(item.status || '').toLowerCase()
  if (raw.includes('out') || item.quantity <= 0) return 'out'
  if (raw.includes('low') || (item.reorderLevel !== '' && item.quantity <= Number(item.reorderLevel))) {
    return 'low'
  }
  return 'ok'
}

function statusLabel(status) {
  if (status === 'out') return 'Out of stock'
  if (status === 'low') return 'Low stock'
  return 'In stock'
}

function formatPrice(value) {
  if (value === '' || value == null || Number.isNaN(Number(value))) return '—'
  return `$${Number(value).toFixed(2)}`
}

async function readError(response) {
  try {
    const body = await response.json()
    return body.error || `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

export default function App() {
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadItems() {
    const response = await fetch('/api/inventory')
    if (!response.ok) throw new Error(await readError(response))
    setItems(await response.json())
  }

  useEffect(() => {
    loadItems()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const low = items.filter((item) => stockStatus(item) !== 'ok').length
    const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    return { skuCount: items.length, totalQty, alerts: low }
  }, [items])

  const categoryOptions = useMemo(() => {
    const fromData = items.map((item) => item.category).filter(Boolean)
    return [...new Set([...CATEGORIES, ...fromData])]
  }, [items])

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      const matchesCategory = category === 'All' || item.category === category
      const matchesQuery =
        !q ||
        [item.name, item.sku, item.location, item.notes]
          .join(' ')
          .toLowerCase()
          .includes(q)
      return matchesCategory && matchesQuery
    })
  }, [items, query, category])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!form.name.trim() || busy) return

    const payload = {
      ...form,
      name: form.name.trim(),
      sku: form.sku.trim(),
      location: form.location.trim(),
      notes: form.notes.trim(),
      quantity: Math.max(0, Number(form.quantity) || 0),
      reorderLevel: form.reorderLevel === '' ? '' : Math.max(0, Number(form.reorderLevel) || 0),
      unitPrice: form.unitPrice === '' ? '' : Number(form.unitPrice),
    }

    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        editingId ? `/api/inventory/${editingId}` : '/api/inventory',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      if (!response.ok) throw new Error(await readError(response))
      await loadItems()
      resetForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function startEdit(item) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      sku: item.sku,
      category: item.category || 'Other',
      location: item.location,
      quantity: item.quantity,
      reorderLevel: item.reorderLevel,
      unitPrice: item.unitPrice,
      notes: item.notes,
    })
  }

  async function adjustStock(id, delta) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/inventory/${id}/quantity`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      })
      if (!response.ok) throw new Error(await readError(response))
      const updated = await response.json()
      setItems((current) => current.map((item) => (item.id === id ? updated : item)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(id) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/inventory/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await readError(response))
      setItems((current) => current.filter((item) => item.id !== id))
      if (editingId === id) resetForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Office supplies</p>
          <h1>Stationery inventory</h1>
          <p className="subtitle">
            Track stock in PostgreSQL, flag low supplies, and keep the office cupboard in order.
          </p>
        </div>
        <div className="stats">
          <div className="stat">
            <span>SKUs</span>
            <strong>{stats.skuCount}</strong>
          </div>
          <div className="stat">
            <span>Units on hand</span>
            <strong>{stats.totalQty}</strong>
          </div>
          <div className="stat">
            <span>Stock alerts</span>
            <strong>{stats.alerts}</strong>
          </div>
        </div>
      </header>

      {error ? <div className="banner">{error}</div> : null}

      <div className="toolbar">
        <input
          className="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, SKU, location..."
          aria-label="Search inventory"
        />
        <select
          className="select"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter by category"
        >
          <option value="All">All categories</option>
          {categoryOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="layout">
        <section className="panel">
          <h2>{editingId ? 'Edit item' : 'Add stationery'}</h2>
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Item name
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="e.g. Stapler"
                required
              />
            </label>
            <div className="row-2">
              <label>
                SKU
                <input
                  value={form.sku}
                  onChange={(event) => updateField('sku', event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label>
                Category
                <select
                  value={form.category}
                  onChange={(event) => updateField('category', event.target.value)}
                >
                  {categoryOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Storage location
              <input
                value={form.location}
                onChange={(event) => updateField('location', event.target.value)}
                placeholder="e.g. Cabinet A1"
              />
            </label>
            <div className="row-2">
              <label>
                Quantity
                <input
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(event) => updateField('quantity', event.target.value)}
                />
              </label>
              <label>
                Reorder level
                <input
                  type="number"
                  min="0"
                  value={form.reorderLevel}
                  onChange={(event) => updateField('reorderLevel', event.target.value)}
                />
              </label>
            </div>
            <label>
              Unit price
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unitPrice}
                onChange={(event) => updateField('unitPrice', event.target.value)}
                placeholder="0.00"
              />
            </label>
            <label>
              Notes
              <textarea
                rows="3"
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                placeholder="Brand, size, or supplier notes"
              />
            </label>
            <div className="actions">
              <button className="btn primary" type="submit" disabled={busy}>
                {editingId ? 'Save changes' : 'Add to inventory'}
              </button>
              {editingId ? (
                <button className="btn ghost" type="button" onClick={resetForm}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="panel">
          <h2>Current stock</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="empty">
                      Loading inventory from PostgreSQL...
                    </td>
                  </tr>
                ) : visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty">
                      No stationery matches this search.
                    </td>
                  </tr>
                ) : (
                  visibleItems.map((item) => {
                    const status = stockStatus(item)
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="item-name">{item.name}</div>
                          <div className="sku">
                            {item.sku || 'No SKU'} · {item.location || 'Unassigned'}
                          </div>
                        </td>
                        <td>{item.category || '—'}</td>
                        <td>{item.quantity}</td>
                        <td>{formatPrice(item.unitPrice)}</td>
                        <td>
                          <span className={`badge ${status}`}>{item.status || statusLabel(status)}</span>
                        </td>
                        <td>
                          <div className="actions">
                            <button
                              className="btn qty-btn"
                              type="button"
                              onClick={() => adjustStock(item.id, -1)}
                              aria-label={`Decrease ${item.name}`}
                              disabled={busy}
                            >
                              −
                            </button>
                            <button
                              className="btn qty-btn"
                              type="button"
                              onClick={() => adjustStock(item.id, 1)}
                              aria-label={`Increase ${item.name}`}
                              disabled={busy}
                            >
                              +
                            </button>
                            <button className="btn ghost" type="button" onClick={() => startEdit(item)}>
                              Edit
                            </button>
                            <button
                              className="btn ghost"
                              type="button"
                              onClick={() => removeItem(item.id)}
                              disabled={busy}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
