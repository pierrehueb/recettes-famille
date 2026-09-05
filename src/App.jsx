import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

const navigation = [
  { id: 'home', label: 'Accueil', icon: '⌂' },
  { id: 'recipes', label: 'Recettes', icon: '📖' },
  { id: 'grandma', label: 'Recettes de Mamie', icon: '👵' },
  { id: 'favorites', label: 'Favoris', icon: '♥' },
]

const pages = {
  home: { kicker: 'Bienvenue', title: 'Des recettes transmises de génération en génération.', text: 'Retrouvez les recettes de la famille, les précieux écrits de Mamie, leurs adaptations et les souvenirs qui les accompagnent.' },
  grandma: { kicker: 'Le patrimoine de Mamie', title: 'Les recettes de Mamie', text: 'Les recettes originales, leurs documents manuscrits et les versions transmises aux générations suivantes.' },
  favorites: { kicker: 'Mes recettes', title: 'Mes favoris', text: 'Retrouvez ici les recettes que vous souhaitez garder à portée de main.' },
}

function AuthPage({ onSignedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const signIn = async event => {
    event.preventDefault()
    if (!supabase) return setError('La connexion Supabase n’est pas configurée.')
    setLoading(true); setError('')
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setError(signInError.message); else onSignedIn(data.user)
    setLoading(false)
  }
  return <section className="auth-section"><div className="auth-card">
    <p className="section-kicker">Livre familial privé</p><h2>Bienvenue dans votre livre</h2>
    <p>Connectez-vous pour retrouver et enrichir les recettes de la famille.</p>
    <form onSubmit={signIn} className="recipe-form">
      <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
      <label>Mot de passe<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></label>
      {error && <div className="form-error">{error}</div>}
      <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
    </form>
  </div></section>
}

function RecipesPage({ recipes, loading, error, onRetry, onAdd, onOpen }) {
  return <section className="recipes-section">
    <div className="section-heading"><div><p className="section-kicker">Le livre familial</p><h3>Toutes les recettes</h3></div>
      <div className="section-heading-actions"><button type="button" className="primary-button small-button" onClick={onAdd}>＋ Ajouter une recette</button>{!loading && recipes.length > 0 && <span className="recipe-count">{recipes.length} recette{recipes.length > 1 ? 's' : ''}</span>}</div>
    </div>
    {loading && <div className="status-card">Chargement des recettes…</div>}
    {!loading && error && <div className="status-card error-card"><strong>Impossible de charger les recettes.</strong><p>{error}</p><button type="button" className="secondary-button" onClick={onRetry}>Réessayer</button></div>}
    {!loading && !error && recipes.length === 0 && <div className="status-card empty-card"><span className="empty-icon">📖</span><h4>Votre livre commence ici</h4><p>Aucune recette n’est encore enregistrée. Ajoutez votre première recette familiale.</p><button type="button" className="primary-button" onClick={onAdd}>Ajouter la première recette</button></div>}
    {!loading && !error && recipes.length > 0 && <div className="recipe-grid">{recipes.map(recipe => <button className="recipe-card" key={recipe.id} type="button" onClick={() => onOpen(recipe.id)}><div className="recipe-card-image" aria-hidden="true">🍲</div><div className="recipe-card-body"><div className="recipe-card-meta">{recipe.original_author && <span>{recipe.original_author}</span>}{recipe.origin_year && <span>{recipe.origin_year}</span>}</div><h4>{recipe.title}</h4>{recipe.description && <p>{recipe.description}</p>}<div className="recipe-card-footer"><span>{recipe.servings ? `👨‍👩‍👧‍👦 ${recipe.servings} pers.` : 'Recette familiale'}</span>{recipe.difficulty && <span>{recipe.difficulty}</span>}</div></div></button>)}</div>}
  </section>
}

function MediaSection({ recipeId, user }) {
  const [familyId, setFamilyId] = useState(null)
  const [photos, setPhotos] = useState([])
  const [originals, setOriginals] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadMedia = async () => {
    if (!supabase || !recipeId || !user) return
    setLoading(true); setError(''); setMessage('')
    try {
      const { data: membership, error: membershipError } = await supabase.from('family_members').select('family_id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle()
      if (membershipError || !membership) throw new Error(membershipError?.message || 'Aucune famille active trouvée.')
      setFamilyId(membership.family_id)
      const { data, error: mediaError } = await supabase.from('media').select('id, storage_path, media_type, mime_type, original_filename, caption, position, created_at').eq('recipe_id', recipeId).order('position', { ascending: true }).order('created_at', { ascending: true })
      if (mediaError) throw mediaError
      const rows = data ?? []
      const signed = await Promise.all(rows.map(async item => {
        const { data: signedData } = await supabase.storage.from('family-media').createSignedUrl(item.storage_path, 3600)
        return { ...item, signedUrl: signedData?.signedUrl || '' }
      }))
      setPhotos(signed.filter(item => item.media_type === 'photo'))
      setOriginals(signed.filter(item => item.media_type === 'scan'))
    } catch (loadError) { setError(loadError.message || 'Impossible de charger les médias.') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadMedia() }, [recipeId, user?.id])

  const uploadFiles = async (event, kind) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length || !familyId || !supabase) return
    if (kind === 'original' && originals.length > 0) return setError('Le manuscrit original existe déjà. Il reste volontairement immuable depuis l’application.')
    setUploading(true); setError(''); setMessage('')
    try {
      for (const file of files) {
        const extension = file.name.includes('.') ? `.${file.name.split('.').pop().toLowerCase()}` : ''
        const id = crypto.randomUUID()
        const folder = kind === 'photo' ? `recipes/${recipeId}/photos` : `originals/${recipeId}`
        const path = `${familyId}/${folder}/${id}${extension}`
        const { error: uploadError } = await supabase.storage.from('family-media').upload(path, file, { contentType: file.type || undefined, upsert: false })
        if (uploadError) throw uploadError
        const { error: mediaError } = await supabase.from('media').insert({ family_id: familyId, recipe_id: recipeId, storage_path: path, media_type: kind === 'photo' ? 'photo' : 'scan', mime_type: file.type || null, original_filename: file.name, position: kind === 'photo' ? photos.length : 0, created_by: user.id })
        if (mediaError) throw mediaError
      }
      setMessage(kind === 'photo' ? 'Photo(s) ajoutée(s) à la recette.' : 'Le manuscrit original a été conservé dans le livre familial.')
      await loadMedia()
    } catch (uploadError) { setError(uploadError.message || 'Impossible d’importer le fichier.') }
    finally { setUploading(false) }
  }

  if (loading) return <section className="media-section"><div className="status-card">Chargement des photos et du manuscrit…</div></section>
  return <section className="media-section">
    <div className="media-heading"><div><p className="section-kicker">Le patrimoine visuel</p><h3>Photos & manuscrit original</h3><p>Les documents originaux restent privés et ne sont jamais remplacés par une nouvelle version.</p></div></div>
    {error && <div className="form-error media-message">{error}</div>}
    {message && <div className="media-success">{message}</div>}

    <div className="media-block"><div className="media-block-heading"><div><h4>📷 Photos de la recette</h4><p>Ajoutez les photos du plat, de la préparation ou des moments en famille.</p></div><label className="secondary-button upload-button">{uploading ? 'Import…' : '＋ Ajouter des photos'}<input type="file" accept="image/*" multiple disabled={uploading} onChange={e => uploadFiles(e, 'photo')} /></label></div>
      {photos.length === 0 ? <div className="media-empty">Aucune photo pour le moment.</div> : <div className="photo-grid">{photos.map(photo => <figure className="photo-card" key={photo.id}>{photo.signedUrl ? <img src={photo.signedUrl} alt={photo.caption || photo.original_filename || 'Photo de la recette'} /> : <div className="photo-unavailable">Image indisponible</div>}{photo.caption && <figcaption>{photo.caption}</figcaption>}</figure>)}</div>}
    </div>

    <div className="media-block original-block"><div className="media-block-heading"><div><p className="section-kicker">Pièce originale</p><h4>✍️ Manuscrit de Mamie</h4><p>Cette pièce est conservée comme document patrimonial. Une fois déposée, elle n’est pas modifiable depuis l’application.</p></div>{originals.length === 0 && <label className="primary-button upload-button">{uploading ? 'Import…' : '＋ Ajouter le manuscrit'}<input type="file" accept="image/*,.pdf,application/pdf" disabled={uploading} onChange={e => uploadFiles(e, 'original')} /></label>}</div>
      {originals.length === 0 ? <div className="media-empty manuscript-empty">Aucun manuscrit original n’a encore été numérisé pour cette recette.</div> : <div className="original-list">{originals.map(original => <div className="original-card" key={original.id}>{original.signedUrl && original.mime_type?.startsWith('image/') ? <img src={original.signedUrl} alt="Manuscrit original de Mamie" className="manuscript-image" /> : <div className="document-preview"><span>📜</span><strong>{original.original_filename || 'Document original'}</strong><small>{original.mime_type || 'Document'}</small></div>}{original.signedUrl && <a className="secondary-button" href={original.signedUrl} target="_blank" rel="noreferrer">Ouvrir le document</a>}</div>)}</div>}
    </div>
  </section>
}

