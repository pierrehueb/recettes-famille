import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentFamilyMembership } from '../lib/family'

const blankIngredient = () => ({ quantity: '', unit: '', name: '', notes: '' })
const blankStep = () => ({ instruction: '', duration_minutes: '', temperature_celsius: '' })

export default function RecipeVariants({ recipeId, user, currentVersionId, onSelectVersion }) {
  const [versions, setVersions] = useState([])
  const [ingredients, setIngredients] = useState({})
  const [steps, setSteps] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editingVersionId, setEditingVersionId] = useState(null)
  const [form, setForm] = useState({ name: '', notes: '' })
  const [draftIngredients, setDraftIngredients] = useState([])
  const [draftSteps, setDraftSteps] = useState([])

  const groupByVersion = rows => rows.reduce((acc, row) => { (acc[row.version_id] ||= []).push(row); return acc }, {})

  const load = async () => {
    if (!supabase || !recipeId) return
    setLoading(true); setError('')
    const { data, error: versionError } = await supabase.from('recipe_versions').select('id, version_name, notes, is_original, based_on_version_id, created_at').eq('recipe_id', recipeId).order('created_at', { ascending: true })
    if (versionError) { setError(versionError.message); setLoading(false); return }
    const rows = data ?? []; setVersions(rows)
    const ids = rows.map(v => v.id)
    if (ids.length) {
      const [ir, sr] = await Promise.all([
        supabase.from('ingredients').select('id, version_id, position, quantity, unit, name, notes').in('version_id', ids).order('position'),
        supabase.from('preparation_steps').select('id, version_id, position, instruction, duration_minutes, temperature_celsius').in('version_id', ids).order('position'),
      ])
      if (ir.error) setError(ir.error.message); else setIngredients(groupByVersion(ir.data ?? []))
      if (sr.error) setError(sr.error.message); else setSteps(groupByVersion(sr.data ?? []))
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [recipeId])

  const createVariant = async event => {
    event.preventDefault(); if (!form.name.trim() || !supabase || !currentVersionId) return
    setSaving(true); setError('')
    try {
      const membership = await getCurrentFamilyMembership(user?.id)
      const { data: version, error: versionError } = await supabase.from('recipe_versions').insert({ recipe_id: recipeId, version_name: form.name.trim(), notes: form.notes.trim() || null, based_on_version_id: currentVersionId, created_by: membership.id }).select('id').single()
      if (versionError) throw versionError
      const baseIngredients = ingredients[currentVersionId] ?? []
      const baseSteps = steps[currentVersionId] ?? []
      if (baseIngredients.length) {
        const { error } = await supabase.from('ingredients').insert(baseIngredients.map(({ id, version_id, ...item }, index) => ({ ...item, version_id: version.id, position: index + 1 })))
        if (error) throw error
      }
      if (baseSteps.length) {
        const { error } = await supabase.from('preparation_steps').insert(baseSteps.map(({ id, version_id, ...item }, index) => ({ ...item, version_id: version.id, position: index + 1 })))
        if (error) throw error
      }
      setForm({ name: '', notes: '' }); setOpen(false); await load(); setEditingVersionId(version.id)
    } catch (saveError) { setError(saveError.message || 'Impossible de créer cette variante.') }
    finally { setSaving(false) }
  }

  const startEditing = version => {
    setEditingVersionId(version.id)
    setDraftIngredients((ingredients[version.id] ?? []).map(({ quantity, unit, name, notes }) => ({ quantity: quantity ?? '', unit: unit ?? '', name: name ?? '', notes: notes ?? '' })))
    setDraftSteps((steps[version.id] ?? []).map(({ instruction, duration_minutes, temperature_celsius }) => ({ instruction: instruction ?? '', duration_minutes: duration_minutes ?? '', temperature_celsius: temperature_celsius ?? '' })))
  }

  const moveItem = (items, setItems, index, direction) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const copy = [...items]; [copy[index], copy[target]] = [copy[target], copy[index]]; setItems(copy)
  }

  const saveEdition = async version => {
    if (!supabase || version.is_original) return
    setSaving(true); setError('')
    try {
      const cleanIngredients = draftIngredients.filter(item => item.name.trim())
      const cleanSteps = draftSteps.filter(item => item.instruction.trim())
      const { error: deleteIngredientsError } = await supabase.from('ingredients').delete().eq('version_id', version.id)
      if (deleteIngredientsError) throw deleteIngredientsError
      const { error: deleteStepsError } = await supabase.from('preparation_steps').delete().eq('version_id', version.id)
      if (deleteStepsError) throw deleteStepsError
      if (cleanIngredients.length) {
        const { error } = await supabase.from('ingredients').insert(cleanIngredients.map((item, index) => ({ version_id: version.id, position: index + 1, quantity: item.quantity === '' ? null : Number(item.quantity), unit: item.unit.trim() || null, name: item.name.trim(), notes: item.notes.trim() || null })))
        if (error) throw error
      }
      if (cleanSteps.length) {
        const { error } = await supabase.from('preparation_steps').insert(cleanSteps.map((item, index) => ({ version_id: version.id, position: index + 1, instruction: item.instruction.trim(), duration_minutes: item.duration_minutes === '' ? null : Number(item.duration_minutes), temperature_celsius: item.temperature_celsius === '' ? null : Number(item.temperature_celsius) })))
        if (error) throw error
      }
      await load(); setEditingVersionId(null)
      if (onSelectVersion) onSelectVersion(version.id)
    } catch (saveError) { setError(saveError.message || 'Impossible d’enregistrer cette variante.') }
    finally { setSaving(false) }
  }

  if (loading) return <section className="variants-section"><div className="status-card">Chargement des variantes familiales…</div></section>
  return <section className="variants-section">
    <div className="variants-header"><div><p className="section-kicker">Transmission familiale</p><h3>Les variantes de la recette</h3><p>Chaque génération peut créer et personnaliser sa propre version sans modifier l’original.</p></div><button type="button" className="primary-button small-button" onClick={() => setOpen(v => !v)}>＋ Nouvelle variante</button></div>
    {error && <div className="form-error">{error}</div>}
    {open && <form className="variant-form" onSubmit={createVariant}><label>Nom de la variante<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex. Version de Maman – 2005" required /></label><label>Ce qui a changé<textarea rows="3" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Plus de beurre, cuisson différente…" /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Annuler</button><button className="primary-button" disabled={saving}>{saving ? 'Création…' : 'Créer la variante'}</button></div></form>}
    <div className="variant-timeline">{versions.map((version, index) => {
      const isEditing = editingVersionId === version.id
      const isCurrent = version.id === currentVersionId
      const parentVersion = versions.find(item => item.id === version.based_on_version_id)
      const generationLabel = version.is_original ? '👵 Original' : `Version ${index}`
      return <article className={`variant-card ${isCurrent ? 'current' : ''}`} key={version.id}>
        <div className="variant-dot" />
        <div className="variant-body">
          <div className="variant-top">
            <div className="variant-labels">
              <span className="variant-generation">{generationLabel}</span>
              {isCurrent && <span className="variant-current-badge">✓ Version affichée</span>}
            </div>
            <span className="variant-date">{new Date(version.created_at).toLocaleDateString('fr-FR')}</span>
          </div>
          <h4>{version.version_name}</h4>
          {version.notes && <p>{version.notes}</p>}
          {parentVersion && <div className="variant-parent">↳ Inspirée de <strong>{parentVersion.version_name}</strong></div>}
          <div className="variant-summary"><span>{(ingredients[version.id] ?? []).length} ingrédient{(ingredients[version.id] ?? []).length > 1 ? 's' : ''}</span><span>{(steps[version.id] ?? []).length} étape{(steps[version.id] ?? []).length > 1 ? 's' : ''}</span></div>
          <div className="variant-actions">
            <button type="button" className={`secondary-button small-button ${isCurrent ? 'is-selected' : ''}`} onClick={() => onSelectVersion?.(version.id)} disabled={isCurrent}>{isCurrent ? 'Version affichée' : 'Voir cette version'}</button>
            {!version.is_original && <button type="button" className="secondary-button small-button" onClick={() => isEditing ? setEditingVersionId(null) : startEditing(version)}>{isEditing ? 'Fermer l’édition' : 'Modifier'}</button>}
          </div>
          {isEditing && <div className="variant-editor"><div className="variant-editor-heading"><h4>Personnaliser cette variante</h4><p>Modifiez librement les ingrédients et la préparation. La recette originale reste intacte.</p></div><div className="variant-editor-block"><div className="variant-editor-title"><h5>Ingrédients</h5><button type="button" className="secondary-button small-button" onClick={() => setDraftIngredients([...draftIngredients, blankIngredient()])}>＋ Ajouter</button></div>{draftIngredients.map((item, itemIndex) => <div className="variant-ingredient-row" key={itemIndex}><input placeholder="Quantité" value={item.quantity} onChange={e => { const copy=[...draftIngredients]; copy[itemIndex]={...copy[itemIndex],quantity:e.target.value}; setDraftIngredients(copy) }} /><input placeholder="Unité" value={item.unit} onChange={e => { const copy=[...draftIngredients]; copy[itemIndex]={...copy[itemIndex],unit:e.target.value}; setDraftIngredients(copy) }} /><input className="variant-wide" placeholder="Ingrédient" value={item.name} onChange={e => { const copy=[...draftIngredients]; copy[itemIndex]={...copy[itemIndex],name:e.target.value}; setDraftIngredients(copy) }} /><button type="button" onClick={() => moveItem(draftIngredients,setDraftIngredients,itemIndex,-1)}>↑</button><button type="button" onClick={() => moveItem(draftIngredients,setDraftIngredients,itemIndex,1)}>↓</button><button type="button" onClick={() => setDraftIngredients(draftIngredients.filter((_,i)=>i!==itemIndex))}>×</button></div>)}</div><div className="variant-editor-block"><div className="variant-editor-title"><h5>Préparation</h5><button type="button" className="secondary-button small-button" onClick={() => setDraftSteps([...draftSteps, blankStep()])}>＋ Ajouter</button></div>{draftSteps.map((item,itemIndex) => <div className="variant-step-row" key={itemIndex}><textarea placeholder={`Étape ${itemIndex + 1}`} value={item.instruction} onChange={e => { const copy=[...draftSteps]; copy[itemIndex]={...copy[itemIndex],instruction:e.target.value}; setDraftSteps(copy) }} /><div><input placeholder="Durée (min)" value={item.duration_minutes} onChange={e => { const copy=[...draftSteps]; copy[itemIndex]={...copy[itemIndex],duration_minutes:e.target.value}; setDraftSteps(copy) }} /><input placeholder="Température (°C)" value={item.temperature_celsius} onChange={e => { const copy=[...draftSteps]; copy[itemIndex]={...copy[itemIndex],temperature_celsius:e.target.value}; setDraftSteps(copy) }} /></div><div className="variant-row-actions"><button type="button" onClick={() => moveItem(draftSteps,setDraftSteps,itemIndex,-1)}>↑</button><button type="button" onClick={() => moveItem(draftSteps,setDraftSteps,itemIndex,1)}>↓</button><button type="button" onClick={() => setDraftSteps(draftSteps.filter((_,i)=>i!==itemIndex))}>×</button></div></div>)}</div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setEditingVersionId(null)}>Annuler</button><button type="button" className="primary-button" onClick={() => saveEdition(version)} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer les modifications'}</button></div></div>}
        </div>
      </article>
    })}</div>
  </section>
}
