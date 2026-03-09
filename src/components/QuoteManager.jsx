import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function QuoteManager({ onClose }) {
  const [quotes, setQuotes] = useState([])
  const [newQuote, setNewQuote] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [loading, setLoading] = useState(true)

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

  async function saveEdit(id) {
    if (!editText.trim()) return
    const { error } = await supabase.from('quotes').update({ text: editText.trim() }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    setEditingId(null)
    setEditText('')
    loadQuotes()
  }

  async function deleteQuote(id) {
    if (!confirm('Delete this quote?')) return
    await supabase.from('quotes').delete().eq('id', id)
    loadQuotes()
  }

  return (
    <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mc" style={{ maxWidth: '600px' }}>
        <h2>Manage Quotes <span style={{ fontSize: '13px', color: 'var(--tx3)', fontWeight: 400 }}>{quotes.length}</span></h2>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          <input
            value={newQuote}
            onChange={e => setNewQuote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addQuote() }}
            placeholder="Add a new quote..."
            style={{ flex: 1 }}
          />
          <button className="ab p" onClick={addQuote}>Add</button>
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {quotes.map(q => (
              <div key={q.id} style={{
                padding: '8px 0', borderBottom: '1px solid var(--brd)'
              }}>
                {editingId === q.id ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(q.id) }}
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <button className="ab p" onClick={() => saveEdit(q.id)} style={{ padding: '5px 10px', fontSize: '11px' }}>Save</button>
                    <button className="ab" onClick={() => setEditingId(null)} style={{ padding: '5px 10px', fontSize: '11px' }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ flex: 1, fontSize: '13px', color: 'var(--tx2)', fontStyle: 'italic' }}>{q.text}</span>
                    <button className="del-entry" onClick={() => { setEditingId(q.id); setEditText(q.text) }}
                      style={{ fontSize: '12px', padding: '4px 6px', color: 'var(--tx3)' }} title="Edit">✎</button>
                    <button className="del-entry" onClick={() => deleteQuote(q.id)}
                      style={{ fontSize: '14px', padding: '4px 6px' }}>✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
