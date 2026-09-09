import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function InvitationPage({ token, onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) return setLoading(false)
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setLoading(false) })
  }, [])

  const accept = async () => {
    if (!supabase || !user || !token) return
    setWorking(true); setError('')
    const { error: acceptError } = await supabase.rpc('accept_family_invitation', { p_token: token })
    if (acceptError) setError(acceptError.message || 'Impossible d’accepter cette invitation.')
    else setAccepted(true)
    setWorking(false)
  }

  const signIn = async event => {
    event.preventDefault()
    if (!supabase) return setError('La connexion Supabase n’est pas configurée.')
    setWorking(true); setError('')
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setError(signInError.message || 'Impossible de vous connecter.')
    else { setUser(data.user); const { error: acceptError } = await supabase.rpc('accept_family_invitation', { p_token: token }); if (acceptError) setError(acceptError.message || 'Impossible d’accepter cette invitation.'); else setAccepted(true) }
    setWorking(false)
  }

  if (loading) return <section className="invitation-page"><div className="status-card">Vérification de l’invitation…</div></section>
  if (accepted) return <section className="invitation-page"><div className="invitation-card"><span className="invitation-icon">✓</span><p className="section-kicker">Bienvenue dans la famille</p><h2>Invitation acceptée</h2><p>Votre compte fait maintenant partie du livre familial. Vous pouvez revenir au livre pour retrouver les recettes transmises par votre famille.</p><button type="button" className="primary-button" onClick={onBack}>Ouvrir le livre</button></div></section>
  if (user) return <section className="invitation-page"><div className="invitation-card"><span className="invitation-icon">👨‍👩‍👧</span><p className="section-kicker">Invitation familiale</p><h2>Rejoindre le livre de famille</h2><p>Vous êtes connecté en tant que <strong>{user.email}</strong>. Acceptez cette invitation pour rejoindre la famille.</p>{error && <div className="form-error">{error}</div>}<button type="button" className="primary-button" onClick={accept} disabled={working}>{working ? 'Acceptation…' : 'Accepter l’invitation'}</button><button type="button" className="secondary-button" onClick={onBack}>Retour</button></div></section>
  return <section className="invitation-page"><div className="invitation-card"><span className="invitation-icon">👨‍👩‍👧</span><p className="section-kicker">Invitation familiale</p><h2>Rejoignez le livre de famille</h2><p>Connectez-vous pour accepter votre invitation et retrouver les recettes partagées par votre famille.</p><form className="recipe-form" onSubmit={signIn}><label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label><label>Mot de passe<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button" type="submit" disabled={working}>{working ? 'Connexion…' : 'Se connecter et rejoindre'}</button></form><button type="button" className="secondary-button" onClick={onBack}>Retour au livre</button></div></section>
}
