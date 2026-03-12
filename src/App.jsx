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
import StandaloneTimer from './components/StandaloneTimer'
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
  const [totalCompleted, setTotalCompleted] = useState(0)

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

  useEffect(() => { loadRecentActivity() }, [])

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

  if (showProfile && session) {
    return (
      <div className="app">
        <Header counts={counts} session={session} profile={profile} onAuthClick={handleProfileClick} streak={streak} totalCompleted={totalCompleted} onLogoClick={() => { setTab("all"); window.scrollTo({ top: 0, behavior: "smooth" }) }} onStatsClick={() => setTab("stats")} onActivityClick={() => { setActivityHighlight(null); setTab("activity") }} onH2HClick={() => setTab("h2h")} onCollectionsClick={() => setTab("collections")} onNotifNavigate={(link) => { if (link.startsWith("activity:")) { const parts = link.split(":"); setActivityHighlight(parts[1]); setTab("activity") } }} />
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
  const isFeatureTab = ['deck', 'ai', 'timer', 'h2h', 'prs', 'activity', 'stats', 'collections'].includes(tab)

  return (
    <div className="app">
      <Header counts={counts} session={session} profile={profile} onAuthClick={handleProfileClick} streak={streak} totalCompleted={totalCompleted} onLogoClick={() => { setTab("all"); window.scrollTo({ top: 0, behavior: "smooth" }) }} onStatsClick={() => setTab("stats")} onActivityClick={() => { setActivityHighlight(null); setTab("activity") }} onH2HClick={() => setTab("h2h")} onCollectionsClick={() => setTab("collections")} onNotifNavigate={(link) => { if (link.startsWith("activity:")) { const parts = link.split(":"); setActivityHighlight(parts[1]); setTab("activity") } }} />
      {!session && <Welcome onSignIn={() => setShowAuth(true)} />}

      {/* Hero Feature Cards — desktop only, on main tabs */}
      {isMainTab && (
        <div className="hero-features desktop-only">
          <button className="hero-card hero-ai" onClick={() => setTab('ai')}>
            <span className="hero-icon">🤖</span>
            <div>
              <div className="hero-title">AI Workout Generator</div>
              <div className="hero-sub">Describe what you want — we build it</div>
            </div>
          </button>
          <button className="hero-card hero-deck" onClick={() => setTab('deck')}>
            <span className="hero-icon">🃏</span>
            <div>
              <div className="hero-title">Deck of Cards</div>
              <div className="hero-sub">Flip, rep, survive the whole deck</div>
            </div>
          </button>
          <button className="hero-card hero-h2h" onClick={() => setTab('timer')}>
            <span className="hero-icon">⏱</span>
            <div>
              <div className="hero-title">Workout Timer</div>
              <div className="hero-sub">AMRAP, Tabata, EMOM & more</div>
            </div>
          </button>
        </div>
      )}

      <div className={['deck','ai','prs','h2h','timer'].includes(tab) ? 'mobile-hide' : ''}>
        <QuoteBar isAdmin={profile?.is_admin || false} />
      </div>

      {/* Bigger secondary tabs — desktop only */}
      <Tabs tab={tab} setTab={setTab} counts={counts} prsCount={0} collectionsCount={collections.length} hideMainOnMobile={['deck','ai','prs','h2h','timer'].includes(tab)} />

      {/* Two-column layout on desktop for main workout tabs */}
      {isMainTab ? (
        <div className="desktop-layout">
          <div className="desktop-main">
            {tab !== 'prs' && tab !== 'stats' && tab !== 'collections' && tab !== 'activity' && tab !== 'deck' && tab !== 'ai' && tab !== 'h2h' && tab !== 'timer' && (
              <WODCard workouts={workouts} session={session} onAuthRequired={() => setShowAuth(true)} onWorkoutsChanged={loadWorkouts} favorites={favorites} toggleFavorite={toggleFavorite} />
            )}
            {(profile?.is_admin) && tab === 'all' && <AdminQueue onWorkoutsChanged={loadWorkouts} />}
            <WorkoutList
              workouts={workouts}
              tab={tab}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              session={session}
              isAdmin={profile?.is_admin || false}
              onAuthRequired={() => setShowAuth(true)}
              onWorkoutsChanged={loadWorkouts}
              collections={collections}
              onCollectionsChanged={() => session && loadCollections(session.user.id)}
            />
          </div>

          {/* Sticky sidebar — desktop only */}
          <div className="desktop-sidebar desktop-only">
            <div className="sidebar-card sidebar-ai">
              <div className="sidebar-label">🤖 AI Workout Generator</div>
              <input className="sidebar-ai-input" value={sidebarPrompt} onChange={e => setSidebarPrompt(e.target.value)}
                placeholder="e.g. 20 min dumbbell AMRAP..." onKeyDown={e => { if (e.key === 'Enter' && sidebarPrompt.trim()) { setTab('ai') } }} />
              <div className="sidebar-ai-quicks">
                {['Quick Burn', 'DB Only', 'Hotel Room', 'Leg Day'].map(q => (
                  <button key={q} className="sidebar-ai-quick" onClick={() => { setSidebarPrompt(q); setTab('ai') }}>{q}</button>
                ))}
              </div>
              <button className="sidebar-ai-btn" onClick={() => setTab('ai')}>Generate →</button>
            </div>

            <div className="sidebar-card">
              <div className="sidebar-label">⏱ Quick Timer</div>
              <div className="sidebar-timer-grid">
                <button className="sidebar-timer-btn" onClick={() => setTab('timer')}>AMRAP</button>
                <button className="sidebar-timer-btn" onClick={() => setTab('timer')}>Tabata</button>
                <button className="sidebar-timer-btn" onClick={() => setTab('timer')}>EMOM</button>
                <button className="sidebar-timer-btn" onClick={() => setTab('timer')}>Custom</button>
              </div>
            </div>

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
          {tab === 'deck' ? (
            <DeckOfCards session={session} onAuthRequired={() => setShowAuth(true)} onWorkoutsChanged={loadWorkouts} isAdmin={profile?.is_admin || false} />
          ) : tab === 'ai' ? (
            <AIGenerator session={session} onAuthRequired={() => setShowAuth(true)} isAdmin={profile?.is_admin || false} onWorkoutsChanged={loadWorkouts} />
          ) : tab === 'h2h' ? (
            <Challenges session={session} onAuthRequired={() => setShowAuth(true)} workouts={workouts} />
          ) : tab === 'timer' ? (
            <StandaloneTimer session={session} onAuthRequired={() => setShowAuth(true)} />
          ) : tab === 'prs' ? (
            <PRTracker session={session} onAuthRequired={() => setShowAuth(true)} />
          ) : tab === 'activity' ? (
            <ActivityFeed session={session} onAuthRequired={() => setShowAuth(true)} highlightId={activityHighlight} onNavigateToWorkout={(id, name) => {
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
