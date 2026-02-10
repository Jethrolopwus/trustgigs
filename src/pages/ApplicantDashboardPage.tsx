import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { contractApi } from '../api/mockContract'
import type { Application } from '../types'
import { useWallet } from '../wallet/WalletContext'

export function ApplicantDashboardPage() {
  const { address, isConnected } = useWallet()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address || !isConnected) return
    void (async () => {
      setLoading(true)
      const apps = await contractApi.getApplicantApplications(address)
      setApplications(apps)
      setLoading(false)
    })()
  }, [address, isConnected])

  if (!isConnected || !address) {
    return (
      <div className="content-shell">
        <h2>Applicant dashboard</h2>
        <p>Connect your wallet to see your applications and winnings.</p>
      </div>
    )
  }

  const winnings = applications.filter((a) => a.isWinner)

  return (
    <div className="content-shell">
      <div className="content-header">
        <div>
          <h2>Applicant dashboard</h2>
          <p>Track all the gigs you have applied to and your sBTC winnings.</p>
        </div>
        <div className="muted">Connected as {address}</div>
      </div>

      {loading ? (
        <p>Loading your applications…</p>
      ) : applications.length === 0 ? (
        <p>
          You haven&apos;t applied to any jobs yet. Browse <Link to="/">open gigs</Link> to get
          started.
        </p>
      ) : (
        <>
          <section>
            <h3>Your applications</h3>
            <ul className="application-list">
              {applications.map((app) => (
                <li key={app.id} className="application-card">
                  <div className="application-header">
                    <span className="applicant">Job #{app.jobId}</span>
                    {app.isWinner && <span className="badge badge-success">Winner</span>}
                  </div>
                  <p>{app.coverLetter}</p>
                  <Link to={`/jobs/${app.jobId}`} className="small-link">
                    View job
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>Your winnings</h3>
            {winnings.length === 0 ? (
              <p>No winnings yet — keep shipping great work.</p>
            ) : (
              <p>
                You have won <strong>{winnings.length}</strong> bounty
                {winnings.length > 1 ? ' awards' : ' award'} so far.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  )
}

