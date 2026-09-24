import { useEffect, useState } from 'react'
import { analyzeRecipeScan } from '../lib/recipeImport'

export default function RecipeImport({ onImported }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file) return setPreview('')
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const analyze = async () => {
    setLoading(true); setError('')
    try {
      const recipe = await analyzeRecipeScan(file)
      onImported(recipe)
    } catch (e) {
      setError(e.message || 'Impossible d’analyser cette recette.')
    } finally {
      setLoading(false)
    }
  }

  return <section className="recipe-import">
    <div>
      <p className="section-kicker">Import intelligent</p>
      <h3>Scanner une recette imprimée</h3>
      <p>Ajoutez une photo ou un scan. Les champs seront préremplis et vous pourrez tout vérifier avant l’enregistrement.</p>
    </div>
    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] || null)} />
    {preview && <img className="recipe-import-preview" src={preview} alt="Aperçu de la recette à analyser" />}
    {error && <div className="form-error">{error}</div>}
    <button type="button" className="secondary-button" onClick={analyze} disabled={!file || loading}>
      {loading ? 'Analyse en cours…' : 'Analyser et préremplir'}
    </button>
  </section>
}
