import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function QuoteManager({ onClose }) {
  const [quotes, setQuotes] = useState([])
  const [newQuote, setNewQuote] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    loadQuotes()
  }, [])

  async function loadQuotes() {
    setLoading(true)
    const { data } = await supabase.from('quotes').select('*').order('created_at', { ascending: false })
    if (data) setQuotes(data)
    setLoading(false)
  }

  async function addQuote() {
    if (!newQuote.trim()) return
    const { error } = await supabase.from('quotes').insert({ text: newQuote.trim() })
    if (error) { alert('Error: ' + error.message); return }
    setNewQuote('')
    loadQuotes()
  }

  async function saveEdit() {
    if (!editText.trim() || !editingId) return
    await supabase.from('quotes').update({ text: editText.trim() }).eq('id', editingId)
    setEditingId(null)
    setEditText('')
    loadQuotes()
  }

  async function deleteQuote(id) {
    if (!confirm('Delete this quote?')) return
    await supabase.from('quotes').delete().eq('id', id)
    loadQuotes()
  }

  const filtered = search.trim()
    ? quotes.filter(q => q.text.toLowerCase().includes(search.toLowerCase()))
    : quotes

  return (
    <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mc" style={{ maxWidth: '600px' }}>
        <h2>Manage Quotes <span style={{ fontSize: '13px', color: 'var(--tx3)', fontWeight: 400 }}>{quotes.length}</span></h2>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <input
            value={newQuote}
            onChange={e => setNewQuote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addQuote() }}
            placeholder="Add a new quote..."
            style={{ flex: 1 }}
          />
          <button className="ab p" onClick={addQuote}>Add</button>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search quotes..."
          style={{ width: '100%', marginBottom: '12px' }}
        />
        {search && <div style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '8px' }}>{filtered.length} of {quotes.length} quotes</div>}

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {filtered.map(q => (
              <div key={q.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 0', borderBottom: '1px solid var(--brd)'
              }}>
                {editingId === q.id ? (
                  <>
                    <input
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingId(null); setEditText('') } }}
                      style={{ flex: 1, fontSize: '13px' }}
                      autoFocus
                    />
                    <button className="del-entry" onClick={saveEdit} style={{ fontSize: '14px', padding: '4px 8px', color: 'var(--grn)' }}>✓</button>
                    <button className="del-entry" onClick={() => { setEditingId(null); setEditText('') }} style={{ fontSize: '14px', padding: '4px 8px' }}>✕</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: '13px', color: 'var(--tx2)', fontStyle: 'italic', cursor: 'pointer' }}
                      onClick={() => { setEditingId(q.id); setEditText(q.text) }}
                    >{q.text}</span>
                    <button className="del-entry" onClick={() => { setEditingId(q.id); setEditText(q.text) }} style={{ fontSize: '12px', padding: '4px 8px' }} title="Edit">✎</button>
                    <button className="del-entry" onClick={() => deleteQuote(q.id)} style={{ fontSize: '14px', padding: '4px 8px' }} title="Delete">✕</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
