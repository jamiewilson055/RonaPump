import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminAnalytics() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    setLoading(true)

    // Total users
    const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true })

    // Active users (logged a workout in last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: activeLogs } = await supabase
      .from('performance_log')
      .select('user_id')
      .gte('completed_at', weekAgo)
    const activeUsers = new Set(activeLogs?.map(l => l.user_id) || []).size

    // Active last 30 days
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: monthLogs } = await supabase
      .from('performance_log')
      .select('user_id')
      .gte('completed_at', monthAgo)
    const monthlyActive = new Set(monthLogs?.map(l => l.user_id) || []).size

    // Total logs this week
    const { count: weekLogs } = await supabase.from('performance_log').select('*', { count: 'exact', head: true }).gte('completed_at', weekAgo)

    // Total workouts
    const { count: totalWorkouts } = await supabase.from('workouts').select('*', { count: 'exact', head: true })

    // Community submissions
    const { count: pendingCount } = await supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('visibility', 'pending')
    const { count: communityCount } = await supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('visibility', 'community')

    // Most popular workouts (most logs)
    const { data: popularRaw } = await supabase
      .from('performance_log')
      .select('workout_id')
    const wCounts = {}
    popularRaw?.forEach(l => { wCounts[l.workout_id] = (wCounts[l.workout_id] || 0) + 1 })
    const topWorkoutIds = Object.entries(wCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)

    // Get workout names for top workouts
    const topIds = topWorkoutIds.map(([id]) => id)
    const { data: topWorkouts } = await supabase.from('workouts').select('id, name').in('id', topIds)
    const nameMap = {}
    topWorkouts?.forEach(w => { nameMap[w.id] = w.name || 'Unnamed' })

    const popular = topWorkoutIds.map(([id, count]) => ({ name: nameMap[id] || 'Unnamed', count }))

    // Recent signups (last 10)
    const { data: recentUsers } = await supabase
      .from('profiles')
      .select('display_name, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    // Digest subscribers
    const { count: digestSubs } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('weekly_digest', true)

    setStats({
      totalUsers, activeUsers, monthlyActive, weekLogs,
      totalWorkouts, pendingCount, communityCount,
      popular, recentUsers, digestSubs
    })
    setLoading(false)
  }

  if (loading) return <div className="loading">Loading analytics...</div>
  if (!stats) return null

  return (
    <div className="admin-analytics">
      <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '16px', marginBottom: '14px' }}>📊 Admin Analytics</h3>

      <div className="aa-grid">
        <div className="aa-card">
          <div className="aa-num">{stats.totalUsers}</div>
          <div className="aa-label">Total Users</div>
        </div>
        <div className="aa-card">
          <div className="aa-num" style={{ color: 'var(--grn)' }}>{stats.activeUsers}</div>
          <div className="aa-label">Active (7d)</div>
        </div>
        <div className="aa-card">
          <div className="aa-num" style={{ color: 'var(--cyn)' }}>{stats.monthlyActive}</div>
          <div className="aa-label">Active (30d)</div>
        </div>
        <div className="aa-card">
          <div className="aa-num" style={{ color: 'var(--acc)' }}>{stats.weekLogs}</div>
          <div className="aa-label">Logs (7d)</div>
        </div>
        <div className="aa-card">
          <div className="aa-num">{stats.totalWorkouts}</div>
          <div className="aa-label">Total Workouts</div>
        </div>
        <div className="aa-card">
          <div className="aa-num" style={{ color: 'var(--ylw)' }}>{stats.pendingCount}</div>
          <div className="aa-label">Pending Review</div>
        </div>
        <div className="aa-card">
          <div className="aa-num" style={{ color: 'var(--cyn)' }}>{stats.communityCount}</div>
          <div className="aa-label">Community WODs</div>
        </div>
        <div className="aa-card">
          <div className="aa-num" style={{ color: 'var(--prp)' }}>{stats.digestSubs}</div>
          <div className="aa-label">Digest Subs</div>
        </div>
      </div>

      <div className="aa-section">
        <h4>Most Popular Workouts</h4>
        {stats.popular.map((p, i) => (
          <div key={i} className="aa-row">
            <span className="aa-rank">#{i + 1}</span>
            <span className="aa-name">{p.name}</span>
            <span className="aa-count">{p.count} logs</span>
          </div>
        ))}
      </div>

      <div className="aa-section">
        <h4>Recent Signups</h4>
        {stats.recentUsers?.map((u, i) => (
          <div key={i} className="aa-row">
            <span className="aa-name">{u.display_name || 'No name'}</span>
            <span className="aa-count">{new Date(u.created_at).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