function RecipeDetailPage({ recipeId, user, onBack }) {
  const [recipe, setRecipe] = useState(null)
  const [version, setVersion] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!supabase || !recipeId) return
      setLoading(true); setError('')
      try {
        const { data: recipeData, error: recipeError } = await supabase.from('recipes').select('id, title, description, original_author, origin_year, difficulty, servings, created_at').eq('id', recipeId).single()
        if (recipeError) throw recipeError
        const { data: versionData, error: versionError } = await supabase.from('recipe_versions').select('id, version_name, notes, is_original, based_on_version_id, created_at, updated_at').eq('recipe_id', recipeId).order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (versionError) throw versionError
        if (!versionData) throw new Error('Cette recette ne contient encore aucune version exploitable.')
        const [ingredientsResult, stepsResult] = await Promise.all([
          supabase.from('ingredients').select('id, position, quantity, unit, name, notes').eq('version_id', versionData.id).order('position', { ascending: true }),
          supabase.from('preparation_steps').select('id, position, instruction, duration_minutes, temperature_celsius').eq('version_id', versionData.id).order('position', { ascending: true }),
        ])
        if (ingredientsResult.error) throw ingredientsResult.error
        if (stepsResult.error) throw stepsResult.error
        if (!cancelled) { setRecipe(recipeData); setVersion(versionData); setIngredients(ingredientsResult.data ?? []); setSteps(stepsResult.data ?? []) }
      } catch (loadError) { if (!cancelled) setError(loadError.message || 'Impossible de charger cette recette.') }
      finally { if (!cancelled) setLoading(false) }
    }
    load(); return () => { cancelled = true }
  }, [recipeId])
  if (loading) return <section className="detail-section"><button type="button" className="secondary-button back-button" onClick={onBack}>← Retour aux recettes</button><div className="status-card">Chargement de la recette…</div></section>
  if (error) return <section className="detail-section"><button type="button" className="secondary-button back-button" onClick={onBack}>← Retour aux recettes</button><div className="status-card error-card"><strong>Impossible de charger la recette.</strong><p>{error}</p></div></section>
  if (!recipe) return null
  const difficultyLabel = { facile: 'Facile', moyenne: 'Moyenne', difficile: 'Difficile' }[recipe.difficulty] || recipe.difficulty
  return <section className="detail-section">
    <button type="button" className="secondary-button back-button" onClick={onBack}>← Retour aux recettes</button>
    <article className="recipe-detail">
      <header className="detail-header"><div className="detail-cover" aria-hidden="true">🍲</div><div className="detail-intro"><p className="section-kicker">{version?.is_original ? 'Recette originale' : 'Recette familiale'}</p><h2>{recipe.title}</h2>{recipe.description && <p className="detail-description">{recipe.description}</p>}<div className="detail-meta">{recipe.original_author && <span>👵 {recipe.original_author}</span>}{recipe.origin_year && <span>📅 {recipe.origin_year}</span>}{recipe.servings && <span>👨‍👩‍👧‍👦 {recipe.servings} personnes</span>}{difficultyLabel && <span>◎ {difficultyLabel}</span>}</div></div></header>
      <div className="detail-content">
        <section className="detail-panel"><div className="detail-panel-heading"><p className="section-kicker">Les ingrédients</p><h3>Pour préparer cette recette</h3></div>{ingredients.length === 0 ? <p className="muted-text">Aucun ingrédient renseigné.</p> : <ul className="detail-ingredients">{ingredients.map(item => <li key={item.id}><span className="ingredient-amount">{item.quantity ?? ''}{item.quantity != null && item.unit ? ` ${item.unit}` : item.unit || ''}</span><span className="ingredient-name">{item.name}</span>{item.notes && <span className="ingredient-note">{item.notes}</span>}</li>)}</ul>}</section>
        <section className="detail-panel"><div className="detail-panel-heading"><p className="section-kicker">La préparation</p><h3>Étape par étape</h3></div>{steps.length === 0 ? <p className="muted-text">Aucune étape renseignée.</p> : <ol className="detail-steps">{steps.map((step, index) => <li key={step.id}><div className="detail-step-number">{index + 1}</div><div><p>{step.instruction}</p>{(step.duration_minutes != null || step.temperature_celsius != null) && <div className="step-meta">{step.duration_minutes != null && <span>⏱ {step.duration_minutes} min</span>}{step.temperature_celsius != null && <span>🌡 {step.temperature_celsius} °C</span>}</div>}</div></li>)}</ol>}</section>
      </div>
      <MediaSection recipeId={recipeId} user={user} />
    </article>
  </section>
}

