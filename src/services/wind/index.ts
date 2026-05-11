import request from '@/services/request'

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export type WindLevelDistribution = {
  district: string
  levelCounts: number[]
}

export type WindPollPayload = {
  districts?: WindLevelDistribution[]
}

export type WeatherNowItem = {
  province?: string
  city?: string
  adcode?: string
  weather?: string
  temperature?: string
  temperature_float?: string
  winddirection?: string
  windpower?: string
  humidity?: string
  humidity_float?: string
  reporttime?: string
}

export type WeatherNowPayload = {
  status?: string
  count?: string
  info?: string
  infocode?: string
  lives?: WeatherNowItem[]
}

export type WeatherNowResponse = {
  success?: boolean
  data?: WeatherNowPayload
}

export type CrawledForecastItem = {
  day: string
  weather: string
  temperatureText: string
  high: number | null
  low: number | null
  wind: string
}

export type CrawledForecastPayload = {
  source: string
  sourceUrl: string
  crawledAt: string
  city: string
  items: CrawledForecastItem[]
}

export type CrawledForecastResponse = {
  success: boolean
  data: CrawledForecastPayload
}

export async function getWindPoll(lastTime?: string) {
  return request.get('/poll', {
    params: lastTime ? { lastTime } : {},
    timeout: 40000,
  }) as Promise<ApiResponse<WindPollPayload>>
}

export async function getWeatherNow(
  city: string,
  extensions: 'base' | 'all' = 'base',
  output: 'JSON' | 'XML' = 'JSON',
) {
  return request.get('/weather/now', {
    params: { city, extensions, output },
    timeout: 40000,
  }) as Promise<WeatherNowResponse>
}

export async function getGuangzhouWindData() {
  return request.get('/weather/guangzhou/wind', {
    timeout: 40000,
  }) as Promise<ApiResponse<unknown>>
}

export async function getGuangzhouForecastCrawl() {
  return request.get('/weather/guangzhou/forecast-crawl', {
    timeout: 40000,
  }) as Promise<CrawledForecastResponse>
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
  }) as Promise<ApiResponse<WindHistoryItem[]>>
}
