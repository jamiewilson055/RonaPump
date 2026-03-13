import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './lib/supabase'
import Header from './components/Header'
import QuoteBar from './components/QuoteBar'
import WODCard from './components/WODCard'
import Tabs from './components/Tabs'
import WorkoutList from './pages/WorkoutList'
import PRTracker from './pages/PRTracker'
import Stats from './pages/Stats'
import Profile from './pages/Profile'
import Auth from './components/Auth'
import UpdatePassword from './components/UpdatePassword'
import './App.css'

// Shared slug helper — used across components
export function toSlug(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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
  const [showUpdatePassword, setShowUpdatePassword] = useState(false)
  const [collections, setCollections] = useState([])
  const [streak, setStreak] = useState(0)
  const [totalCompleted, setTotalCompleted] = useState(0)

  const isAdmin = profile?.is_admin || false

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else { setProfile(null); setFavorites(new Set()); setShowProfile(false); setCollections([]) }
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
    loadStreakAndTotal(userId)
  }

  async function loadFavorites(userId) {
    const { data } = await supabase.from('user_favorites').select('workout_id').eq('user_id', userId)
    if (data) setFavorites(new Set(data.map(f => f.workout_id)))
  }

  async function loadCollections(userId) {
    const { data } = await supabase.from('user_collections').select('*').eq('user_id', userId).order('name')
    if (data) setCollections(data)
  }

  async function loadStreakAndTotal(userId) {
    const { data: logs } = await supabase
      .from('performance_log')
      .select('completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(400)

    if (logs) {
      // Total unique completions
      setTotalCompleted(logs.length)

      // Compute streak
      const dates = new Set(logs.map(l => l.completed_at))
      let s = 0
      const today = new Date()
      for (let i = 0; i < 365; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const ds = d.toISOString().slice(0, 10)
        if (dates.has(ds)) s++
        else if (i > 0) break
      }
      setStreak(s)
    }
  }

  // Load workouts — BUG FIX #1: filter by visibility
  useEffect(() => {
    loadWorkouts()
  }, [session])

  async function loadWorkouts() {
    setLoading(true)
    const userId = session?.user?.id

    let query = supabase
      .from('workouts')
      .select('*, performance_log(*)')
      .order('original_date', { ascending: false, nullsFirst: false })

    // Visibility filter: show official + community to everyone,
    // private/pending only to the creator
    if (userId) {
      query = query.or(`visibility.eq.official,visibility.eq.community,and(visibility.in.(private,pending),created_by.eq.${userId})`)
    } else {
      query = query.in('visibility', ['official', 'community'])
    }

    const { data, error } = await query

    if (data) {
      const filtered = data.map(w => ({
        ...w,
        performance_log: userId
          ? (w.performance_log || []).filter(p => p.user_id === userId)
          : []
      }))
      setWorkouts(filtered)
    }
    setLoading(false)
  }

  // BUG FIX #2: updateCounts no longer depends on favorites via closure.
  // It always receives both args explicitly from the effect below.
  const updateCounts = useCallback((wks, favs) => {
    const done = wks.filter(w => w.performance_log && w.performance_log.length > 0).length
    const queue = wks.filter(w => !w.performance_log || w.performance_log.length === 0).length
    setCounts({ total: wks.length, done, queue, favs: favs.size })
  }, [])

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

  function handleAuthRequired() {
    setShowAuth(true)
  }

  // Shared header props — FIX #4: wire all 12 props Header expects
  const headerProps = {
    counts,
    session,
    profile,
    onAuthClick: handleProfileClick,
    streak,
    totalCompleted,
    onLogoClick: () => { setTab('all'); setShowProfile(false) },
    onStatsClick: () => setTab('stats'),
    onActivityClick: () => setTab('activity'),
    onH2HClick: () => setTab('activity'),
    onCollectionsClick: () => setTab('collections'),
    onTimerClick: () => setTab('timer'),
    onDeckClick: () => setTab('deck'),
    onNotifNavigate: (link) => {
      if (!link) { setTab('all'); return }
      if (link.startsWith('activity:') || link === 'h2h' || link.startsWith('challenge')) {
        setTab('activity')
      } else if (link === 'stats') {
        setTab('stats')
      } else if (link.startsWith('/workout/')) {
        window.location.href = link
      } else {
        setTab('all')
      }
    },
  }

  if (showProfile && session) {
    return (
      <div className="app">
        <Header {...headerProps} />
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
      <Header {...headerProps} />
      <QuoteBar isAdmin={isAdmin} />
      {/* FIX #5: Wire all props WODCard expects */}
      {tab !== 'prs' && tab !== 'stats' && (
        <WODCard
          workouts={workouts}
          session={session}
          onAuthRequired={handleAuthRequired}
          onWorkoutsChanged={loadWorkouts}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          isAdmin={isAdmin}
          collections={collections}
          onCollectionsChanged={() => session && loadCollections(session.user.id)}
        />
      )}
      <Tabs tab={tab} setTab={setTab} counts={counts} prsCount={0} />
      {tab === 'prs' ? (
        <PRTracker session={session} onAuthRequired={handleAuthRequired} />
      ) : tab === 'stats' ? (
        <Stats workouts={workouts} favorites={favorites} />
      ) : (
        <WorkoutList
          workouts={workouts}
          tab={tab}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          session={session}
          isAdmin={isAdmin}
          onAuthRequired={handleAuthRequired}
          onWorkoutsChanged={loadWorkouts}
        />
      )}
      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
      {showUpdatePassword && <UpdatePassword onClose={() => setShowUpdatePassword(false)} />}
    </div>
  )
}

export default App
