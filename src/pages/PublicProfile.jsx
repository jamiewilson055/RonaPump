import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PublicProfile({ userId, onClose }) {
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadProfile() }, [userId])

  async function loadProfile() {
    setLoading(true)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(prof)

    // Get their performance logs with workout names
    const { data: logs } = await supabase
      .from('performance_log')
      .select('*, workouts(name, score_type)')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(20)

    if (logs) {
      setRecentLogs(logs)

      // Calculate stats
      const uniqueWorkouts = new Set(logs.map(l => l.workout_id)).size
      const totalLogs = logs.length

      // Streak
      const dates = new Set(logs.map(l => l.completed_at).filter(Boolean))
      let streak = 0
      const today = new Date()
      for (let i = 0; i < 365; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const ds = d.toISOString().slice(0, 10)
        if (dates.has(ds)) streak++
        else if (i > 0) break
        else continue
      }

      setStats({ uniqueWorkouts, totalLogs, streak })
    }
    setLoading(false)
  }

  if (loading) return (
    <div className="mo" onClick={onClose}>
      <div className="mc" style={{ maxWidth: '480px' }}><div className="loading">Loading...</div></div>
    </div>
  )

  if (!profile) return (
    <div className="mo" onClick={onClose}>
      <div className="mc" style={{ maxWidth: '480px' }}><p>Profile not found.</p></div>
    </div>
  )

  const initial = (profile.display_name || '?')[0].toUpperCase()

  return (
    <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mc" style={{ maxWidth: '480px' }}>
        <div className="prof-header">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="prof-avatar-img" />
          ) : (
            <div className="prof-avatar">{initial}</div>
          )}
          <div className="prof-name-area">
            <h2 style={{ margin: 0, fontSize: '20px' }}>{profile.display_name || 'Athlete'}</h2>
            {profile.hometown && <div style={{ fontSize: '12px', color: 'var(--tx3)', marginTop: '2px' }}>📍 {profile.hometown}</div>}
          </div>
        </div>

        {profile.bio && (
          <div style={{ fontSize: '13px', color: 'var(--tx2)', lineHeight: 1.5, margin: '12px 0', padding: '10px', background: 'var(--bg)', borderRadius: '6px' }}>
            {profile.bio}
          </div>
        )}

        {stats && (
          <div className="pp-stats">
            <div className="pp-stat">
              <div className="pp-stat-num">{stats.totalLogs}</div>
              <div className="pp-stat-lbl">Logged</div>
            </div>
            <div className="pp-stat">
              <div className="pp-stat-num">{stats.uniqueWorkouts}</div>
              <div className="pp-stat-lbl">Workouts</div>
            </div>
            <div className="pp-stat">
              <div className="pp-stat-num" style={{ color: '#ff9500' }}>{stats.streak > 0 ? `🔥 ${stats.streak}` : '0'}</div>
              <div className="pp-stat-lbl">Streak</div>
            </div>
          </div>
        )}

        {recentLogs.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'var(--tx3)', marginBottom: '6px' }}>Recent Activity</h4>
            <table className="plog-table">
              <thead><tr><th>Workout</th><th>Date</th><th>Score</th></tr></thead>
              <tbody>
                {recentLogs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>{l.workouts?.name || 'Unnamed'}</td>
                    <td>{l.completed_at || '—'}</td>
                    <td>{l.score || (l.notes === 'Quick logged' ? '✓' : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          <button className="ab" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
