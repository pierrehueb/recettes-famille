import { createPortal } from 'react-dom'

export default function TransmissionSummary({ versions = [], creatorNames = {}, currentVersionId, onSelectVersion }) {
  if (typeof document === 'undefined' || versions.length < 2) return null

  const target = document.querySelector('.recipe-detail .detail-intro')
  if (!target) return null

  const byId = new Map(versions.map(version => [version.id, version]))
  const current = byId.get(currentVersionId) || versions[versions.length - 1]
  const path = []
  const visited = new Set()
  let cursor = current

  while (cursor && !visited.has(cursor.id)) {
    path.unshift(cursor)
    visited.add(cursor.id)
    cursor = cursor.based_on_version_id ? byId.get(cursor.based_on_version_id) : null
  }

  const displayed = path.length === versions.length ? path : versions

  return createPortal(
    <div className="transmission-summary" aria-label="Transmission familiale">
      <div className="transmission-summary-heading">
        <span className="transmission-summary-label">Transmission familiale</span>
        <span className="transmission-summary-count">{versions.length} version{versions.length > 1 ? 's' : ''}</span>
      </div>
      <div className="transmission-summary-path">
        {displayed.map((version, index) => {
          const creator = creatorNames[version.created_by]
          const active = version.id === currentVersionId
          return <span className="transmission-summary-step" key={version.id}>
            {index > 0 && <span className="transmission-summary-arrow" aria-hidden="true">→</span>}
            <button type="button" className={`transmission-summary-node ${active ? 'active' : ''}`} onClick={() => onSelectVersion?.(version.id)} disabled={active} title={version.version_name}>
              <span aria-hidden="true">{version.is_original ? '👵' : '🍴'}</span>
              <span>{version.is_original ? (version.version_name || 'Recette originale') : (version.version_name || creator || `Variante ${index}`)}</span>
            </button>
          </span>
        })}
      </div>
    </div>,
    target,
  )
}
