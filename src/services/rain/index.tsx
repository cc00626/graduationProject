import request from '@/services/request'

export type BufferPoiItem = {
  id: string
  name: string
  type: string
  location: string
  address: string
  distance: string
  tel: string | string[]
}

export type BufferAnalysisPayload = {
  success: boolean
  count: string
  pois: BufferPoiItem[]
  msg?: string
}

export async function getBufferAnalysis(
  location: string,
  radius: number = 5000,
  disasterType: 'flood' | 'wind' | 'rescue' = 'flood',
) {
  return request.get('/rain/buffer', {
    params: {
      location,
      radius,
      disasterType,
    },
    timeout: 40000,
  }) as Promise<BufferAnalysisPayload>
}

export type RainStationDetailParams = {
  lng: number
  lat: number
  time: string
  period?: RainPeriod
}

export type RainPeriod = '1h' | '3h' | '6h' | '12h' | '24h'

export type RainLevel = {
  key: string
  label: string
  min: number
  color: string
  warningLevel: 'normal' | 'watch' | 'warning' | 'danger'
}

export type RainTopStation = {
  rank: number
  stationCode: string
  stationName: string
  district: string
  precip: number
  level: RainLevel
  coordinates: [number, number]
}

export type RainMonitorData = {
  period: RainPeriod
  periods: RainPeriod[]
  updatedAt: string
  stationCount: number
  avgPrecip: number
  maxPrecip: number
  topStations: RainTopStation[]
  thresholds: {
    watch: number
    warning: number
    danger: number
    message: string
    maxStation: RainTopStation | null
  }
  districts: Array<{
    district: string
    precipTotal: number
    stationCount: number
    avg: number
    max: number
  }>
  levels: RainLevel[]
}

export type RainStationDetailPayload = {
  success: boolean
  data:
    | {
        stationCode: string
        stationName: string
        district: string
        time: string
        period: RainPeriod
        precip: number
        rawPrecip: number
        level: RainLevel
        coordinates: [number, number]
        distanceKm: number
        updatedAt: string | null
      }
    | null
}

export async function getStationDetail(params: RainStationDetailParams) {
  return request.get('/rain/station-detail', {
    params: {
      lng: params.lng,
      lat: params.lat,
      time: params.time,
      period: params.period,
    },
    timeout: 40000,
  }) as Promise<RainStationDetailPayload>
}

export async function getRainMonitor(period: RainPeriod, time: string) {
  return request.get<{ success: boolean; data: RainMonitorData }>('/rain/monitor', {
    params: { period, time },
    timeout: 40000,
  })
}
