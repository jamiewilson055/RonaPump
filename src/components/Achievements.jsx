import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ============= Gorilla Ranks =============
const RANKS = [
  { key: 'baby', name: 'Baby Gorilla', icon: '🐒', minXp: 0, color: '#9ca3af' },
  { key: 'juvenile', name: 'Juvenile Gorilla', icon: '🦍', minXp: 50, color: '#a78bfa' },
  { key: 'blackback', name: 'Blackback', icon: '🦍', minXp: 150, color: '#60a5fa' },
  { key: 'silverback', name: 'Silverback', icon: '🦍', minXp: 400, color: '#c0c0c0' },
  { key: 'alpha', name: 'Alpha Silverback', icon: '🦍', minXp: 800, color: '#fbbf24' },
  { key: 'harambe', name: 'Harambe Legend', icon: '🦍', minXp: 1500, color: '#e01e1e' },
]

// ============= Achievements =============
const ACHIEVEMENTS = [
  // Onboarding
  { key: 'first_workout', name: 'First Rep', icon: '💪', desc: 'Complete your first workout', xp: 10, category: 'milestone' },
  { key: 'first_pr', name: 'Record Breaker', icon: '📈', desc: 'Log your first PR', xp: 10, category: 'milestone' },
  { key: 'first_favorite', name: 'Bookworm', icon: '⭐', desc: 'Favorite your first workout', xp: 5, category: 'milestone' },
  { key: 'profile_complete', name: 'Identity', icon: '🪪', desc: 'Complete your profile', xp: 5, category: 'milestone' },

  // Consistency
  { key: 'streak_3', name: 'Three-Peat', icon: '🔥', desc: '3-day workout streak', xp: 15, category: 'streak' },
  { key: 'streak_7', name: 'Week Warrior', icon: '🔥', desc: '7-day workout streak', xp: 30, category: 'streak' },
  { key: 'streak_14', name: 'Relentless', icon: '🔥', desc: '14-day workout streak', xp: 50, category: 'streak' },
  { key: 'streak_30', name: 'Machine', icon: '🤖', desc: '30-day workout streak', xp: 100, category: 'streak' },

  // Volume
  { key: 'workouts_10', name: 'Getting Started', icon: '🏋️', desc: 'Complete 10 workouts', xp: 15, category: 'volume' },
  { key: 'workouts_25', name: 'Quarter Century', icon: '🏋️', desc: 'Complete 25 workouts', xp: 25, category: 'volume' },
  { key: 'workouts_50', name: 'Half Century', icon: '🏋️', desc: 'Complete 50 workouts', xp: 40, category: 'volume' },
  { key: 'workouts_100', name: 'Centurion', icon: '🏛️', desc: 'Complete 100 workouts', xp: 75, category: 'volume' },
  { key: 'workouts_250', name: 'Iron Will', icon: '⚔️', desc: 'Complete 250 workouts', xp: 120, category: 'volume' },
  { key: 'workouts_500', name: 'Legendary', icon: '👑', desc: 'Complete 500 workouts', xp: 200, category: 'volume' },

  // Features
  { key: 'deck_complete', name: 'Full Deck', icon: '🃏', desc: 'Complete a Deck of Cards', xp: 20, category: 'feature' },
  { key: 'ai_generated', name: 'Robot Coach', icon: '🤖', desc: 'Generate an AI workout', xp: 10, category: 'feature' },
  { key: 'h2h_won', name: 'Victor', icon: '⚔️', desc: 'Win a Head-to-Head challenge', xp: 25, category: 'feature' },
  { key: 'collection_created', name: 'Curator', icon: '📁', desc: 'Create a collection', xp: 10, category: 'feature' },
  { key: 'comment_posted', name: 'Hype Man', icon: '💬', desc: 'Comment on someone\'s activity', xp: 5, category: 'social' },
  { key: 'followed_someone', name: 'Networking', icon: '👥', desc: 'Follow another athlete', xp: 5, category: 'social' },
  { key: 'got_10_likes', name: 'Popular', icon: '❤️', desc: 'Get 10 likes on your activities', xp: 20, category: 'social' },

  // Special
  { key: 'prs_5', name: 'PR Machine', icon: '🏆', desc: 'Log 5 personal records', xp: 20, category: 'special' },
  { key: 'variety_10', name: 'Variety Pack', icon: '🎯', desc: 'Complete 10 different workout types', xp: 30, category: 'special' },
  { key: 'early_bird', name: 'Early Bird', icon: '🌅', desc: 'Log a workout before 7 AM', xp: 10, category: 'special' },
  { key: 'night_owl', name: 'Night Owl', icon: '🦉', desc: 'Log a workout after 10 PM', xp: 10, category: 'special' },
]

