;; TrustGigs sBTC-Powered Job Board / Bounty Contract
;;
;; High-level flow:
;; - Employer creates a job with a locked sBTC reward.
;; - Applicants submit applications to an open job.
;; - Employer selects a winner; contract releases sBTC to the chosen applicant.
;;
;; Notes:
;; - This contract assumes an SIP-010-compliant sBTC fungible token.
;; - Text fields are stored as bounded buffers; frontends can also pair with off-chain storage.

;; --------------------------------------------------------
;; Constants
;; --------------------------------------------------------

(define-constant ERR_UNAUTHORIZED u100)
(define-constant ERR_NOT_FOUND u101)
(define-constant ERR_JOB_CLOSED u102)
(define-constant ERR_NOT_EMPLOYER u103)
(define-constant ERR_ALREADY_WINNER u104)
(define-constant ERR_INVALID_REWARD u105)
(define-constant ERR_ALREADY_APPLIED u106)
(define-constant ERR_JOB_EXPIRED u107)
(define-constant ERR_INVALID_STATUS u108)
(define-constant ERR_CANNOT_CANCEL u109)
(define-constant ERR_INVALID_APPLICATION u110)
(define-constant ERR_WITHDRAWAL_FAILED u111)

(define-constant CONTRACT_OWNER tx-sender)
(define-constant JOB_STATUS_OPEN u0)
(define-constant JOB_STATUS_CLOSED u1)
(define-constant JOB_STATUS_CANCELLED u2)
(define-constant JOB_STATUS_EXPIRED u3)

;; Placeholder sBTC token configuration.
;; NOTE: For the current MVP, we DO NOT perform on-chain token transfers yet.
;; The `reward` value is tracked in-contract only. Later, this var can be
;; wired to an SIP-010 token contract and the transfer logic restored.
(define-data-var sbtc-token principal CONTRACT_OWNER)

;; --------------------------------------------------------
;; Data structures
;; --------------------------------------------------------

(define-data-var job-counter uint u0)
(define-data-var total-jobs-created uint u0)
(define-data-var total-applications-submitted uint u0)
(define-data-var total-rewards-distributed uint u0)

;; Track user activity
(define-map user-stats
  { user: principal }
  {
    jobs-created: uint,
    applications-submitted: uint,
    jobs-won: uint,
    total-earned: uint
  }
)

;; Track job activity
(define-map job-activity
  { job-id: uint }
  {
    views: uint,
    applications: uint,
    last-activity: uint
  }
)

;; Each job:
;; - id: implicit numeric key
;; - employer: principal that created the job
;; - reward: amount of sBTC (in sats) locked in this bounty
;; - status: 0 = open, 1 = closed, 2 = cancelled, 3 = expired
;; - winner: optional principal of winning applicant
;; - application-counter: number of applications for this job
;; - title / description: short metadata for discoverability
;; - created-at: block height when job was created
;; - expires-at: optional expiry block height
;; - required-kyc-level: minimum KYC level required (if any)
;; - tags: job categorization

(define-map jobs
  { id: uint }
  {
    employer: principal,
    reward: uint,
    status: uint,
    winner: (optional principal),
    application-counter: uint,
    title: (buff 96),
    description: (buff 256),
    created-at: uint,
    expires-at: (optional uint),
    required-kyc-level: (optional uint),
    tags: (list 10 (buff 32))
  }
)

;; Applications are keyed by (job-id, application-id).
;; We keep applicant and a short "note" or reference (e.g. a link or hash to off-chain content).

(define-map applications
  { job-id: uint, application-id: uint }
  {
    applicant: principal,
    note: (buff 256),
    is-winner: bool,
    submitted-at: uint,
    status: uint  ;; 0 = pending, 1 = accepted, 2 = rejected
  }
)

;; Track applicant applications per job to prevent duplicates
(define-map applicant-applications
  { job-id: uint, applicant: principal }
  { application-id: uint }
)

;; --------------------------------------------------------
;; Helpers
;; --------------------------------------------------------

(define-read-only (get-sbtc-token)
  (ok (var-get sbtc-token))
)

(define-private (only-job-employer (job-id uint))
  (match (map-get? jobs { id: job-id })
    job
      (begin
        (asserts! (is-eq (get employer job) tx-sender) (err ERR_NOT_EMPLOYER))
        (ok job)
      )
    (err ERR_NOT_FOUND)
  )
)

