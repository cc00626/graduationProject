import request from '@/services/request'
import type { BufferPoiItem } from '@/services/rain'

export type WarningType = 'rain' | 'flood' | 'typhoon'
export type WarningLevel = 'low' | 'medium' | 'high'
export type WarningStatus = 'draft' | 'published' | 'resolved' | 'archived'

export type WarningAnalysis = {
  count?: number
  avg?: number
  max?: number
  risk?: string
  [key: string]: unknown
} | null

export type WarningRecord = {
  _id: string
  title: string
  location: string
  center?: number[]
  type: WarningType
  level: WarningLevel
  status: WarningStatus
  radius: number
  description: string
  publisher?: string
  analysis?: WarningAnalysis
  pois?: BufferPoiItem[]
  publishedAt?: string
  resolvedAt?: string
  createdAt?: string
  updatedAt?: string
}

export type WarningPayload = {
  title: string
  location: string
  center?: number[]
  type: WarningType
  level: WarningLevel
  status?: WarningStatus
  radius: number
  description: string
  publisher?: string
  analysis?: WarningAnalysis
  pois?: BufferPoiItem[]
}

type ApiResponse<T> = {
  code: number
  message: string
  data: T
}

type WarningListParams = {
  type?: WarningType
  level?: WarningLevel
  status?: WarningStatus
  keyword?: string
  page?: number
  pageSize?: number
}

type WarningListData = {
  items: WarningRecord[]
  total: number
  page: number
  pageSize: number
}

type WarningNotificationData = {
  items: WarningRecord[]
  unreadCount: number
  total: number
}

export const createWarning = (data: WarningPayload) => {
  return request.post<ApiResponse<WarningRecord>, WarningPayload>('/warnings', data)
}

export const getWarnings = (params: WarningListParams = {}) => {
  return request.get<ApiResponse<WarningListData>>('/warnings', { params })
}

export const getLatestPublishedWarnings = (pageSize = 5) => {
  return getWarnings({
    status: 'published',
    page: 1,
    pageSize,
  })
}

export const getWarningNotifications = (pageSize = 5) => {
  return request.get<ApiResponse<WarningNotificationData>>('/warnings/notifications', {
    params: { pageSize },
  })
}

export const markWarningNotificationsRead = () => {
  return request.patch<ApiResponse<{ warningNoticeReadAt: string }>, undefined>(
    '/warnings/notifications/read',
  )
}

export const updateWarning = (id: string, data: WarningPayload) => {
  return request.patch<ApiResponse<WarningRecord>, WarningPayload>(`/warnings/${id}`, data)
}

export const getPublishedWarningsByTypes = async (types: WarningType[]) => {
  const responses = await Promise.all(
    types.map(type =>
      getWarnings({
        type,
        status: 'published',
        page: 1,
        pageSize: 100,
      }),
    ),
  )

  return responses.flatMap(response => (response.code === 0 ? response.data.items : []))
}

export const updateWarningStatus = (id: string, status: WarningStatus) => {
  return request.patch<ApiResponse<WarningRecord>, { status: WarningStatus }>(
    `/warnings/${id}/status`,
    { status },
  )
}

export const deleteWarning = (id: string) => {
  return request.delete<ApiResponse<null>>(`/warnings/${id}`)
}
