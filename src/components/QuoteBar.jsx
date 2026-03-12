import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import QuoteManager from './QuoteManager'

export default function QuoteBar({ isAdmin }) {
  const [quotes, setQuotes] = useState([])
  const [current, setCurrent] = useState('')
  const [showManager, setShowManager] = useState(false)

  useEffect(() => {
    loadQuotes()
  }, [])

  async function loadQuotes() {
    const { data } = await supabase.from('quotes').select('text')
    if (data && data.length) {
      setQuotes(data.map(q => q.text))
      setCurrent(data[Math.floor(Math.random() * data.length)].text)
    }
  }

  function shuffle() {
    if (quotes.length) setCurrent(quotes[Math.floor(Math.random() * quotes.length)])
  }

  return (
    <>
      <div className="qwrap">
        <div className="qbar" onClick={shuffle}>{current || 'Loading...'}</div>
        {isAdmin && (
          <button className="q-edit" onClick={() => setShowManager(true)} title="Manage Quotes">✎</button>
        )}
      </div>
      {showManager && <QuoteManager onClose={() => { setShowManager(false); loadQuotes() }} />}
    </>
  )
}