(define-private (update-user-stats (user principal) (job-created bool) (application-submitted bool) (job-won bool) (earned-amount uint))
  (let
    ((stats (default-to 
      { jobs-created: u0, applications-submitted: u0, jobs-won: u0, total-earned: u0 }
      (map-get? user-stats { user: user })
    )))
    (map-set user-stats
      { user: user }
      {
        jobs-created: (+ (get jobs-created stats) (if job-created u1 u0)),
        applications-submitted: (+ (get applications-submitted stats) (if application-submitted u1 u0)),
        jobs-won: (+ (get jobs-won stats) (if job-won u1 u0)),
        total-earned: (+ (get total-earned stats) earned-amount)
      }
    )
  )
)

(define-private (update-job-activity (job-id uint))
  (let
    ((activity (default-to 
      { views: u0, applications: u0, last-activity: u0 }
      (map-get? job-activity { job-id: job-id })
    )))
    (map-set job-activity
      { job-id: job-id }
      {
        views: (get views activity),
        applications: (get applications activity),
        last-activity: stacks-block-height
      }
    )
  )
)

;; --------------------------------------------------------
;; Public functions
;; --------------------------------------------------------

;; Create a new job and lock sBTC into the contract.
;;
;; @param reward - amount of sBTC (sats) to lock for this job
;; @param title  - short title (truncated to 96 bytes if longer off-chain)
;; @param description - short description (truncated to 256 bytes)
;; @param expires-at - optional expiry block height
;; @param required-kyc-level - optional minimum KYC level
;; @param tags - list of up to 10 tags for categorization

(define-public (create-job 
  (reward uint) 
  (title (buff 96)) 
  (description (buff 256))
  (expires-at (optional uint))
  (required-kyc-level (optional uint))
  (tags (list 10 (buff 32)))
)
  (begin
    (asserts! (> reward u0) (err ERR_INVALID_REWARD))

    (let
      (
        (job-id (+ u1 (var-get job-counter)))
      )
      (var-set job-counter job-id)
      (var-set total-jobs-created (+ (var-get total-jobs-created) u1))

      (map-set jobs
        { id: job-id }
        {
          employer: tx-sender,
          reward: reward,
          status: JOB_STATUS_OPEN,
          winner: none,
          application-counter: u0,
          title: title,
          description: description,
          created-at: stacks-block-height,
          expires-at: expires-at,
          required-kyc-level: required-kyc-level,
          tags: tags
        }
      )

      ;; Update user stats
      (update-user-stats tx-sender true false false u0)

      ;; Initialize job activity
      (map-set job-activity
        { job-id: job-id }
        {
          views: u0,
          applications: u0,
          last-activity: stacks-block-height
        }
      )

      ;; Emit job created event
      (print {
        event: "job-created",
        job-id: job-id,
        employer: tx-sender,
        reward: reward,
        title: title,
        expires-at: expires-at,
        required-kyc-level: required-kyc-level,
        tags: tags,
        timestamp: stacks-block-height,
        total-jobs: (var-get total-jobs-created)
      })

      (ok job-id)
    )
  )
)

;; Apply to an open job.
;;
;; @param job-id - the job to apply to
;; @param note   - short text (e.g., summary or link to full proposal)

(define-public (apply-to-job (job-id uint) (note (buff 256)))
  (let
    (
      (job (unwrap! (map-get? jobs { id: job-id }) (err ERR_NOT_FOUND)))
      (existing-application (map-get? applicant-applications { job-id: job-id, applicant: tx-sender }))
    )
    (asserts! (is-eq (get status job) JOB_STATUS_OPEN) (err ERR_JOB_CLOSED))
    (asserts! (is-none existing-application) (err ERR_ALREADY_APPLIED))
    
    ;; Check if job expired
    (match (get expires-at job)
      expiry (asserts! (< stacks-block-height expiry) (err ERR_JOB_EXPIRED))
      true
    )

    (let
      (
        (application-id (+ u1 (get application-counter job)))
      )
      (map-set applications
        { job-id: job-id, application-id: application-id }
        {
          applicant: tx-sender,
          note: note,
          is-winner: false,
          submitted-at: stacks-block-height,
          status: u0  ;; pending
        }
      )

      (map-set jobs
        { id: job-id }
        (merge job { application-counter: application-id })
      )

      ;; Track applicant to prevent duplicate applications
      (map-set applicant-applications
        { job-id: job-id, applicant: tx-sender }
        { application-id: application-id }
      )

      ;; Update user stats
      (update-user-stats tx-sender false true false u0)

      ;; Update job activity
      (let
        ((activity (unwrap! (map-get? job-activity { job-id: job-id }) (err ERR_NOT_FOUND))))
        (map-set job-activity
          { job-id: job-id }
          (merge activity { applications: (+ (get applications activity) u1), last-activity: stacks-block-height })
        )
      )

      (var-set total-applications-submitted (+ (var-get total-applications-submitted) u1))

      ;; Emit application submitted event
      (print {
        event: "application-submitted",
        job-id: job-id,
        application-id: application-id,
        applicant: tx-sender,
        note: note,
        timestamp: stacks-block-height,
        total-applications: (var-get total-applications-submitted)
      })

      (ok application-id)
    )
  )
)

