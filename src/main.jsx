import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import FamilyPage from './components/FamilyPage.jsx'
import './index.css'
import './components/RecipeVariants.css'

function Root() {
  const [familyPage, setFamilyPage] = useState(() => new URLSearchParams(window.location.search).get('family') === '1')

  useEffect(() => {
    const onPopState = () => setFamilyPage(new URLSearchParams(window.location.search).get('family') === '1')
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const toggleFamilyPage = () => {
    const next = !familyPage
    const url = new URL(window.location.href)
    if (next) url.searchParams.set('family', '1')
    else url.searchParams.delete('family')
    window.history.pushState({}, '', url)
    setFamilyPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (familyPage) return <div className="app"><header className="app-header"><div className="header-inner"><button className="brand" type="button" onClick={toggleFamilyPage}><span className="brand-mark" aria-hidden="true">🍲</span><span><span className="eyebrow">Notre livre de famille</span><span className="brand-title">Les recettes de notre famille</span></span></button><button type="button" className="secondary-button small-button" onClick={toggleFamilyPage}>← Retour au livre</button></div></header><main className="main-content"><FamilyPage /></main><footer className="app-footer">Un patrimoine familial à préserver ❤️</footer></div>

  return <><App /><button type="button" className="family-access-button" onClick={toggleFamilyPage}>👨‍👩‍👧 Famille</button></>
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
