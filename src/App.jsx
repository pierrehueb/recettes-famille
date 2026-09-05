import { useState } from 'react'

const navigation = [
  { id: 'home', label: 'Accueil', icon: '⌂' },
  { id: 'recipes', label: 'Recettes', icon: '📖' },
  { id: 'grandma', label: 'Recettes de Mamie', icon: '👵' },
  { id: 'favorites', label: 'Favoris', icon: '♥' },
]

const pages = {
  home: {
    kicker: 'Bienvenue',
    title: 'Des recettes transmises de génération en génération.',
    text: 'Retrouvez les recettes de la famille, les précieux écrits de Mamie, leurs adaptations et les souvenirs qui les accompagnent.',
  },
  recipes: {
    kicker: 'Le livre familial',
    title: 'Toutes les recettes',
    text: 'Une collection vivante de recettes partagées et enrichies par toute la famille.',
  },
  grandma: {
    kicker: 'Le patrimoine de Mamie',
    title: 'Les recettes de Mamie',
    text: 'Les recettes originales, leurs documents manuscrits et les versions transmises aux générations suivantes.',
  },
  favorites: {
    kicker: 'Mes recettes',
    title: 'Mes favoris',
    text: 'Retrouvez ici les recettes que vous souhaitez garder à portée de main.',
  },
}

function App() {
  const [activePage, setActivePage] = useState('home')
  const page = pages[activePage]

  const goTo = (pageId) => {
    setActivePage(pageId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <button className="brand" type="button" onClick={() => goTo('home')} aria-label="Retour à l'accueil">
            <span className="brand-mark" aria-hidden="true">🍲</span>
            <span>
              <span className="eyebrow">Notre livre de famille</span>
              <span className="brand-title">Les recettes de notre famille</span>
            </span>
          </button>

          <nav className="desktop-nav" aria-label="Navigation principale">
            {navigation.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activePage === item.id ? 'nav-button active' : 'nav-button'}
                onClick={() => goTo(item.id)}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <button className="profile-button" type="button" aria-label="Mon profil" title="Mon profil">
            P
          </button>
        </div>
      </header>

      <main className="main-content">
        <section className="hero">
          <p className="hero-kicker">{page.kicker}</p>
          <h2>{page.title}</h2>
          <p className="hero-text">{page.text}</p>

          {activePage === 'home' && (
            <div className="hero-actions">
              <button type="button" className="primary-button" onClick={() => goTo('recipes')}>
                Voir les recettes
              </button>
              <button type="button" className="secondary-button" onClick={() => goTo('grandma')}>
                Recettes de Mamie
              </button>
            </div>
          )}
        </section>

        <section className="section-preview" aria-label="Navigation rapide">
          <div className="section-heading">
            <div>
              <p className="section-kicker">À découvrir</p>
              <h3>Votre livre de recettes</h3>
            </div>
          </div>

          <div className="preview-grid">
            <button className="preview-card featured" type="button" onClick={() => goTo('grandma')}>
              <span className="card-icon">📖</span>
              <h4>Recettes de Mamie</h4>
              <p>Les recettes originales et leurs documents manuscrits.</p>
            </button>
            <button className="preview-card" type="button" onClick={() => goTo('recipes')}>
              <span className="card-icon">👨‍👩‍👧‍👦</span>
              <h4>Recettes de la famille</h4>
              <p>Les recettes partagées et enrichies par chacun.</p>
            </button>
            <button className="preview-card" type="button" onClick={() => goTo('favorites')}>
              <span className="card-icon">❤️</span>
              <h4>Mes favoris</h4>
              <p>Retrouvez rapidement les recettes que vous aimez.</p>
            </button>
          </div>
        </section>
      </main>

      <nav className="mobile-nav" aria-label="Navigation mobile">
        {navigation.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activePage === item.id ? 'mobile-nav-button active' : 'mobile-nav-button'}
            onClick={() => goTo(item.id)}
          >
            <span className="mobile-nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label === 'Recettes de Mamie' ? 'Mamie' : item.label}</span>
          </button>
        ))}
      </nav>

      <footer className="app-footer">
        <span>Un patrimoine familial à préserver ❤️</span>
      </footer>
    </div>
  )
}

export default App
