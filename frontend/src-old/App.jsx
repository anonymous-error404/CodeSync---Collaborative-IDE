import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import './components/auth/auth.css'
import { AuthProvider } from './context/AuthProvider'
import { useAuth } from './context/useAuth'
import { UserNav } from './components/auth/UserNav'
import { AuthModal } from './components/auth/AuthModal'

function MainContent() {
  const [count, setCount] = useState(0)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authTab, setAuthTab] = useState('login')
  const { user, isAuthenticated } = useAuth()

  const handleOpenAuth = (tab = 'login') => {
    setAuthTab(tab)
    setAuthModalOpen(true)
  }

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <img src={viteLogo} alt="CodeSync Logo" className="brand-logo" />
          <span>CodeSync</span>
          <span className="brand-badge">IDE</span>
        </div>
        <UserNav onOpenAuth={handleOpenAuth} />
      </header>

      {isAuthenticated && user && (
        <div className="ide-status-banner">
          <div className="ide-status-text">
            👋 Welcome back, <span className="ide-status-user">{user.username}</span>! Your collaborative workspace is active and synced.
          </div>
        </div>
      )}

      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            {isAuthenticated ? (
              <>Authenticated as <code>{user?.email}</code></>
            ) : (
              <>Edit <code>src/App.jsx</code> and save to test <code>HMR</code></>
            )}
          </p>
        </div>
        <button
          type="button"
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank" rel="noreferrer">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank" rel="noreferrer">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank" rel="noreferrer">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank" rel="noreferrer">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank" rel="noreferrer">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank" rel="noreferrer">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>

      <AuthModal
        isOpen={authModalOpen}
        initialTab={authTab}
        onClose={() => setAuthModalOpen(false)}
      />
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  )
}

export default App
