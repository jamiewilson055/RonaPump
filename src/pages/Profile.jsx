import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Profile({ session, profile, onProfileUpdated, onClose }) {
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [age, setAge] = useState('')
  const [hometown, setHometown] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setHeight(profile.height || '')
      setWeight(profile.weight || '')
      setAge(profile.age || '')
      setHometown(profile.hometown || '')
      setBio(profile.bio || '')
      setAvatarUrl(profile.avatar_url || '')
    }
  }, [profile])

  async function handleSave() {
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('profiles').update({
      display_name: displayName.trim() || null,
      height: height.trim() || null,
      weight: weight.trim() || null,
      age: age ? parseInt(age) : null,
      hometown: hometown.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl || null,
    }).eq('id', session.user.id)

    if (error) {
      setMessage('Error saving: ' + error.message)
    } else {
      setMessage('Profile saved!')
      setEditing(false)
      if (onProfileUpdated) onProfileUpdated()
    }
    setSaving(false)
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    const ext = file.name.split('.').pop()
    const fileName = `${session.user.id}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
      setMessage('Upload error: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
    setAvatarUrl(data.publicUrl)
    setUploading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    onClose()
  }

  if (!profile) return null

  return (
    <div className="profile-page">
      <div className="profile-back" onClick={onClose}>&larr; Back</div>
      <div className="profile-card">
        <div className="profile-top">
          <div className="profile-avatar-wrap">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="profile-avatar" />
            ) : (
              <div className="profile-avatar-placeholder">
                {(displayName || session.user.email)[0].toUpperCase()}
              </div>
            )}
            {editing && (
              <label className="profile-avatar-edit">
                &#128247;
                <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
              </label>
            )}
            {uploading && <div style={{ fontSize: '10px', color: 'var(--tx3)', marginTop: '4px' }}>Uploading...</div>}
          </div>
          <div className="profile-name-area">
            <h2>{profile.display_name || session.user.email.split('@')[0]}</h2>
            <div className="profile-email">{session.user.email}</div>
            {profile.bio && !editing && <div className="profile-bio">{profile.bio}</div>}
          </div>
        </div>

        {!editing ? (
          <>
            <div className="profile-details">
              <div className="profile-detail">
                <span className="pd-label">Height</span>
                <span className="pd-value">{profile.height || '\u2014'}</span>
              </div>
              <div className="profile-detail">
                <span className="pd-label">Weight</span>
                <span className="pd-value">{profile.weight || '\u2014'}</span>
              </div>
              <div className="profile-detail">
                <span className="pd-label">Age</span>
                <span className="pd-value">{profile.age || '\u2014'}</span>
              </div>
              <div className="profile-detail">
                <span className="pd-label">Hometown</span>
                <span className="pd-value">{profile.hometown || '\u2014'}</span>
              </div>
            </div>
            <div className="profile-actions">
              <button className="ab p" onClick={() => setEditing(true)}>Edit Profile</button>
              <button className="ab del" onClick={handleSignOut}>Sign Out</button>
            </div>
          </>
        ) : (
          <div className="profile-form">
            <label>Display Name</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />

            <label>Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about yourself..." rows={3} />

            <div className="profile-form-row">
              <div className="profile-form-field">
                <label>Height</label>
                <input value={height} onChange={e => setHeight(e.target.value)} placeholder="e.g. 5'11&quot;" />
              </div>
              <div className="profile-form-field">
                <label>Weight</label>
                <input value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 185 lbs" />
              </div>
              <div className="profile-form-field">
                <label>Age</label>
                <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 30" />
              </div>
            </div>

            <label>Hometown</label>
            <input value={hometown} onChange={e => setHometown(e.target.value)} placeholder="e.g. New York, NY" />

            {message && <div style={{ fontSize: '12px', color: message.includes('Error') ? 'var(--acc)' : 'var(--grn)', marginTop: '8px' }}>{message}</div>}

            <div className="profile-actions">
              <button className="ab p" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="ab" onClick={() => { setEditing(false); setMessage('') }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
