import { useState, useEffect, useCallback, Component } from 'react'
import { supabase } from './lib/supabase'
import Header from './components/Header'
import QuoteBar from './components/QuoteBar'
import WODCard from './components/WODCard'
import Tabs from './components/Tabs'
import WorkoutList from './pages/WorkoutList'
import PRTracker from './pages/PRTracker'
import Stats from './pages/Stats'
import Collections from './pages/Collections'
import Profile from './pages/Profile'
import Auth from './components/Auth'
import UpdatePassword from './components/UpdatePassword'
import Welcome from './components/Welcome'
import AddToHomeScreen from './components/AddToHomeScreen'
import AdminQueue from './components/AdminQueue'
import AdminAnalytics from './pages/AdminAnalytics'
import SignupGate from './components/SignupGate'
import ActivityFeed from './pages/ActivityFeed'
import DeckOfCards from './components/DeckOfCards'
import AIGenerator from './components/AIGenerator'
import AICoach from './components/AICoach'
import StandaloneTimer from './components/StandaloneTimer'
import BodyMap from './components/BodyMap'
import Longevity from './components/Longevity'
import AchievementDisplay, { checkAndAwardAchievements } from './components/Achievements'
import Challenges from './components/Challenges'
import ScrollToTop from './components/ScrollToTop'
import './App.css'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: '20px', color: 'var(--acc)' }}>
        <h3>Something went wrong</h3>
        <p style={{ fontSize: '12px', color: 'var(--tx3)', marginTop: '8px' }}>{this.state.error?.message || 'Unknown error'}</p>
        <button onClick={() => this.setState({ hasError: false, error: null })} style={{ marginTop: '10px' }} className="ab p">Try Again</button>
      </div>
    }
    return this.props.children
  }
}

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('all')
  const [showProfile, setShowProfile] = useState(false)
  const [workouts, setWorkouts] = useState([])
  const [favorites, setFavorites] = useState(new Set())
  const [counts, setCounts] = useState({ total: 0, done: 0, queue: 0, favs: 0 })
  const [loading, setLoading] = useState(true)
  const [showAuth, setShowAuth] = useState(false)
  const [collections, setCollections] = useState([])
  const [streak, setStreak] = useState(0)
  const [activityHighlight, setActivityHighlight] = useState(null)
  const [sidebarPrompt, setSidebarPrompt] = useState('')
  const [recentActivity, setRecentActivity] = useState([])
  const [weeklyLeaders, setWeeklyLeaders] = useState([])
  const [totalCompleted, setTotalCompleted] = useState(0)
  const [activeWorkout, setActiveWorkout] = useState(null)

  // Check for active workout from previous session
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ronapump_active_workout')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Only show if less than 24 hours old
        if (parsed.startedAt && Date.now() - parsed.startedAt < 86400000) {
          setActiveWorkout(parsed)
        } else {
          localStorage.removeItem('ronapump_active_workout')
        }
      }
    } catch {}
  }, [])

  async function loadCollections(userId) {
    if (!userId) { setCollections([]); return }
    const { data } = await supabase.from('user_collections').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (data) setCollections(data)
  }

  const [showUpdatePassword, setShowUpdatePassword] = useState(false)

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else { setProfile(null); setFavorites(new Set()); setShowProfile(false) }
      if (event === 'PASSWORD_RECOVERY') {
        setShowUpdatePassword(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    loadFavorites(userId)
    loadCollections(userId)
    // Auto-subscribe to daily WOD email if not already subscribed (silent, never blocks)
    try {
      const email = (await supabase.auth.getUser())?.data?.user?.email
      if (email) {
        await supabase.from('email_subscribers').upsert(
          { user_id: userId, email, subscribed: true },
          { onConflict: 'user_id', ignoreDuplicates: true }
        )
      }
    } catch {}
  }

  async function loadFavorites(userId) {
    const { data } = await supabase.from('user_favorites').select('workout_id').eq('user_id', userId)
    if (data) setFavorites(new Set(data.map(f => f.workout_id)))
  }

  // Load workouts
  useEffect(() => {
    loadWorkouts()
  }, [session])

  async function loadWorkouts() {
    setLoading(true)
    let query = supabase
      .from('workouts')
      .select('*, performance_log(*, profiles(display_name))')
      .order('original_date', { ascending: false, nullsFirst: false })

    const { data, error } = await query

    if (data) {
      // Attach display_name to each log entry, keep all logs (communal)
      const userId = session?.user?.id
      const processed = data.map(w => {
        const allLogs = (w.performance_log || []).map(p => ({
          ...p,
          display_name: p.profiles?.display_name || 'Anonymous',
          is_mine: p.user_id === userId,
        }))
        return {
          ...w,
          performance_log: allLogs,
          my_log_count: userId ? allLogs.filter(p => p.user_id === userId).length : 0,
        }
      })
      setWorkouts(processed)
      updateCounts(processed)

      // Calculate streak and total for current user
      if (userId) {
        const allDates = new Set()
        let total = 0
        processed.forEach(w => {
          (w.performance_log || []).forEach(p => {
            if (p.user_id === userId && p.completed_at) {
              allDates.add(p.completed_at)
              total++
            }
          })
        })
        setTotalCompleted(total)

        // Calculate consecutive day streak
        let s = 0
        const today = new Date()
        for (let i = 0; i < 365; i++) {
          const d = new Date(today)
          d.setDate(d.getDate() - i)
          const ds = d.toISOString().slice(0, 10)
          if (allDates.has(ds)) { s++ }
          else if (i > 0) break
          // Allow today to be missing (streak still counts from yesterday)
          else if (i === 0) continue
        }
        setStreak(s)
      }
    }
    setLoading(false)
  }

  const updateCounts = useCallback((wks, favs) => {
    const f = favs || favorites
    const done = wks.filter(w => w.my_log_count > 0).length
    const queue = wks.filter(w => !w.my_log_count || w.my_log_count === 0).length
    setCounts({ total: wks.length, done, queue, favs: f.size })
  }, [favorites])

  useEffect(() => {
    if (workouts.length) updateCounts(workouts, favorites)
  }, [workouts, favorites, updateCounts])

  async function loadRecentActivity() {
    const { data } = await supabase
      .from('performance_log')
      .select('id, score, completed_at, workouts(name), profiles(display_name)')
      .order('created_at', { ascending: false })
      .limit(3)
    if (data) setRecentActivity(data)
  }

  useEffect(() => { loadRecentActivity(); loadWeeklyLeaders() }, [])

  async function loadWeeklyLeaders() {
    const startOfWeek = new Date()
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('performance_log')
      .select('user_id, profiles(display_name, avatar_url)')
      .gte('created_at', startOfWeek.toISOString())
    if (data) {
      const counts = {}
      data.forEach(d => {
        const id = d.user_id
        if (!counts[id]) counts[id] = { id, name: d.profiles?.display_name || 'Anonymous', avatar: d.profiles?.avatar_url, count: 0 }
        counts[id].count++
      })
      setWeeklyLeaders(Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5))
    }
  }

  // Compute "my week" — 7-day heatmap
  const myWeek = (() => {
    if (!session) return []
    const today = new Date()
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      const ds = d.toISOString().slice(0, 10)
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' })
      const count = workouts.filter(w => {
        const logs = w.performance_log || []
        return logs.some(l => l.user_id === session.user.id && l.completed_at === ds)
      }).length
      days.push({ label: dayLabel, date: ds, count })
    }
    return days
  })()

  async function toggleFavorite(workoutId) {
    if (!session) { setShowAuth(true); return }
    const userId = session.user.id
    const newFavs = new Set(favorites)
    if (newFavs.has(workoutId)) {
      newFavs.delete(workoutId)
      await supabase.from('user_favorites').delete().eq('user_id', userId).eq('workout_id', workoutId)
    } else {
      newFavs.add(workoutId)
      await supabase.from('user_favorites').insert({ user_id: userId, workout_id: workoutId })
    }
    setFavorites(newFavs)
  }

  function handleProfileClick() {
    if (session) {
      setShowProfile(true)
    } else {
      setShowAuth(true)
    }
  }

  function handleNotifNavigate(link) {
    if (!link) return
    if (link.startsWith('activity:')) {
      const parts = link.split(':')
      setActivityHighlight(null)
      setTimeout(() => { setActivityHighlight(parts[1]); setTab('activity') }, 0)
    } else if (link === 'h2h' || link.startsWith('challenge')) {
      setTab('activity')
    } else if (link === 'stats') {
      setTab('stats')
    } else if (link.startsWith('/workout/')) {
      window.location.href = link
    } else {
      setTab('all')
    }
    setShowProfile(false)
  }

  if (showProfile && session) {
    return (
      <div className="app">
        <Header counts={counts} session={session} profile={profile} onAuthClick={handleProfileClick} streak={streak} totalCompleted={totalCompleted} onLogoClick={() => { setTab("all"); window.scrollTo({ top: 0, behavior: "smooth" }) }} onNotifNavigate={handleNotifNavigate} />
        <Profile
          session={session}
          profile={profile}
          onClose={() => setShowProfile(false)}
          onProfileUpdated={() => loadProfile(session.user.id)}
        />
      </div>
    )
  }

  const isMainTab = ['all', 'done', 'queue', 'favs'].includes(tab)
  const isFeatureTab = ['deck', 'ai', 'ai-coach', 'timer', 'longevity', 'h2h', 'prs', 'activity', 'stats', 'collections', 'train', 'track', 'social'].includes(tab)

  const SECTION_META = {
    train:       { label: 'Train',          back: 'all',    backLabel: 'Workouts' },
    track:       { label: 'Track',          back: 'all',    backLabel: 'Workouts' },
    social:      { label: 'Social',         back: 'all',    backLabel: 'Workouts' },
    ai:          { label: 'AI Generator',   back: 'train',  backLabel: 'Train' },
    'ai-coach':  { label: 'AI Coach',       back: 'train',  backLabel: 'Train' },
    deck:        { label: 'Deck of Cards',  back: 'train',  backLabel: 'Train' },
    timer:       { label: 'Timer',          back: 'train',  backLabel: 'Train' },
    longevity:   { label: 'Longevity',      back: 'track',  backLabel: 'Track' },
    prs:         { label: 'Strength',       back: 'track',  backLabel: 'Track' },
    stats:       { label: 'Stats',          back: 'track',  backLabel: 'Track' },
    collections: { label: 'Collections',    back: 'track',  backLabel: 'Track' },
    activity:    { label: 'Activity Feed',  back: 'social', backLabel: 'Social' },
    h2h:         { label: 'H2H Challenges', back: 'social', backLabel: 'Social' },
  }
  const sectionMeta = SECTION_META[tab]

  return (
    <div className="app">
      <Header counts={counts} session={session} profile={profile} onAuthClick={handleProfileClick} streak={streak} totalCompleted={totalCompleted} onLogoClick={() => { setTab("all"); window.scrollTo({ top: 0, behavior: "smooth" }) }} onNotifNavigate={handleNotifNavigate} />
      {!session && <Welcome onSignIn={() => setShowAuth(true)} />}

      {/* Continue where you left off banner */}
      {activeWorkout && (
        <div className="resume-banner">
          <div className="resume-left">
            <span className="resume-icon">🏋</span>
            <div>
              <div className="resume-title">Pick up where you left off</div>
              <div className="resume-name">{activeWorkout.name}</div>
            </div>
          </div>
          <div className="resume-actions">
            <button className="ab p" onClick={() => {
              window.location.href = `/workout/${activeWorkout.slug}`
            }} style={{ padding: '6px 14px', fontSize: '12px' }}>Resume</button>
            <button className="ab" onClick={() => {
              setActiveWorkout(null)
              try { localStorage.removeItem('ronapump_active_workout') } catch {}
            }} style={{ padding: '6px 10px', fontSize: '12px' }}>✕</button>
          </div>
        </div>
      )}

      {/* Hero Feature Cards — desktop only, on main tabs */}
      {isMainTab && (
        <div className="hero-features desktop-only">
          <button className="hero-card hero-ai" onClick={() => setTab('train')}>
            <span className="hero-icon">⚡</span>
            <div>
              <div className="hero-title">Train</div>
              <div className="hero-sub">AI generator, deck of cards, timer</div>
            </div>
          </button>
          <button className="hero-card hero-deck" onClick={() => setTab('track')}>
            <span className="hero-icon">📊</span>
            <div>
              <div className="hero-title">Track</div>
              <div className="hero-sub">Longevity, strength, stats, collections</div>
            </div>
          </button>
          <button className="hero-card hero-h2h" onClick={() => setTab('social')}>
            <span className="hero-icon">👥</span>
            <div>
              <div className="hero-title">Social</div>
              <div className="hero-sub">Activity feed, H2H challenges</div>
            </div>
          </button>
        </div>
      )}

      <div className={['deck','ai','ai-coach','prs','h2h','timer','longevity','train','track','social'].includes(tab) ? 'mobile-hide' : ''}>
        <QuoteBar isAdmin={profile?.is_admin || false} />
      </div>

      {/* Bigger secondary tabs — desktop only */}
      <Tabs tab={tab} setTab={setTab} counts={counts} prsCount={0} collectionsCount={collections.length} hideMainOnMobile={['deck','ai','ai-coach','prs','h2h','timer','longevity','train','track','social'].includes(tab)} />

      {/* Two-column layout on desktop for main workout tabs */}
      {isMainTab ? (
        <div className="desktop-layout">
          <div className="desktop-main">
            {tab !== 'prs' && tab !== 'stats' && tab !== 'collections' && tab !== 'activity' && tab !== 'deck' && tab !== 'ai' && tab !== 'ai-coach' && tab !== 'h2h' && tab !== 'timer' && tab !== 'longevity' && (
              <WODCard workouts={workouts} session={session} profile={profile} onAuthRequired={() => setShowAuth(true)} onWorkoutsChanged={loadWorkouts} favorites={favorites} toggleFavorite={toggleFavorite} isAdmin={profile?.is_admin || false} collections={collections} onCollectionsChanged={() => session && loadCollections(session.user.id)} />
            )}
            {(profile?.is_admin) && tab === 'all' && <AdminQueue onWorkoutsChanged={loadWorkouts} />}
            <WorkoutList
              workouts={workouts}
              tab={tab}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              session={session}
              profile={profile}
              isAdmin={profile?.is_admin || false}
              onAuthRequired={() => setShowAuth(true)}
              onWorkoutsChanged={loadWorkouts}
              collections={collections}
              onCollectionsChanged={() => session && loadCollections(session.user.id)}
            />
          </div>

          {/* Sticky sidebar — desktop only */}
          <div className="desktop-sidebar desktop-only">
            {/* Desktop Feature Nav — grouped */}
            <div className="sidebar-card sidebar-nav">
              <div className="sidebar-nav-label">⚡ Train</div>
              <div className="sidebar-nav-grid">
                <button className={`sidebar-nav-btn${tab === 'ai' ? ' on' : ''}`} onClick={() => setTab('ai')}>🤖 AI Gen</button>
                <button className={`sidebar-nav-btn${tab === 'ai-coach' ? ' on' : ''}`} onClick={() => setTab('ai-coach')}>🧠 Coach</button>
                <button className={`sidebar-nav-btn${tab === 'deck' ? ' on' : ''}`} onClick={() => setTab('deck')}>🃏 Deck</button>
                <button className={`sidebar-nav-btn${tab === 'timer' ? ' on' : ''}`} onClick={() => setTab('timer')}>⏱ Timer</button>
              </div>
              <div className="sidebar-nav-label" style={{ marginTop: '8px' }}>📊 Track</div>
              <div className="sidebar-nav-grid">
                <button className={`sidebar-nav-btn${tab === 'longevity' ? ' on' : ''}`} onClick={() => setTab('longevity')}>🧬 Longevity</button>
                <button className={`sidebar-nav-btn${tab === 'prs' ? ' on' : ''}`} onClick={() => setTab('prs')}>💪 Strength</button>
                <button className={`sidebar-nav-btn${tab === 'stats' ? ' on' : ''}`} onClick={() => setTab('stats')}>📊 Stats</button>
                <button className={`sidebar-nav-btn${tab === 'collections' ? ' on' : ''}`} onClick={() => setTab('collections')}>📁 Collections</button>
              </div>
              <div className="sidebar-nav-label" style={{ marginTop: '8px' }}>👥 Social</div>
              <div className="sidebar-nav-grid">
                <button className={`sidebar-nav-btn${tab === 'activity' ? ' on' : ''}`} onClick={() => { setActivityHighlight(null); setTab('activity') }}>👥 Activity</button>
                <button className={`sidebar-nav-btn${tab === 'h2h' ? ' on' : ''}`} onClick={() => setTab('h2h')}>⚔️ H2H</button>
              </div>
            </div>

            {/* Body Map */}
            {session ? <BodyMap session={session} /> : <BodyMap preview />}

            {/* Your Week */}
            {session && (
              <div className="sidebar-card">
                <div className="sidebar-label">🗓 Your Week</div>
                <div className="sidebar-week">
                  {myWeek.map(d => (
                    <div key={d.date} className="sidebar-day">
                      <div className={`sidebar-day-dot${d.count > 0 ? ' active' : ''}${d.count > 1 ? ' multi' : ''}`}>{d.count > 0 ? '✓' : ''}</div>
                      <div className="sidebar-day-label">{d.label}</div>
                    </div>
                  ))}
                </div>
                <div className="sidebar-week-summary">
                  <span>{myWeek.filter(d => d.count > 0).length}/7 days</span>
                  {streak > 0 && <span>🔥 {streak} day streak</span>}
                </div>
              </div>
            )}

            {/* This Week's Leaders */}
            {weeklyLeaders.length > 0 && (
              <div className="sidebar-card">
                <div className="sidebar-label">🏆 This Week's Leaders</div>
                {weeklyLeaders.map((l, i) => (
                  <div key={l.id} className="sidebar-leader">
                    <span className="sidebar-leader-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                    <span className="sidebar-leader-name">{l.name}</span>
                    <span className="sidebar-leader-count">{l.count} workout{l.count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Activity */}
            {recentActivity.length > 0 && (
              <div className="sidebar-card">
                <div className="sidebar-label">👥 Recent Activity</div>
                {recentActivity.map(a => (
                  <div key={a.id} className="sidebar-activity-item">
                    <span className="sidebar-activity-name">{a.profiles?.display_name || 'Someone'}</span>
                    {a.score ? <> logged <b>{a.score}</b> on </> : <> completed </>}
                    <span className="sidebar-activity-wod">{a.workouts?.name || 'a workout'}</span>
                  </div>
                ))}
                <button className="sidebar-link" onClick={() => { setActivityHighlight(null); setTab('activity') }}>View All Activity →</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Section Back Bar */}
          {sectionMeta && (
            <div className="section-back-bar">
              <button className="section-back-btn" onClick={() => setTab(sectionMeta.back)}>
                ← {sectionMeta.backLabel}
              </button>
              <span className="section-back-title">{sectionMeta.label}</span>
            </div>
          )}
          {tab === 'train' ? (
            <div className="group-landing">
              <h3 className="group-title">⚡ Train</h3>
              <div className="group-grid">
                <button className="group-card" onClick={() => setTab('ai')}>
                  <span className="group-card-icon">🤖</span>
                  <div className="group-card-name">AI Generator</div>
                  <div className="group-card-desc">Describe what you want — we build it</div>
                </button>
                <button className="group-card" onClick={() => setTab('ai-coach')}>
                  <span className="group-card-icon">🧠</span>
                  <div className="group-card-name">AI Coach</div>
                  <div className="group-card-desc">Daily smart picks based on your history</div>
                </button>
                <button className="group-card" onClick={() => setTab('deck')}>
                  <span className="group-card-icon">🃏</span>
                  <div className="group-card-name">Deck of Cards</div>
                  <div className="group-card-desc">Card-driven random workouts</div>
                </button>
                <button className="group-card" onClick={() => setTab('timer')}>
                  <span className="group-card-icon">⏱</span>
                  <div className="group-card-name">Timer</div>
                  <div className="group-card-desc">AMRAP, EMOM, Tabata & more</div>
                </button>
              </div>
            </div>
          ) : tab === 'track' ? (
            <div className="group-landing">
              <h3 className="group-title">📊 Track</h3>
              <div className="group-grid">
                <button className="group-card" onClick={() => setTab('longevity')}>
                  <span className="group-card-icon">🧬</span>
                  <div className="group-card-name">Longevity</div>
                  <div className="group-card-desc">Track your Vital Age & longevity markers</div>
                </button>
                <button className="group-card" onClick={() => setTab('prs')}>
                  <span className="group-card-icon">💪</span>
                  <div className="group-card-name">Strength</div>
                  <div className="group-card-desc">PRs, 1RM calculator & records</div>
                </button>
                <button className="group-card" onClick={() => setTab('stats')}>
                  <span className="group-card-icon">📊</span>
                  <div className="group-card-name">Stats</div>
                  <div className="group-card-desc">Heatmap, streaks, leaderboard{streak > 0 ? ` · 🔥${streak}` : ''}</div>
                </button>
                <button className="group-card" onClick={() => setTab('collections')}>
                  <span className="group-card-icon">📁</span>
                  <div className="group-card-name">Collections</div>
                  <div className="group-card-desc">Your saved workout playlists</div>
                </button>
              </div>
            </div>
          ) : tab === 'social' ? (
            <div className="group-landing">
              <h3 className="group-title">👥 Social</h3>
              <div className="group-grid">
                <button className="group-card" onClick={() => { setActivityHighlight(null); setTab('activity') }}>
                  <span className="group-card-icon">👥</span>
                  <div className="group-card-name">Activity Feed</div>
                  <div className="group-card-desc">See what others are doing & find athletes</div>
                </button>
                <button className="group-card" onClick={() => setTab('h2h')}>
                  <span className="group-card-icon">⚔️</span>
                  <div className="group-card-name">H2H Challenges</div>
                  <div className="group-card-desc">Challenge friends head-to-head</div>
                </button>
              </div>
            </div>
          ) : tab === 'deck' ? (
            <DeckOfCards session={session} onAuthRequired={() => setShowAuth(true)} onWorkoutsChanged={loadWorkouts} isAdmin={profile?.is_admin || false} />
          ) : tab === 'ai' ? (
            <AIGenerator session={session} profile={profile} onAuthRequired={() => setShowAuth(true)} isAdmin={profile?.is_admin || false} onWorkoutsChanged={loadWorkouts} />
          ) : tab === 'ai-coach' ? (
            <AICoach session={session} onAuthRequired={() => setShowAuth(true)} onWorkoutsChanged={loadWorkouts} />
          ) : tab === 'h2h' ? (
            <Challenges session={session} onAuthRequired={() => setShowAuth(true)} workouts={workouts} />
          ) : tab === 'timer' ? (
            <StandaloneTimer session={session} onAuthRequired={() => setShowAuth(true)} />
          ) : tab === 'longevity' ? (
            <Longevity session={session} onAuthRequired={() => setShowAuth(true)} />
          ) : tab === 'prs' ? (
            <PRTracker session={session} onAuthRequired={() => setShowAuth(true)} />
          ) : tab === 'activity' ? (
            <ActivityFeed session={session} onAuthRequired={() => setShowAuth(true)} highlightId={activityHighlight} workouts={workouts} onNavigateToWorkout={(id, name) => {
              if (name) {
                const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                window.location.href = '/workout/' + slug
              } else {
                setTab('all')
                setTimeout(() => {
                  const el = document.getElementById('wc-' + id)
                  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.click() }
                }, 200)
              }
            }} />
          ) : tab === 'stats' ? (
            session ? (
              <ErrorBoundary>
                {profile?.is_admin && <AdminAnalytics />}
                <AchievementDisplay session={session} />
                <Stats workouts={workouts} favorites={favorites} />
              </ErrorBoundary>
            ) : (
              <div className="pr-section">
                <div className="pr-empty">
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
                  <b>Sign in</b> to view your stats, streaks, and workout analytics.
                  <br /><button className="ab p" style={{ marginTop: '12px' }} onClick={() => setShowAuth(true)}>Sign In</button>
                </div>
              </div>
            )
          ) : tab === 'collections' ? (
            <Collections session={session} onAuthRequired={() => setShowAuth(true)} workouts={workouts} />
          ) : null}
        </>
      )}
      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
      {showUpdatePassword && <UpdatePassword onClose={() => setShowUpdatePassword(false)} />}
      <AddToHomeScreen />
      {!session && <SignupGate onSignIn={() => setShowAuth(true)} />}
      <ScrollToTop />
    </div>
  )
}

export default App
