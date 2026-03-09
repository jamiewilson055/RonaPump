import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import Header from './components/Header'
import QuoteBar from './components/QuoteBar'
import WODCard from './components/WODCard'
import Tabs from './components/Tabs'
import WorkoutList from './pages/WorkoutList'
import PRTracker from './pages/PRTracker'
import Stats from './pages/Stats'
import Auth from './components/Auth'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('all')
  const [workouts, setWorkouts] = useState([])
  const [favorites, setFavorites] = useState(new Set())
  const [counts, setCounts] = useState({ total: 0, done: 0, queue: 0, favs: 0 })
  const [loading, setLoading] = useState(true)
  const [showAuth, setShowAuth] = useState(false)

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else { setProfile(null); setFavorites(new Set()) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    loadFavorites(userId)
  }

  async function loadFavorites(userId) {
    const { data } = await supabase.from('user_favorites').select('workout_id').eq('user_id', userId)
    if (data) setFavorites(new Set(data.map(f => f.workout_id)))
  }

  // Load workouts
  useEffect(() => {
    loadWorkouts()
  }, [])

  async function loadWorkouts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('workouts')
      .select('*, performance_log(*)')
      .order('original_date', { ascending: false, nullsFirst: false })
    if (data) {
      setWorkouts(data)
      updateCounts(data)
    }
    setLoading(false)
  }

  const updateCounts = useCallback((wks, favs) => {
    const f = favs || favorites
    const done = wks.filter(w => w.original_date || (w.performance_log && w.performance_log.length > 0)).length
    const queue = wks.filter(w => !w.original_date && (!w.performance_log || w.performance_log.length === 0)).length
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

  return (
    <div className="app">
      <Header counts={counts} session={session} profile={profile} onAuthClick={() => setShowAuth(true)} onSignOut={() => supabase.auth.signOut()} />
      <QuoteBar />
      {tab !== 'prs' && tab !== 'stats' && <WODCard workouts={workouts} />}
      <Tabs tab={tab} setTab={setTab} counts={counts} prsCount={0} />
      {tab === 'prs' ? (
        <PRTracker session={session} onAuthRequired={() => setShowAuth(true)} />
      ) : tab === 'stats' ? (
        <Stats workouts={workouts} favorites={favorites} />
      ) : (
        <WorkoutList
          workouts={workouts}
          tab={tab}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          session={session}
          onAuthRequired={() => setShowAuth(true)}
          onWorkoutsChanged={loadWorkouts}
        />
      )}
      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
    </div>
  )
}

export default App
