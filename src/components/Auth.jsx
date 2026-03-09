import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth({ onClose }) {
  const [mode, setMode] = useState('login') // login, signup, reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Load saved email on mount
  useEffect(() => {
    const saved = localStorage.getItem('rp_saved_email')
    if (saved) {
      setEmail(saved)
      setRememberMe(true)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    // Trim inputs to avoid whitespace issues on mobile
    const trimEmail = email.trim().toLowerCase()
    const trimPassword = password

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(trimEmail, {
        redirectTo: window.location.origin
      })
      if (error) setError(error.message)
      else setMessage('Password reset link sent! Check your email.')
      setLoading(false)
      return
    }

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimEmail,
        password: trimPassword
      })
      if (error) {
        if (error.message.includes('Invalid login')) {
          setError('Incorrect email or password. Please try again.')
        } else {
          setError(error.message)
        }
      } else {
        // Save or clear email
        if (rememberMe) {
          localStorage.setItem('rp_saved_email', trimEmail)
        } else {
          localStorage.removeItem('rp_saved_email')
        }
        onClose()
      }
    } else {
      if (trimPassword.length < 6) {
        setError('Password must be at least 6 characters.')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signUp({
        email: trimEmail,
        password: trimPassword,
        options: { data: { display_name: displayName.trim() || trimEmail.split('@')[0] } }
      })
      if (error) setError(error.message)
      else setMessage('Account created! Check your email for a confirmation link.')
    }
    setLoading(false)
  }

  function switchMode(newMode) {
    setMode(newMode)
    setError('')
    setMessage('')
  }

  return (
    <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mc" style={{ maxWidth: '420px' }}>
        <h2>
          {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
        </h2>

        {mode === 'reset' ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <p style={{ fontSize: '13px', color: 'var(--tx2)', marginBottom: '4px' }}>
              Enter your email and we'll send you a link to reset your password.
            </p>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
            {error && <div className="auth-error">{error}</div>}
            {message && <div className="auth-success">{message}</div>}
            <button className="ab p" type="submit" disabled={loading} style={{ width: '100%', padding: '10px' }}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <div className="auth-toggle" onClick={() => switchMode('login')}>
              Back to sign in
            </div>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <input
                type="text"
                placeholder="Display Name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
            <div className="auth-pw-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button type="button" className="auth-pw-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>

            {mode === 'login' && (
              <div className="auth-options">
                <label className="auth-remember">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                  <span>Remember email</span>
                </label>
                <span className="auth-forgot" onClick={() => switchMode('reset')}>Forgot password?</span>
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}
            {message && <div className="auth-success">{message}</div>}

            <button className="ab p" type="submit" disabled={loading} style={{ width: '100%', padding: '10px' }}>
              {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            {mode === 'signup' && (
              <p style={{ fontSize: '11px', color: 'var(--tx3)', textAlign: 'center' }}>
                Password must be at least 6 characters. All special characters are supported.
              </p>
            )}

            <div className="auth-toggle" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
