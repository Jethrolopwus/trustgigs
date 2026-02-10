import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { contractApi } from '../api/mockContract'
import type { Application, Job } from '../types'
import { useWallet } from '../wallet/WalletContext'

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { address, isConnected } = useWallet()
  const [job, setJob] = useState<Job | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [coverLetter, setCoverLetter] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!jobId) return
    void (async () => {
      setLoading(true)
      const [jobData, apps] = await Promise.all([
        contractApi.getJob(jobId),
        contractApi.listApplications(jobId),
      ])
      setJob(jobData ?? null)
      setApplications(apps)
      setLoading(false)
    })()
  }, [jobId])

  if (loading) {
    return (
      <div className="content-shell">
        <p>Loading job…</p>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="content-shell">
        <p>Job not found.</p>
      </div>
    )
  }

  const winnerApplication = applications.find((a) => a.id === job.winnerApplicationId)

  const hasApplied =
    !!address && applications.some((a) => a.applicantAddress === address && a.jobId === job.id)

  async function handleApply(e: FormEvent) {
    e.preventDefault()
    if (!jobId || !address || !coverLetter.trim()) return
    setSubmitting(true)
    const app = await contractApi.applyToJob({
      jobId,
      applicantAddress: address,
      coverLetter,
    })
    setApplications((prev) => [app, ...prev])
    setCoverLetter('')
    setSubmitting(false)
  }

  return (
    <div className="content-shell">
      <div className="content-header">
        <div>
          <h2>{job.title}</h2>
          <p>{job.description}</p>
        </div>
        <div className="job-meta">
          <span className="badge">{job.status === 'open' ? 'Open' : 'Closed'}</span>
          <span className="reward">
            {new Intl.NumberFormat('en-US').format(job.rewardSats)} sats
          </span>
        </div>
      </div>

      {winnerApplication && (
        <div className="winner-banner">
          <strong>Winner:</strong> {winnerApplication.applicantAddress}
        </div>
      )}

      <div className="two-column">
        <section className="column">
          <h3>Applications</h3>
          {applications.length === 0 ? (
            <p>No applications yet. Be the first to apply!</p>
          ) : (
            <ul className="application-list">
              {applications.map((app) => (
                <li key={app.id} className="application-card">
                  <div className="application-header">
                    <span className="applicant">{app.applicantAddress}</span>
                    {app.isWinner && <span className="badge badge-success">Winner</span>}
                  </div>
                  <p>{app.coverLetter}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="column">
          <h3>Apply to this bounty</h3>
          {!isConnected ? (
            <p>Connect your wallet above to submit an application.</p>
          ) : job.status !== 'open' ? (
            <p>This job is closed.</p>
          ) : hasApplied ? (
            <p>You have already applied to this job.</p>
          ) : (
            <form onSubmit={handleApply} className="card-form">
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Describe your approach, experience, or link to your solution…"
                required
                rows={5}
              />
              <button type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit application'}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}

