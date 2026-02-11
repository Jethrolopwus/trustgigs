import { fetchCallReadOnlyFunction, ClarityType, cvToJSON, stringAsciiCV, uintCV } from '@stacks/transactions'
import { STACKS_TESTNET } from '@stacks/network'
import type { Application, Job, JobFilters } from '../types'

// Contract configuration is provided via Vite env vars in `.env`.
// Make sure to set:
// - VITE_CONTRACT_ADDRESS=SP...
// - VITE_CONTRACT_NAME=TrustGigs
const CONTRACT_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined) ?? 'SPXXXXXXXXXXXXXXXTRUSTGIGS'
const CONTRACT_NAME = (import.meta.env.VITE_CONTRACT_NAME as string | undefined) ?? 'TrustGigs'

const network = STACKS_TESTNET

async function callJobReadOnly<T>(
  functionName: string,
  args: any[],
): Promise<T | undefined> {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName,
      functionArgs: args,
      senderAddress: CONTRACT_ADDRESS,
      network,
    })

    const json = cvToJSON(result)
    if (json.type !== 'response') return undefined
    if (json.value.type === 'error') return undefined
    return json.value.value as T
  } catch (err) {
    const message = String(err)
    // If the contract is not yet deployed at the configured address,
    // avoid crashing the UI and return undefined instead.
    if (message.includes('NoSuchContract')) {
      // eslint-disable-next-line no-console
      console.warn('TrustGigs contract not found at configured address:', CONTRACT_ADDRESS, CONTRACT_NAME)
      return undefined
    }
    throw err
  }
}

function mapJob(id: number, value: any): Job {
  const data = value.value as any
  const employer = data.employer.value as string
  const reward = BigInt(data.reward.value as string)
  const status = BigInt(data.status.value as string)
  const winnerOptional = data.winner

  const winnerAddress =
    winnerOptional.type === ClarityType.OptionalSome ? (winnerOptional.value.value as string) : undefined

  return {
    id: String(id),
    title: data.title.value as string,
    description: data.description.value as string,
    rewardSats: Number(reward),
    createdAt: new Date().toISOString(),
    employerAddress: employer,
    status: status === 0n ? 'open' : 'closed',
    winnerApplicationId: winnerAddress, // UI can resolve mapping separately if needed
  }
}

function mapApplication(jobId: number, id: number, value: any): Application {
  const data = value.value as any
  return {
    id: String(id),
    jobId: String(jobId),
    applicantAddress: data.applicant.value as string,
    coverLetter: data.note.value as string,
    submittedAt: new Date().toISOString(),
    isWinner: Boolean(data.isWinner.value),
  }
}

export const onchainContractApi = {
  // Note: uses naive pagination by iterating job ids from 1..job-count.
  async listJobs(filters?: JobFilters): Promise<Job[]> {
    const jobCount = await callJobReadOnly<number>('get-job-count', [])
    if (!jobCount || jobCount === 0) return []

    const jobs: Job[] = []
    for (let i = 1; i <= jobCount; i += 1) {
      const jobVal = await callJobReadOnly<any>('get-job', [uintCV(i)])
      if (!jobVal) continue
      const job = mapJob(i, jobVal)
      jobs.push(job)
    }

    // Reuse client-side filters from the previous mock implementation
    if (!filters) return jobs
    const { status, minRewardSats, maxRewardSats, search } = filters
    return jobs.filter((job) => {
      if (status && status !== 'all' && job.status !== status) return false
      if (minRewardSats != null && job.rewardSats < minRewardSats) return false
      if (maxRewardSats != null && job.rewardSats > maxRewardSats) return false
      if (search && search.trim()) {
        const term = search.trim().toLowerCase()
        const haystack = `${job.title} ${job.description}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  },

  async getJob(jobId: string): Promise<Job | undefined> {
    const id = Number(jobId)
    const jobVal = await callJobReadOnly<any>('get-job', [uintCV(id)])
    if (!jobVal) return undefined
    return mapJob(id, jobVal)
  },

  async listApplications(jobId: string): Promise<Application[]> {
    const jobIdNum = Number(jobId)
    const count = await callJobReadOnly<number>('get-application-count', [uintCV(jobIdNum)])
    if (!count || count === 0) return []

    const apps: Application[] = []
    for (let i = 1; i <= count; i += 1) {
      const appVal = await callJobReadOnly<any>('get-application', [
        uintCV(jobIdNum),
        uintCV(i),
      ])
      if (!appVal) continue
      apps.push(mapApplication(jobIdNum, i, appVal))
    }
    return apps
  },

  async getEmployerJobs(employerAddress: string): Promise<Job[]> {
    const jobs = await this.listJobs()
    return jobs.filter((j) => j.employerAddress === employerAddress)
  },

  async getApplicantApplications(applicantAddress: string): Promise<Application[]> {
    const jobs = await this.listJobs()
    const applications: Application[] = []
    for (const job of jobs) {
      const apps = await this.listApplications(job.id)
      applications.push(...apps.filter((a) => a.applicantAddress === applicantAddress))
    }
    return applications
  },

  // The following methods construct argument payloads for contract calls.
  // They do not broadcast transactions directly; integrate with a wallet
  // (e.g. Stacks Web Wallet) to sign and submit these payloads.

  buildCreateJobArgs(input: {
    title: string
    description: string
    rewardSats: number
  }) {
    return {
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'create-job',
      functionArgs: [
        uintCV(input.rewardSats),
        stringAsciiCV(input.title),
        stringAsciiCV(input.description),
      ],
    }
  },

  buildApplyToJobArgs(input: { jobId: string; coverLetter: string }) {
    return {
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'apply-to-job',
      functionArgs: [uintCV(Number(input.jobId)), stringAsciiCV(input.coverLetter)],
    }
  },

  buildSelectWinnerArgs(input: { jobId: string; applicationId: string }) {
    return {
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'select-winner',
      functionArgs: [uintCV(Number(input.jobId)), uintCV(Number(input.applicationId))],
    }
  },
}

