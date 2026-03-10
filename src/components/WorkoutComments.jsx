import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function WorkoutComments({ workoutId, session, onAuthRequired }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => { loadComments() }, [workoutId])

  async function loadComments() {
    setLoading(true)
    const { data } = await supabase
      .from('workout_comments')
      .select('*, profiles(display_name)')
      .eq('workout_id', workoutId)
      .order('created_at', { ascending: true })
    if (data) setComments(data)
    setLoading(false)
  }

  async function postComment() {
    if (!session) { onAuthRequired(); return }
    if (!newComment.trim()) return
    setPosting(true)
    await supabase.from('workout_comments').insert({
      workout_id: workoutId,
      user_id: session.user.id,
      body: newComment.trim(),
    })
    setNewComment('')
    setPosting(false)
    loadComments()
  }

  async function deleteComment(id) {
    await supabase.from('workout_comments').delete().eq('id', id)
    loadComments()
  }

  function timeAgo(date) {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return Math.floor(s / 60) + 'm ago'
    if (s < 86400) return Math.floor(s / 3600) + 'h ago'
    if (s < 604800) return Math.floor(s / 86400) + 'd ago'
    return new Date(date).toLocaleDateString()
  }

  return (
    <div className="wc-comments">
      <div className="wc-comments-hdr">
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'var(--tx3)' }}>
          💬 Comments {comments.length > 0 && `(${comments.length})`}
        </span>
      </div>

      {loading ? null : comments.map(c => (
        <div key={c.id} className="wc-comment">
          <div className="wc-comment-top">
            <span className="wc-comment-author">{c.profiles?.display_name || 'Anonymous'}</span>
            <span className="wc-comment-time">{timeAgo(c.created_at)}</span>
            {session && (session.user.id === c.user_id) && (
              <span className="del-entry" onClick={() => deleteComment(c.id)} style={{ marginLeft: '4px' }}>✕</span>
            )}
          </div>
          <div className="wc-comment-body">{c.body}</div>
        </div>
      ))}

      <div className="wc-comment-form">
        <input
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder={session ? "Add a comment..." : "Sign in to comment"}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment() } }}
          disabled={!session}
        />
        {newComment.trim() && <button className="ab p" onClick={postComment} disabled={posting} style={{ padding: '6px 12px', fontSize: '11px' }}>Post</button>}
      </div>
    </div>
  )
}
