import './App.css'

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">₿</span>
          <span className="brand-text">TrustGigs</span>
        </div>
        <nav className="nav-links">
          <button className="nav-link active">Jobs</button>
          <button className="nav-link">Employer</button>
          <button className="nav-link">Applicant</button>
        </nav>
        <div className="wallet-pill">Connect sBTC Wallet</div>
      </header>

      <main className="app-main">
        <section className="hero">
          <h1>sBTC-powered work, on-chain trust.</h1>
          <p>
            Post bounties, ship solutions, and get paid in locked sBTC when your work is
            selected.
          </p>
        </section>
      </main>
    </div>
  )
}

export default App
