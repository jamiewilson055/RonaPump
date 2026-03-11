import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PublicProfile from './PublicProfile'

export default function ActivityFeed({ session, onAuthRequired, onNavigateToWorkout }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [showDiscover, setShowDiscover] = useState(false)
  const [viewingProfile, setViewingProfile] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (session) {
      loadFollowing()
      loadActivity()
    }
  }, [session])

  async function loadFollowing() {
    const { data } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', session.user.id)
    if (data) setFollowing(data.map(f => f.following_id))
  }

  async function loadActivity() {
    setLoading(true)
    const { data: followData } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', session.user.id)

    const followIds = followData?.map(f => f.following_id) || []

    // Include yourself + people you follow
    const feedUserIds = [...followIds, session.user.id]

    // Get workout completions
    const { data: logs } = await supabase
      .from('performance_log')
      .select('*, workouts(id, name, score_type), profiles(display_name, avatar_url)')
      .in('user_id', feedUserIds)
      .or('notes.is.null,notes.neq.Quick logged')
      .order('created_at', { ascending: false })
      .limit(40)

    // Get PR logs
    const { data: prLogs } = await supabase
      .from('personal_records')
      .select('*, profiles(display_name, avatar_url)')
      .in('user_id', feedUserIds)
      .order('created_at', { ascending: false })
      .limit(20)

    // Combine and sort by created_at
    const combined = [
      ...(logs || []).map(l => ({ ...l, feed_type: 'workout' })),
      ...(prLogs || []).map(p => ({ ...p, feed_type: 'pr' })),
    ].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 50)

    setActivities(combined)
    setLoading(false)
  }

  async function loadAllUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, follower_count')
      .neq('id', session.user.id)
      .order('follower_count', { ascending: false })
      .limit(50)
    if (data) setAllUsers(data)
  }

  async function toggleFollow(userId) {
    if (!session) { onAuthRequired(); return }
    const isFollowing = following.includes(userId)
    if (isFollowing) {
      await supabase.from('user_follows').delete()
        .eq('follower_id', session.user.id)
        .eq('following_id', userId)
      setFollowing(prev => prev.filter(id => id !== userId))
    } else {
      await supabase.from('user_follows').insert({
        follower_id: session.user.id,
        following_id: userId,
      })
      setFollowing(prev => [...prev, userId])
    }
    if (!isFollowing) setTimeout(loadActivity, 500)
  }

  function timeAgo(date) {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return Math.floor(s / 60) + 'm ago'
    if (s < 86400) return Math.floor(s / 3600) + 'h ago'
    if (s < 604800) return Math.floor(s / 86400) + 'd ago'
    return new Date(date).toLocaleDateString()
  }

  function navigateToWorkout(workoutId, workoutName) {
    if (onNavigateToWorkout) onNavigateToWorkout(workoutId, workoutName)
  }

  const filteredUsers = searchQuery.trim()
    ? allUsers.filter(u => (u.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : allUsers

  if (!session) {
    return (
      <div className="pr-section">
        <div className="pr-empty">
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
          <b>Sign in</b> to follow other athletes and see their activity.
          <br /><button className="ab p" style={{ marginTop: '12px' }} onClick={onAuthRequired}>Sign In</button>
        </div>
      </div>
    )
  }

  return (
    <div className="pr-section">
      <div className="pr-header">
        <h3>Activity Feed</h3>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="nbtn" onClick={() => loadActivity()} style={{ padding: '7px 12px', fontSize: '12px' }}>↻ Refresh</button>
          <button className="nbtn" onClick={() => { setShowDiscover(!showDiscover); if (!showDiscover) loadAllUsers() }} style={{ padding: '7px 14px', fontSize: '12px' }}>
            {showDiscover ? 'Hide' : '👥 Find Athletes'}
          </button>
        </div>
      </div>

      {showDiscover && (
        <div className="discover-section">
          <div className="sbox" style={{ marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="Search athletes by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          {filteredUsers.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--tx3)', padding: '8px 0' }}>
              {searchQuery ? 'No athletes found.' : 'No other users yet.'}
            </div>
          ) : (
            filteredUsers.map(u => (
              <div key={u.id} className="discover-user">
                <div className="discover-avatar" onClick={() => setViewingProfile(u.id)}>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="discover-avatar-img" />
                  ) : (
                    <div className="discover-avatar-letter">{(u.display_name || '?')[0].toUpperCase()}</div>
                  )}
                </div>
                <div className="discover-info" onClick={() => setViewingProfile(u.id)}>
                  <div className="discover-name">{u.display_name || 'Anonymous'}</div>
                  <div className="discover-meta">{u.follower_count || 0} follower{u.follower_count !== 1 ? 's' : ''}</div>
                </div>
                <button
                  className={`ab${following.includes(u.id) ? '' : ' p'}`}
                  onClick={() => toggleFollow(u.id)}
                  style={{ padding: '5px 14px', fontSize: '11px', flexShrink: 0 }}
                >
                  {following.includes(u.id) ? 'Following' : '+ Follow'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : activities.length === 0 ? (
        <div className="pr-empty">
          No activity yet. Complete a workout or log a PR to see it here. Tap <b>👥 Find Athletes</b> to follow others.
        </div>
      ) : (
        <div className="activity-list">
          {activities.map(a => (
            <div key={a.id + (a.feed_type || '')} className="activity-item">
              <div className="activity-avatar" onClick={() => setViewingProfile(a.user_id)}>
                {a.profiles?.avatar_url ? (
                  <img src={a.profiles.avatar_url} alt="" className="activity-avatar-img" />
                ) : (
                  <div className="activity-avatar-letter">{(a.profiles?.display_name || '?')[0].toUpperCase()}</div>
                )}
              </div>
              <div className="activity-content">
                <div className="activity-text">
                  <span className="activity-name" onClick={() => setViewingProfile(a.user_id)}>{a.profiles?.display_name || 'Someone'}</span>
                  {a.feed_type === 'pr' ? (
                    <>
                      {' '}logged <b>{a.score}</b> on <span className="activity-workout">{a.movement}{a.weight ? ` @ ${a.weight}` : ''}{a.target ? ` — ${a.target}` : ''}</span>
                      <span className="pr-badge-sm">PR</span>
                    </>
                  ) : (
                    <>
                      {a.score ? (
                        <> logged <b>{a.score}</b> on </>
                      ) : (
                        <> completed </>
                      )}
                      <span className="activity-workout" onClick={() => navigateToWorkout(a.workouts?.id, a.workouts?.name)}>{a.workouts?.name || 'a workout'}</span>
                      {a.is_rx === false && <span className="scaled-tag">Scaled</span>}
                      {a.is_rx === true && a.score && <span className="rx-tag">Rx</span>}
                    </>
                  )}
                </div>
                {a.notes && a.notes !== 'Quick logged' && (
                  <div className="activity-notes">"{a.notes}"</div>
                )}
                <div className="activity-time">{timeAgo(a.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingProfile && <PublicProfile userId={viewingProfile} onClose={() => setViewingProfile(null)} session={session} />}
    </div>
  )
}
