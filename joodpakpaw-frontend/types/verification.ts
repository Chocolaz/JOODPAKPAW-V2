export interface VerificationData {
  id: number
  status: 'pending' | 'approved' | 'rejected'
  isResubmit: boolean
  idPhoto: string
  selfieWithId: string
  submittedAt: string
  rejectDescription: string | null
  previousRejectDescription: string | null
}

export interface VerificationResponse {
  verification: VerificationData
}
