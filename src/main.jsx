import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import FamilyPage from './components/FamilyPage.jsx'
import InvitationPage from './components/InvitationPage.jsx'
import './index.css'
import './components/RecipeVariants.css'

function Root() {
  const getMode = () => {
    const params = new URLSearchParams(window.location.search)
    return { family: params.get('family') === '1', invite: params.get('invite') || '' }
  }
  const [mode, setMode] = useState(getMode)

  useEffect(() => {
    const onPopState = () => setMode(getMode())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (changes = {}) => {
    const url = new URL(window.location.href)
    if (changes.family) url.searchParams.set('family', '1')
    else url.searchParams.delete('family')
    if (changes.invite) url.searchParams.set('invite', changes.invite)
    else url.searchParams.delete('invite')
    window.history.pushState({}, '', url)
    setMode(getMode())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (mode.invite) return <div className="app"><header className="app-header"><div className="header-inner"><button className="brand" type="button" onClick={() => navigate()}><span className="brand-mark" aria-hidden="true">🍲</span><span><span className="eyebrow">Notre livre de famille</span><span className="brand-title">Les recettes de notre famille</span></span></button></div></header><main className="main-content"><InvitationPage token={mode.invite} onBack={() => navigate()} /></main><footer className="app-footer">Un patrimoine familial à préserver ❤️</footer></div>
  if (mode.family) return <div className="app"><header className="app-header"><div className="header-inner"><button className="brand" type="button" onClick={() => navigate()}><span className="brand-mark" aria-hidden="true">🍲</span><span><span className="eyebrow">Notre livre de famille</span><span className="brand-title">Les recettes de notre famille</span></span></button><button type="button" className="secondary-button small-button" onClick={() => navigate()}>← Retour au livre</button></div></header><main className="main-content"><FamilyPage /></main><footer className="app-footer">Un patrimoine familial à préserver ❤️</footer></div>

  return <><App /><button type="button" className="family-access-button" onClick={() => navigate({ family: true })}>👨‍👩‍👧 Famille</button></>
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
