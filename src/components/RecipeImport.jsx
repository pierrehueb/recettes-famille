import { useEffect, useRef, useState } from 'react'
import { analyzeRecipeScan } from '../lib/recipeImport'

const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

export default function RecipeImport({ onImported, onPhotoChange, onSourceChange, familyId }) {
  const [file, setFile] = useState(null)
  const [pages, setPages] = useState([])
  const [activePage, setActivePage] = useState(0)
  const [preparing, setPreparing] = useState(false)
  const cameraInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const [preview, setPreview] = useState('')
  const [cropPreview, setCropPreview] = useState('')
  const [crop, setCrop] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const page = pages[activePage]
    if (!page?.file) { setPreview(''); return }
    const url = URL.createObjectURL(page.file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [pages, activePage])

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

  const prepareFile = async nextFile => {
    setFile(nextFile); setPages([]); setActivePage(0); setCrop(null); setCropPreview(''); onPhotoChange?.(null); onSourceChange?.(nextFile)
    if (!nextFile) return
    if (nextFile.type !== 'application/pdf') {
      setPages([{ file: nextFile, selected: true, crop: { x: 0, y: 0, width: 1000, height: 1000 }, label: 'Image' }])
      return
    }
    setPreparing(true); setError('')
    try {
      const pdfjs = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/+esm')
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs'
      const data = new Uint8Array(await nextFile.arrayBuffer())
      const pdf = await pdfjs.getDocument({ data }).promise
      if (pdf.numPages > 30) throw new Error('Ce PDF contient trop de pages (30 maximum).')
      const rendered = []
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number)
        const viewport = page.getViewport({ scale: 1.6 })
        const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .9))
        rendered.push({ file: new File([blob], `page-${number}.jpg`, { type: 'image/jpeg' }), selected: number === 1, crop: { x: 0, y: 0, width: 1000, height: 1000 }, label: `Page ${number}` })
      }
      setPages(rendered)
    } catch (e) { setError(e.message || 'Impossible de lire ce PDF.') } finally { setPreparing(false) }
  }

  const updateSelectionCrop = next => setPages(current => current.map((page, index) => index === activePage ? { ...page, crop: next } : page))
  const togglePage = index => setPages(current => current.map((page, i) => i === index ? { ...page, selected: !page.selected } : page))

  const startSourceResize = (corner, event) => {
    event.preventDefault()
    const stage = event.currentTarget.closest('.recipe-crop-stage')
    const page = pages[activePage]
    if (!stage || !page) return
    const start = page.crop
    const startX = event.clientX
    const startY = event.clientY
    const rect = stage.getBoundingClientRect()
    const move = moveEvent => {
      const dx = (moveEvent.clientX - startX) / rect.width * 1000
      const dy = (moveEvent.clientY - startY) / rect.height * 1000
      let left = start.x, top = start.y, right = start.x + start.width, bottom = start.y + start.height
      if (corner.includes('l')) left = Math.max(0, Math.min(right - 40, start.x + dx))
      if (corner.includes('r')) right = Math.min(1000, Math.max(left + 40, start.x + start.width + dx))
      if (corner.includes('t')) top = Math.max(0, Math.min(bottom - 40, start.y + dy))
      if (corner.includes('b')) bottom = Math.min(1000, Math.max(top + 40, start.y + start.height + dy))
      updateSelectionCrop({ x: Math.round(left), y: Math.round(top), width: Math.round(right - left), height: Math.round(bottom - top) })
    }
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const buildAnalysisImage = async () => {
    const selected = pages.filter(page => page.selected)
    if (!selected.length) throw new Error('Sélectionnez au moins une page ou une zone.')
    const pieces = await Promise.all(selected.map(page => new Promise((resolve, reject) => {
      const url = URL.createObjectURL(page.file); const img = new Image()
      img.onload = () => { URL.revokeObjectURL(url); const r = page.crop; const sx=img.naturalWidth*r.x/1000, sy=img.naturalHeight*r.y/1000, sw=img.naturalWidth*r.width/1000, sh=img.naturalHeight*r.height/1000; const scale=Math.min(1,1600/Math.max(sw,sh)); const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(sw*scale)); canvas.height=Math.max(1,Math.round(sh*scale)); canvas.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height); resolve(canvas) }
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Une page est illisible.'))}; img.src=url
    })))
    const width=Math.max(...pieces.map(x=>x.width)); const gap=24; const height=pieces.reduce((sum,x)=>sum+x.height,0)+gap*(pieces.length-1); const scale=Math.min(1,3000/height); const out=document.createElement('canvas'); out.width=Math.max(1,Math.round(width*scale)); out.height=Math.max(1,Math.round(height*scale)); const ctx=out.getContext('2d'); ctx.fillStyle='white'; ctx.fillRect(0,0,out.width,out.height); let y=0; for(const piece of pieces){ const w=piece.width*scale,h=piece.height*scale; ctx.drawImage(piece,0,0,piece.width,piece.height,0,y,w,h); y+=h+gap*scale } const blob=await new Promise(resolve=>out.toBlob(resolve,'image/jpeg',.88)); return new File([blob],'recipe-selection.jpg',{type:'image/jpeg'})
  }

  const analyze = async () => {
    setLoading(true); setError(''); setCrop(null); setCropPreview(''); onPhotoChange?.(null)
    try {
      const analysisFile = await buildAnalysisImage()
      const recipe = await analyzeRecipeScan(analysisFile, familyId)
      onImported(recipe)
      const box = recipe.illustration
      if (box && [box.x, box.y, box.width, box.height].every(Number.isFinite) &&
          box.width >= 40 && box.height >= 40 && box.x >= 0 && box.y >= 0 &&
          box.x + box.width <= 1000 && box.y + box.height <= 1000) {
        const selected = { x: box.x, y: box.y, width: box.width, height: box.height }
        setCrop(selected)
        onPhotoChange?.({ file: analysisFile, crop: selected })
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
    <div className="recipe-import-source-actions">
      <button type="button" className="secondary-button recipe-camera-button" onClick={() => cameraInputRef.current?.click()}>📷 Prendre une photo</button>
      <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()}>📁 Choisir un fichier</button>
      <input ref={cameraInputRef} className="recipe-import-hidden-input" type="file" accept="image/*" capture="environment" onChange={event => { prepareFile(event.target.files?.[0] || null); event.target.value = '' }} />
      <input ref={fileInputRef} className="recipe-import-hidden-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => { prepareFile(event.target.files?.[0] || null); event.target.value = '' }} />
    </div>
    {preparing && <p className="field-hint">Préparation des pages du PDF…</p>}
    {pages.length > 1 && <div className="recipe-page-picker">{pages.map((page,index) => <button type="button" key={index} className={(page.selected ? 'selected ' : '') + (activePage === index ? 'active' : '')} onClick={() => setActivePage(index)}><span>{page.label}</span><input type="checkbox" checked={page.selected} onClick={e => e.stopPropagation()} onChange={() => togglePage(index)} aria-label={'Inclure '+page.label} /></button>)}</div>}
    {preview && <><p className="field-hint">Cadrez la zone de la recette sur {pages[activePage]?.label?.toLowerCase()}. Pour plusieurs pages, cochez toutes celles à analyser.</p><div className="recipe-crop-stage recipe-source-crop"><img src={preview} alt="Page à analyser" /><div className="recipe-crop-frame" style={{left:(pages[activePage]?.crop.x/10)+'%',top:(pages[activePage]?.crop.y/10)+'%',width:(pages[activePage]?.crop.width/10)+'%',height:(pages[activePage]?.crop.height/10)+'%'}}><span className="crop-grid-v crop-grid-one"/><span className="crop-grid-v crop-grid-two"/><span className="crop-grid-h crop-grid-one"/><span className="crop-grid-h crop-grid-two"/><button type="button" className="crop-handle crop-handle-tl" aria-label="Redimensionner depuis le coin supérieur gauche" onPointerDown={event => startSourceResize('tl', event)}/><button type="button" className="crop-handle crop-handle-tr" aria-label="Redimensionner depuis le coin supérieur droit" onPointerDown={event => startSourceResize('tr', event)}/><button type="button" className="crop-handle crop-handle-bl" aria-label="Redimensionner depuis le coin inférieur gauche" onPointerDown={event => startSourceResize('bl', event)}/><button type="button" className="crop-handle crop-handle-br" aria-label="Redimensionner depuis le coin inférieur droit" onPointerDown={event => startSourceResize('br', event)}/></div></div><div className="recipe-crop-controls">{[['x','Position horizontale'],['y','Position verticale'],['width','Largeur'],['height','Hauteur']].map(([key,label]) => { const r=pages[activePage]?.crop; if(!r) return null; const max=key==='x'?1000-r.width:key==='y'?1000-r.height:key==='width'?1000-r.x:1000-r.y; return <label key={key}>{label}<input type="range" min={key==='width'||key==='height'?40:0} max={max} value={r[key]} onChange={e=>{const next={...r,[key]:Number(e.target.value)};updateSelectionCrop(next)}} /></label>})}</div></>}
    {error && <div className="form-error">{error}</div>}
    <button type="button" className="secondary-button" onClick={analyze} disabled={!file || loading || preparing || !pages.some(page => page.selected)}>
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
