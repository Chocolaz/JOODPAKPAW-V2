export interface AdminVerificationUser {
  id: number
  firstName: string
  lastName: string
  avatar: string
  email: string
}

export interface AdminVerificationSummary {
  id: number
  user: AdminVerificationUser
  status: 'pending' | 'approved' | 'rejected'
  isResubmit: boolean
  submittedAt: string
}

export interface AdminVerificationDetail extends AdminVerificationSummary {
  rejectDescription: string | null
  previousRejectDescription: string | null
  idPhoto: string
  selfieWithId: string
}

export interface AdminVerificationsResponse {
  totalRows: number
  totalPages: number
  data: AdminVerificationSummary[]
  limit: number
  page: number
  attributes: { status: string }
}
