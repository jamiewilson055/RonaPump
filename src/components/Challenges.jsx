import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Challenges({ session, onAuthRequired, workouts }) {
  const [challenges, setChallenges] = useState([])
  const [creating, setCreating] = useState(false)
  const [users, setUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [workoutSearch, setWorkoutSearch] = useState('')
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState('active') // active, completed
  const [submitting, setSubmitting] = useState(null) // challenge id being submitted

  useEffect(() => {
    if (session) loadChallenges()
  }, [session])

  async function loadChallenges() {
    const { data } = await supabase
      .from('challenges')
      .select('*, challenger:profiles!challenges_challenger_id_fkey(id, display_name), challenged:profiles!challenges_challenged_id_fkey(id, display_name), workout:workouts!challenges_workout_id_fkey(id, name, score_type)')
      .or(`challenger_id.eq.${session.user.id},challenged_id.eq.${session.user.id}`)
      .order('created_at', { ascending: false })
    if (data) setChallenges(data)
  }

  async function searchUsers(q) {
    setUserSearch(q)
    if (q.length < 2) { setUsers([]); return }
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .ilike('display_name', `%${q}%`)
      .neq('id', session.user.id)
      .limit(8)
    if (data) setUsers(data)
  }

  const filteredWorkouts = workoutSearch.length >= 2
    ? (workouts || []).filter(w => w.name && w.score_type && w.score_type !== 'None' && w.visibility === 'official' && w.name.toLowerCase().includes(workoutSearch.toLowerCase())).slice(0, 8)
    : []

  async function createChallenge() {
    if (!session) { onAuthRequired(); return }
    if (!selectedUser || !selectedWorkout) { alert('Select an opponent and a workout.'); return }

    const { error } = await supabase.from('challenges').insert({
      challenger_id: session.user.id,
      challenged_id: selectedUser.id,
      workout_id: selectedWorkout.id,
      message: message.trim() || null,
    })
    if (error) { alert('Error: ' + error.message); return }

    // Send notification
    const name = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Someone'
    await supabase.from('notifications').insert({
      user_id: selectedUser.id,
      type: 'challenge',
      title: `${name} challenged you!`,
      body: `Head-to-head on ${selectedWorkout.name}`,
      link: 'h2h',
    })

    setCreating(false)
    setSelectedUser(null)
    setSelectedWorkout(null)
    setMessage('')
    setUserSearch('')
    setWorkoutSearch('')
    loadChallenges()
  }

  async function respondToChallenge(id, response) {
    await supabase.from('challenges').update({ status: response }).eq('id', id)
    loadChallenges()
  }

  async function submitScore(challenge) {
    const scoreInput = document.getElementById(`ch-score-${challenge.id}`)?.value?.trim()
    if (!scoreInput) return
    const isChallenger = challenge.challenger_id === session.user.id
    const update = isChallenger
      ? { challenger_score: scoreInput, challenger_completed_at: new Date().toISOString().slice(0, 10) }
      : { challenged_score: scoreInput, challenged_completed_at: new Date().toISOString().slice(0, 10) }

    // Check if both have now submitted
    if (isChallenger && challenge.challenged_score) update.status = 'completed'
    if (!isChallenger && challenge.challenger_score) update.status = 'completed'

    await supabase.from('challenges').update(update).eq('id', challenge.id)
    setSubmitting(null)
    loadChallenges()

    // Also log to performance_log
    await supabase.from('performance_log').insert({
      user_id: session.user.id,
      workout_id: challenge.workout_id,
      completed_at: new Date().toISOString().slice(0, 10),
      score: scoreInput,
      notes: `Head-to-Head vs ${isChallenger ? challenge.challenged?.display_name : challenge.challenger?.display_name}`,
      is_rx: true,
    })
  }

  if (!session) {
    return (
      <div className="pr-section">
        <div className="pr-empty">
          <b>Sign in</b> to challenge other athletes.
          <br /><button className="ab p" style={{ marginTop: '12px' }} onClick={onAuthRequired}>Sign In</button>
        </div>
      </div>
    )
  }

  const active = challenges.filter(c => c.status === 'pending' || c.status === 'accepted')
  const completed = challenges.filter(c => c.status === 'completed' || c.status === 'declined' || c.status === 'expired')

  const shown = tab === 'active' ? active : completed

  function getWinner(c) {
    if (!c.challenger_score || !c.challenged_score) return null
    const scoreType = c.workout?.score_type
    if (scoreType === 'Time') {
      return c.challenger_score <= c.challenged_score ? c.challenger_id : c.challenged_id
    }
    return c.challenger_score >= c.challenged_score ? c.challenger_id : c.challenged_id
  }

  return (
    <div className="ch-section">
      <div className="pr-header">
        <h3>⚔️ Head-to-Head</h3>
        <button className="nbtn" onClick={() => setCreating(!creating)} style={{ padding: '7px 14px', fontSize: '12px' }}>
          {creating ? 'Cancel' : '+ Challenge'}
        </button>
      </div>

      {creating && (
        <div className="ch-create">
          <div className="ch-create-field">
            <label className="ai-edit-label">Who do you want to challenge?</label>
            <input className="doc-suit-input" value={userSearch} onChange={e => searchUsers(e.target.value)}
              placeholder="Search by name..." />
            {users.length > 0 && !selectedUser && (
              <div className="ch-dropdown">
                {users.map(u => (
                  <div key={u.id} className="ch-dropdown-item" onClick={() => { setSelectedUser(u); setUserSearch(u.display_name); setUsers([]) }}>
                    {u.display_name}
                  </div>
                ))}
              </div>
            )}
            {selectedUser && <div className="ch-selected">✓ {selectedUser.display_name}</div>}
          </div>

          <div className="ch-create-field">
            <label className="ai-edit-label">Pick a workout</label>
            <input className="doc-suit-input" value={workoutSearch} onChange={e => setWorkoutSearch(e.target.value)}
              placeholder="Search official workouts..." />
            {filteredWorkouts.length > 0 && !selectedWorkout && (
              <div className="ch-dropdown">
                {filteredWorkouts.map(w => (
                  <div key={w.id} className="ch-dropdown-item" onClick={() => { setSelectedWorkout(w); setWorkoutSearch(w.name); }}>
                    {w.name} <span style={{ color: 'var(--tx3)', fontSize: '11px' }}>{w.score_type}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedWorkout && <div className="ch-selected">✓ {selectedWorkout.name}</div>}
          </div>

          <div className="ch-create-field">
            <label className="ai-edit-label">Trash talk (optional)</label>
            <input className="doc-suit-input" value={message} onChange={e => setMessage(e.target.value)}
              placeholder="e.g. I'll beat your time by 2 minutes..." />
          </div>

          <button className="doc-start-btn" onClick={createChallenge} style={{ fontSize: '14px' }}>
            ⚔️ Send Challenge
          </button>
        </div>
      )}

      <div className="ch-tabs">
        <button className={`ch-tab${tab === 'active' ? ' on' : ''}`} onClick={() => setTab('active')}>
          Active {active.length > 0 && <span className="ch-badge">{active.length}</span>}
        </button>
        <button className={`ch-tab${tab === 'completed' ? ' on' : ''}`} onClick={() => setTab('completed')}>
          History {completed.length > 0 && <span className="ch-badge">{completed.length}</span>}
        </button>
      </div>

      {shown.length === 0 && (
        <div className="pr-empty" style={{ marginTop: '12px' }}>
          {tab === 'active' ? 'No active challenges. Send one!' : 'No completed challenges yet.'}
        </div>
      )}

      {shown.map(c => {
        const isChallenger = c.challenger_id === session.user.id
        const opponent = isChallenger ? c.challenged : c.challenger
        const myScore = isChallenger ? c.challenger_score : c.challenged_score
        const theirScore = isChallenger ? c.challenged_score : c.challenger_score
        const winner = getWinner(c)
        const iWon = winner === session.user.id
        const isPending = c.status === 'pending' && !isChallenger
        const needsMyScore = c.status === 'accepted' && !myScore
        const daysLeft = Math.max(0, Math.ceil((new Date(c.expires_at) - Date.now()) / 86400000))

        return (
          <div key={c.id} className={`ch-card${c.status === 'completed' ? ' done' : ''}`}>
            <div className="ch-card-top">
              <div className="ch-matchup">
                <span className="ch-player">{isChallenger ? 'You' : c.challenger?.display_name}</span>
                <span className="ch-vs">⚔️</span>
                <span className="ch-player">{isChallenger ? opponent?.display_name : 'You'}</span>
              </div>
              <div className="ch-workout-name">{c.workout?.name}</div>
              {c.message && <div className="ch-message">"{c.message}"</div>}
            </div>

            {c.status === 'completed' && (
              <div className="ch-scores">
                <div className={`ch-score-col${winner === c.challenger_id ? ' winner' : ''}`}>
                  <div className="ch-score-name">{c.challenger?.display_name}</div>
                  <div className="ch-score-val">{c.challenger_score || '—'}</div>
                  {winner === c.challenger_id && <div className="ch-crown">👑</div>}
                </div>
                <div className="ch-score-divider">vs</div>
                <div className={`ch-score-col${winner === c.challenged_id ? ' winner' : ''}`}>
                  <div className="ch-score-name">{c.challenged?.display_name}</div>
                  <div className="ch-score-val">{c.challenged_score || '—'}</div>
                  {winner === c.challenged_id && <div className="ch-crown">👑</div>}
                </div>
              </div>
            )}

            {c.status === 'accepted' && (
              <div className="ch-scores">
                <div className="ch-score-col">
                  <div className="ch-score-name">{c.challenger?.display_name}</div>
                  <div className="ch-score-val">{c.challenger_score || '⏳'}</div>
                </div>
                <div className="ch-score-divider">vs</div>
                <div className="ch-score-col">
                  <div className="ch-score-name">{c.challenged?.display_name}</div>
                  <div className="ch-score-val">{c.challenged_score || '⏳'}</div>
                </div>
              </div>
            )}

            <div className="ch-card-actions">
              {isPending && (
                <>
                  <button className="ab p" onClick={() => respondToChallenge(c.id, 'accepted')}>Accept</button>
                  <button className="ab del" onClick={() => respondToChallenge(c.id, 'declined')}>Decline</button>
                </>
              )}
              {c.status === 'pending' && isChallenger && (
                <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>Waiting for {opponent?.display_name} to accept... ({daysLeft}d left)</span>
              )}
              {needsMyScore && (
                submitting === c.id ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1 }}>
                    <input id={`ch-score-${c.id}`} className="doc-suit-input" placeholder={c.workout?.score_type === 'Time' ? 'Your time (e.g. 18:42)' : 'Your score'} style={{ flex: 1 }} />
                    <button className="ab p" onClick={() => submitScore(c)}>Submit</button>
                    <button className="ab" onClick={() => setSubmitting(null)}>Cancel</button>
                  </div>
                ) : (
                  <button className="ab p" onClick={() => setSubmitting(c.id)}>📝 Submit My Score</button>
                )
              )}
              {c.status === 'declined' && <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>Declined</span>}
              {c.status === 'completed' && (
                <span style={{ fontSize: '12px', color: iWon ? 'var(--grn)' : 'var(--acc)', fontWeight: 600 }}>
                  {iWon ? '🏆 You won!' : '💪 Better luck next time'}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
