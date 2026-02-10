// Core domain types for TrustGigs

export type JobStatus = 'open' | 'closed'

export interface Job {
  id: string
  title: string
  description: string
  rewardSats: number // sBTC-denominated sats
  createdAt: string
  employerAddress: string
  status: JobStatus
  winnerApplicationId?: string
}

export interface Application {
  id: string
  jobId: string
  applicantAddress: string
  coverLetter: string
  submittedAt: string
  isWinner?: boolean
}

// Filters for job list
export interface JobFilters {
  status?: JobStatus | 'all'
  minRewardSats?: number
  maxRewardSats?: number
  search?: string
}

