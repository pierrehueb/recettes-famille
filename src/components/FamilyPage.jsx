import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentFamilyMembership } from '../lib/family'

const roleLabels = { admin: 'Administrateur', editor: 'Éditeur', member: 'Membre', viewer: 'Lecteur' }
const roleDescriptions = { admin: 'Gère la famille et les droits', editor: 'Peut enrichir les recettes', member: 'Peut consulter et participer', viewer: 'Lecture uniquement' }

export default function FamilyPage() {
  const [user, setUser] = useState(null)
  const [membership, setMembership] = useState(null)
  const [family, setFamily] = useState(null)
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [revokingId, setRevokingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [adminOpen, setAdminOpen] = useState(false)
  const [memberConfirmation, setMemberConfirmation] = useState(null)

  const isAdmin = membership?.role === 'admin'

  const load = async currentUser => {
    if (!supabase || !currentUser) return
    setLoading(true); setError(''); setMessage('')
    try {
      const current = await getCurrentFamilyMembership(currentUser.id)
      setMembership(current)
      const [familyResult, membersResult, invitationsResult] = await Promise.all([
        supabase.from('families').select('id, name, description').eq('id', current.family_id).single(),
        supabase.from('family_members').select('id, display_name, role, is_active, created_at, user_id').eq('family_id', current.family_id).order('created_at', { ascending: true }),
        current.role === 'admin' ? supabase.from('family_invitations').select('id, email, role, expires_at, accepted_at, revoked_at, created_at').eq('family_id', current.family_id).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [], error: null }),
      ])
      if (familyResult.error) throw familyResult.error
      if (membersResult.error) throw membersResult.error
      if (invitationsResult.error) throw invitationsResult.error
      setFamily(familyResult.data); setMembers(membersResult.data ?? []); setInvitations(invitationsResult.data ?? [])
    } catch (loadError) { setError(loadError.message || 'Impossible de charger la famille.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    let cancelled = false
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      const currentUser = data.session?.user ?? null
      setUser(currentUser)
      if (currentUser) load(currentUser)
      else setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const activeMembers = useMemo(() => members.filter(member => member.is_active), [members])

  const updateMember = async (member, changes) => {
    if (!isAdmin || !membership) return
    setSavingId(member.id); setError(''); setMessage('')
    try {
      const { error: updateError } = await supabase.from('family_members').update(changes).eq('id', member.id).eq('family_id', membership.family_id)
      if (updateError) throw updateError
      setMessage(`${member.display_name || 'Membre'} a été mis à jour.`)
      await load(user)
      setMemberConfirmation(null)
    } catch (updateError) { setError(updateError.message || 'Impossible de modifier ce membre.') }
    finally { setSavingId(null) }
  }

  const createInvitation = async event => {
    event.preventDefault()
    if (!isAdmin || !inviteEmail.trim() || !membership || !supabase) return
    setInviteLoading(true); setError(''); setMessage(''); setInviteLink('')
    try {
      const email = inviteEmail.trim()
      const { data, error: inviteError } = await supabase.rpc('create_family_invitation', { p_family_id: membership.family_id, p_email: email, p_role: inviteRole, p_valid_days: 7 })
      if (inviteError) throw inviteError
      const invitation = Array.isArray(data) ? data[0] : data
      if (!invitation?.invitation_token) throw new Error('L’invitation a été créée mais son lien n’a pas pu être récupéré.')
      const link = `${window.location.origin}/?invite=${encodeURIComponent(invitation.invitation_token)}`
      setInviteLink(link)

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Votre session a expiré. Reconnectez-vous avant d’envoyer l’invitation.')

      const response = await fetch('/api/send-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ invitationToken: invitation.invitation_token }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'L’invitation a été créée, mais l’email n’a pas pu être envoyé.')

      setMessage(`Invitation envoyée par email à ${email}.`)
      setInviteEmail('')
      await load(user)
    } catch (inviteError) { setError(inviteError.message || 'Impossible de créer ou d’envoyer l’invitation.') }
    finally { setInviteLoading(false) }
  }

  const revokeInvitation = async invitation => {
    if (!isAdmin || !supabase || invitation.accepted_at || invitation.revoked_at || new Date(invitation.expires_at) < new Date()) return
        setRevokingId(invitation.id); setError(''); setMessage('')
    try {
      const { error: revokeError } = await supabase.rpc('revoke_family_invitation', { p_invitation_id: invitation.id })
      if (revokeError) throw revokeError
      setMessage(`L’invitation pour ${invitation.email} a été révoquée.`)
      await load(user)
    } catch (revokeError) {
      console.error('Erreur révocation invitation:', revokeError)
      setError(revokeError.message || revokeError.details || revokeError.hint || 'Impossible de révoquer cette invitation.')
    } finally { setRevokingId(null) }
  }

  const copyInviteLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink); setMessage('Lien d’invitation copié.') }
    catch { setError('Impossible de copier automatiquement le lien. Vous pouvez le sélectionner et le copier manuellement.') }
  }

  if (loading) return <section className="family-section"><div className="status-card">Chargement de la famille…</div></section>
  if (!user) return <section className="family-section"><div className="status-card error-card">Connectez-vous pour accéder à la gestion de la famille.</div></section>
  if (!membership) return <section className="family-section"><div className="status-card error-card">Aucune famille active n’est associée à votre compte.</div></section>

  return <section className="family-section">
    <header className="family-hero">
      <div className="family-hero-mark" aria-hidden="true">♥</div>
      <div className="family-hero-copy"><p className="section-kicker">Notre famille</p><h2>{family?.name || 'La famille'}</h2><p>{family?.description || 'Les personnes qui font vivre, cuisiner et transmettre ce livre de recettes.'}</p></div>
      <div className="family-count"><strong>{activeMembers.length}</strong><span>membre{activeMembers.length > 1 ? 's' : ''}</span></div>
    </header>
    {error && <div className="form-error">{error}</div>}{message && <div className="media-success">{message}</div>}

    <section className="family-members-section">
      <div className="family-section-heading"><div><p className="section-kicker">Les membres</p><h3>Ceux qui font vivre ce livre</h3></div>{isAdmin && <button type="button" className="family-admin-toggle" onClick={() => setAdminOpen(value => !value)}>{adminOpen ? 'Fermer la gestion' : 'Gérer la famille'}</button>}</div>
      <div className="member-gallery">{activeMembers.map(member => <article className="member-card" key={member.id}>
        <div className="member-avatar member-avatar-large">{(member.display_name || '?').charAt(0).toUpperCase()}</div>
        <div className="member-card-copy"><strong>{member.display_name || 'Sans nom'}</strong><span>{member.user_id === user.id ? 'Vous · ' : ''}{roleLabels[member.role]}</span><small>{roleDescriptions[member.role]}</small></div>
        {isAdmin && adminOpen && <div className="member-admin-controls"><select value={member.role} disabled={savingId === member.id || member.user_id === user.id} onChange={e => updateMember(member, { role: e.target.value })} aria-label={`Rôle de ${member.display_name || 'ce membre'}`}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{member.user_id !== user.id && <button type="button" className="member-remove-button" onClick={() => setMemberConfirmation(member)} disabled={savingId === member.id} aria-label={`Retirer ${member.display_name || 'ce membre'} de la famille`} title="Retirer de la famille">×</button>}</div>}
      </article>)}{isAdmin && <button type="button" className="member-card member-add-card" onClick={() => { setAdminOpen(true); window.setTimeout(() => document.getElementById('family-invite-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0) }}><span className="member-add-icon">＋</span><span><strong>Inviter un membre</strong><small>Ajouter un proche à cette famille</small></span></button>}</div>
      {members.some(member => !member.is_active) && isAdmin && adminOpen && <details className="inactive-members"><summary>Membres désactivés ({members.filter(member => !member.is_active).length})</summary><div>{members.filter(member => !member.is_active).map(member => <span key={member.id}>{member.display_name || 'Sans nom'}</span>)}</div></details>}
    </section>

    {isAdmin && <section className={`family-management ${adminOpen ? 'open' : ''}`}>
      <div className="family-management-heading"><p className="section-kicker">Administration</p><h3>Invitations et accès</h3><p>Cette partie est réservée aux administrateurs de la famille.</p></div>
      <div className="family-management-grid">
        <section className="family-card invite-card" id="family-invite-card"><div className="family-card-heading"><div><h3>Inviter un proche</h3><p>Envoyez une invitation privée valable 7 jours.</p></div></div><form className="recipe-form" onSubmit={createInvitation}><label>Email<input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="prenom@email.com" required /></label><label>Rôle<select value={inviteRole} onChange={e => setInviteRole(e.target.value)}><option value="member">Membre — peut participer</option><option value="viewer">Lecteur — lecture uniquement</option><option value="editor">Éditeur — peut enrichir les recettes</option><option value="admin">Administrateur — gestion complète</option></select></label><button className="primary-button" type="submit" disabled={inviteLoading}>{inviteLoading ? 'Envoi…' : 'Envoyer l’invitation'}</button></form>{inviteLink && <div className="invite-result"><strong>Lien d’invitation</strong><div className="invite-link-row"><input readOnly value={inviteLink} aria-label="Lien d’invitation" /><button type="button" className="secondary-button small-button" onClick={copyInviteLink}>Copier</button></div><small>Le lien expire dans 7 jours.</small></div>}</section>
        <section className="family-card invitation-history"><div className="family-card-heading"><div><h3>Invitations récentes</h3><p>Suivez les invitations encore en attente.</p></div></div>{invitations.length ? <div className="invitation-list">{invitations.map(invitation => { const isExpired = new Date(invitation.expires_at) < new Date(); const canRevoke = !invitation.accepted_at && !invitation.revoked_at && !isExpired; return <div className="invitation-row" key={invitation.id}><div><strong>{invitation.email}</strong><span>{roleLabels[invitation.role]}</span></div><div className="invitation-actions"><span className={invitation.accepted_at ? 'invitation-status accepted' : invitation.revoked_at ? 'invitation-status revoked' : isExpired ? 'invitation-status expired' : 'invitation-status'}>{invitation.accepted_at ? 'Acceptée' : invitation.revoked_at ? 'Révoquée' : isExpired ? 'Expirée' : 'En attente'}</span>{canRevoke && <button type="button" className="invitation-revoke-button" disabled={revokingId === invitation.id} onClick={() => revokeInvitation(invitation)} aria-label={`Révoquer l’invitation de ${invitation.email}`} title="Révoquer">×</button>}</div></div> })}</div> : <p className="family-empty-note">Aucune invitation récente.</p>}</section>
      </div>
    </section>}

    {memberConfirmation && <div className="family-confirmation-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !savingId) setMemberConfirmation(null) }}><div className="family-confirmation" role="alertdialog" aria-modal="true"><p className="section-kicker">Accès à la famille</p><h3>Retirer ce membre ?</h3><p><strong>{memberConfirmation.display_name || 'Ce membre'}</strong> n’aura plus accès à cette famille. Son contenu déjà transmis restera conservé.</p><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setMemberConfirmation(null)}>Annuler</button><button type="button" className="primary-button" disabled={savingId === memberConfirmation.id} onClick={() => updateMember(memberConfirmation, { is_active: false })}>{savingId === memberConfirmation.id ? 'Retrait…' : 'Retirer'}</button></div></div></div>}
  </section>
}
