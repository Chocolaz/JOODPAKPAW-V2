export interface ReportCategory {
  id: number
  name: string
  label: string
  type: string
  createdAt: string
  updatedAt: string
}

export interface ReportCategoriesResponse {
  reportCategories: ReportCategory[]
}

export interface ReporterUser {
  id: number
  firstName: string
  lastName: string
  avatar: string
  email?: string
}

export interface ReporterReportSummary {
  id: number
  type: 'property' | 'review' | 'unban_property'
  status: 'pending' | 'resolved' | 'dismissed'
  resolvedAction: string | null
  reportCategoryLabel: string
  reporter: ReporterUser
  createdAt: string
  property?: { id: number; title: string }
  reviewAuthor?: ReporterUser
  reportCount?: number
}

export interface ReporterReportsResponse {
  totalRows: number
  totalPages: number
  data: ReporterReportSummary[]
  limit: number
  page: number
  orderBy: string
  sort: string
  attributes: { type: string }
}

export interface ReportImage {
  id: number
  fileName: string
  filePath: string
  fileContentType: string
  fileExtensionName: string
  fileSize: number
}

export interface ReporterReportDetail {
  id: number
  type: 'property' | 'review' | 'unban_property'
  status: 'pending' | 'resolved' | 'dismissed'
  resolvedAction: string | null
  adminNote: string | null
  reportCategoryLabel: string
  description: string
  createdAt: string
  images: ReportImage[]
  property?: { id: number; title: string }
  reporter: ReporterUser
  propOwner?: ReporterUser
  reviewAuthor?: ReporterUser
}
