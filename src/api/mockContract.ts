import type { Application, Job, JobFilters } from '../types'

// In a real app, this file would talk to an sBTC smart contract via a wallet SDK.
// For now we keep state in-memory to model the flows.

let jobs: Job[] = [
  {
    id: '1',
    title: 'Build TrustGigs Landing Page',
    description: 'Design and implement a responsive landing page for TrustGigs.',
    rewardSats: 100_000,
    createdAt: new Date().toISOString(),
    employerAddress: 'STEMPLOYER1',
    status: 'open',
  },
  {
    id: '2',
    title: 'Write sBTC Smart Contract Audit',
    description: 'Security review of the TrustGigs sBTC payout contract.',
    rewardSats: 250_000,
    createdAt: new Date().toISOString(),
    employerAddress: 'STEMPLOYER2',
    status: 'closed',
    winnerApplicationId: '3',
  },
]

let applications: Application[] = [
  {
    id: '1',
    jobId: '1',
    applicantAddress: 'STAPPLICANT1',
    coverLetter: 'I have 5 years of React experience and can ship quickly.',
    submittedAt: new Date().toISOString(),
  },
  {
    id: '2',
    jobId: '1',
    applicantAddress: 'STAPPLICANT2',
    coverLetter: 'Product-focused engineer with strong UX skills.',
    submittedAt: new Date().toISOString(),
  },
  {
    id: '3',
    jobId: '2',
    applicantAddress: 'STAPPLICANT3',
    coverLetter: 'Smart contract auditor with sBTC experience.',
    submittedAt: new Date().toISOString(),
    isWinner: true,
  },
]

function matchesFilters(job: Job, filters: JobFilters | undefined): boolean {
  if (!filters) return true
  const { status, minRewardSats, maxRewardSats, search } = filters

  if (status && status !== 'all' && job.status !== status) return false
  if (minRewardSats != null && job.rewardSats < minRewardSats) return false
  if (maxRewardSats != null && job.rewardSats > maxRewardSats) return false

  if (search && search.trim()) {
    const term = search.trim().toLowerCase()
    const haystack = `${job.title} ${job.description}`.toLowerCase()
    if (!haystack.includes(term)) return false
  }

  return true
}

export const contractApi = {
  async listJobs(filters?: JobFilters): Promise<Job[]> {
    return jobs.filter((job) => matchesFilters(job, filters))
  },

  async getJob(jobId: string): Promise<Job | undefined> {
    return jobs.find((job) => job.id === jobId)
  },

  async listApplications(jobId: string): Promise<Application[]> {
    return applications.filter((a) => a.jobId === jobId)
  },

  async createJob(input: {
    title: string
    description: string
    rewardSats: number
    employerAddress: string
  }): Promise<Job> {
    const id = String(jobs.length + 1)
    const newJob: Job = {
      id,
      title: input.title,
      description: input.description,
      rewardSats: input.rewardSats,
      createdAt: new Date().toISOString(),
      employerAddress: input.employerAddress,
      status: 'open',
    }
    jobs = [newJob, ...jobs]
    return newJob
  },

  async applyToJob(input: {
    jobId: string
    applicantAddress: string
    coverLetter: string
  }): Promise<Application> {
    const id = String(applications.length + 1)
    const application: Application = {
      id,
      jobId: input.jobId,
      applicantAddress: input.applicantAddress,
      coverLetter: input.coverLetter,
      submittedAt: new Date().toISOString(),
    }
    applications = [application, ...applications]
    return application
  },

  async selectWinner(input: {
    jobId: string
    applicationId: string
  }): Promise<{ job: Job; application: Application }> {
    const job = jobs.find((j) => j.id === input.jobId)
    const application = applications.find((a) => a.id === input.applicationId)
    if (!job || !application) {
      throw new Error('Job or application not found')
    }

    jobs = jobs.map((j) =>
      j.id === job.id
        ? {
            ...j,
            status: 'closed',
            winnerApplicationId: application.id,
          }
        : j,
    )

    applications = applications.map((a) =>
      a.id === application.id
        ? { ...a, isWinner: true }
        : a.jobId === job.id
          ? { ...a, isWinner: false }
          : a,
    )

    const updatedJob = jobs.find((j) => j.id === job.id)!
    const updatedApplication = applications.find((a) => a.id === application.id)!
    return { job: updatedJob, application: updatedApplication }
  },

  async getEmployerJobs(employerAddress: string): Promise<Job[]> {
    return jobs.filter((j) => j.employerAddress === employerAddress)
  },

  async getApplicantApplications(applicantAddress: string): Promise<Application[]> {
    return applications.filter((a) => a.applicantAddress === applicantAddress)
  },
}

