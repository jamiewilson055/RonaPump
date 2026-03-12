import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import QuoteManager from './QuoteManager'

export default function QuoteBar({ isAdmin }) {
  const [quotes, setQuotes] = useState([])
  const [current, setCurrent] = useState(null)
  const [showManager, setShowManager] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    loadQuotes()
  }, [])

  async function loadQuotes() {
    const { data } = await supabase.from('quotes').select('*')
    if (data && data.length) {
      setQuotes(data)
      setCurrent(data[Math.floor(Math.random() * data.length)])
    }
  }

  function shuffle() {
    if (editing) return
    if (quotes.length) setCurrent(quotes[Math.floor(Math.random() * quotes.length)])
  }

  function startEdit() {
    if (!current) return
    setEditText(current.text)
    setEditing(true)
  }

  async function saveEdit() {
    if (!editText.trim() || !current) return
    await supabase.from('quotes').update({ text: editText.trim() }).eq('id', current.id)
    setCurrent({ ...current, text: editText.trim() })
    setEditing(false)
    loadQuotes()
  }

  return (
    <>
      <div className="qwrap">
        {editing ? (
          <div className="qbar-edit">
            <input
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
              autoFocus
            />
            <button className="ab p" onClick={saveEdit} style={{ padding: '5px 12px', fontSize: '11px' }}>Save</button>
            <button className="ab" onClick={() => setEditing(false)} style={{ padding: '5px 8px', fontSize: '11px' }}>Cancel</button>
          </div>
        ) : (
          <div className="qbar" onClick={shuffle}>{current?.text || 'Loading...'}</div>
        )}
        {isAdmin && !editing && (
          <div className="q-btns">
            <button className="q-btn" onClick={startEdit} title="Edit this quote">✎</button>
            <button className="q-btn" onClick={() => setShowManager(true)} title="Manage all quotes">☰</button>
          </div>
        )}
      </div>
      {showManager && <QuoteManager onClose={() => { setShowManager(false); loadQuotes() }} />}
    </>
  )
}
