export interface AdminReportUser {
  id: number
  firstName: string
  lastName: string
  avatar: string
  email?: string
}

export interface AdminReportSummary {
  id: number
  type: 'property' | 'review' | 'unban_property'
  status: 'pending' | 'resolved' | 'dismissed'
  resolvedAction: string | null
  reportCategoryLabel: string
  reporter: AdminReportUser
  createdAt: string
  property?: { id: number; title: string }
  reviewAuthor?: AdminReportUser
  reportCount?: number
}

export interface AdminReportsResponse {
  totalRows: number
  totalPages: number
  data: AdminReportSummary[]
  limit: number
  page: number
  orderBy: string
  sort: string
  attributes: { type: string }
}

export interface AdminReportImage {
  id: number
  fileName: string
  filePath: string
  fileContentType: string
  fileExtensionName: string
  fileSize: number
}

export type ReportAction =
  | 'dismiss_report'
  | 'warn_user'
  | 'deactivate_property'
  | 'deactivate_all_properties'
  | 'delete_review'
  | 'unban_property'
  | 'unban_all_properties'

export interface AdminReportDetail {
  id: number
  type: 'property' | 'review' | 'unban_property'
  status: 'pending' | 'resolved' | 'dismissed'
  resolvedAction: string | null
  adminNote: string | null
  reportCategoryLabel: string
  description: string
  createdAt: string
  images: AdminReportImage[]
  property?: { id: number; title: string }
  reporter: AdminReportUser & { email: string }
  propOwner?: AdminReportUser & { email: string }
  reviewAuthor?: AdminReportUser & { email: string }
}
