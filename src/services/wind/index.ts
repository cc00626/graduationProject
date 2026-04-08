import request from '@/services/request'

export async function getWindPoll(lastTime?: string) {
  return request.get('/poll', {
    params: lastTime ? { lastTime } : {},
    timeout: 40000,
  })
}

export async function getWeatherNow(
  city: string,
  extensions: 'base' | 'all' = 'base',
  output: 'JSON' | 'XML' = 'JSON',
) {
  return request.get('/weather/now', {
    params: { city, extensions, output },
    timeout: 40000,
  })
}

export type HistoryQuery = {
  page?: number
  pageSize?: number
  sort?: 'asc' | 'desc'
  startTime?: string
  endTime?: string
}

export type WindHistoryItem = {
  maxWind?: number | { value?: number; station?: string }
  minWind?: number | { value?: number; station?: string }
  maxStation?: string
  minStation?: string
  time?: string | Date
  station?: string
  stationName?: string
  site?: string
  siteName?: string
}

export async function getWindHistory(params?: HistoryQuery) {
  return request.get('/history', {
    params: params || {},
    timeout: 40000,
  })
}