;; Select a winning application and release sBTC to the winner.
;;
;; Only the employer who created the job can call this.

(define-public (select-winner (job-id uint) (application-id uint))
  (let
    (
      (job (unwrap! (only-job-employer job-id) (err ERR_NOT_EMPLOYER)))
      (app (unwrap! (map-get? applications { job-id: job-id, application-id: application-id })
                    (err ERR_NOT_FOUND)))
    )
    (asserts! (is-eq (get status job) JOB_STATUS_OPEN) (err ERR_JOB_CLOSED))
    (asserts! (not (is-some (get winner job))) (err ERR_ALREADY_WINNER))
    (asserts! (is-eq (get status app) u0) (err ERR_INVALID_APPLICATION))

    (let
      (
        (winner (get applicant app))
        (reward (get reward job))
      )
      (map-set jobs
        { id: job-id }
        (merge job { status: JOB_STATUS_CLOSED, winner: (some winner) })
      )

      (map-set applications
        { job-id: job-id, application-id: application-id }
        (merge app { is-winner: true, status: u1 })
      )

      ;; Update user stats for winner
      (update-user-stats winner false false true reward)

      ;; Update total rewards distributed
      (var-set total-rewards-distributed (+ (var-get total-rewards-distributed) reward))

      ;; Emit winner selected event
      (print {
        event: "winner-selected",
        job-id: job-id,
        application-id: application-id,
        winner: winner,
        reward: reward,
        employer: tx-sender,
        timestamp: stacks-block-height,
        total-rewards-distributed: (var-get total-rewards-distributed)
      })

      (ok true)
    )
  )
)

;; Cancel a job (only possible if no applications received)
(define-public (cancel-job (job-id uint))
  (let
    (
      (job (unwrap! (only-job-employer job-id) (err ERR_NOT_EMPLOYER)))
    )
    (asserts! (is-eq (get status job) JOB_STATUS_OPEN) (err ERR_JOB_CLOSED))
    (asserts! (is-eq (get application-counter job) u0) (err ERR_CANNOT_CANCEL))

    (map-set jobs
      { id: job-id }
      (merge job { status: JOB_STATUS_CANCELLED })
    )

    ;; Emit job cancelled event
    (print {
      event: "job-cancelled",
      job-id: job-id,
      employer: tx-sender,
      timestamp: stacks-block-height
    })

    (ok true)
  )
)

;; Mark job as expired (can be called by anyone)
;; Mark job as expired (can be called by anyone)
(define-public (expire-job (job-id uint))
  (let
    (
      (job (unwrap! (map-get? jobs { id: job-id }) (err ERR_NOT_FOUND)))
    )
    (asserts! (is-eq (get status job) JOB_STATUS_OPEN) (err ERR_JOB_CLOSED))
    
    ;; Check if job has expiry
    (match (get expires-at job)
      expiry (begin
        (asserts! (>= stacks-block-height expiry) (err ERR_JOB_EXPIRED))
        (map-set jobs
          { id: job-id }
          (merge job { status: JOB_STATUS_EXPIRED })
        )

        ;; Emit job expired event
        (print {
          event: "job-expired",
          job-id: job-id,
          employer: (get employer job),
          timestamp: stacks-block-height
        })

        (ok true)
      )
      ;; No expiry set - cannot expire
      (err ERR_INVALID_STATUS)
    )
  )
)

;; Reject an application (employer only)
(define-public (reject-application (job-id uint) (application-id uint))
  (let
    (
      (job (unwrap! (only-job-employer job-id) (err ERR_NOT_EMPLOYER)))
      (app (unwrap! (map-get? applications { job-id: job-id, application-id: application-id })
                    (err ERR_NOT_FOUND)))
    )
    (asserts! (is-eq (get status job) JOB_STATUS_OPEN) (err ERR_JOB_CLOSED))
    (asserts! (is-eq (get status app) u0) (err ERR_INVALID_APPLICATION))

    (map-set applications
      { job-id: job-id, application-id: application-id }
      (merge app { status: u2 })  ;; rejected
    )

    ;; Emit application rejected event
    (print {
      event: "application-rejected",
      job-id: job-id,
      application-id: application-id,
      applicant: (get applicant app),
      employer: tx-sender,
      timestamp: stacks-block-height
    })

    (ok true)
  )
)

