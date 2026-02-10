import { NavLink, Outlet } from 'react-router-dom'
import './App.css'
import { useWallet } from './wallet/WalletContext'

function AppLayout() {
  const { address, isConnected, connect, disconnect } = useWallet()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">₿</span>
          <span className="brand-text">TrustGigs</span>
        </div>
        <nav className="nav-links">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Jobs
          </NavLink>
          <NavLink
            to="/employer"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Employer
          </NavLink>
          <NavLink
            to="/applicant"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Applicant
          </NavLink>
        </nav>
        <button
          type="button"
          className="wallet-pill"
          onClick={isConnected ? disconnect : connect}
        >
          {isConnected && address ? `Connected: ${address}` : 'Connect demo sBTC wallet'}
        </button>
      </header>

      <main className="app-main">
        <section className="hero">
          <h1>sBTC-powered work, on-chain trust.</h1>
          <p>
            Post bounties, ship solutions, and get paid in locked sBTC when your work is
            selected.
          </p>
        </section>
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
