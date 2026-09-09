import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function FavoritesPage({ user, onOpen }) {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadFavorites = async () => {
    if (!supabase || !user) return
    setLoading(true)
    setError('')
    try {
      const { data: favoriteRows, error: favoriteError } = await supabase
        .from('favorites')
        .select('recipe_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (favoriteError) throw favoriteError
      const ids = (favoriteRows ?? []).map(row => row.recipe_id)
      if (!ids.length) {
        setFavorites([])
        return
      }
      const { data: recipes, error: recipesError } = await supabase
        .from('recipes')
        .select('id, title, description, original_author, origin_year, difficulty, servings')
        .in('id', ids)
      if (recipesError) throw recipesError
      const byId = new Map((recipes ?? []).map(recipe => [recipe.id, recipe]))
      setFavorites(ids.map(id => byId.get(id)).filter(Boolean))
    } catch (loadError) {
      setError(loadError.message || 'Impossible de charger vos favoris.')
      setFavorites([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFavorites() }, [user?.id])

  const removeFavorite = async (event, recipeId) => {
    event.stopPropagation()
    const { error: deleteError } = await supabase.from('favorites').delete().eq('recipe_id', recipeId).eq('user_id', user.id)
    if (deleteError) return setError(deleteError.message || 'Impossible de retirer ce favori.')
    setFavorites(current => current.filter(recipe => recipe.id !== recipeId))
  }

  if (loading) return <section className="favorites-section"><div className="status-card">Chargement de vos favoris…</div></section>

  return <section className="favorites-section">
    <header className="favorites-header">
      <div><p className="section-kicker">Mes recettes</p><h2>Mes favoris</h2><p>Les recettes que vous souhaitez garder à portée de main.</p></div>
      <div className="family-count"><strong>{favorites.length}</strong><span>favori{favorites.length > 1 ? 's' : ''}</span></div>
    </header>
    {error && <div className="form-error">{error}</div>}
    {!error && favorites.length === 0 && <div className="status-card empty-card"><span className="empty-icon">♥</span><h4>Votre sélection est encore vide</h4><p>Ouvrez une recette et utilisez « Ajouter aux favoris » pour la retrouver ici.</p></div>}
    {favorites.length > 0 && <div className="recipe-grid">{favorites.map(recipe => <article className="recipe-card" key={recipe.id}>
      <button type="button" className="recipe-card-open" onClick={() => onOpen(recipe.id)}>
        <div className="recipe-card-image" aria-hidden="true">🍲</div>
        <div className="recipe-card-body"><div className="recipe-card-meta">{recipe.original_author && <span>{recipe.original_author}</span>}{recipe.origin_year && <span>{recipe.origin_year}</span>}</div><h4>{recipe.title}</h4>{recipe.description && <p>{recipe.description}</p>}<div className="recipe-card-footer"><span>{recipe.servings ? `👨‍👩‍👧‍👦 ${recipe.servings} pers.` : 'Recette familiale'}</span>{recipe.difficulty && <span>{recipe.difficulty}</span>}</div></div>
      </button>
      <button type="button" className="favorite-remove" onClick={event => removeFavorite(event, recipe.id)} aria-label={`Retirer ${recipe.title} des favoris`} title="Retirer des favoris">♥</button>
    </article>)}</div>}
  </section>
}
