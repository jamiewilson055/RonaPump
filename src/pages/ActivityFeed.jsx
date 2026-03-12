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
  const [likes, setLikes] = useState({}) // { perfId: count, prId: count }
  const [myLikes, setMyLikes] = useState(new Set()) // set of ids I've liked
  const [comments, setComments] = useState({}) // { id: [comments] }
  const [expandedComments, setExpandedComments] = useState(null)
  const [commentText, setCommentText] = useState('')

  useEffect(() => {
    if (session) {
      loadFollowing()
      loadActivity()
    }
  }, [session])

  async function loadFollowing() {
    const { data } = await supabase.from('user_follows').select('following_id').eq('follower_id', session.user.id)
    if (data) setFollowing(data.map(f => f.following_id))
  }

  async function loadActivity() {
    setLoading(true)
    const { data: followData } = await supabase.from('user_follows').select('following_id').eq('follower_id', session.user.id)
    const followIds = followData?.map(f => f.following_id) || []
    const feedUserIds = [...followIds, session.user.id]

    const { data: logs } = await supabase
      .from('performance_log')
      .select('*, workouts(id, name, score_type), profiles(display_name, avatar_url)')
      .in('user_id', feedUserIds)
      .or('notes.is.null,notes.neq.Quick logged')
      .order('created_at', { ascending: false })
      .limit(40)

    const { data: prLogs } = await supabase
      .from('personal_records')
      .select('*, profiles(display_name, avatar_url)')
      .in('user_id', feedUserIds)
      .neq('type', 'deck-scheme')
      .order('created_at', { ascending: false })
      .limit(20)

    const combined = [
      ...(logs || []).map(l => ({ ...l, feed_type: 'workout' })),
      ...(prLogs || []).map(p => ({ ...p, feed_type: 'pr' })),
    ].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 50)

    setActivities(combined)

    // Load likes and comments for these activities
    await loadLikesAndComments(combined)
    setLoading(false)
  }

  async function loadLikesAndComments(acts) {
    const perfIds = acts.filter(a => a.feed_type === 'workout').map(a => a.id)
    const prIds = acts.filter(a => a.feed_type === 'pr').map(a => a.id)

    // Likes
    const likeCounts = {}
    const myLikeSet = new Set()

    if (perfIds.length) {
      const { data: perfLikes } = await supabase.from('activity_likes').select('performance_log_id, user_id').in('performance_log_id', perfIds)
      ;(perfLikes || []).forEach(l => {
        const key = 'p:' + l.performance_log_id
        likeCounts[key] = (likeCounts[key] || 0) + 1
        if (l.user_id === session.user.id) myLikeSet.add(key)
      })
    }
    if (prIds.length) {
      const { data: prLikesData } = await supabase.from('activity_likes').select('personal_record_id, user_id').in('personal_record_id', prIds)
      ;(prLikesData || []).forEach(l => {
        const key = 'r:' + l.personal_record_id
        likeCounts[key] = (likeCounts[key] || 0) + 1
        if (l.user_id === session.user.id) myLikeSet.add(key)
      })
    }

    setLikes(likeCounts)
    setMyLikes(myLikeSet)

    // Comments counts
    const commentCounts = {}
    if (perfIds.length) {
      const { data: perfComments } = await supabase.from('activity_comments').select('performance_log_id').in('performance_log_id', perfIds)
      ;(perfComments || []).forEach(c => { const key = 'p:' + c.performance_log_id; commentCounts[key] = (commentCounts[key] || 0) + 1 })
    }
    if (prIds.length) {
      const { data: prComments } = await supabase.from('activity_comments').select('personal_record_id').in('personal_record_id', prIds)
      ;(prComments || []).forEach(c => { const key = 'r:' + c.personal_record_id; commentCounts[key] = (commentCounts[key] || 0) + 1 })
    }
    setComments(commentCounts)
  }

  function actKey(a) {
    return a.feed_type === 'pr' ? 'r:' + a.id : 'p:' + a.id
  }

  async function toggleLike(a) {
    if (!session) { onAuthRequired(); return }
    const key = actKey(a)
    const isPr = a.feed_type === 'pr'

    if (myLikes.has(key)) {
      // Unlike
      if (isPr) {
        await supabase.from('activity_likes').delete().eq('user_id', session.user.id).eq('personal_record_id', a.id)
      } else {
        await supabase.from('activity_likes').delete().eq('user_id', session.user.id).eq('performance_log_id', a.id)
      }
      setMyLikes(prev => { const n = new Set(prev); n.delete(key); return n })
      setLikes(prev => ({ ...prev, [key]: Math.max(0, (prev[key] || 1) - 1) }))
    } else {
      // Like
      const insert = { user_id: session.user.id }
      if (isPr) insert.personal_record_id = a.id
      else insert.performance_log_id = a.id
      await supabase.from('activity_likes').insert(insert)

      setMyLikes(prev => { const n = new Set(prev); n.add(key); return n })
      setLikes(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))

      // Notify the author
      if (a.user_id !== session.user.id) {
        const name = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Someone'
        await supabase.from('notifications').insert({
          user_id: a.user_id,
          type: 'like',
          title: `${name} liked your activity`,
          body: a.feed_type === 'pr' ? `Your PR on ${a.movement || 'a movement'}` : `Your log on ${a.workouts?.name || 'a workout'}`,
        })
      }
    }
  }

  async function loadCommentsForActivity(a) {
    const key = actKey(a)
    const isPr = a.feed_type === 'pr'
    const col = isPr ? 'personal_record_id' : 'performance_log_id'

    const { data } = await supabase
      .from('activity_comments')
      .select('*, profiles(display_name, avatar_url)')
      .eq(col, a.id)
      .order('created_at', { ascending: true })

    setComments(prev => ({ ...prev, ['data:' + key]: data || [] }))
  }

  async function postComment(a) {
    if (!session) { onAuthRequired(); return }
    if (!commentText.trim()) return

    const isPr = a.feed_type === 'pr'
    const insert = { user_id: session.user.id, body: commentText.trim() }
    if (isPr) insert.personal_record_id = a.id
    else insert.performance_log_id = a.id

    await supabase.from('activity_comments').insert(insert)

    // Notify
    if (a.user_id !== session.user.id) {
      const name = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Someone'
      await supabase.from('notifications').insert({
        user_id: a.user_id,
        type: 'comment',
        title: `${name} commented on your activity`,
        body: commentText.trim().slice(0, 100),
      })
    }

    setCommentText('')
    const key = actKey(a)
    setComments(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
    loadCommentsForActivity(a)
  }

  async function deleteComment(commentId, a) {
    await supabase.from('activity_comments').delete().eq('id', commentId)
    const key = actKey(a)
    setComments(prev => ({ ...prev, [key]: Math.max(0, (prev[key] || 1) - 1) }))
    loadCommentsForActivity(a)
  }

  async function loadAllUsers() {
    const { data } = await supabase.from('profiles').select('id, display_name, avatar_url, follower_count')
      .neq('id', session.user.id).order('follower_count', { ascending: false }).limit(50)
    if (data) setAllUsers(data)
  }

  async function toggleFollow(userId) {
    if (!session) { onAuthRequired(); return }
    const isFollowing = following.includes(userId)
    if (isFollowing) {
      await supabase.from('user_follows').delete().eq('follower_id', session.user.id).eq('following_id', userId)
      setFollowing(prev => prev.filter(id => id !== userId))
    } else {
      await supabase.from('user_follows').insert({ follower_id: session.user.id, following_id: userId })
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
            <input type="text" placeholder="Search athletes by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          {filteredUsers.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--tx3)', padding: '8px 0' }}>
              {searchQuery ? 'No athletes found.' : 'No other users yet.'}
            </div>
          ) : (
            filteredUsers.map(u => (
              <div key={u.id} className="discover-user">
                <div className="discover-avatar" onClick={() => setViewingProfile(u.id)}>
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="discover-avatar-img" /> : <div className="discover-avatar-letter">{(u.display_name || '?')[0].toUpperCase()}</div>}
                </div>
                <div className="discover-info" onClick={() => setViewingProfile(u.id)}>
                  <div className="discover-name">{u.display_name || 'Anonymous'}</div>
                  <div className="discover-meta">{u.follower_count || 0} follower{u.follower_count !== 1 ? 's' : ''}</div>
                </div>
                <button className={`ab${following.includes(u.id) ? '' : ' p'}`} onClick={() => toggleFollow(u.id)} style={{ padding: '5px 14px', fontSize: '11px', flexShrink: 0 }}>
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
          {activities.map(a => {
            const key = actKey(a)
            const likeCount = likes[key] || 0
            const iLiked = myLikes.has(key)
            const commentCount = comments[key] || 0
            const isExpanded = expandedComments === a.id
            const commentList = comments['data:' + key] || []

            return (
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
                        {a.score ? <> logged <b>{a.score}</b> on </> : <> completed </>}
                        <span className="activity-workout" onClick={() => navigateToWorkout(a.workouts?.id, a.workouts?.name)}>{a.workouts?.name || 'a workout'}</span>
                        {a.is_rx === false && <span className="scaled-tag">Scaled</span>}
                        {a.is_rx === true && a.score && <span className="rx-tag">Rx</span>}
                      </>
                    )}
                  </div>
                  {a.notes && a.notes !== 'Quick logged' && <div className="activity-notes">"{a.notes}"</div>}
                  <div className="activity-bottom">
                    <span className="activity-time">{timeAgo(a.created_at)}</span>
                    <div className="activity-actions">
                      <button className={`act-btn${iLiked ? ' liked' : ''}`} onClick={() => toggleLike(a)}>
                        {iLiked ? '❤️' : '🤍'} {likeCount > 0 ? likeCount : ''}
                      </button>
                      <button className="act-btn" onClick={() => { if (isExpanded) { setExpandedComments(null) } else { setExpandedComments(a.id); loadCommentsForActivity(a) } }}>
                        💬 {commentCount > 0 ? commentCount : ''}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="act-comments">
                      {commentList.map(c => (
                        <div key={c.id} className="act-comment">
                          <span className="act-comment-name">{c.profiles?.display_name || 'Someone'}</span>
                          <span className="act-comment-body">{c.body}</span>
                          <span className="act-comment-time">{timeAgo(c.created_at)}</span>
                          {c.user_id === session.user.id && (
                            <span className="del-entry" onClick={() => deleteComment(c.id, a)} style={{ marginLeft: '4px' }}>✕</span>
                          )}
                        </div>
                      ))}
                      <div className="act-comment-form">
                        <input className="doc-suit-input" value={commentText} onChange={e => setCommentText(e.target.value)}
                          placeholder="Add a comment..." onKeyDown={e => { if (e.key === 'Enter') postComment(a) }}
                          style={{ flex: 1, fontSize: '12px', padding: '6px 8px' }} />
                        <button className="ab p" onClick={() => postComment(a)} style={{ padding: '6px 12px', fontSize: '11px' }}>Post</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {viewingProfile && <PublicProfile userId={viewingProfile} onClose={() => setViewingProfile(null)} session={session} />}
    </div>
  )
}
