import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import QuoteManager from './QuoteManager'

export default function QuoteBar({ isAdmin }) {
  const [quotes, setQuotes] = useState([])
  const [current, setCurrent] = useState(null)
  const [showManager, setShowManager] = useState(false)

  useEffect(() => {
    loadQuotes()
  }, [])

  async function loadQuotes() {
    const { data } = await supabase.from('quotes').select('text, author')
    if (data && data.length) {
      setQuotes(data)
      // Date-seeded so everyone sees the same quote all day (tap to shuffle)
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      let seed = 0
      for (let i = 0; i < today.length; i++) seed = (seed * 31 + today.charCodeAt(i)) >>> 0
      setCurrent(data[seed % data.length])
    }
  }

  function shuffle() {
    if (quotes.length) setCurrent(quotes[Math.floor(Math.random() * quotes.length)])
  }

  return (
    <>
      <div className="qwrap">
        <div className="qbar" onClick={shuffle}>
          <div className="qbar-kicker">Quote of the Day</div>
          <div className="qbar-text"><span className="qbar-mark">“</span>{current ? current.text : 'Loading...'}</div>
          {current?.author && <div className="qbar-author">— {current.author}</div>}
        </div>
        {isAdmin && (
          <button className="q-edit" onClick={() => setShowManager(true)} title="Manage Quotes">✎</button>
        )}
      </div>
      {showManager && <QuoteManager onClose={() => { setShowManager(false); loadQuotes() }} />}
    </>
  )
}