const emptyIngredient = () => ({ quantity: '', unit: '', name: '', notes: '' })
const emptyStep = () => ({ instruction: '', duration_minutes: '', temperature_celsius: '' })

function AddRecipePage({ user, onCancel, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', original_author: '', origin_year: '', difficulty: '', servings: '' })
  const [ingredients, setIngredients] = useState([emptyIngredient()])
  const [steps, setSteps] = useState([emptyStep()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const update = (field, value) => setForm(current => ({ ...current, [field]: value }))
  const updateIngredient = (index, field, value) => setIngredients(current => current.map((item, i) => i === index ? { ...item, [field]: value } : item))
  const updateStep = (index, field, value) => setSteps(current => current.map((item, i) => i === index ? { ...item, [field]: value } : item))
  const addIngredient = () => setIngredients(current => [...current, emptyIngredient()])
  const removeIngredient = index => setIngredients(current => current.length === 1 ? current : current.filter((_, i) => i !== index))
  const moveIngredient = (index, direction) => setIngredients(current => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next })
  const addStep = () => setSteps(current => [...current, emptyStep()])
  const removeStep = index => setSteps(current => current.length === 1 ? current : current.filter((_, i) => i !== index))
  const moveStep = (index, direction) => setSteps(current => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next })
  const saveRecipe = async event => {
    event.preventDefault()
    if (!supabase) return setError('La connexion Supabase n’est pas configurée.')
    if (!form.title.trim()) return setError('Le nom de la recette est obligatoire.')
    const validIngredients = ingredients.filter(item => item.name.trim())
    const invalidIngredient = ingredients.some(item => item.name.trim() && item.quantity !== '' && Number.isNaN(Number(item.quantity)))
    const validSteps = steps.filter(item => item.instruction.trim())
    if (invalidIngredient) return setError('Vérifiez les quantités des ingrédients.')
    if (validSteps.length === 0) return setError('Ajoutez au moins une étape de préparation.')
    setLoading(true); setError('')
    try {
      const { data: membership, error: membershipError } = await supabase.from('family_members').select('family_id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle()
      if (membershipError || !membership) throw new Error(membershipError?.message || 'Votre compte n’est associé à aucune famille active.')
      const { data: recipe, error: recipeError } = await supabase.from('recipes').insert({ family_id: membership.family_id, title: form.title.trim(), description: form.description.trim() || null, original_author: form.original_author.trim() || null, origin_year: form.origin_year ? Number(form.origin_year) : null, difficulty: form.difficulty || null, servings: form.servings ? Number(form.servings) : null, created_by: user.id }).select('id').single()
      if (recipeError) throw recipeError
      const { data: version, error: versionError } = await supabase.from('recipe_versions').insert({ recipe_id: recipe.id, version_name: 'Version familiale', created_by: user.id }).select('id').single()
      if (versionError) throw versionError
      if (validIngredients.length) {
        const { error } = await supabase.from('ingredients').insert(validIngredients.map((item, index) => ({ version_id: version.id, position: index + 1, quantity: item.quantity === '' ? null : Number(item.quantity), unit: item.unit.trim() || null, name: item.name.trim(), notes: item.notes.trim() || null })))
        if (error) throw error
      }
      const { error: stepsError } = await supabase.from('preparation_steps').insert(validSteps.map((item, index) => ({ version_id: version.id, position: index + 1, instruction: item.instruction.trim(), duration_minutes: item.duration_minutes === '' ? null : Number(item.duration_minutes), temperature_celsius: item.temperature_celsius === '' ? null : Number(item.temperature_celsius) })))
      if (stepsError) throw stepsError
      onCreated(recipe.id)
    } catch (saveError) { setError(saveError.message || 'Une erreur est survenue pendant l’enregistrement.') }
    finally { setLoading(false) }
  }
  return <section className="form-section">
    <div className="form-header"><div><p className="section-kicker">Nouvelle recette</p><h2>Ajouter une recette familiale</h2><p>Conservez la recette telle qu’elle est transmise, puis enrichissez-la avec ses ingrédients et ses étapes.</p></div><button type="button" className="secondary-button" onClick={onCancel}>Annuler</button></div>
    <form className="recipe-form large-form" onSubmit={saveRecipe}>
      <div className="form-grid"><label className="full-field">Nom de la recette *<input value={form.title} onChange={e => update('title', e.target.value)} required placeholder="Ex. Tarte aux pommes de Mamie" /></label><label className="full-field">Description<textarea value={form.description} onChange={e => update('description', e.target.value)} rows="4" placeholder="Une courte présentation ou un souvenir lié à la recette…" /></label><label>Auteur d’origine<input value={form.original_author} onChange={e => update('original_author', e.target.value)} placeholder="Ex. Mamie" /></label><label>Année d’origine<input type="number" min="1800" max="2100" value={form.origin_year} onChange={e => update('origin_year', e.target.value)} placeholder="1987" /></label><label>Difficulté<select value={form.difficulty} onChange={e => update('difficulty', e.target.value)}><option value="">Non précisée</option><option value="facile">Facile</option><option value="moyenne">Moyenne</option><option value="difficile">Difficile</option></select></label><label>Nombre de personnes<input type="number" min="1" max="100" value={form.servings} onChange={e => update('servings', e.target.value)} placeholder="4" /></label></div>
      <section className="editor-section"><div className="editor-section-header"><div><p className="section-kicker">Les ingrédients</p><h3>De quoi avez-vous besoin ?</h3></div><button type="button" className="secondary-button" onClick={addIngredient}>＋ Ajouter un ingrédient</button></div><div className="ingredient-list">{ingredients.map((item, index) => <div className="ingredient-row" key={index}><span className="row-number">{index + 1}</span><input type="number" min="0" step="any" value={item.quantity} onChange={e => updateIngredient(index, 'quantity', e.target.value)} placeholder="Qté" aria-label={`Quantité ingrédient ${index + 1}`} /><input value={item.unit} onChange={e => updateIngredient(index, 'unit', e.target.value)} placeholder="Unité" aria-label={`Unité ingrédient ${index + 1}`} /><input value={item.name} onChange={e => updateIngredient(index, 'name', e.target.value)} placeholder="Ex. farine" aria-label={`Nom ingrédient ${index + 1}`} /><input value={item.notes} onChange={e => updateIngredient(index, 'notes', e.target.value)} placeholder="Précision (optionnel)" aria-label={`Note ingrédient ${index + 1}`} /><div className="row-actions"><button type="button" onClick={() => moveIngredient(index, -1)} disabled={index === 0}>↑</button><button type="button" onClick={() => moveIngredient(index, 1)} disabled={index === ingredients.length - 1}>↓</button><button type="button" onClick={() => removeIngredient(index)} disabled={ingredients.length === 1}>×</button></div></div>)}</div></section>
      <section className="editor-section"><div className="editor-section-header"><div><p className="section-kicker">La préparation</p><h3>Les étapes, dans l’ordre</h3></div><button type="button" className="secondary-button" onClick={addStep}>＋ Ajouter une étape</button></div><div className="step-list">{steps.map((step, index) => <div className="step-row" key={index}><div className="step-number">{index + 1}</div><textarea value={step.instruction} onChange={e => updateStep(index, 'instruction', e.target.value)} rows="3" placeholder="Décrivez cette étape…" /><div className="step-details"><input type="number" min="0" value={step.duration_minutes} onChange={e => updateStep(index, 'duration_minutes', e.target.value)} placeholder="Durée (min)" /><input type="number" min="0" step="any" value={step.temperature_celsius} onChange={e => updateStep(index, 'temperature_celsius', e.target.value)} placeholder="Température °C" /></div><div className="row-actions"><button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0}>↑</button><button type="button" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1}>↓</button><button type="button" onClick={() => removeStep(index)} disabled={steps.length === 1}>×</button></div></div>)}</div></section>
      {error && <div className="form-error">{error}</div>}<div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Annuler</button><button type="submit" className="primary-button" disabled={loading}>{loading ? 'Enregistrement…' : 'Enregistrer la recette'}</button></div>
    </form>
  </section>
}

