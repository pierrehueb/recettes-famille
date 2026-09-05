import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function RecipeVariants({ recipeId, user, currentVersionId }) {
  const [versions, setVersions] = useState([])
  const [ingredients, setIngredients] = useState({})
  const [steps, setSteps] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', notes: '' })

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
      const { data: version, error: versionError } = await supabase.from('recipe_versions').insert({ recipe_id: recipeId, version_name: form.name.trim(), notes: form.notes.trim() || null, based_on_version_id: currentVersionId, created_by: user.id }).select('id').single()
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
      setForm({ name: '', notes: '' }); setOpen(false); await load()
    } catch (saveError) { setError(saveError.message || 'Impossible de créer cette variante.') }
    finally { setSaving(false) }
  }

  if (loading) return <section className="variants-section"><div className="status-card">Chargement des variantes familiales…</div></section>
  return <section className="variants-section">
    <div className="variants-header"><div><p className="section-kicker">Transmission familiale</p><h3>Les variantes de la recette</h3><p>Chaque génération peut créer sa propre version sans modifier les recettes précédentes.</p></div><button type="button" className="primary-button small-button" onClick={() => setOpen(v => !v)}>＋ Nouvelle variante</button></div>
    {error && <div className="form-error">{error}</div>}
    {open && <form className="variant-form" onSubmit={createVariant}><label>Nom de la variante<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex. Version de Maman – 2005" required /></label><label>Ce qui a changé<textarea rows="3" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Plus de beurre, cuisson différente…" /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Annuler</button><button className="primary-button" disabled={saving}>{saving ? 'Création…' : 'Créer la variante'}</button></div></form>}
    <div className="variant-timeline">{versions.map((version, index) => <article className={`variant-card ${version.id === currentVersionId ? 'current' : ''}`} key={version.id}><div className="variant-dot" /><div className="variant-body"><div className="variant-top"><span className="variant-generation">{version.is_original ? '👵 Original' : `Version ${index}`}</span><span className="variant-date">{new Date(version.created_at).toLocaleDateString('fr-FR')}</span></div><h4>{version.version_name}</h4>{version.notes && <p>{version.notes}</p>}<div className="variant-summary"><span>{(ingredients[version.id] ?? []).length} ingrédient{(ingredients[version.id] ?? []).length > 1 ? 's' : ''}</span><span>{(steps[version.id] ?? []).length} étape{(steps[version.id] ?? []).length > 1 ? 's' : ''}</span>{version.based_on_version_id && <span>↳ dérivée d'une version précédente</span>}</div></div></article>)}</div>
  </section>
}
