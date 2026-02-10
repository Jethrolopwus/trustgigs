import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { onchainContractApi } from '../api/onchainContract'
import type { Application, Job } from '../types'
import { useWallet } from '../wallet/WalletContext'
import { callContractWithWallet } from '../wallet/stacksContractCall'

export function EmployerDashboardPage() {
  const { address, isConnected } = useWallet()
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [loadingApps, setLoadingApps] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [rewardSats, setRewardSats] = useState(100_000)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!address || !isConnected) return
    void (async () => {
      setLoadingJobs(true)
      const data = await onchainContractApi.getEmployerJobs(address)
      setJobs(data)
      setLoadingJobs(false)
    })()
  }, [address, isConnected])

  async function handleCreateJob(e: FormEvent) {
    e.preventDefault()
    if (!address || !isConnected) return
    setCreating(true)
    try {
      const txOptions = onchainContractApi.buildCreateJobArgs({
        title,
        description,
        rewardSats,
      })
      await callContractWithWallet({
        ...txOptions,
      })
      const refreshed = await onchainContractApi.getEmployerJobs(address)
      setJobs(refreshed)
      setTitle('')
      setDescription('')
      setRewardSats(100_000)
    } finally {
      setCreating(false)
    }
  }

  async function loadApplications(job: Job) {
    setSelectedJob(job)
    setLoadingApps(true)
    const apps = await onchainContractApi.listApplications(job.id)
    setApplications(apps)
    setLoadingApps(false)
  }

  async function handleSelectWinner(applicationId: string) {
    if (!selectedJob) return
    const txOptions = onchainContractApi.buildSelectWinnerArgs({
      jobId: selectedJob.id,
      applicationId,
    })
    await callContractWithWallet({
      ...txOptions,
    })
    const [jobsRefreshed, appsRefreshed] = await Promise.all([
      onchainContractApi.getEmployerJobs(selectedJob.employerAddress),
      onchainContractApi.listApplications(selectedJob.id),
    ])
    setJobs(jobsRefreshed)
    setApplications(appsRefreshed)
  }

  if (!isConnected || !address) {
    return (
      <div className="content-shell">
        <h2>Employer dashboard</h2>
        <p>Connect your wallet to create and manage jobs.</p>
      </div>
    )
  }

  return (
    <div className="content-shell">
      <div className="content-header">
        <div>
          <h2>Employer dashboard</h2>
          <p>Post new sBTC-backed gigs and select winners for your open jobs.</p>
        </div>
        <div className="muted">Connected as {address}</div>
      </div>

      <div className="two-column">
        <section className="column">
          <h3>Create a new job</h3>
          <form onSubmit={handleCreateJob} className="card-form">
            <input
              type="text"
              placeholder="Job title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <textarea
              placeholder="Describe the work, acceptance criteria, and timelines…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
            />
            <label>
              Reward (sats)
              <input
                type="number"
                min={1}
                value={rewardSats}
                onChange={(e) => setRewardSats(Number(e.target.value))}
                required
              />
            </label>
            <button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create job'}
            </button>
          </form>
        </section>

        <section className="column">
          <h3>Your jobs</h3>
          {loadingJobs ? (
            <p>Loading your jobs…</p>
          ) : jobs.length === 0 ? (
            <p>You have not posted any jobs yet.</p>
          ) : (
            <ul className="job-list compact">
              {jobs.map((job) => (
                <li key={job.id} className="job-card">
                  <div className="job-main">
                    <h4>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => loadApplications(job)}
                      >
                        {job.title}
                      </button>{' '}
                      <span className="muted">·</span>{' '}
                      <Link to={`/jobs/${job.id}`}>View</Link>
                    </h4>
                    <p>{job.description}</p>
                  </div>
                  <div className="job-meta">
                    <span className="badge">{job.status === 'open' ? 'Open' : 'Closed'}</span>
                    <span className="reward">
                      {new Intl.NumberFormat('en-US').format(job.rewardSats)} sats
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="column">
        <h3>Applications for selected job</h3>
        {!selectedJob ? (
          <p>Select a job from the list above to review applications.</p>
        ) : loadingApps ? (
          <p>Loading applications…</p>
        ) : applications.length === 0 ? (
          <p>No applications yet for this job.</p>
        ) : (
          <ul className="application-list">
            {applications.map((app) => (
              <li key={app.id} className="application-card">
                <div className="application-header">
                  <span className="applicant">{app.applicantAddress}</span>
                  {app.isWinner && <span className="badge badge-success">Winner</span>}
                </div>
                <p>{app.coverLetter}</p>
                {selectedJob.status === 'open' && !app.isWinner && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleSelectWinner(app.id)}
                  >
                    Select as winner &amp; release sBTC
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