function App() {
  const [activePage, setActivePage] = useState('home')
  const [selectedRecipeId, setSelectedRecipeId] = useState(null)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [recipes, setRecipes] = useState([])
  const [recipesLoading, setRecipesLoading] = useState(false)
  const [recipesError, setRecipesError] = useState('')
  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setAuthLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])
  const loadRecipes = async () => {
    if (!supabase) { setRecipesError('La connexion Supabase n’est pas configurée.'); return }
    setRecipesLoading(true); setRecipesError('')
    const { data, error } = await supabase.from('recipes').select('id, title, description, original_author, origin_year, difficulty, servings, created_at').order('created_at', { ascending: false })
    if (error) { setRecipesError(error.message); setRecipes([]) } else setRecipes(data ?? [])
    setRecipesLoading(false)
  }
  useEffect(() => { if (activePage === 'recipes' && user) loadRecipes() }, [activePage, user])
  const goTo = pageId => { setActivePage(pageId); if (pageId !== 'recipe-detail') setSelectedRecipeId(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const openRecipe = recipeId => { setSelectedRecipeId(recipeId); setActivePage('recipe-detail'); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const signOut = async () => { await supabase?.auth.signOut(); setActivePage('home'); setSelectedRecipeId(null) }
  if (authLoading) return <div className="app"><main className="main-content"><div className="status-card">Chargement de votre livre…</div></main></div>
  if (!user) return <div className="app"><header className="app-header"><div className="header-inner"><div className="brand"><span className="brand-mark">🍲</span><span><span className="eyebrow">Notre livre de famille</span><span className="brand-title">Les recettes de notre famille</span></span></div></div></header><main className="main-content"><AuthPage onSignedIn={setUser} /></main><footer className="app-footer">Un patrimoine familial à préserver ❤️</footer></div>
  const page = pages[activePage]
  return <div className="app">
    <header className="app-header"><div className="header-inner"><button className="brand" type="button" onClick={() => goTo('home')} aria-label="Retour à l'accueil"><span className="brand-mark" aria-hidden="true">🍲</span><span><span className="eyebrow">Notre livre de famille</span><span className="brand-title">Les recettes de notre famille</span></span></button><nav className="desktop-nav" aria-label="Navigation principale">{navigation.map(item => <button key={item.id} type="button" className={activePage === item.id ? 'nav-button active' : 'nav-button'} onClick={() => goTo(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav><button className="profile-button" type="button" onClick={signOut} aria-label="Se déconnecter" title="Se déconnecter">{user.email?.charAt(0).toUpperCase() || 'P'}</button></div></header>
    <main className="main-content">
      {activePage === 'recipes' && <RecipesPage recipes={recipes} loading={recipesLoading} error={recipesError} onRetry={loadRecipes} onAdd={() => goTo('add-recipe')} onOpen={openRecipe} />}
      {activePage === 'recipe-detail' && selectedRecipeId && <RecipeDetailPage recipeId={selectedRecipeId} user={user} onBack={() => goTo('recipes')} />}
      {activePage === 'add-recipe' && <AddRecipePage user={user} onCancel={() => goTo('recipes')} onCreated={openRecipe} />}
      {['home','grandma','favorites'].includes(activePage) && <><section className="hero"><p className="hero-kicker">{page.kicker}</p><h2>{page.title}</h2><p className="hero-text">{page.text}</p>{activePage === 'home' && <div className="hero-actions"><button type="button" className="primary-button" onClick={() => goTo('recipes')}>Voir les recettes</button><button type="button" className="secondary-button" onClick={() => goTo('grandma')}>Recettes de Mamie</button></div>}</section>{activePage === 'home' && <section className="section-preview"><div className="section-heading"><div><p className="section-kicker">À découvrir</p><h3>Votre livre de recettes</h3></div></div><div className="preview-grid"><button className="preview-card featured" type="button" onClick={() => goTo('grandma')}><span className="card-icon">📖</span><h4>Recettes de Mamie</h4><p>Les recettes originales et leurs documents manuscrits.</p></button><button className="preview-card" type="button" onClick={() => goTo('recipes')}><span className="card-icon">👨‍👩‍👧‍👦</span><h4>Recettes de la famille</h4><p>Les recettes partagées et enrichies par chacun.</p></button><button className="preview-card" type="button" onClick={() => goTo('favorites')}><span className="card-icon">❤️</span><h4>Mes favoris</h4><p>Retrouvez rapidement les recettes que vous aimez.</p></button></div></section>}</>}
    </main>
    <nav className="mobile-nav" aria-label="Navigation mobile">{navigation.map(item => <button key={item.id} type="button" className={activePage === item.id ? 'mobile-nav-button active' : 'mobile-nav-button'} onClick={() => goTo(item.id)}><span className="mobile-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></button>)}</nav>
    <footer className="app-footer">Un patrimoine familial à préserver ❤️</footer>
  </div>
}

export default App
