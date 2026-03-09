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
      .select('*, performance_log(*)')
      .order('original_date', { ascending: false, nullsFirst: false })

    const { data, error } = await query

    if (data) {
      // Filter performance logs to current user only
      const userId = session?.user?.id
      const filtered = data.map(w => ({
        ...w,
        performance_log: userId
          ? (w.performance_log || []).filter(p => p.user_id === userId)
          : []
      }))
      setWorkouts(filtered)
      updateCounts(filtered)
    }
    setLoading(false)
  }

  const updateCounts = useCallback((wks, favs) => {
    const f = favs || favorites
    const done = wks.filter(w => w.performance_log && w.performance_log.length > 0).length
    const queue = wks.filter(w => !w.performance_log || w.performance_log.length === 0).length
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
        <Header counts={counts} session={session} profile={profile} onAuthClick={handleProfileClick} />
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
      <Header counts={counts} session={session} profile={profile} onAuthClick={handleProfileClick} />
      {!session && <Welcome onSignIn={() => setShowAuth(true)} />}
      <QuoteBar isAdmin={profile?.is_admin || false} />
      {tab !== 'prs' && tab !== 'stats' && tab !== 'collections' && <WODCard workouts={workouts} />}
      <Tabs tab={tab} setTab={setTab} counts={counts} prsCount={0} collectionsCount={collections.length} />
      {tab === 'prs' ? (
        <PRTracker session={session} onAuthRequired={() => setShowAuth(true)} />
      ) : tab === 'stats' ? (
        <Stats workouts={workouts} favorites={favorites} />
      ) : tab === 'collections' ? (
        <Collections session={session} onAuthRequired={() => setShowAuth(true)} workouts={workouts} />
      ) : (
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
      )}
      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
      {showUpdatePassword && <UpdatePassword onClose={() => setShowUpdatePassword(false)} />}
    </div>
  )
}

export default App
