import { useEffect, useState } from 'react'
import { analyzeRecipeScan } from '../lib/recipeImport'

const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

export default function RecipeImport({ onImported, onPhotoChange, onSourceChange, familyId }) {
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

  const startResize = (corner, event) => {
    event.preventDefault()
    const stage = event.currentTarget.closest('.recipe-crop-stage')
    if (!stage || !crop) return
    const start = { x: event.clientX, y: event.clientY, crop: { ...crop }, rect: stage.getBoundingClientRect() }
    const move = moveEvent => {
      const dx = (moveEvent.clientX - start.x) / start.rect.width * 1000
      const dy = (moveEvent.clientY - start.y) / start.rect.height * 1000
      const left = start.crop.x, top = start.crop.y
      const right = start.crop.x + start.crop.width, bottom = start.crop.y + start.crop.height
      let nextLeft = left, nextTop = top, nextRight = right, nextBottom = bottom
      if (corner.includes('l')) nextLeft = clamp(left + dx, 0, right - 40)
      if (corner.includes('r')) nextRight = clamp(right + dx, left + 40, 1000)
      if (corner.includes('t')) nextTop = clamp(top + dy, 0, bottom - 40)
      if (corner.includes('b')) nextBottom = clamp(bottom + dy, top + 40, 1000)
      const next = { x: Math.round(nextLeft), y: Math.round(nextTop), width: Math.round(nextRight - nextLeft), height: Math.round(nextBottom - nextTop) }
      setCrop(next)
      onPhotoChange?.({ file, crop: next })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
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
      const nextFile = event.target.files?.[0] || null; setFile(nextFile); setCrop(null); setCropPreview(''); onPhotoChange?.(null); onSourceChange?.(nextFile)
    }} />
    {preview && <img className="recipe-import-preview" src={preview} alt="Page à analyser" />}
    {error && <div className="form-error">{error}</div>}
    <button type="button" className="secondary-button" onClick={analyze} disabled={!file || loading}>
      {loading ? 'Analyse en cours…' : 'Analyser et préremplir'}
    </button>
    {crop && <div className="recipe-illustration-editor">
      <h4>Photo d’illustration proposée</h4>
      <p>Faites glisser les coins du cadre pour ajuster directement le cadrage. La zone extérieure reste visible.</p>
      {preview && <div className="recipe-crop-stage"><img src={preview} alt="Page originale" /><div className="recipe-crop-frame" style={{ left: (crop.x / 10) + '%', top: (crop.y / 10) + '%', width: (crop.width / 10) + '%', height: (crop.height / 10) + '%' }}><span className="crop-grid-v crop-grid-one"></span><span className="crop-grid-v crop-grid-two"></span><span className="crop-grid-h crop-grid-one"></span><span className="crop-grid-h crop-grid-two"></span><button type="button" className="crop-handle crop-handle-tl" aria-label="Redimensionner depuis le coin supérieur gauche" onPointerDown={event => startResize("tl", event)}></button><button type="button" className="crop-handle crop-handle-tr" aria-label="Redimensionner depuis le coin supérieur droit" onPointerDown={event => startResize("tr", event)}></button><button type="button" className="crop-handle crop-handle-bl" aria-label="Redimensionner depuis le coin inférieur gauche" onPointerDown={event => startResize("bl", event)}></button><button type="button" className="crop-handle crop-handle-br" aria-label="Redimensionner depuis le coin inférieur droit" onPointerDown={event => startResize("br", event)}></button></div></div>}
      {cropPreview && <><div className="field-hint">Aperçu final</div><img className="recipe-crop-result" src={cropPreview} alt="Photo recadrée proposée" /></>}
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
