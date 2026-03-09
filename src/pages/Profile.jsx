import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Profile({ session, profile, onClose, onProfileUpdated }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    display_name: '',
    height: '',
    weight: '',
    age: '',
    hometown: '',
    bio: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        height: profile.height || '',
        weight: profile.weight || '',
        age: profile.age || '',
        hometown: profile.hometown || '',
        bio: profile.bio || '',
      })
    }
  }, [profile])

  async function handleSave() {
    setSaving(true)
    setMessage('')
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: form.display_name || null,
        height: form.height || null,
        weight: form.weight || null,
        age: form.age ? parseInt(form.age) : null,
        hometown: form.hometown || null,
        bio: form.bio || null,
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

  async function handleSignOut() {
    await supabase.auth.signOut()
    onClose()
  }

  const initial = (profile?.display_name || session?.user?.email || '?')[0].toUpperCase()

  return (
    <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mc" style={{ maxWidth: '480px' }}>
        <div className="prof-header">
          <div className="prof-avatar">{initial}</div>
          <div className="prof-name-area">
            <h2 style={{ margin: 0, fontSize: '20px' }}>{profile?.display_name || 'Your Profile'}</h2>
            <div style={{ fontSize: '12px', color: 'var(--tx3)', marginTop: '2px' }}>{session?.user?.email}</div>
          </div>
        </div>

        {message && (
          <div style={{ fontSize: '12px', color: message.includes('Error') ? 'var(--acc)' : 'var(--grn)', padding: '8px 0' }}>
            {message}
          </div>
        )}

        {editing ? (
          <div className="prof-form">
            <label>Display Name</label>
            <input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="Your name" />

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

            <div className="mf" style={{ marginTop: '12px' }}>
              <button className="ab" onClick={() => setEditing(false)}>Cancel</button>
              <button className="ab p" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button>
            </div>
          </div>
        ) : (
          <div className="prof-details">
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
            <div className="prof-row">
              <span className="prof-label">Hometown</span>
              <span className="prof-value">{profile?.hometown || '—'}</span>
            </div>
            {profile?.bio && (
              <div className="prof-bio">
                <span className="prof-label">Bio</span>
                <p>{profile.bio}</p>
              </div>
            )}

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
