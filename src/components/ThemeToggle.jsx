import { useState, useEffect } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('rp_theme')
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('rp_theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <button className="theme-toggle" onClick={() => setDark(!dark)} title={dark ? 'Light mode' : 'Dark mode'}>
      {dark ? '☀️' : '🌙'}
    </button>
  )
}
