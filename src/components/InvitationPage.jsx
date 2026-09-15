import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function InvitationPage({ token, onBack }) {
  const [invitation, setInvitation] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState(false)
  const [mode, setMode] = useState('signup')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const load = async () => {
      if (!supabase || !token) {
        if (mounted) {
          setError('Cette invitation est invalide.')
          setLoading(false)
        }
        return
      }

      const [{ data: invitationData, error: invitationError }, { data: sessionData }] = await Promise.all([
        supabase.rpc('get_family_invitation_details', { p_token: token }),
        supabase.auth.getSession(),
      ])

      if (!mounted) return

      if (invitationError) {
        setError(invitationError.message || 'Impossible de vérifier cette invitation.')
      } else if (!invitationData?.[0]) {
        setError('Cette invitation est invalide, expirée ou a déjà été utilisée.')
      } else {
        const details = invitationData[0]
        setInvitation(details)
        setEmail(details.email)
        setMode('signup')
      }

      setUser(sessionData.session?.user ?? null)
      setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [token])

  const acceptInvitation = async currentUser => {
    if (!supabase || !currentUser || !token) return false

    if (currentUser.email?.toLowerCase() !== invitation?.email?.toLowerCase()) {
      setError(`Cette invitation est réservée à ${invitation?.email}. Connectez-vous avec cette adresse.`)
      return false
    }

    const { error: acceptError } = await supabase.rpc('accept_family_invitation', { p_token: token })
    if (acceptError) {
      console.error('Erreur acceptation invitation:', acceptError)
      setError(acceptError.message || 'Impossible d’accepter cette invitation.')
      return false
    }

    setAccepted(true)
    return true
  }

  const signIn = async event => {
    event.preventDefault()
    if (!supabase) return setError('La connexion Supabase n’est pas configurée.')
    setWorking(true); setError('')

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message || 'Impossible de vous connecter.')
    } else {
      setUser(data.user)
      await acceptInvitation(data.user)
    }

    setWorking(false)
  }

  const signUp = async event => {
    event.preventDefault()
    if (!supabase || !invitation) return
    setWorking(true); setError(''); setPendingConfirmation(false)

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      setWorking(false)
      return
    }

    if (password !== passwordConfirmation) {
      setError('Les deux mots de passe ne correspondent pas.')
      setWorking(false)
      return
    }

    const redirectUrl = `${window.location.origin}/?invite=${encodeURIComponent(token)}`
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: invitation.email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: displayName.trim(),
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message || 'Impossible de créer votre compte.')
    } else if (data.session && data.user) {
      setUser(data.user)
      await acceptInvitation(data.user)
    } else {
      setPendingConfirmation(true)
    }

    setWorking(false)
  }

  if (loading) return <section className="invitation-page"><div className="status-card">Vérification de l’invitation…</div></section>

  if (error && !invitation) return <section className="invitation-page"><div className="invitation-card"><span className="invitation-icon">⚠️</span><p className="section-kicker">Invitation</p><h2>Invitation indisponible</h2><div className="form-error">{error}</div><button type="button" className="secondary-button" onClick={onBack}>Retour au livre</button></div></section>

  if (accepted) return <section className="invitation-page"><div className="invitation-card"><span className="invitation-icon">✓</span><p className="section-kicker">Bienvenue dans la famille</p><h2>Invitation acceptée</h2><p>Votre compte fait maintenant partie du livre familial. Vous pouvez revenir au livre pour retrouver les recettes transmises par votre famille.</p><button type="button" className="primary-button" onClick={onBack}>Ouvrir le livre</button></div></section>

  if (pendingConfirmation) return <section className="invitation-page"><div className="invitation-card"><span className="invitation-icon">✉️</span><p className="section-kicker">Presque terminé</p><h2>Vérifiez votre adresse e-mail</h2><p>Un e-mail de confirmation vient d’être envoyé à <strong>{invitation.email}</strong>.</p><p>Cliquez sur le lien de confirmation dans cet e-mail. Vous serez ensuite ramené automatiquement ici pour terminer votre inscription.</p><button type="button" className="secondary-button" onClick={onBack}>Retour au livre</button></div></section>

  if (user) return <section className="invitation-page"><div className="invitation-card"><span className="invitation-icon">👨‍👩‍👧</span><p className="section-kicker">Invitation familiale</p><h2>Rejoindre le livre de famille</h2><p>Vous êtes connecté en tant que <strong>{user.email}</strong>.</p>{error && <div className="form-error">{error}</div>}{!error && <p>Cette invitation est destinée à <strong>{invitation.email}</strong>. Acceptez-la pour rejoindre <strong>{invitation.family_name}</strong> en tant que <strong>{invitation.role}</strong>.</p>}<button type="button" className="primary-button" onClick={async () => { setWorking(true); setError(''); await acceptInvitation(user); setWorking(false) }} disabled={working}>{working ? 'Acceptation…' : 'Accepter l’invitation'}</button><button type="button" className="secondary-button" onClick={onBack}>Retour</button></div></section>

  return <section className="invitation-page"><div className="invitation-card"><span className="invitation-icon">👨‍👩‍👧</span><p className="section-kicker">Invitation familiale</p><h2>Rejoignez le livre de famille</h2><p>Vous avez été invité à rejoindre <strong>{invitation.family_name}</strong> en tant que <strong>{invitation.role}</strong>.</p><div className="invitation-tabs"><button type="button" className={mode === 'signup' ? 'tab-button active' : 'tab-button'} onClick={() => { setMode('signup'); setError('') }}>Créer mon compte</button><button type="button" className={mode === 'signin' ? 'tab-button active' : 'tab-button'} onClick={() => { setMode('signin'); setError('') }}>J’ai déjà un compte</button></div>{mode === 'signup' ? <form className="recipe-form" onSubmit={signUp}><label>Adresse e-mail<input type="email" value={email} readOnly autoComplete="email" /></label><label>Votre nom (facultatif)<input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" placeholder="Ex. Marie" /></label><label>Mot de passe<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required /></label><label>Confirmer le mot de passe<input type="password" value={passwordConfirmation} onChange={e => setPasswordConfirmation(e.target.value)} autoComplete="new-password" minLength={8} required /></label><p className="form-help">Votre adresse e-mail est celle utilisée pour l’invitation et ne peut pas être modifiée.</p>{error && <div className="form-error">{error}</div>}<button className="primary-button" type="submit" disabled={working}>{working ? 'Création du compte…' : 'Créer mon compte et rejoindre'}</button></form> : <form className="recipe-form" onSubmit={signIn}><label>Adresse e-mail<input type="email" value={email} readOnly autoComplete="email" /></label><label>Mot de passe<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button" type="submit" disabled={working}>{working ? 'Connexion…' : 'Se connecter et rejoindre'}</button></form>}<button type="button" className="secondary-button" onClick={onBack}>Retour au livre</button></div></section>
}
