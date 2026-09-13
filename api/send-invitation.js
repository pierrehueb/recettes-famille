const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return json({ error: 'Le service d’envoi d’emails n’est pas encore configuré sur le serveur.' }, 500)
  }

  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Authentification requise.' }, 401)

  let body
  try { body = await request.json() } catch { return json({ error: 'Requête invalide.' }, 400) }
  const token = typeof body?.invitationToken === 'string' ? body.invitationToken.trim() : ''
  if (!token) return json({ error: 'Token d’invitation manquant.' }, 400)

  try {
    const tokenBytes = new TextEncoder().encode(token)
    const digest = await crypto.subtle.digest('SHA-256', tokenBytes)
    const tokenHash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')

    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: authorization,
      'Content-Type': 'application/json',
    }

    const invitationUrl = new URL('/rest/v1/family_invitations', SUPABASE_URL)
    invitationUrl.searchParams.set('select', 'id,email,role,family_id,expires_at,accepted_at,revoked_at')
    invitationUrl.searchParams.set('token_hash', `eq.${tokenHash}`)
    invitationUrl.searchParams.set('limit', '1')

    const invitationResponse = await fetch(invitationUrl, { headers })
    if (!invitationResponse.ok) return json({ error: 'Impossible de vérifier l’invitation.' }, 502)
    const invitations = await invitationResponse.json()
    const invitation = invitations?.[0]
    if (!invitation) return json({ error: 'Invitation introuvable ou non autorisée.' }, 404)
    if (invitation.accepted_at) return json({ error: 'Cette invitation a déjà été acceptée.' }, 409)
    if (invitation.revoked_at) return json({ error: 'Cette invitation a été révoquée.' }, 409)
    if (new Date(invitation.expires_at) <= new Date()) return json({ error: 'Cette invitation a expiré.' }, 410)

    const familyUrl = new URL('/rest/v1/families', SUPABASE_URL)
    familyUrl.searchParams.set('select', 'name')
    familyUrl.searchParams.set('id', `eq.${invitation.family_id}`)
    familyUrl.searchParams.set('limit', '1')
    const familyResponse = await fetch(familyUrl, { headers })
    if (!familyResponse.ok) return json({ error: 'Impossible de récupérer la famille.' }, 502)
    const families = await familyResponse.json()
    const familyName = families?.[0]?.name || 'notre famille'

    const inviteLink = `${new URL(request.url).origin}/?invite=${encodeURIComponent(token)}`
    const recipient = escapeHtml(invitation.email)
    const roleLabel = ({ admin: 'Administrateur', editor: 'Éditeur', member: 'Membre', viewer: 'Lecteur' })[invitation.role] || 'Membre'
    const safeRole = escapeHtml(roleLabel)
    const safeFamilyName = escapeHtml(familyName)
    const safeInviteLink = escapeHtml(inviteLink)
    const expires = new Date(invitation.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const safeExpires = escapeHtml(expires)

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [invitation.email],
        subject: `${familyName} vous invite à rejoindre son livre de recettes`,
        text: `Bonjour,\n\nVous êtes invité(e) à rejoindre ${familyName} dans le livre de recettes familial.\n\nRôle : ${roleLabel}\n\nAcceptez l’invitation ici : ${inviteLink}\n\nCette invitation expire le ${expires}.\n\nÀ bientôt !`,
        html: `<!doctype html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Invitation familiale</title></head><body style="margin:0;background:#fffaf3;font-family:Arial,Helvetica,sans-serif;color:#3f332a"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#fffaf3"><tr><td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:16px;padding-right:16px"><table width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #eadfce"><tr><td style="padding-top:36px;padding-bottom:36px;padding-left:32px;padding-right:32px"><p style="margin-top:0;margin-bottom:12px;font-size:13px;line-height:20px;color:#9b7552">NOTRE LIVRE DE FAMILLE</p><h1 style="margin-top:0;margin-bottom:20px;font-size:28px;line-height:36px;color:#3f332a">Une invitation familiale vous attend</h1><p style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:26px;color:#51443a">Bonjour,</p><p style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:26px;color:#51443a">Vous êtes invité(e) à rejoindre <strong style="font-size:16px;line-height:26px;color:#3f332a">${safeFamilyName}</strong> dans son livre de recettes familial.</p><p style="margin-top:0;margin-bottom:24px;font-size:15px;line-height:24px;color:#51443a">Votre rôle : <strong style="font-size:15px;line-height:24px;color:#3f332a">${safeRole}</strong></p><table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#7f5a3b"><a href="${safeInviteLink}" style="display:inline-block;padding-top:14px;padding-bottom:14px;padding-left:22px;padding-right:22px;font-size:16px;line-height:20px;color:#ffffff;text-decoration:none">Rejoindre le livre de famille</a></td></tr></table><p style="margin-top:24px;margin-bottom:8px;font-size:13px;line-height:20px;color:#76685d">Cette invitation est valable jusqu’au ${safeExpires}.</p><p style="margin-top:0;margin-bottom:0;font-size:13px;line-height:20px;color:#76685d">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur : ${recipient ? safeInviteLink : safeInviteLink}</p></td></tr></table></td></tr></table></body></html>`,
      }),
    })

    if (!emailResponse.ok) {
      const resendError = await emailResponse.json().catch(() => null)
      console.error('Resend error', resendError)
      return json({ error: 'Resend n’a pas pu envoyer l’email.' }, 502)
    }

    return json({ sent: true })
  } catch (error) {
    console.error('Invitation email error', error)
    return json({ error: 'Erreur lors de l’envoi de l’invitation.' }, 500)
  }
}
