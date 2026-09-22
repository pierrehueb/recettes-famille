import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function FavoritesPage({ user, onOpen }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadFavorites = async () => {
      if (!supabase || !user) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const { data: favorites, error: favoritesError } = await supabase
          .from('favorites')
          .select('recipe_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (favoritesError) throw favoritesError

        const favoriteRows = favorites ?? []
        if (favoriteRows.length === 0) {
          if (!cancelled) setRecipes([])
          return
        }

        const recipeIds = favoriteRows.map(item => item.recipe_id)
        const { data: recipeData, error: recipesError } = await supabase
          .from('recipes')
          .select('id, title, description, original_author, origin_year, difficulty, servings, preparation_time_minutes, cooking_time_minutes, tags, category_id, created_at, categories(name)')
          .in('id', recipeIds)

        if (recipesError) throw recipesError

        const byId = new Map((recipeData ?? []).map(recipe => [recipe.id, recipe]))
        const orderedRecipes = favoriteRows
          .map(item => byId.get(item.recipe_id))
          .filter(Boolean)

        if (!cancelled) setRecipes(orderedRecipes)
      } catch (loadError) {
        if (!cancelled) {
          setRecipes([])
          setError(loadError.message || 'Impossible de charger vos favoris.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadFavorites()
    return () => { cancelled = true }
  }, [user?.id])

  return <section className="recipes-section">
    <div className="section-heading">
      <div>
        <p className="section-kicker">Mes recettes</p>
        <h3>Mes favoris</h3>
      </div>
      {!loading && !error && recipes.length > 0 && <span className="recipe-count">{recipes.length} recette{recipes.length > 1 ? 's' : ''}</span>}
    </div>

    {loading && <div className="status-card">Chargement de vos favoris…</div>}

    {!loading && error && <div className="status-card error-card">
      <strong>Impossible de charger vos favoris.</strong>
      <p>{error}</p>
    </div>}

    {!loading && !error && recipes.length === 0 && <div className="status-card empty-card">
      <span className="empty-icon">♥</span>
      <h4>Aucun favori pour le moment</h4>
      <p>Ajoutez une recette à vos favoris depuis sa fiche pour la retrouver ici.</p>
    </div>}

    {!loading && !error && recipes.length > 0 && <div className="recipe-grid">
      {recipes.map(recipe => <div className="recipe-card" key={recipe.id}>
        <button className="recipe-card-open" type="button" onClick={() => onOpen(recipe.id)}>
          <div className="recipe-card-body">
            {recipe.categories?.name && <span className="category-badge">{recipe.categories.name}</span>}
            <div className="recipe-card-meta">
              {recipe.original_author && <span>{recipe.original_author}</span>}
              {recipe.origin_year && <span>{recipe.origin_year}</span>}
            </div>
            <h4>{recipe.title}</h4>
            {recipe.description && <p>{recipe.description}</p>}
            {recipe.tags?.length > 0 && <div className="recipe-tags compact">{recipe.tags.slice(0, 3).map(tag => <span key={tag}>#{tag}</span>)}</div>}
            <div className="recipe-card-footer">
              <span>{recipe.servings ? `👨‍👩‍👧‍👦 ${recipe.servings} pers.` : 'Recette familiale'}</span>
              {recipe.difficulty && <span>{recipe.difficulty}</span>}
            </div>
          </div>
        </button>
        <span className="recipe-card-favorite is-favorite" aria-label="Favori" title="Favori">♥</span>
      </div>)}
    </div>}
  </section>
}

export default FavoritesPage
