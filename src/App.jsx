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

  const signIn = async (event) => {
    event.preventDefault()
    if (!supabase) return setError('La connexion Supabase n’est pas configurée.')
    setLoading(true); setError('')
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setError(signInError.message)
    else onSignedIn(data.user)
    setLoading(false)
  }

  return <section className="auth-section">
    <div className="auth-card">
      <p className="section-kicker">Livre familial privé</p>
      <h2>Bienvenue dans votre livre</h2>
      <p>Connectez-vous pour retrouver et enrichir les recettes de la famille.</p>
      <form onSubmit={signIn} className="recipe-form">
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label>Mot de passe<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
      </form>
    </div>
  </section>
}

function RecipesPage({ recipes, loading, error, onRetry, onAdd }) {
  return <section className="recipes-section">
    <div className="section-heading">
      <div><p className="section-kicker">Le livre familial</p><h3>Toutes les recettes</h3></div>
      <div className="section-heading-actions"><button type="button" className="primary-button small-button" onClick={onAdd}>＋ Ajouter une recette</button>{!loading && recipes.length > 0 && <span className="recipe-count">{recipes.length} recette{recipes.length > 1 ? 's' : ''}</span>}</div>
    </div>
    {loading && <div className="status-card">Chargement des recettes…</div>}
    {!loading && error && <div className="status-card error-card"><strong>Impossible de charger les recettes.</strong><p>{error}</p><button type="button" className="secondary-button" onClick={onRetry}>Réessayer</button></div>}
    {!loading && !error && recipes.length === 0 && <div className="status-card empty-card"><span className="empty-icon">📖</span><h4>Votre livre commence ici</h4><p>Aucune recette n’est encore enregistrée. Ajoutez votre première recette familiale.</p><button type="button" className="primary-button" onClick={onAdd}>Ajouter la première recette</button></div>}
    {!loading && !error && recipes.length > 0 && <div className="recipe-grid">{recipes.map(recipe => <article className="recipe-card" key={recipe.id}><div className="recipe-card-image" aria-hidden="true">🍲</div><div className="recipe-card-body"><div className="recipe-card-meta">{recipe.original_author && <span>{recipe.original_author}</span>}{recipe.origin_year && <span>{recipe.origin_year}</span>}</div><h4>{recipe.title}</h4>{recipe.description && <p>{recipe.description}</p>}<div className="recipe-card-footer"><span>{recipe.servings ? `👨‍👩‍👧‍👦 ${recipe.servings} pers.` : 'Recette familiale'}</span>{recipe.difficulty && <span>{recipe.difficulty}</span>}</div></div></article>)}</div>}
  </section>
}

