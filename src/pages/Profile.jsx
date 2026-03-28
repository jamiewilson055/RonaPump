import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const RANKS = [
  { name: 'Baby Gorilla', emoji: '🐒', min: 0 },
  { name: 'Juvenile', emoji: '🦍', min: 50 },
  { name: 'Blackback', emoji: '🦍', min: 150 },
  { name: 'Silverback', emoji: '🦍', min: 400 },
  { name: 'Alpha Silverback', emoji: '👑', min: 800 },
  { name: 'Harambe Legend', emoji: '🏆', min: 1500 },
]

function getRankInfo(xp = 0) {
  let current = RANKS[0]
  let nextRank = RANKS[1]
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].min) {
      current = RANKS[i]
      nextRank = RANKS[i + 1] || null
      break
    }
  }
  const prevMin = current.min
  const nextMin = nextRank ? nextRank.min : current.min
  const progress = nextRank ? ((xp - prevMin) / (nextMin - prevMin)) * 100 : 100
  return { current, nextRank, progress, xpToNext: nextRank ? nextMin - xp : 0 }
}

export default function Profile({ session, profile, onClose, onProfileUpdated }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    display_name: '',
    height: '',
    weight: '',
    age: '',
    hometown: '',
    bio: '',
    weekly_digest: true,
    my_equipment: [],
    instagram_handle: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [wodSubscribed, setWodSubscribed] = useState(false)
  const fileRef = useRef(null)

  // Identity & Social state
  const [socialStats, setSocialStats] = useState({ workouts: 0, followers: 0, following: 0 })
  const [autoTags, setAutoTags] = useState([])

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        height: profile.height || '',
        weight: profile.weight || '',
        age: profile.age || '',
        hometown: profile.hometown || '',
        bio: profile.bio || '',
        weekly_digest: profile.weekly_digest !== false,
        my_equipment: profile.my_equipment || [],
        instagram_handle: profile.instagram_handle || '',
      })
    }
    if (session) {
      loadWodSub()
      loadSocialStats()
      loadAutoTags()
    }
  }, [profile, session])

  async function loadWodSub() {
    const { data } = await supabase.from('email_subscribers').select('subscribed').eq('user_id', session.user.id).single()
    if (data) setWodSubscribed(data.subscribed)
  }

  async function loadSocialStats() {
    try {
      const userId = session.user.id
      const [workoutsRes, followersRes, followingRes] = await Promise.all([
        supabase.from('performance_log').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
      ])
      setSocialStats({
        workouts: workoutsRes.count || 0,
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
      })
    } catch (e) { /* silent */ }
  }

  async function loadAutoTags() {
    try {
      const userId = session.user.id
      const { data } = await supabase
        .from('performance_log')
        .select('workout_id, workouts(workout_types, equipment)')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(100)

      if (!data || data.length === 0) return

      const typeCounts = {}
      const eqCounts = {}
      data.forEach(p => {
        const w = p.workouts
        if (!w) return
        if (w.workout_types) w.workout_types.forEach(t => { typeCounts[t] = (typeCounts[t] || 0) + 1 })
        if (w.equipment) w.equipment.forEach(e => { eqCounts[e] = (eqCounts[e] || 0) + 1 })
      })

      const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0])
      const topEq = Object.entries(eqCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0])
      setAutoTags([...topTypes, ...topEq].slice(0, 4))
    } catch (e) { /* silent */ }
  }

  async function toggleWodSub() {
    const email = session.user.email
    if (!email) return
    if (wodSubscribed) {
      await supabase.from('email_subscribers').update({ subscribed: false }).eq('user_id', session.user.id)
      setWodSubscribed(false)
    } else {
      const { data: existing } = await supabase.from('email_subscribers').select('id').eq('user_id', session.user.id).single()
      if (existing) {
        await supabase.from('email_subscribers').update({ subscribed: true }).eq('user_id', session.user.id)
      } else {
        await supabase.from('email_subscribers').insert({ user_id: session.user.id, email, subscribed: true })
      }
      setWodSubscribed(true)
    }
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')
    const igRaw = form.instagram_handle.trim().replace(/^@/, '')
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: form.display_name || null,
        height: form.height || null,
        weight: form.weight || null,
        age: form.age ? parseInt(form.age) : null,
        hometown: form.hometown || null,
        bio: form.bio || null,
        weekly_digest: form.weekly_digest,
        my_equipment: form.my_equipment.length ? form.my_equipment : [],
        instagram_handle: igRaw || null,
      })
      .eq('id', session.user.id)

    if (error) {
      setMessage('Error saving: ' + error.message)
    } else {
      setMessage('Profile saved!')
      setEditing(false)
      onProfileUpdated()
      setTimeout(() => setMessage(''), 2000)
    }
    setSaving(false)
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return }

    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${session.user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now()

    await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', session.user.id)
    setUploading(false)
    onProfileUpdated()
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    onClose()
  }

  const avatarUrl = profile?.avatar_url
  const initial = (profile?.display_name || session?.user?.email || '?')[0].toUpperCase()
  const xp = profile?.xp || 0
  const rankInfo = getRankInfo(xp)
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null
  const igHandle = profile?.instagram_handle

  return (
    <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mc" style={{ maxWidth: '480px' }}>

        {/* === IDENTITY HERO SECTION === */}
        <div className="prof-hero">
          <div className="prof-hero-top">
            <div className="prof-hero-avatar" onClick={() => fileRef.current?.click()} title="Change profile picture">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="prof-hero-img" />
              ) : (
                <div className="prof-hero-placeholder">{initial}</div>
              )}
              <div className="prof-hero-avatar-overlay">📷</div>
              <div className="prof-hero-rank-badge">{rankInfo.current.emoji}</div>
              <input type="file" ref={fileRef} accept="image/*" onChange={uploadAvatar} style={{ display: 'none' }} />
            </div>
            {uploading && <div style={{ fontSize: '11px', color: 'var(--acc)', marginTop: '4px' }}>Uploading...</div>}
          </div>

          <div className="prof-hero-name">{profile?.display_name || 'Athlete'}</div>
          <div className="prof-hero-rank-title">{rankInfo.current.emoji} {profile?.gorilla_rank || rankInfo.current.name}</div>

          {/* XP Progress Bar */}
          <div className="prof-xp-wrap">
            <div className="prof-xp-bar">
              <div className="prof-xp-fill" style={{ width: `${Math.min(rankInfo.progress, 100)}%` }} />
            </div>
            <div className="prof-xp-label">
              <span>{xp} XP</span>
              {rankInfo.nextRank ? (
                <span>{rankInfo.xpToNext} to {rankInfo.nextRank.name}</span>
              ) : (
                <span>Max Rank!</span>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className="prof-hero-stats">
            <div className="prof-hero-stat">
              <span className="prof-hero-stat-num">{socialStats.workouts}</span>
              <span className="prof-hero-stat-lbl">Workouts</span>
            </div>
            <div className="prof-hero-stat">
              <span className="prof-hero-stat-num">{socialStats.followers}</span>
              <span className="prof-hero-stat-lbl">Followers</span>
            </div>
            <div className="prof-hero-stat">
              <span className="prof-hero-stat-num">{socialStats.following}</span>
              <span className="prof-hero-stat-lbl">Following</span>
            </div>
          </div>

          {/* Bio */}
          {profile?.bio && <div className="prof-hero-bio">{profile.bio}</div>}

          {/* Meta row: Member since, hometown, IG */}
          <div className="prof-hero-meta">
            {memberSince && <span className="prof-hero-meta-item">📅 Joined {memberSince}</span>}
            {profile?.hometown && <span className="prof-hero-meta-item">📍 {profile.hometown}</span>}
            {igHandle && (
              <a className="prof-hero-meta-item prof-hero-ig" href={`https://instagram.com/${igHandle}`} target="_blank" rel="noopener noreferrer">
                📸 @{igHandle}
              </a>
            )}
          </div>

          {/* Auto-generated tags */}
          {autoTags.length > 0 && (
            <div className="prof-hero-tags">
              {autoTags.map(t => <span key={t} className="prof-hero-tag">{t}</span>)}
            </div>
          )}
        </div>

        {/* === END HERO === */}

        {message && (
          <div style={{ fontSize: '12px', color: message.includes('Error') ? 'var(--acc)' : 'var(--grn)', padding: '8px 0' }}>
            {message}
          </div>
        )}

        {editing ? (
          <div className="prof-form">
            <label>Display Name</label>
            <input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="Your name" />

            <label>Instagram Handle</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)', fontSize: '13px', pointerEvents: 'none' }}>@</span>
              <input
                value={form.instagram_handle}
                onChange={e => setForm({ ...form, instagram_handle: e.target.value.replace(/^@/, '') })}
                placeholder="ronapump"
                style={{ paddingLeft: '24px' }}
              />
            </div>

            <label>Height</label>
            <input value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} placeholder="e.g. 5'11&quot; or 180 cm" />

            <label>Weight</label>
            <input value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} placeholder="e.g. 185 lbs or 84 kg" />

            <label>Age</label>
            <input type="number" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} placeholder="e.g. 30" />

            <label>Hometown</label>
            <input value={form.hometown} onChange={e => setForm({ ...form, hometown: e.target.value })} placeholder="e.g. New York, NY" />

            <label>Bio</label>
            <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Tell us about yourself..." style={{ minHeight: '80px' }} />

            <label>🏠 My Gym — Equipment I Have</label>
            <div style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '6px' }}>Select the equipment you have access to. This filters the WOD shuffle, AI generator, and workout list.</div>
            <div className="cr">
              {['Air Bike', 'Barbell', 'Bench', 'Bodyweight', 'Box', 'Dumbbell', 'Jump Rope', 'Kettlebell', 'Medicine Ball', 'Pull-Up Bar', 'Rower', 'Sandbag', 'Ski Erg', 'Sled', 'Weighted Vest'].map(eq => (
                <button key={eq} className={`ch${form.my_equipment.includes(eq) ? ' on' : ''}`}
                  onClick={() => {
                    const arr = [...form.my_equipment]
                    const idx = arr.indexOf(eq)
                    if (idx >= 0) arr.splice(idx, 1); else arr.push(eq)
                    setForm({ ...form, my_equipment: arr })
                  }}>{eq}</button>
              ))}
            </div>

            <div className="prof-digest-toggle">
              <label>
                <input type="checkbox" checked={form.weekly_digest} onChange={e => setForm({ ...form, weekly_digest: e.target.checked })} />
                <span>Receive weekly digest email</span>
              </label>
            </div>

            <div className="mf" style={{ marginTop: '12px' }}>
              <button className="ab" onClick={() => setEditing(false)}>Cancel</button>
              <button className="ab p" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button>
            </div>
          </div>
        ) : (
          <div className="prof-details">
            <div className="prof-row">
              <span className="prof-label">Email</span>
              <span className="prof-value" style={{ fontSize: '12px' }}>{session?.user?.email}</span>
            </div>
            <div className="prof-row">
              <span className="prof-label">Height</span>
              <span className="prof-value">{profile?.height || '—'}</span>
            </div>
            <div className="prof-row">
              <span className="prof-label">Weight</span>
              <span className="prof-value">{profile?.weight || '—'}</span>
            </div>
            <div className="prof-row">
              <span className="prof-label">Age</span>
              <span className="prof-value">{profile?.age || '—'}</span>
            </div>
            <div className="prof-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <span className="prof-label">🏠 My Gym</span>
              {profile?.my_equipment?.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {profile.my_equipment.map(eq => <span key={eq} className="tg te">{eq}</span>)}
                </div>
              ) : (
                <span className="prof-value" style={{ fontSize: '12px', color: 'var(--tx3)' }}>Not set — edit profile to add your equipment</span>
              )}
            </div>
            <div className="prof-row">
              <span className="prof-label">Weekly Digest</span>
              <span className="prof-value">{profile?.weekly_digest !== false ? '✅ Subscribed' : '❌ Not subscribed'}</span>
            </div>
            <div className="prof-row">
              <span className="prof-label">Daily WOD Email</span>
              <button className={`ab${wodSubscribed ? ' p' : ''}`} onClick={toggleWodSub} style={{ padding: '4px 12px', fontSize: '11px' }}>
                {wodSubscribed ? '✅ Subscribed' : 'Subscribe'}
              </button>
            </div>

            <div className="prof-actions">
              <button className="ab p" onClick={() => setEditing(true)} style={{ flex: 1 }}>Edit Profile</button>
              <button className="ab del" onClick={handleSignOut} style={{ opacity: 1 }}>Sign Out</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
