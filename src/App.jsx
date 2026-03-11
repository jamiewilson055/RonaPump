import { useState, useEffect, useCallback } from 'react'
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
import SignupGate from './components/SignupGate'
import AdminAnalytics from './pages/AdminAnalytics'
import ActivityFeed from './pages/ActivityFeed'
import ScrollToTop from './components/ScrollToTop'
import './App.css'

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
        <Header counts={counts} session={session} profile={profile} onAuthClick={handleProfileClick} streak={streak} totalCompleted={totalCompleted} onLogoClick={() => { setTab("all"); window.scrollTo({ top: 0, behavior: "smooth" }) }} />
        <Profile
          session={session}
          profile={profile}
          onClose={() => setShowProfile(false)}
          onProfileUpdated={() => loadProfile(session.user.id)}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <Header counts={counts} session={session} profile={profile} onAuthClick={handleProfileClick} streak={streak} totalCompleted={totalCompleted} onLogoClick={() => { setTab("all"); window.scrollTo({ top: 0, behavior: "smooth" }) }} />
      {!session && <Welcome onSignIn={() => setShowAuth(true)} />}
      <QuoteBar isAdmin={profile?.is_admin || false} />
      {tab !== 'prs' && tab !== 'stats' && tab !== 'collections' && tab !== 'activity' && (
        <WODCard workouts={workouts} session={session} onAuthRequired={() => setShowAuth(true)} onWorkoutsChanged={loadWorkouts} favorites={favorites} toggleFavorite={toggleFavorite} />
      )}
      <Tabs tab={tab} setTab={setTab} counts={counts} prsCount={0} collectionsCount={collections.length} />
      {tab === 'prs' ? (
        <PRTracker session={session} onAuthRequired={() => setShowAuth(true)} />
      ) : tab === 'activity' ? (
        <ActivityFeed session={session} onAuthRequired={() => setShowAuth(true)} onNavigateToWorkout={(id, name) => {
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
          <>
            {profile?.is_admin && <AdminAnalytics />}
            <Stats workouts={workouts} favorites={favorites} />
          </>
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
      ) : (
        <>
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
