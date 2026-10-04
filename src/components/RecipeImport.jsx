import { useEffect, useState } from 'react'
import { analyzeRecipeScan } from '../lib/recipeImport'

const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

export default function RecipeImport({ onImported, onPhotoChange, familyId }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [cropPreview, setCropPreview] = useState('')
  const [crop, setCrop] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (!file || !crop) { setCropPreview(''); return }
    let cancelled = false
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      if (cancelled) return
      const x = Math.round(image.naturalWidth * crop.x / 1000)
      const y = Math.round(image.naturalHeight * crop.y / 1000)
      const w = Math.round(image.naturalWidth * crop.width / 1000)
      const h = Math.round(image.naturalHeight * crop.height / 1000)
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 1400 / Math.max(w, h))
      canvas.width = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      canvas.getContext('2d').drawImage(image, x, y, w, h, 0, 0, canvas.width, canvas.height)
      setCropPreview(canvas.toDataURL('image/jpeg', 0.85))
    }
    image.onerror = () => URL.revokeObjectURL(url)
    image.src = url
    return () => { cancelled = true; URL.revokeObjectURL(url) }
  }, [file, crop])

  const changeCrop = (key, value) => {
    setCrop(current => {
      if (!current) return current
      const next = { ...current, [key]: Number(value) }
      next.x = clamp(next.x, 0, 990)
      next.y = clamp(next.y, 0, 990)
      next.width = clamp(next.width, 10, 1000 - next.x)
      next.height = clamp(next.height, 10, 1000 - next.y)
      onPhotoChange?.({ file, crop: next })
      return next
    })
  }

  const analyze = async () => {
    setLoading(true); setError(''); setCrop(null); setCropPreview(''); onPhotoChange?.(null)
    try {
      const recipe = await analyzeRecipeScan(file, familyId)
      onImported(recipe)
      const box = recipe.illustration
      if (box && [box.x, box.y, box.width, box.height].every(Number.isFinite) &&
          box.width >= 40 && box.height >= 40 && box.x >= 0 && box.y >= 0 &&
          box.x + box.width <= 1000 && box.y + box.height <= 1000) {
        const selected = { x: box.x, y: box.y, width: box.width, height: box.height }
        setCrop(selected)
        onPhotoChange?.({ file, crop: selected })
      }
    } catch (e) {
      setError(e.message || 'Impossible d’analyser cette recette.')
    } finally { setLoading(false) }
  }

  return <section className="recipe-import">
    <div>
      <p className="section-kicker">Import intelligent</p>
      <h3>Scanner une recette imprimée</h3>
      <p>Importez une page : le texte est extrait et la photo du plat est proposée si elle est détectée.</p>
    </div>
    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
      setFile(event.target.files?.[0] || null); setCrop(null); setCropPreview(''); onPhotoChange?.(null)
    }} />
    {preview && <img className="recipe-import-preview" src={preview} alt="Page à analyser" />}
    {error && <div className="form-error">{error}</div>}
    <button type="button" className="secondary-button" onClick={analyze} disabled={!file || loading}>
      {loading ? 'Analyse en cours…' : 'Analyser et préremplir'}
    </button>
    {crop && <div className="recipe-illustration-editor">
      <h4>Photo d’illustration proposée</h4>
      <p>Vérifiez le cadrage. Cette photo ne sera enregistrée qu’avec votre recette.</p>
      {cropPreview && <img src={cropPreview} alt="Photo recadrée proposée" />}
      <div className="recipe-crop-controls">
        {[
          ['x', 'Position horizontale'], ['y', 'Position verticale'],
          ['width', 'Largeur'], ['height', 'Hauteur'],
        ].map(([key, label]) => <label key={key}>{label}
          <input type="range" min={key === 'width' || key === 'height' ? 10 : 0}
            max={key === 'x' ? 1000 - crop.width : key === 'y' ? 1000 - crop.height : key === 'width' ? 1000 - crop.x : 1000 - crop.y}
            value={crop[key]} onChange={event => changeCrop(key, event.target.value)} />
        </label>)}
      </div>
      <button type="button" className="secondary-button" onClick={() => {
        setCrop(null); setCropPreview(''); onPhotoChange?.(null)
      }}>Ne pas conserver cette photo</button>
    </div>}
    {!loading && file && !crop && <p className="field-hint">Si aucune photo n’est détectée, vous pourrez en ajouter depuis la fiche recette.</p>}
  </section>
}
