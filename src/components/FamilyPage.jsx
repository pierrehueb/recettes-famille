import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentFamilyMembership } from '../lib/family'

const roleLabels = { admin: 'Administrateur', editor: 'Éditeur', member: 'Membre', viewer: 'Lecteur' }
const roleDescriptions = { admin: 'Gère la famille et les droits', editor: 'Peut enrichir les recettes', member: 'Peut consulter et participer', viewer: 'Lecture uniquement' }

export default function FamilyPage({ user }) {
  const [membership, setMembership] = useState(null)
  const [family, setFamily] = useState(null)
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState('')

  const isAdmin = membership?.role === 'admin'
  const canInvite = membership?.role === 'admin' || membership?.role === 'editor'

  const load = async () => {
    if (!supabase || !user) return
    setLoading(true); setError(''); setMessage('')
    try {
      const current = await getCurrentFamilyMembership(user.id)
      setMembership(current)
      const [familyResult, membersResult, invitationsResult] = await Promise.all([
        supabase.from('families').select('id, name, description').eq('id', current.family_id).single(),
        supabase.from('family_members').select('id, display_name, role, is_active, created_at, user_id').eq('family_id', current.family_id).order('created_at', { ascending: true }),
        canInvite ? supabase.from('family_invitations').select('id, email, role, expires_at, accepted_at, revoked_at, created_at').eq('family_id', current.family_id).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [], error: null }),
      ])
      if (familyResult.error) throw familyResult.error
      if (membersResult.error) throw membersResult.error
      if (invitationsResult.error) throw invitationsResult.error
      setFamily(familyResult.data)
      setMembers(membersResult.data ?? [])
      setInvitations(invitationsResult.data ?? [])
    } catch (loadError) { setError(loadError.message || 'Impossible de charger la famille.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [user?.id])

  const activeMembers = useMemo(() => members.filter(member => member.is_active), [members])

  const updateMember = async (member, changes) => {
    setSavingId(member.id); setError(''); setMessage('')
    try {
      const { error: updateError } = await supabase.from('family_members').update(changes).eq('id', member.id).eq('family_id', membership.family_id)
      if (updateError) throw updateError
      setMessage(`${member.display_name || 'Membre'} a été mis à jour.`)
      await load()
    } catch (updateError) { setError(updateError.message || 'Impossible de modifier ce membre.') }
    finally { setSavingId(null) }
  }

  const createInvitation = async event => {
    event.preventDefault()
    if (!inviteEmail.trim() || !membership) return
    setInviteLoading(true); setError(''); setMessage(''); setInviteLink('')
    try {
      const { data, error: inviteError } = await supabase.rpc('create_family_invitation', { p_family_id: membership.family_id, p_email: inviteEmail.trim(), p_role: inviteRole, p_valid_days: 7 })
      if (inviteError) throw inviteError
      const invitation = Array.isArray(data) ? data[0] : data
      if (!invitation?.invitation_token) throw new Error('L’invitation a été créée mais son lien n’a pas pu être récupéré.')
      const link = `${window.location.origin}/?invite=${encodeURIComponent(invitation.invitation_token)}`
      setInviteLink(link)
      setMessage(`Invitation créée pour ${inviteEmail.trim()}.`)
      setInviteEmail('')
      await load()
    } catch (inviteError) { setError(inviteError.message || 'Impossible de créer l’invitation.') }
    finally { setInviteLoading(false) }
  }

  const copyInviteLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink); setMessage('Lien d’invitation copié.') }
    catch { setError('Impossible de copier automatiquement le lien. Vous pouvez le sélectionner et le copier manuellement.') }
  }

  if (loading) return <section className="family-section"><div className="status-card">Chargement de la famille…</div></section>
  if (!membership) return <section className="family-section"><div className="status-card error-card">Aucune famille active n’est associée à votre compte.</div></section>

  return <section className="family-section">
    <header className="family-header">
      <div><p className="section-kicker">Notre famille</p><h2>{family?.name || 'La famille'}</h2><p>{family?.description || 'Les personnes qui font vivre et transmettre ce livre de recettes.'}</p></div>
      <div className="family-count"><strong>{activeMembers.length}</strong><span>membre{activeMembers.length > 1 ? 's' : ''}</span></div>
    </header>
    {error && <div className="form-error">{error}</div>}
    {message && <div className="media-success">{message}</div>}

    <div className="family-grid">
      <section className="family-card">
        <div className="family-card-heading"><div><p className="section-kicker">Les membres</p><h3>Qui fait partie de la famille ?</h3></div></div>
        <div className="member-list">{members.map(member => <article className={`member-row ${member.is_active ? '' : 'inactive'}`} key={member.id}>
          <div className="member-avatar">{(member.display_name || '?').charAt(0).toUpperCase()}</div>
          <div className="member-main"><strong>{member.display_name || 'Sans nom'}</strong><span>{member.user_id === user.id ? 'Vous' : roleDescriptions[member.role]}</span></div>
          <div className="member-controls">
            <select value={member.role} disabled={!isAdmin || savingId === member.id || member.user_id === user.id} onChange={e => updateMember(member, { role: e.target.value })} aria-label={`Rôle de ${member.display_name || 'ce membre'}`}>
              {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {member.is_active && isAdmin && member.user_id !== user.id && <button type="button" className="secondary-button small-button" disabled={savingId === member.id} onClick={() => updateMember(member, { is_active: false })}>{savingId === member.id ? '…' : 'Désactiver'}</button>}
          </div>
        </article>)}</div>
      </section>

      {canInvite && <section className="family-card invite-card">
        <div className="family-card-heading"><div><p className="section-kicker">Transmission</p><h3>Inviter un membre</h3><p>Créez un lien privé valable 7 jours, puis envoyez-le à la personne concernée.</p></div></div>
        <form className="recipe-form" onSubmit={createInvitation}>
          <label>Email<input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="prenom@email.com" required /></label>
          <label>Rôle<select value={inviteRole} onChange={e => setInviteRole(e.target.value)}><option value="member">Membre — peut participer</option><option value="viewer">Lecteur — lecture uniquement</option><option value="editor">Éditeur — peut enrichir les recettes</option>{isAdmin && <option value="admin">Administrateur — gestion complète</option>}</select></label>
          <button className="primary-button" type="submit" disabled={inviteLoading}>{inviteLoading ? 'Création…' : 'Créer l’invitation'}</button>
        </form>
        {inviteLink && <div className="invite-result"><strong>Lien d’invitation</strong><div className="invite-link-row"><input readOnly value={inviteLink} aria-label="Lien d’invitation" /><button type="button" className="secondary-button small-button" onClick={copyInviteLink}>Copier</button></div><small>Le lien expire dans 7 jours.</small></div>}
      </section>}
    </div>

    {canInvite && invitations.length > 0 && <section className="family-card invitation-history"><div className="family-card-heading"><div><p className="section-kicker">Invitations</p><h3>Historique récent</h3></div></div><div className="invitation-list">{invitations.map(invitation => <div className="invitation-row" key={invitation.id}><div><strong>{invitation.email}</strong><span>{roleLabels[invitation.role]}</span></div><span className={invitation.accepted_at ? 'invitation-status accepted' : invitation.revoked_at ? 'invitation-status revoked' : new Date(invitation.expires_at) < new Date() ? 'invitation-status expired' : 'invitation-status'}>{invitation.accepted_at ? 'Acceptée' : invitation.revoked_at ? 'Révoquée' : new Date(invitation.expires_at) < new Date() ? 'Expirée' : 'En attente'}</span></div>)}</div></section>}
  </section>
}
