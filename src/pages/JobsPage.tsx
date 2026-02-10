import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { onchainContractApi } from '../api/onchainContract'
import type { Job, JobFilters } from '../types'

function formatSats(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [filters, setFilters] = useState<JobFilters>({ status: 'open' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const data = await onchainContractApi.listJobs(filters)
      setJobs(data)
      setLoading(false)
    })()
  }, [filters])

  return (
    <div className="content-shell">
      <div className="content-header">
        <div>
          <h2>Open bounties</h2>
          <p>Explore sBTC-backed gigs posted by employers.</p>
        </div>
      </div>

      <div className="filters-row">
        <select
          value={filters.status ?? 'all'}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, status: e.target.value as JobFilters['status'] }))
          }
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
        <input
          type="text"
          placeholder="Search by title or description..."
          value={filters.search ?? ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
        />
      </div>

      {loading ? (
        <p>Loading jobs…</p>
      ) : jobs.length === 0 ? (
        <p>No jobs match your filters yet.</p>
      ) : (
        <ul className="job-list">
          {jobs.map((job) => (
            <li key={job.id} className="job-card">
              <div className="job-main">
                <h3>
                  <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                </h3>
                <p>{job.description}</p>
              </div>
              <div className="job-meta">
                <span className="badge">{job.status === 'open' ? 'Open' : 'Closed'}</span>
                <span className="reward">{formatSats(job.rewardSats)} sats</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

