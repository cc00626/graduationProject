import request from '@/services/request'

export type AmapDashboardDistrict = {
  district: string
  adcode: string
  center: [number, number]
  weather: string
  temperature: number
  humidity: number
  winddirection: string
  windpower: string
  windLevel: number
  reporttime: string
  risk: number
  error?: string
}

export type AmapDashboardCast = {
  date: string
  week: string
  dayweather: string
  nightweather: string
  daytemp: string
  nighttemp: string
  daywind: string
  nightwind: string
  daypower: string
  nightpower: string
}

export type AmapDashboardPayload = {
  generatedAt: string
  source: string
  sourceApis: string[]
  city: {
    name: string
    adcode: string
    forecast: {
      city: string
      reporttime: string
      casts: AmapDashboardCast[]
    } | null
  }
  summary: {
    districtCount: number
    avgTemperature: number
    maxRiskDistrict: AmapDashboardDistrict | null
    maxWindDistrict: AmapDashboardDistrict | null
    failed: number
  }
  districts: AmapDashboardDistrict[]
}

export type AmapDashboardResponse = {
  success: boolean
  data: AmapDashboardPayload
  msg?: string
  error?: string
}

export async function getAmapDashboard() {
  return request.get('/dashboard/amap', {
    timeout: 50000,
  }) as Promise<AmapDashboardResponse>
}
