import request from '@/services/request'
import type { BufferPoiItem } from '@/services/rain'
import type { WarningAnalysis, WarningLevel, WarningType } from '@/services/warning'

type ApiResponse<T> = {
  code: number
  message: string
  data: T
}

export type GenerateWarningDraftPayload = {
  title?: string
  type: WarningType
  level: WarningLevel
  location?: string
  radius?: number
  publisher?: string
  analysis?: WarningAnalysis
  pois?: BufferPoiItem[]
  baseDescription?: string
}

type GenerateWarningDraftData = {
  content: string
  model: string
}

export const generateWarningDraft = (data: GenerateWarningDraftPayload) => {
  return request.post<ApiResponse<GenerateWarningDraftData>, GenerateWarningDraftPayload>(
    '/ai/warning-draft',
    data,
    { timeout: 95000 },
  )
}
