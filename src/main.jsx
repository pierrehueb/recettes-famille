import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import InvitationPage from './components/InvitationPage.jsx'
import './index.css'
import './components/RecipeVariants.css'
import './components/FamilyPage.css'

function Root() {
  const getMode = () => {
    const params = new URLSearchParams(window.location.search)
    return { invite: params.get('invite') || '' }
  }
  const [mode, setMode] = useState(getMode)

  useEffect(() => {
    const onPopState = () => setMode(getMode())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('invite')
    window.history.pushState({}, '', url)
    setMode(getMode())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (mode.invite) return <div className="app"><header className="app-header"><div className="header-inner"><button className="brand" type="button" onClick={navigate}><span className="brand-mark" aria-hidden="true">🍲</span><span><span className="eyebrow">Notre livre de famille</span><span className="brand-title">Les recettes de notre famille</span></span></button></div></header><main className="main-content"><InvitationPage token={mode.invite} onBack={navigate} /></main><footer className="app-footer">Un patrimoine familial à préserver ❤️</footer></div>

  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