function getRank(xp) {
  let rank = RANKS[0]
  for (const r of RANKS) {
    if (xp >= r.minXp) rank = r
  }
  return rank
}

function getNextRank(xp) {
  for (const r of RANKS) {
    if (xp < r.minXp) return r
  }
  return null
}

export { ACHIEVEMENTS, RANKS, getRank, getNextRank }

// ============= Achievement Checker =============
export async function checkAndAwardAchievements(session) {
  if (!session) return []
  const userId = session.user.id
  const newlyUnlocked = []

  // Load current achievements
  const { data: existing } = await supabase.from('user_achievements').select('achievement_key').eq('user_id', userId)
  const has = new Set((existing || []).map(a => a.achievement_key))

  // Load stats
  const { data: logs } = await supabase.from('performance_log').select('id, completed_at, created_at').eq('user_id', userId)
  const { data: prs } = await supabase.from('personal_records').select('id').eq('user_id', userId)
  const { data: favs } = await supabase.from('user_favorites').select('workout_id').eq('user_id', userId)
  const { data: profile } = await supabase.from('profiles').select('display_name, height, weight, bio').eq('id', userId).single()
  const { data: follows } = await supabase.from('user_follows').select('id').eq('follower_id', userId)
  const { data: comments } = await supabase.from('activity_comments').select('id').eq('user_id', userId)
  const { data: likes } = await supabase.from('activity_likes').select('id, performance_log_id, personal_record_id')

  const logCount = logs?.length || 0
  const prCount = prs?.length || 0
  const favCount = favs?.length || 0

  // Count likes received
  const myLogIds = new Set((logs || []).map(l => l.id))
  const myPrIds = new Set((prs || []).map(p => p.id))
  const likesReceived = (likes || []).filter(l =>
    (l.performance_log_id && myLogIds.has(l.performance_log_id)) ||
    (l.personal_record_id && myPrIds.has(l.personal_record_id))
  ).length

  // Compute streak
  const dates = new Set((logs || []).map(l => l.completed_at))
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const ds = d.toISOString().slice(0, 10)
    if (dates.has(ds)) streak++
    else if (i > 0) break
  }

  // Compute unique workout types
  const { data: loggedWorkouts } = await supabase
    .from('performance_log')
    .select('workouts(workout_types)')
    .eq('user_id', userId)
  const allTypes = new Set()
  ;(loggedWorkouts || []).forEach(l => {
    ;(l.workouts?.workout_types || []).forEach(t => allTypes.add(t))
  })

  // Check time-based achievements
  const now = new Date()
  const hour = now.getHours()

  // ---- Award checks ----
  const checks = [
    { key: 'first_workout', check: logCount >= 1 },
    { key: 'first_pr', check: prCount >= 1 },
    { key: 'first_favorite', check: favCount >= 1 },
    { key: 'profile_complete', check: profile?.display_name && profile?.bio },
    { key: 'streak_3', check: streak >= 3 },
    { key: 'streak_7', check: streak >= 7 },
    { key: 'streak_14', check: streak >= 14 },
    { key: 'streak_30', check: streak >= 30 },
    { key: 'workouts_10', check: logCount >= 10 },
    { key: 'workouts_25', check: logCount >= 25 },
    { key: 'workouts_50', check: logCount >= 50 },
    { key: 'workouts_100', check: logCount >= 100 },
    { key: 'workouts_250', check: logCount >= 250 },
    { key: 'workouts_500', check: logCount >= 500 },
    { key: 'prs_5', check: prCount >= 5 },
    { key: 'followed_someone', check: (follows?.length || 0) >= 1 },
    { key: 'comment_posted', check: (comments?.length || 0) >= 1 },
    { key: 'got_10_likes', check: likesReceived >= 10 },
    { key: 'variety_10', check: allTypes.size >= 10 },
    { key: 'early_bird', check: hour < 7 && logCount > 0 },
    { key: 'night_owl', check: hour >= 22 && logCount > 0 },
  ]

  let totalNewXp = 0
  for (const { key, check } of checks) {
    if (check && !has.has(key)) {
      const ach = ACHIEVEMENTS.find(a => a.key === key)
      if (ach) {
        await supabase.from('user_achievements').insert({ user_id: userId, achievement_key: key })
        newlyUnlocked.push(ach)
        totalNewXp += ach.xp
      }
    }
  }

  // Update XP and rank
  if (totalNewXp > 0) {
    const { data: currentProfile } = await supabase.from('profiles').select('xp').eq('id', userId).single()
    const newXp = (currentProfile?.xp || 0) + totalNewXp
    const newRank = getRank(newXp)
    await supabase.from('profiles').update({ xp: newXp, gorilla_rank: newRank.name }).eq('id', userId)
  }

  return newlyUnlocked
}

