import { useMemo } from 'react'

export default function RecipeHistory({ versions = [], creatorNames = {} }) {
  const orderedVersions = useMemo(
    () => [...versions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [versions],
  )

  if (!orderedVersions.length) return null

  const original = orderedVersions.find(version => version.is_original)
  const variants = orderedVersions.filter(version => !version.is_original)
  const hasStory = orderedVersions.some(version => version.notes?.trim())

  return (
    <section className="recipe-history">
      <div className="recipe-history-heading">
        <div>
          <p className="section-kicker">La mémoire de la recette</p>
          <h3>📖 Histoire de la recette</h3>
        </div>
        <span className="recipe-history-count">
          {orderedVersions.length} génération{orderedVersions.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="recipe-history-intro">
        {original ? (
          <p>
            Cette recette commence avec <strong>{original.version_name}</strong>
            {creatorNames[original.created_by] ? `, créée par ${creatorNames[original.created_by]}` : ''}.
            {variants.length > 0
              ? ` Elle a ensuite été adaptée ${variants.length > 1 ? 'au fil des générations' : 'par une génération suivante'}.`
              : ' Elle constitue pour le moment la version d’origine conservée dans la famille.'}
          </p>
        ) : (
          <p>Voici les différentes étapes de transmission de cette recette dans la famille.</p>
        )}
      </div>

      {!hasStory && (
        <p className="recipe-history-empty">
          L’histoire détaillée de cette recette pourra être enrichie au fil du temps grâce aux notes de chaque version.
        </p>
      )}

      <div className="recipe-history-timeline">
        {orderedVersions.map((version, index) => {
          const parent = orderedVersions.find(item => item.id === version.based_on_version_id)
          const creatorName = creatorNames[version.created_by]
          const year = new Date(version.created_at).getFullYear()

          return (
            <article className={`recipe-history-item ${version.is_original ? 'original' : ''}`} key={version.id}>
              <div className="recipe-history-marker">{version.is_original ? '👵' : '🍴'}</div>
              <div className="recipe-history-card">
                <div className="recipe-history-meta">
                  <span>{version.is_original ? 'Recette originale' : `Transmission ${index}`}</span>
                  <span>{year}</span>
                </div>
                <h4>{version.version_name}</h4>
                {creatorName && <p className="recipe-history-author">Par <strong>{creatorName}</strong></p>}
                {version.notes ? (
                  <p className="recipe-history-story">{version.notes}</p>
                ) : (
                  <p className="recipe-history-story muted">Aucun récit n’a encore été ajouté pour cette version.</p>
                )}
                {parent && (
                  <div className="recipe-history-parent">
                    ↳ Évolution à partir de <strong>{parent.version_name}</strong>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
