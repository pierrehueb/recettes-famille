function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">🍲</span>
          <div>
            <p className="eyebrow">Notre livre de famille</p>
            <h1>Les recettes de notre famille</h1>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="hero">
          <p className="hero-kicker">Bienvenue</p>
          <h2>Des recettes transmises de génération en génération.</h2>
          <p className="hero-text">
            Retrouvez les recettes de la famille, les précieux écrits de Mamie,
            leurs adaptations et les souvenirs qui les accompagnent.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-button">Voir les recettes</button>
            <button type="button" className="secondary-button">Recettes de Mamie</button>
          </div>
        </section>

        <section className="section-preview" aria-label="Aperçu">
          <div className="section-heading">
            <div>
              <p className="section-kicker">À découvrir</p>
              <h3>Votre livre de recettes</h3>
            </div>
          </div>
          <div className="preview-grid">
            <article className="preview-card featured">
              <span className="card-icon">📖</span>
              <h4>Recettes de Mamie</h4>
              <p>Les recettes originales et leurs documents manuscrits.</p>
            </article>
            <article className="preview-card">
              <span className="card-icon">👨‍👩‍👧‍👦</span>
              <h4>Recettes de la famille</h4>
              <p>Les recettes partagées et enrichies par chacun.</p>
            </article>
            <article className="preview-card">
              <span className="card-icon">❤️</span>
              <h4>Mes favoris</h4>
              <p>Retrouvez rapidement les recettes que vous aimez.</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <span>Un patrimoine familial à préserver ❤️</span>
      </footer>
    </div>
  )
}

export default App
