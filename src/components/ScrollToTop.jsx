import { useState, useEffect } from 'react'

export default function ScrollToTop() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setShow(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!show) return null

  return (
    <button className="scroll-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="Back to top">
      ↑
    </button>
  )
}