// ============= Display Component =============
export default function AchievementDisplay({ session }) {
  const [achievements, setAchievements] = useState([])
  const [xp, setXp] = useState(0)
  const [rank, setRank] = useState(RANKS[0])
  const [nextRank, setNextRank] = useState(RANKS[1])
  const [newUnlocks, setNewUnlocks] = useState([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (session) load()
  }, [session])

  async function load() {
    // Check for new achievements
    const newOnes = await checkAndAwardAchievements(session)
    if (newOnes.length > 0) setNewUnlocks(newOnes)

    // Load all achievements
    const { data } = await supabase.from('user_achievements').select('*').eq('user_id', session.user.id)
    if (data) setAchievements(data)

    // Load XP
    const { data: profile } = await supabase.from('profiles').select('xp, gorilla_rank').eq('id', session.user.id).single()
    if (profile) {
      const currentXp = profile.xp || 0
      setXp(currentXp)
      setRank(getRank(currentXp))
      setNextRank(getNextRank(currentXp))
    }
  }

  const unlockedKeys = new Set(achievements.map(a => a.achievement_key))
  const unlockedCount = achievements.length
  const totalCount = ACHIEVEMENTS.length
  const progressPct = nextRank ? Math.min(100, Math.round(((xp - rank.minXp) / (nextRank.minXp - rank.minXp)) * 100)) : 100

  const categories = ['milestone', 'streak', 'volume', 'feature', 'social', 'special']
  const categoryLabels = { milestone: '🏁 Milestones', streak: '🔥 Streaks', volume: '🏋️ Volume', feature: '⚡ Features', social: '👥 Social', special: '✨ Special' }

  return (
    <div className="ach-section">
      {/* New unlock toast */}
      {newUnlocks.length > 0 && (
        <div className="ach-toast">
          {newUnlocks.map(a => (
            <div key={a.key} className="ach-toast-item">
              <span className="ach-toast-icon">{a.icon}</span>
              <div>
                <div className="ach-toast-name">🎉 {a.name} Unlocked!</div>
                <div className="ach-toast-desc">{a.desc}</div>
                <div className="ach-toast-xp">+{a.xp} XP</div>
              </div>
            </div>
          ))}
          <button className="ach-toast-close" onClick={() => setNewUnlocks([])}>✕</button>
        </div>
      )}

      {/* Rank card */}
      <div className="ach-rank-card">
        <div className="ach-rank-icon" style={{ fontSize: '48px' }}>{rank.icon}</div>
        <div className="ach-rank-info">
          <div className="ach-rank-name" style={{ color: rank.color }}>{rank.name}</div>
          <div className="ach-rank-xp">{xp} XP • {unlockedCount}/{totalCount} badges</div>
          {nextRank && (
            <div className="ach-rank-progress">
              <div className="ach-rank-bar">
                <div className="ach-rank-fill" style={{ width: `${progressPct}%`, background: nextRank.color }}></div>
              </div>
              <div className="ach-rank-next">{nextRank.minXp - xp} XP to {nextRank.name}</div>
            </div>
          )}
          {!nextRank && <div className="ach-rank-next" style={{ color: rank.color }}>MAX RANK 🦍</div>}
        </div>
      </div>

      {/* Rank progression */}
      <div className="ach-ranks-row">
        {RANKS.map(r => (
          <div key={r.key} className={`ach-rank-step${xp >= r.minXp ? ' unlocked' : ''}`} title={r.name}>
            <div className="ach-rank-step-icon" style={{ opacity: xp >= r.minXp ? 1 : 0.3 }}>{r.icon}</div>
            <div className="ach-rank-step-name" style={{ color: xp >= r.minXp ? r.color : 'var(--tx3)' }}>{r.name.split(' ')[0]}</div>
          </div>
        ))}
      </div>

      <button className="ach-toggle" onClick={() => setShowAll(!showAll)}>
        {showAll ? 'Hide Badges' : `View All Badges (${unlockedCount}/${totalCount})`}
      </button>

      {/* Badge grid */}
      {showAll && (
        <div className="ach-grid-section">
          {categories.map(cat => {
            const items = ACHIEVEMENTS.filter(a => a.category === cat)
            return (
              <div key={cat} className="ach-cat">
                <div className="ach-cat-label">{categoryLabels[cat]}</div>
                <div className="ach-grid">
                  {items.map(a => {
                    const unlocked = unlockedKeys.has(a.key)
                    return (
                      <div key={a.key} className={`ach-badge${unlocked ? ' unlocked' : ''}`} title={a.desc}>
                        <div className="ach-badge-icon">{unlocked ? a.icon : '🔒'}</div>
                        <div className="ach-badge-name">{a.name}</div>
                        <div className="ach-badge-xp">{a.xp} XP</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