;; Withdraw application (applicant only, before winner selected)
(define-public (withdraw-application (job-id uint) (application-id uint))
  (let
    (
      (job (unwrap! (map-get? jobs { id: job-id }) (err ERR_NOT_FOUND)))
      (app (unwrap! (map-get? applications { job-id: job-id, application-id: application-id })
                    (err ERR_NOT_FOUND)))
    )
    (asserts! (is-eq (get status job) JOB_STATUS_OPEN) (err ERR_JOB_CLOSED))
    (asserts! (is-eq (get applicant app) tx-sender) (err ERR_UNAUTHORIZED))
    (asserts! (is-eq (get status app) u0) (err ERR_INVALID_APPLICATION))

    (map-set applications
      { job-id: job-id, application-id: application-id }
      (merge app { status: u2 })  ;; mark as withdrawn/rejected
    )

    ;; Remove from applicant tracking
    (map-delete applicant-applications { job-id: job-id, applicant: tx-sender })

    ;; Emit application withdrawn event
    (print {
      event: "application-withdrawn",
      job-id: job-id,
      application-id: application-id,
      applicant: tx-sender,
      timestamp: stacks-block-height
    })

    (ok true)
  )
)

;; Increment job view count
(define-public (track-job-view (job-id uint))
  (let
    ((activity (unwrap! (map-get? job-activity { job-id: job-id }) (err ERR_NOT_FOUND))))
    (map-set job-activity
      { job-id: job-id }
      (merge activity { views: (+ (get views activity) u1), last-activity: stacks-block-height })
    )
    
    ;; Emit job view event
    (print {
      event: "job-viewed",
      job-id: job-id,
      viewer: tx-sender,
      total-views: (+ (get views activity) u1),
      timestamp: stacks-block-height
    })
    
    (ok true)
  )
)

;; Get user statistics
(define-read-only (get-user-stats (user principal))
  (default-to 
    { jobs-created: u0, applications-submitted: u0, jobs-won: u0, total-earned: u0 }
    (map-get? user-stats { user: user })
  )
)

;; Get job activity
(define-read-only (get-job-activity (job-id uint))
  (default-to 
    { views: u0, applications: u0, last-activity: u0 }
    (map-get? job-activity { job-id: job-id })
  )
)

;; Get platform stats
(define-read-only (get-platform-stats)
  {
    total-jobs: (var-get total-jobs-created),
    total-applications: (var-get total-applications-submitted),
    total-rewards-distributed: (var-get total-rewards-distributed),
    active-jobs: (var-get job-counter)  ;; approximate
  }
)

;; --------------------------------------------------------
;; Read-only helpers for frontends
;; --------------------------------------------------------

;; Get a job by id.
(define-read-only (get-job (job-id uint))
  (match (map-get? jobs { id: job-id })
    job (ok job)
    (err ERR_NOT_FOUND)
  )
)

;; Get a single application for a job.
(define-read-only (get-application (job-id uint) (application-id uint))
  (match (map-get? applications { job-id: job-id, application-id: application-id })
    app (ok app)
    (err ERR_NOT_FOUND)
  )
)

;; Get counts useful for pagination on the frontend.
(define-read-only (get-job-count)
  (ok (var-get job-counter))
)

(define-read-only (get-application-count (job-id uint))
  (match (map-get? jobs { id: job-id })
    job (ok (get application-counter job))
    (err ERR_NOT_FOUND)
  )
)

;; Get all applications for a job (paginated)
(define-read-only (get-job-applications (job-id uint) (offset uint) (limit uint))
  (let
    ((job (unwrap! (map-get? jobs { id: job-id }) (err ERR_NOT_FOUND)))
     (max-apps (get application-counter job))
     (result (list)))
    ;; Note: Actual pagination would require iteration - this is a placeholder
    (ok { 
      job-id: job-id,
      total: max-apps,
      offset: offset,
      limit: limit
    })
  )
)

;; Check if user has applied to job
(define-read-only (has-applied (job-id uint) (applicant principal))
  (is-some (map-get? applicant-applications { job-id: job-id, applicant: applicant }))
)

;; Get application by applicant
(define-read-only (get-application-by-applicant (job-id uint) (applicant principal))
  (match (map-get? applicant-applications { job-id: job-id, applicant: applicant })
    data (map-get? applications { job-id: job-id, application-id: (get application-id data) })
    none
  )
)
