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
  const [tab, setTab] = useState('active')
  const [submitting, setSubmitting] = useState(null)
  const [scoreComment, setScoreComment] = useState('')
  const [decliningId, setDecliningId] = useState(null)
  const [declineReason, setDeclineReason] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editWorkoutSearch, setEditWorkoutSearch] = useState('')
  const [editMessage, setEditMessage] = useState('')
  const [editWorkout, setEditWorkout] = useState(null)
  const [threadOpen, setThreadOpen] = useState(null)
  const [threadComments, setThreadComments] = useState({})
  const [threadText, setThreadText] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(null)

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

  const editFilteredWorkouts = editWorkoutSearch.length >= 2
    ? (workouts || []).filter(w => w.name && w.score_type && w.score_type !== 'None' && w.visibility === 'official' && w.name.toLowerCase().includes(editWorkoutSearch.toLowerCase())).slice(0, 8)
    : []

  function getMyName() {
    return session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Someone'
  }

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

    await supabase.from('notifications').insert({
      user_id: selectedUser.id,
      type: 'challenge',
      title: `${getMyName()} challenged you!`,
      body: `Head-to-head on ${selectedWorkout.name}${message.trim() ? ` — "${message.trim()}"` : ''}`,
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

  async function cancelChallenge(id) {
    const c = challenges.find(ch => ch.id === id)
    if (!c) return
    await supabase.from('challenges').delete().eq('id', id)
    if (c.challenged_id) {
      await supabase.from('notifications').insert({
        user_id: c.challenged_id,
        type: 'challenge',
        title: 'Challenge withdrawn',
        body: `${getMyName()} cancelled their challenge on ${c.workout?.name || 'a workout'}`,
        link: 'h2h',
      })
    }
    setConfirmCancel(null)
    loadChallenges()
  }

  async function declineChallenge(id) {
    const c = challenges.find(ch => ch.id === id)
    const update = { status: 'declined' }
    if (declineReason.trim()) update.decline_reason = declineReason.trim()
    await supabase.from('challenges').update(update).eq('id', id)
    if (c) {
      await supabase.from('notifications').insert({
        user_id: c.challenger_id,
        type: 'challenge',
        title: 'Challenge declined',
        body: `${getMyName()} declined your challenge on ${c.workout?.name || 'a workout'}${declineReason.trim() ? ` — "${declineReason.trim()}"` : ''}`,
        link: 'h2h',
      })
    }
    setDecliningId(null)
    setDeclineReason('')
    loadChallenges()
  }

  async function acceptChallenge(id) {
    const c = challenges.find(ch => ch.id === id)
    await supabase.from('challenges').update({ status: 'accepted' }).eq('id', id)
    if (c) {
      await supabase.from('notifications').insert({
        user_id: c.challenger_id,
        type: 'challenge',
        title: 'Challenge accepted!',
        body: `${getMyName()} accepted your challenge on ${c.workout?.name || 'a workout'} — game on!`,
        link: 'h2h',
      })
    }
    loadChallenges()
  }

  async function saveEdit(id) {
    const update = {}
    if (editWorkout) update.workout_id = editWorkout.id
    if (editMessage.trim() || editMessage === '') update.message = editMessage.trim() || null
    if (Object.keys(update).length === 0) { setEditingId(null); return }
    await supabase.from('challenges').update(update).eq('id', id)
    const c = challenges.find(ch => ch.id === id)
    if (c) {
      await supabase.from('notifications').insert({
        user_id: c.challenged_id,
        type: 'challenge',
        title: 'Challenge updated',
        body: `${getMyName()} updated their challenge${editWorkout ? ` — now on ${editWorkout.name}` : ''}`,
        link: 'h2h',
      })
    }
    setEditingId(null)
    setEditWorkout(null)
    setEditWorkoutSearch('')
    setEditMessage('')
    loadChallenges()
  }

  async function submitScore(challenge) {
    const scoreInput = document.getElementById(`ch-score-${challenge.id}`)?.value?.trim()
    if (!scoreInput) return
    const isChallenger = challenge.challenger_id === session.user.id
    const update = isChallenger
      ? { challenger_score: scoreInput, challenger_completed_at: new Date().toISOString().slice(0, 10) }
      : { challenged_score: scoreInput, challenged_completed_at: new Date().toISOString().slice(0, 10) }

    if (scoreComment.trim()) {
      if (isChallenger) update.challenger_comment = scoreComment.trim()
      else update.challenged_comment = scoreComment.trim()
    }

    const bothDone = (isChallenger && challenge.challenged_score) || (!isChallenger && challenge.challenger_score)
    if (bothDone) {
      update.status = 'completed'
      const myS = scoreInput
      const theirS = isChallenger ? challenge.challenged_score : challenge.challenger_score
      const scoreType = challenge.workout?.score_type
      let winnerId = null
      if (myS === theirS) {
        winnerId = null
      } else if (scoreType === 'Time') {
        winnerId = myS <= theirS ? session.user.id : (isChallenger ? challenge.challenged_id : challenge.challenger_id)
      } else {
        winnerId = myS >= theirS ? session.user.id : (isChallenger ? challenge.challenged_id : challenge.challenger_id)
      }
      update.winner_id = winnerId
    }

    await supabase.from('challenges').update(update).eq('id', challenge.id)

    const opponentId = isChallenger ? challenge.challenged_id : challenge.challenger_id
    const opponentName = isChallenger ? challenge.challenged?.display_name : challenge.challenger?.display_name
    await supabase.from('notifications').insert({
      user_id: opponentId,
      type: 'challenge',
      title: bothDone ? 'Challenge complete!' : `${getMyName()} submitted a score`,
      body: bothDone
        ? `Results are in for ${challenge.workout?.name || 'your challenge'} — check who won!`
        : `${getMyName()} posted ${scoreInput} on ${challenge.workout?.name || 'your challenge'}${scoreComment.trim() ? ` — "${scoreComment.trim()}"` : ''}`,
      link: 'h2h',
    })

    setSubmitting(null)
    setScoreComment('')
    loadChallenges()

    await supabase.from('performance_log').insert({
      user_id: session.user.id,
      workout_id: challenge.workout_id,
      completed_at: new Date().toISOString().slice(0, 10),
      score: scoreInput,
      notes: `Head-to-Head vs ${opponentName}`,
      is_rx: true,
    })
  }

  function startRematch(c) {
    const opponentId = c.challenger_id === session.user.id ? c.challenged_id : c.challenger_id
    const opponentName = c.challenger_id === session.user.id ? c.challenged?.display_name : c.challenger?.display_name
    setSelectedUser({ id: opponentId, display_name: opponentName })
    setUserSearch(opponentName || '')
    setSelectedWorkout({ id: c.workout_id, name: c.workout?.name, score_type: c.workout?.score_type })
    setWorkoutSearch(c.workout?.name || '')
    setMessage('')
    setCreating(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function loadThread(challengeId) {
    const { data } = await supabase
      .from('challenge_comments')
      .select('*, profiles(display_name)')
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: true })
    setThreadComments(prev => ({ ...prev, [challengeId]: data || [] }))
  }

  async function postThreadComment(challengeId) {
    if (!threadText.trim()) return
    const { error } = await supabase.from('challenge_comments').insert({
      challenge_id: challengeId,
      user_id: session.user.id,
      body: threadText.trim(),
    })
    if (!error) {
      const c = challenges.find(ch => ch.id === challengeId)
      if (c) {
        const opponentId = c.challenger_id === session.user.id ? c.challenged_id : c.challenger_id
        await supabase.from('notifications').insert({
          user_id: opponentId,
          type: 'challenge',
          title: `${getMyName()} commented on your challenge`,
          body: threadText.trim().slice(0, 80),
          link: 'h2h',
        })
      }
    }
    setThreadText('')
    loadThread(challengeId)
  }

  function getH2HRecord(opponentId) {
    const head2head = challenges.filter(c =>
      c.status === 'completed' &&
      ((c.challenger_id === session.user.id && c.challenged_id === opponentId) ||
       (c.challenged_id === session.user.id && c.challenger_id === opponentId))
    )
    let myWins = 0, theirWins = 0, ties = 0
    head2head.forEach(c => {
      if (!c.winner_id) ties++
      else if (c.winner_id === session.user.id) myWins++
      else theirWins++
    })
    return { myWins, theirWins, ties, total: head2head.length }
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
    if (c.winner_id) return c.winner_id
    if (!c.challenger_score || !c.challenged_score) return null
    const scoreType = c.workout?.score_type
    if (scoreType === 'Time') {
      return c.challenger_score <= c.challenged_score ? c.challenger_id : c.challenged_id
    }
    return c.challenger_score >= c.challenged_score ? c.challenger_id : c.challenged_id
  }

  function timeAgo(d) {
    if (!d) return ''
    const s = Math.floor((Date.now() - new Date(d)) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return Math.floor(s / 60) + 'm ago'
    if (s < 86400) return Math.floor(s / 3600) + 'h ago'
    return Math.floor(s / 86400) + 'd ago'
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
        const opponentId = isChallenger ? c.challenged_id : c.challenger_id
        const myScore = isChallenger ? c.challenger_score : c.challenged_score
        const theirScore = isChallenger ? c.challenged_score : c.challenger_score
        const winner = getWinner(c)
        const iWon = winner === session.user.id
        const isPending = c.status === 'pending' && !isChallenger
        const needsMyScore = c.status === 'accepted' && !myScore
        const daysLeft = c.expires_at ? Math.max(0, Math.ceil((new Date(c.expires_at) - Date.now()) / 86400000)) : null
        const record = getH2HRecord(opponentId)
        const thread = threadComments[c.id] || []
        const isThreadOpen = threadOpen === c.id

        return (
          <div key={c.id} className={`ch-card${c.status === 'completed' || c.status === 'declined' ? ' done' : ''}`}>
            <div className="ch-card-top">
              <div className="ch-matchup">
                <span className="ch-player">{isChallenger ? 'You' : c.challenger?.display_name}</span>
                <span className="ch-vs">⚔️</span>
                <span className="ch-player">{isChallenger ? opponent?.display_name : 'You'}</span>
              </div>
              <div className="ch-workout-name">{c.workout?.name}</div>
              {c.message && <div className="ch-message">"{c.message}"</div>}
              {record.total > 0 && (
                <div className="ch-record">
                  <span className="ch-record-label">Record:</span>
                  <span className={`ch-record-score${record.myWins > record.theirWins ? ' ahead' : record.myWins < record.theirWins ? ' behind' : ''}`}>
                    {record.myWins}W–{record.theirWins}L{record.ties > 0 ? `–${record.ties}T` : ''}
                  </span>
                </div>
              )}
            </div>

            {c.status === 'completed' && (
              <>
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
                {(c.challenger_comment || c.challenged_comment) && (
                  <div className="ch-comments-section">
                    {c.challenger_comment && (
                      <div className="ch-score-comment"><span className="ch-sc-name">{c.challenger?.display_name}:</span> "{c.challenger_comment}"</div>
                    )}
                    {c.challenged_comment && (
                      <div className="ch-score-comment"><span className="ch-sc-name">{c.challenged?.display_name}:</span> "{c.challenged_comment}"</div>
                    )}
                  </div>
                )}
              </>
            )}

            {c.status === 'accepted' && (
              <>
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
                {(c.challenger_comment || c.challenged_comment) && (
                  <div className="ch-comments-section">
                    {c.challenger_comment && (
                      <div className="ch-score-comment"><span className="ch-sc-name">{c.challenger?.display_name}:</span> "{c.challenger_comment}"</div>
                    )}
                    {c.challenged_comment && (
                      <div className="ch-score-comment"><span className="ch-sc-name">{c.challenged?.display_name}:</span> "{c.challenged_comment}"</div>
                    )}
                  </div>
                )}
              </>
            )}

            {c.status === 'declined' && c.decline_reason && (
              <div className="ch-decline-reason">"{c.decline_reason}"</div>
            )}

            <div className="ch-card-actions">
              {isPending && (
                decliningId === c.id ? (
                  <div className="ch-decline-form">
                    <input className="doc-suit-input" value={declineReason} onChange={e => setDeclineReason(e.target.value)}
                      placeholder="Reason (optional)..." style={{ flex: 1, fontSize: '12px' }} />
                    <button className="ab del" onClick={() => declineChallenge(c.id)}>Decline</button>
                    <button className="ab" onClick={() => { setDecliningId(null); setDeclineReason('') }}>Back</button>
                  </div>
                ) : (
                  <>
                    <button className="ab p" onClick={() => acceptChallenge(c.id)}>Accept</button>
                    <button className="ab del" onClick={() => setDecliningId(c.id)}>Decline</button>
                  </>
                )
              )}

              {c.status === 'pending' && isChallenger && (
                editingId === c.id ? (
                  <div className="ch-edit-form">
                    <div className="ch-create-field" style={{ marginBottom: '8px' }}>
                      <label className="ai-edit-label">Change workout</label>
                      <input className="doc-suit-input" value={editWorkoutSearch} onChange={e => setEditWorkoutSearch(e.target.value)}
                        placeholder={c.workout?.name || 'Search...'} style={{ fontSize: '12px' }} />
                      {editFilteredWorkouts.length > 0 && !editWorkout && (
                        <div className="ch-dropdown">
                          {editFilteredWorkouts.map(w => (
                            <div key={w.id} className="ch-dropdown-item" onClick={() => { setEditWorkout(w); setEditWorkoutSearch(w.name) }}>
                              {w.name} <span style={{ color: 'var(--tx3)', fontSize: '11px' }}>{w.score_type}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {editWorkout && <div className="ch-selected">✓ {editWorkout.name}</div>}
                    </div>
                    <div className="ch-create-field" style={{ marginBottom: '8px' }}>
                      <label className="ai-edit-label">Update trash talk</label>
                      <input className="doc-suit-input" value={editMessage} onChange={e => setEditMessage(e.target.value)}
                        placeholder={c.message || 'Add trash talk...'} style={{ fontSize: '12px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="ab p" onClick={() => saveEdit(c.id)}>Save</button>
                      <button className="ab" onClick={() => { setEditingId(null); setEditWorkout(null); setEditWorkoutSearch(''); setEditMessage('') }}>Cancel</button>
                    </div>
                  </div>
                ) : confirmCancel === c.id ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>Withdraw this challenge?</span>
                    <button className="ab del" onClick={() => cancelChallenge(c.id)}>Yes, cancel</button>
                    <button className="ab" onClick={() => setConfirmCancel(null)}>No</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>Waiting for {opponent?.display_name}...{daysLeft !== null ? ` (${daysLeft}d left)` : ''}</span>
                    <button className="ab" onClick={() => { setEditingId(c.id); setEditMessage(c.message || ''); setEditWorkoutSearch('') }} style={{ padding: '4px 10px', fontSize: '11px' }}>✏️ Edit</button>
                    <button className="ab" onClick={() => setConfirmCancel(c.id)} style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--acc)' }}>✕ Cancel</button>
                  </div>
                )
              )}

              {needsMyScore && (
                submitting === c.id ? (
                  <div className="ch-submit-form">
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input id={`ch-score-${c.id}`} className="doc-suit-input" placeholder={c.workout?.score_type === 'Time' ? 'Your time (e.g. 18:42)' : 'Your score'} style={{ flex: 1 }} />
                      <button className="ab p" onClick={() => submitScore(c)}>Submit</button>
                      <button className="ab" onClick={() => { setSubmitting(null); setScoreComment('') }}>Cancel</button>
                    </div>
                    <input className="doc-suit-input" value={scoreComment} onChange={e => setScoreComment(e.target.value)}
                      placeholder="Add some commentary..." style={{ marginTop: '6px', fontSize: '12px' }} />
                  </div>
                ) : (
                  <button className="ab p" onClick={() => setSubmitting(c.id)}>📝 Submit My Score</button>
                )
              )}

              {c.status === 'accepted' && myScore && !theirScore && (
                <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>✅ You scored {myScore} — waiting for {opponent?.display_name}</span>
              )}

              {c.status === 'declined' && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>❌ Declined</span>
                  {isChallenger && <button className="ab" onClick={() => startRematch(c)} style={{ padding: '4px 10px', fontSize: '11px' }}>🔄 Try again</button>}
                </div>
              )}

              {c.status === 'completed' && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: iWon ? 'var(--grn)' : winner ? 'var(--acc)' : 'var(--tx3)', fontWeight: 600 }}>
                    {!winner ? '🤝 Tie!' : iWon ? '🏆 You won!' : '💪 Better luck next time'}
                  </span>
                  <button className="ab" onClick={() => startRematch(c)} style={{ padding: '4px 10px', fontSize: '11px' }}>🔄 Rematch</button>
                </div>
              )}
            </div>

            <div className="ch-thread-toggle">
              <button className="act-btn" onClick={() => {
                if (isThreadOpen) { setThreadOpen(null) } else { setThreadOpen(c.id); loadThread(c.id) }
              }}>
                💬 {thread.length > 0 ? thread.length : ''} {isThreadOpen ? 'Hide' : 'Chat'}
              </button>
              <span className="ch-card-time">{timeAgo(c.created_at)}</span>
            </div>

            {isThreadOpen && (
              <div className="ch-thread">
                {thread.length === 0 && <div style={{ fontSize: '11px', color: 'var(--tx3)', padding: '4px 0' }}>No messages yet — start the trash talk.</div>}
                {thread.map(t => (
                  <div key={t.id} className="ch-thread-msg">
                    <span className="ch-thread-name">{t.profiles?.display_name || 'Someone'}</span>
                    <span className="ch-thread-body">{t.body}</span>
                    <span className="ch-thread-time">{timeAgo(t.created_at)}</span>
                  </div>
                ))}
                <div className="ch-thread-form">
                  <input className="doc-suit-input" value={threadText} onChange={e => setThreadText(e.target.value)}
                    placeholder="Talk trash..." onKeyDown={e => { if (e.key === 'Enter') postThreadComment(c.id) }}
                    style={{ flex: 1, fontSize: '12px', padding: '6px 8px' }} />
                  <button className="ab p" onClick={() => postThreadComment(c.id)} style={{ padding: '6px 12px', fontSize: '11px' }}>Send</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
