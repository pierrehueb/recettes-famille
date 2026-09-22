import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function CommentsSection({ recipeId, user, focusCommentId = null }) {
  const [familyId, setFamilyId] = useState(null)
  const [membership, setMembership] = useState(null)
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [editingPhoto, setEditingPhoto] = useState(null)
  const [removeEditingPhoto, setRemoveEditingPhoto] = useState(false)
  const [busyCommentId, setBusyCommentId] = useState(null)
  const [photoConfirmation, setPhotoConfirmation] = useState(null)
  const [replacePhotoInput, setReplacePhotoInput] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState(null)

  const loadComments = async () => {
    if (!supabase || !recipeId || !user) return
    setLoading(true)
    setError('')
    try {
      const { data: currentMembership, error: membershipError } = await supabase
        .from('family_members')
        .select('id, family_id, display_name, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (membershipError || !currentMembership) throw new Error(membershipError?.message || 'Aucune famille active trouvée.')
      setMembership(currentMembership)
      setFamilyId(currentMembership.family_id)

      const { data, error: commentsError } = await supabase
        .from('recipe_comments')
        .select('id, content, created_by, created_at, updated_at')
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: true })
      if (commentsError) throw commentsError

      const rows = data ?? []
      const creatorIds = [...new Set(rows.map(item => item.created_by).filter(Boolean))]
      let creatorMap = new Map()
      if (creatorIds.length) {
        const { data: members, error: membersError } = await supabase.from('family_members').select('id, display_name').in('id', creatorIds)
        if (membersError) throw membersError
        creatorMap = new Map((members ?? []).map(member => [member.id, member.display_name]))
      }

      const commentIds = rows.map(item => item.id)
      let mediaMap = new Map()
      if (commentIds.length) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('id, comment_id, storage_path, mime_type, original_filename, caption')
          .in('comment_id', commentIds)
          .eq('media_type', 'photo')
        if (mediaError) throw mediaError
        const signedMedia = await Promise.all((media ?? []).map(async item => {
          const { data: signedData } = await supabase.storage.from('family-media').createSignedUrl(item.storage_path, 3600)
          return { ...item, signedUrl: signedData?.signedUrl || '' }
        }))
        mediaMap = new Map(signedMedia.map(item => [item.comment_id, item]))
      }

      setComments(rows.map(item => ({ ...item, creatorName: creatorMap.get(item.created_by) || 'Membre de la famille', photo: mediaMap.get(item.id) || null })))
    } catch (loadError) { setError(loadError.message || 'Impossible de charger les souvenirs.') } finally { setLoading(false) }
  }

  useEffect(() => { loadComments() }, [recipeId, user?.id])
  useEffect(() => {
    if (!selectedPhoto) return undefined
    const onKeyDown = event => { if (event.key === 'Escape') setSelectedPhoto(null) }
    document.addEventListener('keydown', onKeyDown); document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = '' }
  }, [selectedPhoto])

  useEffect(() => {
    if (loading || !focusCommentId || !comments.some(comment => comment.id === focusCommentId)) return
    let cancelled = false
    const scrollToComment = () => {
      if (cancelled) return
      const target = document.getElementById(`comment-${focusCommentId}`)
      if (!target) return
      const headerOffset = 88
      const top = target.getBoundingClientRect().top + window.scrollY - headerOffset
      window.scrollTo({ top, behavior: 'smooth' })
    }
    const firstTimer = window.setTimeout(scrollToComment, 120)
    const settleTimer = window.setTimeout(scrollToComment, 700)
    return () => { cancelled = true; window.clearTimeout(firstTimer); window.clearTimeout(settleTimer) }
  }, [loading, focusCommentId, comments])

  const canManageComment = comment => membership && (comment.created_by === membership.id || membership.role === 'admin')

  const addComment = async event => {
    event.preventDefault(); const content = text.trim(); if (!content || !supabase || !membership || membership.role === 'viewer') return
    setSaving(true); setError('')
    try {
      const { data: createdComment, error: insertError } = await supabase.from('recipe_comments').insert({ family_id: familyId, recipe_id: recipeId, content, created_by: membership.id }).select('id').single()
      if (insertError) throw insertError
      if (photo) {
        const extension = photo.name.includes('.') ? `.${photo.name.split('.').pop().toLowerCase()}` : ''; const id = crypto.randomUUID(); const path = `${familyId}/recipes/${recipeId}/comments/${createdComment.id}/${id}${extension}`
        const { error: uploadError } = await supabase.storage.from('family-media').upload(path, photo, { contentType: photo.type || undefined, upsert: false }); if (uploadError) throw uploadError
        const { error: mediaError } = await supabase.from('media').insert({ family_id: familyId, comment_id: createdComment.id, storage_path: path, media_type: 'photo', mime_type: photo.type || null, original_filename: photo.name, position: 0, created_by: membership.id })
        if (mediaError) { await supabase.storage.from('family-media').remove([path]); throw mediaError }
      }
      setText(''); setPhoto(null); await loadComments()
    } catch (saveError) { setError(saveError.message || 'Impossible d’ajouter ce souvenir.') } finally { setSaving(false) }
  }

  const startEditing = comment => { setEditingId(comment.id); setEditingText(comment.content); setEditingPhoto(null); setRemoveEditingPhoto(false); setPhotoConfirmation(null); setReplacePhotoInput(null); setError('') }
  const cancelEditing = () => { setEditingId(null); setEditingText(''); setEditingPhoto(null); setRemoveEditingPhoto(false); setPhotoConfirmation(null); setReplacePhotoInput(null) }
  const saveEdit = async comment => {
    const content = editingText.trim(); if (!content || !canManageComment(comment)) return
    setBusyCommentId(comment.id); setError('')
    let newStoragePath = null
    try {
      const { error: updateError } = await supabase.from('recipe_comments').update({ content, updated_at: new Date().toISOString() }).eq('id', comment.id)
      if (updateError) throw updateError

      if (editingPhoto) {
        const extension = editingPhoto.name.includes('.') ? `.${editingPhoto.name.split('.').pop().toLowerCase()}` : ''
        newStoragePath = `${familyId}/recipes/${recipeId}/comments/${comment.id}/${crypto.randomUUID()}${extension}`
        const { error: uploadError } = await supabase.storage.from('family-media').upload(newStoragePath, editingPhoto, { contentType: editingPhoto.type || undefined, upsert: false })
        if (uploadError) throw uploadError
        const { error: mediaError } = await supabase.from('media').insert({ family_id: familyId, comment_id: comment.id, storage_path: newStoragePath, media_type: 'photo', mime_type: editingPhoto.type || null, original_filename: editingPhoto.name, position: 0, created_by: membership.id })
        if (mediaError) { await supabase.storage.from('family-media').remove([newStoragePath]); throw mediaError }
      }

      if ((removeEditingPhoto || editingPhoto) && comment.photo?.storage_path) {
        const { error: storageError } = await supabase.storage.from('family-media').remove([comment.photo.storage_path])
        if (storageError) throw storageError
        const { error: mediaError } = await supabase.from('media').delete().eq('id', comment.photo.id)
        if (mediaError) throw mediaError
      }

      cancelEditing(); await loadComments()
    } catch (updateError) {
      setError(updateError.message || 'Impossible de modifier ce souvenir.')
    } finally { setBusyCommentId(null) }
  }
  const deleteComment = async comment => {
    if (!canManageComment(comment)) return
    setBusyCommentId(comment.id); setError('')
    try {
      if (comment.photo?.storage_path) { const { error: storageError } = await supabase.storage.from('family-media').remove([comment.photo.storage_path]); if (storageError) throw storageError; const { error: mediaError } = await supabase.from('media').delete().eq('id', comment.photo.id); if (mediaError) throw mediaError }
      const { error: deleteError } = await supabase.from('recipe_comments').delete().eq('id', comment.id); if (deleteError) throw deleteError
      if (selectedPhoto?.comment_id === comment.id) setSelectedPhoto(null); if (editingId === comment.id) cancelEditing(); setDeleteConfirmation(null); await loadComments()
    } catch (deleteError) { setError(deleteError.message || 'Impossible de supprimer ce souvenir.') } finally { setBusyCommentId(null) }
  }

  const actionStyle = { width: 34, height: 34, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 8, background: 'transparent', color: '#756a61', cursor: 'pointer' }
  const photoActionStyle = { minHeight: 34, padding: '4px 6px', display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 7, background: 'transparent', color: '#756a61', font: 'inherit', fontSize: '.82rem', cursor: 'pointer' }
  const photoOverlayActionStyle = { width: 32, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: '50%', background: 'rgba(35, 30, 27, .68)', color: '#fff', cursor: 'pointer', boxShadow: '0 1px 5px rgba(0,0,0,.18)' }

  return <section className="comments-section">
    <div className="comments-heading"><p className="section-kicker">Commentaires & souvenirs</p></div>
    {error && <div className="form-error comments-message">{error}</div>}
    {loading ? <div className="status-card">Chargement des souvenirs…</div> : <>
      <div className="comments-list">
        {comments.length === 0 ? <div className="comments-empty">Aucun souvenir n’a encore été partagé. Soyez le premier à raconter l’histoire de cette recette.</div> : comments.map(comment => {
          const isEditing = editingId === comment.id; const canManage = canManageComment(comment); const isBusy = busyCommentId === comment.id
          return <article id={`comment-${comment.id}`} className={`comment-card ${focusCommentId === comment.id ? 'comment-card-focused' : ''}`} key={comment.id} style={{ position: 'relative' }}>
            {canManage && !isEditing && <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 2 }}>
              <button type="button" style={actionStyle} onClick={() => startEditing(comment)} disabled={isBusy} aria-label="Modifier le souvenir" title="Modifier">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="m13.5 6.5 4 4" stroke="currentColor" strokeWidth="1.7"/></svg>
              </button>
              <button type="button" style={actionStyle} onClick={() => setDeleteConfirmation(comment)} disabled={isBusy} aria-label="Supprimer le souvenir" title="Supprimer">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3M8 10v8M12 10v8M16 10v8M7 7l1 14h8l1-14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>}
            <div className="comment-card-header" style={canManage && !isEditing ? { paddingRight: 72 } : undefined}><strong>{comment.creatorName}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</time></div>
            {isEditing ? <><textarea value={editingText} onChange={e => setEditingText(e.target.value)} rows="4" maxLength="2000" disabled={isBusy} style={{ width: '100%', marginTop: 12 }} />{(!comment.photo || removeEditingPhoto) && !editingPhoto && <div style={{ marginTop: 10 }}><label style={photoActionStyle}><span aria-hidden="true">+</span>Ajouter une photo<input type="file" accept="image/*" disabled={isBusy} style={{ display: 'none' }} onChange={e => { setEditingPhoto(e.target.files?.[0] || null); if (e.target.files?.[0]) setRemoveEditingPhoto(false) }} /></label></div>}{removeEditingPhoto && comment.photo && !editingPhoto && <button type="button" style={photoActionStyle} onClick={() => setRemoveEditingPhoto(false)} disabled={isBusy}><span aria-hidden="true">↶</span>Conserver la photo</button>}<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}><button type="button" className="secondary-button small-button" onClick={cancelEditing} disabled={isBusy}>Annuler</button><button type="button" className="primary-button" onClick={() => saveEdit(comment)} disabled={isBusy || !editingText.trim()}>{isBusy ? 'Enregistrement…' : 'Enregistrer'}</button></div></> : <p>{comment.content}</p>}
            {comment.photo?.signedUrl && (!isEditing || (!removeEditingPhoto && !editingPhoto)) && <div style={{ position: 'relative', width: '100%', maxWidth: 420, marginTop: 14 }}><button type="button" onClick={() => setSelectedPhoto(comment.photo)} aria-label="Ouvrir la photo du souvenir" style={{ display: 'block', width: '100%', padding: 0, border: 0, borderRadius: 14, overflow: 'hidden', background: '#f3e7d8' }}><img src={comment.photo.signedUrl} alt={comment.photo.caption || comment.photo.original_filename || 'Photo du souvenir'} style={{ display: 'block', width: '100%', maxHeight: 320, objectFit: 'cover' }} /></button>{isEditing && <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}><button type="button" style={photoOverlayActionStyle} onClick={() => setPhotoConfirmation('replace')} disabled={isBusy} aria-label="Remplacer la photo" title="Remplacer la photo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg></button><input ref={setReplacePhotoInput} type="file" accept="image/*" disabled={isBusy} style={{ display: 'none' }} onChange={e => { setEditingPhoto(e.target.files?.[0] || null); if (e.target.files?.[0]) setRemoveEditingPhoto(false); e.target.value = '' }} /><button type="button" style={photoOverlayActionStyle} onClick={() => setPhotoConfirmation('delete')} disabled={isBusy} aria-label="Supprimer la photo" title="Supprimer la photo"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button></div>}{isEditing && photoConfirmation && <div role="alertdialog" aria-modal="true" aria-label={photoConfirmation === 'replace' ? 'Confirmer le remplacement de la photo' : 'Confirmer la suppression de la photo'} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 14, background: 'rgba(54, 45, 39, .38)', backdropFilter: 'blur(2px)' }}><div style={{ width: 'min(260px, 100%)', padding: '16px 18px', borderRadius: 14, background: '#fffaf4', color: '#4f453e', boxShadow: '0 8px 24px rgba(52, 42, 35, .18)', textAlign: 'center' }}><strong style={{ display: 'block', fontSize: '.95rem', marginBottom: 12 }}>{photoConfirmation === 'replace' ? 'Remplacer la photo ?' : 'Supprimer la photo ?'}</strong><div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}><button type="button" className="secondary-button small-button" onClick={() => setPhotoConfirmation(null)}>Non</button><button type="button" className="primary-button" style={{ minHeight: 34, padding: '6px 14px' }} onClick={() => { const action = photoConfirmation; setPhotoConfirmation(null); if (action === 'replace') replacePhotoInput?.click(); else setRemoveEditingPhoto(true) }}>Oui</button></div></div></div>}</div>}{isEditing && editingPhoto && <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: '#756a61', fontSize: '.8rem' }}>{editingPhoto.name}</span><button type="button" style={photoActionStyle} onClick={() => setEditingPhoto(null)} disabled={isBusy}>× Annuler</button></div>}
          </article>
        })}
      </div>
      {membership?.role === 'viewer' ? <div className="comments-empty">Votre rôle est « lecture seule » : vous pouvez consulter les souvenirs, mais pas en ajouter.</div> : <form className="comment-form" onSubmit={addComment}><label>Votre souvenir<textarea value={text} onChange={e => setText(e.target.value)} rows="4" maxLength="2000" placeholder="Ex. Mamie ajoutait toujours une cuillère de…" /></label><div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}><label style={photoActionStyle}><span aria-hidden="true">{photo ? '↻' : '+'}</span>{photo ? 'Remplacer' : 'Ajouter une photo'}<input type="file" accept="image/*" disabled={saving} style={{ display: 'none' }} onChange={e => setPhoto(e.target.files?.[0] || null)} /></label>{photo && <><span style={{ color: '#756a61', fontSize: '.8rem' }}>{photo.name}</span><button type="button" style={photoActionStyle} onClick={() => setPhoto(null)} disabled={saving}><span aria-hidden="true">⌫</span>Retirer</button></>}</div><div className="comment-form-footer"><span>{text.length}/2000</span><button type="submit" className="primary-button" disabled={saving || !text.trim()}>{saving ? 'Enregistrement…' : 'Partager le souvenir'}</button></div></form>}
    </>}
    {deleteConfirmation && <div className="password-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busyCommentId) setDeleteConfirmation(null) }}><div className="password-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-comment-title"><button type="button" className="password-modal-close" onClick={() => setDeleteConfirmation(null)} disabled={!!busyCommentId} aria-label="Fermer">×</button><p className="section-kicker">Suppression</p><h3 id="delete-comment-title">Supprimer ce souvenir ?</h3><p className="password-modal-intro">Cette action est définitive. {deleteConfirmation.photo ? "Le commentaire et sa photo seront supprimés." : "Le commentaire sera supprimé."}</p><div className="password-modal-actions"><button type="button" className="secondary-button" onClick={() => setDeleteConfirmation(null)} disabled={!!busyCommentId}>Annuler</button><button type="button" className="primary-button" onClick={() => deleteComment(deleteConfirmation)} disabled={!!busyCommentId}>{busyCommentId ? "Suppression…" : "Supprimer"}</button></div></div></div>}
    {selectedPhoto?.signedUrl && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Photo du souvenir agrandie" onClick={() => setSelectedPhoto(null)}><button type="button" className="photo-lightbox-close" onClick={() => setSelectedPhoto(null)} aria-label="Fermer">×</button><div className="photo-lightbox-content" onClick={event => event.stopPropagation()}><img src={selectedPhoto.signedUrl} alt={selectedPhoto.caption || selectedPhoto.original_filename || 'Photo du souvenir'} /></div></div>}
  </section>
}

export default CommentsSection
