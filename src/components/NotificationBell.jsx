import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function NotificationBell({ session, onNavigate }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    if (session) loadNotifications()
  }, [session])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) {
      setNotifications(data)
      setUnread(data.filter(n => !n.read).length)
    }
  }

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', session.user.id)
      .eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  async function clearAll() {
    if (!confirm('Clear all notifications?')) return
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', session.user.id)
    setNotifications([])
    setUnread(0)
  }

  function timeAgo(date) {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (s < 60) return 'now'
    if (s < 3600) return Math.floor(s / 60) + 'm'
    if (s < 86400) return Math.floor(s / 3600) + 'h'
    if (s < 604800) return Math.floor(s / 86400) + 'd'
    return Math.floor(s / 604800) + 'w'
  }

  const icons = { approval: '✅', rejection: '❌', score: '🏆', comment: '💬', like: '❤️', challenge: '⚔️', milestone: '🎉' }

  // Every notification should navigate somewhere even without an explicit link
  function getNotifLink(n) {
    if (n.link) return n.link
    if (n.type === 'like' || n.type === 'comment') return 'activity::'
    if (n.type === 'challenge') return 'h2h'
    if (n.type === 'score' || n.type === 'milestone') return 'stats'
    return 'all'
  }

  if (!session) return null

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="notif-btn" onClick={() => { setOpen(!open); if (!open && unread > 0) markAllRead() }}>
        🔔
        {unread > 0 && <span className="notif-badge">{unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-header">
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 600 }}>Notifications</span>
            {notifications.length > 0 && (
              <button className="notif-clear" onClick={clearAll}>Clear all</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="notif-empty">No notifications yet</div>
          ) : (
            <div className="notif-list">
              {notifications.map(n => (
                <div key={n.id} className={`notif-item${n.read ? '' : ' unread'} clickable`}
                  onClick={() => { if (onNavigate) { onNavigate(getNotifLink(n)); setOpen(false) } }}>
                  <span className="notif-icon">{icons[n.type] || '📌'}</span>
                  <div className="notif-content">
                    <div className="notif-title">{n.title}</div>
                    {n.body && <div className="notif-body">{n.body}</div>}
                  </div>
                  <span className="notif-time">{timeAgo(n.created_at)}</span>
                  <span style={{ color: 'var(--tx3)', fontSize: '10px', flexShrink: 0 }}>›</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
