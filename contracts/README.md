## TrustGigs sBTC Contract

This folder contains the on-chain contract for the **TrustGigs** sBTC-powered job board / bounty platform.

### High-level design

- **Token**: Uses an SIP-010 compatible sBTC fungible token (referenced via `sbtc-token` data var).
- **Jobs**:
  - Employers call `create-job` with a `reward` (sats), `title`, and `description`.
  - The contract transfers `reward` sBTC from the employer to itself and stores the job.
  - Jobs have `status` (`u0` open, `u1` closed), and an optional `winner`.
- **Applications**:
  - Applicants call `apply-to-job` with a `note` (summary or link to full proposal).
  - The contract assigns an incremental `application-id` per job and stores `(job-id, application-id)` with `applicant` and `note`.
- **Winner selection**:
  - The employer who created the job calls `select-winner` with `(job-id, application-id)`.
  - The contract transfers the locked sBTC reward from itself to the winning applicant and marks the job `closed` with `winner`.

### Public functions

- `create-job (reward uint) (title (buff 96)) (description (buff 256)) -> (response uint uint)`
  - Creates a new job, locks `reward` sBTC, and returns the new `job-id`.
- `apply-to-job (job-id uint) (note (buff 256)) -> (response uint uint)`
  - Creates an application for `job-id` from `tx-sender` and returns the new `application-id`.
- `select-winner (job-id uint) (application-id uint) -> (response bool uint)`
  - Employer-only. Marks the application as winner, closes the job, and transfers sBTC to the winner.

### Read-only helpers for the frontend

- `get-job (job-id uint) -> (response { employer: principal, reward: uint, status: uint, winner: (optional principal), application-counter: uint, title: (buff 96), description: (buff 256) } uint)`
- `get-application (job-id uint) (application-id uint) -> (response { applicant: principal, note: (buff 256), is-winner: bool } uint)`
- `get-job-count () -> (response uint uint)`
- `get-application-count (job-id uint) -> (response uint uint)`

### Mapping to the frontend flows

- **Employer dashboard**
  - `create-job` ↔ employer "create job" form.
  - `select-winner` ↔ employer selecting a winning application and triggering sBTC payout.
- **Jobs list & details**
  - `get-job-count` + `get-job` used to page through jobs.
  - `get-application-count` + `get-application` used to read applications for a job.
- **Applicant dashboard**
  - Applications are tied to `tx-sender`, so the UI filters apps by the connected wallet address.

In the next step, we will add a TypeScript integration layer in the frontend that calls these functions using the Stacks SDK (replacing the current in-memory `contractApi`).