function AddRecipePage({ user, onCancel, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', original_author: '', origin_year: '', difficulty: '', servings: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const update = (field, value) => setForm(current => ({ ...current, [field]: value }))

  const saveRecipe = async (event) => {
    event.preventDefault()
    if (!supabase) return setError('La connexion Supabase n’est pas configurée.')
    setLoading(true); setError('')
    const { data: membership, error: membershipError } = await supabase.from('family_members').select('family_id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle()
    if (membershipError || !membership) { setError(membershipError?.message || 'Votre compte n’est associé à aucune famille active.'); setLoading(false); return }
    const payload = {
      family_id: membership.family_id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      original_author: form.original_author.trim() || null,
      origin_year: form.origin_year ? Number(form.origin_year) : null,
      difficulty: form.difficulty || null,
      servings: form.servings ? Number(form.servings) : null,
      created_by: user.id,
    }
    const { data, error: insertError } = await supabase.from('recipes').insert(payload).select('id').single()
    if (insertError) setError(insertError.message)
    else onCreated(data.id)
    setLoading(false)
  }

  return <section className="form-section">
    <div className="form-header"><div><p className="section-kicker">Nouvelle recette</p><h2>Ajouter une recette familiale</h2><p>Commencez par les informations principales. Les ingrédients, étapes et documents originaux seront ajoutés ensuite.</p></div><button type="button" className="secondary-button" onClick={onCancel}>Annuler</button></div>
    <form className="recipe-form large-form" onSubmit={saveRecipe}>
      <div className="form-grid"><label className="full-field">Nom de la recette *<input value={form.title} onChange={e => update('title', e.target.value)} required placeholder="Ex. Tarte aux pommes de Mamie" /></label>
      <label className="full-field">Description<textarea value={form.description} onChange={e => update('description', e.target.value)} rows="4" placeholder="Une courte présentation ou un souvenir lié à la recette…" /></label>
      <label>Auteur d’origine<input value={form.original_author} onChange={e => update('original_author', e.target.value)} placeholder="Ex. Mamie" /></label>
      <label>Année d’origine<input type="number" min="1800" max="2100" value={form.origin_year} onChange={e => update('origin_year', e.target.value)} placeholder="1987" /></label>
      <label>Difficulté<select value={form.difficulty} onChange={e => update('difficulty', e.target.value)}><option value="">Non précisée</option><option value="facile">Facile</option><option value="moyenne">Moyenne</option><option value="difficile">Difficile</option></select></label>
      <label>Nombre de personnes<input type="number" min="1" max="100" value={form.servings} onChange={e => update('servings', e.target.value)} placeholder="4" /></label></div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Annuler</button><button type="submit" className="primary-button" disabled={loading}>{loading ? 'Enregistrement…' : 'Enregistrer la recette'}</button></div>
    </form>
  </section>
}

function App() {
  const [activePage, setActivePage] = useState('home')
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
  const goTo = pageId => { setActivePage(pageId); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const signOut = async () => { await supabase?.auth.signOut(); setActivePage('home') }
  if (authLoading) return <div className="app"><main className="main-content"><div className="status-card">Chargement de votre livre…</div></main></div>
  if (!user) return <div className="app"><header className="app-header"><div className="header-inner"><div className="brand"><span className="brand-mark">🍲</span><span><span className="eyebrow">Notre livre de famille</span><span className="brand-title">Les recettes de notre famille</span></span></div></div></header><main className="main-content"><AuthPage onSignedIn={setUser} /></main><footer className="app-footer"><span>Un patrimoine familial à préserver ❤️</span></footer></div>

  const page = pages[activePage]
  return <div className="app">
    <header className="app-header"><div className="header-inner"><button className="brand" type="button" onClick={() => goTo('home')} aria-label="Retour à l'accueil"><span className="brand-mark" aria-hidden="true">🍲</span><span><span className="eyebrow">Notre livre de famille</span><span className="brand-title">Les recettes de notre famille</span></span></button><nav className="desktop-nav" aria-label="Navigation principale">{navigation.map(item => <button key={item.id} type="button" className={activePage === item.id ? 'nav-button active' : 'nav-button'} onClick={() => goTo(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav><button className="profile-button" type="button" onClick={signOut} aria-label="Se déconnecter" title="Se déconnecter">{user.email?.charAt(0).toUpperCase() || 'P'}</button></div></header>
    <main className="main-content">
      {activePage === 'recipes' && <RecipesPage recipes={recipes} loading={recipesLoading} error={recipesError} onRetry={loadRecipes} onAdd={() => goTo('add-recipe')} />}
      {activePage === 'add-recipe' && <AddRecipePage user={user} onCancel={() => goTo('recipes')} onCreated={() => goTo('recipes')} />}
      {['home','grandma','favorites'].includes(activePage) && <><section className="hero"><p className="hero-kicker">{page.kicker}</p><h2>{page.title}</h2><p className="hero-text">{page.text}</p>{activePage === 'home' && <div className="hero-actions"><button type="button" className="primary-button" onClick={() => goTo('recipes')}>Voir les recettes</button><button type="button" className="secondary-button" onClick={() => goTo('grandma')}>Recettes de Mamie</button></div>}</section>{activePage === 'home' && <section className="section-preview" aria-label="Navigation rapide"><div className="section-heading"><div><p className="section-kicker">À découvrir</p><h3>Votre livre de recettes</h3></div></div><div className="preview-grid"><button className="preview-card featured" type="button" onClick={() => goTo('grandma')}><span className="card-icon">📖</span><h4>Recettes de Mamie</h4><p>Les recettes originales et leurs documents manuscrits.</p></button><button className="preview-card" type="button" onClick={() => goTo('recipes')}><span className="card-icon">👨‍👩‍👧‍👦</span><h4>Recettes de la famille</h4><p>Les recettes partagées et enrichies par chacun.</p></button><button className="preview-card" type="button" onClick={() => goTo('favorites')}><span className="card-icon">❤️</span><h4>Mes favoris</h4><p>Retrouvez rapidement les recettes que vous aimez.</p></button></div></section>}</>}
    </main>
    <nav className="mobile-nav" aria-label="Navigation mobile">{navigation.map(item => <button key={item.id} type="button" className={activePage === item.id ? 'mobile-nav-button active' : 'mobile-nav-button'} onClick={() => goTo(item.id)}><span className="mobile-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label === 'Recettes de Mamie' ? 'Mamie' : item.label}</span></button>)}</nav>
    <footer className="app-footer"><span>Un patrimoine familial à préserver ❤️</span></footer>
  </div>
}

export default App
