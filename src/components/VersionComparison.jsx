import { useEffect, useMemo, useState } from 'react'
import './VersionComparison.css'

const normalize = value => String(value ?? '').trim().toLowerCase()

const compareIngredients = (leftItems, rightItems) => {
  const left = leftItems ?? []
  const right = rightItems ?? []
  const rightByName = new Map(right.map(item => [normalize(item.name), item]))
  const leftByName = new Map(left.map(item => [normalize(item.name), item]))
  const rows = []

  left.forEach(item => {
    const key = normalize(item.name)
    const match = rightByName.get(key)
    if (!match) rows.push({ type: 'removed', left: item, right: null })
    else {
      const changed = Number(item.quantity ?? 0) !== Number(match.quantity ?? 0) || normalize(item.unit) !== normalize(match.unit) || normalize(item.notes) !== normalize(match.notes)
      rows.push({ type: changed ? 'changed' : 'same', left: item, right: match })
    }
  })
  right.forEach(item => { if (!leftByName.has(normalize(item.name))) rows.push({ type: 'added', left: null, right: item }) })
  return rows
}

const ingredientLabel = item => {
  if (!item) return '—'
  const amount = [item.quantity, item.unit].filter(value => value !== null && value !== undefined && value !== '').join(' ')
  return `${amount}${amount ? ' ' : ''}${item.name}${item.notes ? ` — ${item.notes}` : ''}`
}

const stepLabel = step => {
  if (!step) return '—'
  const meta = [step.duration_minutes != null ? `${step.duration_minutes} min` : '', step.temperature_celsius != null ? `${step.temperature_celsius} °C` : ''].filter(Boolean).join(' · ')
  return `${step.instruction}${meta ? ` (${meta})` : ''}`
}

export default function VersionComparison({ versions, ingredients, steps, creatorNames, currentVersionId }) {
  const [open, setOpen] = useState(false)
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const orderedVersions = useMemo(() => [...versions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)), [versions])

  useEffect(() => {
    if (!open || orderedVersions.length < 2) return
    const original = orderedVersions.find(version => version.is_original) ?? orderedVersions[0]
    const current = orderedVersions.find(version => version.id === currentVersionId) ?? orderedVersions[orderedVersions.length - 1]
    setLeftId(original.id)
    setRightId(current.id === original.id ? orderedVersions[orderedVersions.length - 1].id : current.id)
  }, [open, orderedVersions, currentVersionId])

  const leftVersion = orderedVersions.find(version => version.id === leftId) ?? null
  const rightVersion = orderedVersions.find(version => version.id === rightId) ?? null
  const ingredientRows = useMemo(() => compareIngredients(ingredients[leftId], ingredients[rightId]), [ingredients, leftId, rightId])
  const stepRows = useMemo(() => {
    const left = steps[leftId] ?? []
    const right = steps[rightId] ?? []
    const count = Math.max(left.length, right.length)
    return Array.from({ length: count }, (_, index) => {
      const leftStep = left[index] ?? null
      const rightStep = right[index] ?? null
      const changed = stepLabel(leftStep) !== stepLabel(rightStep)
      return { index, left: leftStep, right: rightStep, type: !leftStep ? 'added' : !rightStep ? 'removed' : changed ? 'changed' : 'same' }
    })
  }, [steps, leftId, rightId])

  if (versions.length < 2) return null
  const changedIngredients = ingredientRows.filter(row => row.type !== 'same').length
  const changedSteps = stepRows.filter(row => row.type !== 'same').length

  return <>
    <button type="button" className="secondary-button small-button" onClick={() => setOpen(true)}>⇄ Comparer deux versions</button>
    {open && <div className="comparison-backdrop" role="dialog" aria-modal="true" aria-labelledby="version-comparison-title" onClick={event => { if (event.target === event.currentTarget) setOpen(false) }}>
      <div className="comparison-modal">
        <div className="comparison-header"><div><p className="section-kicker">Évolution de la recette</p><h3 id="version-comparison-title">Comparer deux versions</h3><p>Voyez rapidement ce qui a changé entre deux générations de la recette.</p></div><button type="button" className="comparison-close" onClick={() => setOpen(false)} aria-label="Fermer">×</button></div>
        <div className="comparison-selectors"><label>Version de départ<select value={leftId} onChange={event => setLeftId(event.target.value)}>{orderedVersions.map(version => <option key={version.id} value={version.id}>{version.version_name}</option>)}</select></label><span className="comparison-arrow">→</span><label>Version d’arrivée<select value={rightId} onChange={event => setRightId(event.target.value)}>{orderedVersions.map(version => <option key={version.id} value={version.id}>{version.version_name}</option>)}</select></label></div>
        {leftVersion && rightVersion && <>
          <div className="comparison-version-headings"><div><strong>{leftVersion.version_name}</strong><span>{leftVersion.is_original ? '👵 Originale' : '🍴 Variante'}{creatorNames[leftVersion.created_by] ? ` · ${creatorNames[leftVersion.created_by]}` : ''}</span></div><div><strong>{rightVersion.version_name}</strong><span>{rightVersion.is_original ? '👵 Originale' : '🍴 Variante'}{creatorNames[rightVersion.created_by] ? ` · ${creatorNames[rightVersion.created_by]}` : ''}</span></div></div>
          <section className="comparison-section"><div className="comparison-section-heading"><div><p className="section-kicker">Ingrédients</p><h4>Ce qui a changé</h4></div><span>{changedIngredients === 0 ? 'Aucune différence' : `${changedIngredients} différence${changedIngredients > 1 ? 's' : ''}`}</span></div>{ingredientRows.length === 0 ? <p className="muted-text">Aucun ingrédient renseigné.</p> : <div className="comparison-rows">{ingredientRows.map((row, index) => <div className={`comparison-row ${row.type}`} key={`${row.left?.id ?? 'left'}-${row.right?.id ?? 'right'}-${index}`}><div><span>{ingredientLabel(row.left)}</span></div><div><span>{ingredientLabel(row.right)}</span></div></div>)}</div>}<div className="comparison-legend"><span className="same">Identique</span><span className="changed">Modifié</span><span className="added">Ajouté</span><span className="removed">Supprimé</span></div></section>
          <section className="comparison-section"><div className="comparison-section-heading"><div><p className="section-kicker">Préparation</p><h4>Étape par étape</h4></div><span>{changedSteps === 0 ? 'Aucune différence' : `${changedSteps} différence${changedSteps > 1 ? 's' : ''}`}</span></div>{stepRows.length === 0 ? <p className="muted-text">Aucune étape renseignée.</p> : <div className="comparison-rows">{stepRows.map(row => <div className={`comparison-row ${row.type}`} key={row.index}><div><strong>Étape {row.index + 1}</strong><span>{stepLabel(row.left)}</span></div><div><strong>Étape {row.index + 1}</strong><span>{stepLabel(row.right)}</span></div></div>)}</div>}</section>
        </>}
      </div>
    </div>}
  </>
}
