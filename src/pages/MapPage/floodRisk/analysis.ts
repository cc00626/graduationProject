import * as turf from '@turf/turf'
import type {
  BufferFeature,
  FloodAnalysisResult,
  FloodRiskSummary,
  RiskPointCollection,
  RiskPointFeature,
  RiverFeatureCollection,
} from './types'

const RAIN_KEYWORDS = ['雨', '阵雨', '雷阵雨', '暴雨', '大雨', '中雨', '小雨']

const getRainSeverity = (weatherText: string) => {
  if (weatherText.includes('暴雨')) return 10
  if (weatherText.includes('大雨')) return 8
  if (weatherText.includes('中雨')) return 6
  if (weatherText.includes('小雨') || weatherText.includes('阵雨')) return 4
  return 0
}

export const isRainyWeather = (weatherText?: string | null) => {
  if (!weatherText) return false
  return RAIN_KEYWORDS.some(keyword => weatherText.includes(keyword))
}

const isRiverLikeFeature = (feature: RiverFeatureCollection['features'][number]) => {
  const waterType = String(feature.properties?.water || '')
  const naturalType = String(feature.properties?.natural || '')
  const waterwayType = String(feature.properties?.waterway || '')
  return (
    waterType === 'river' ||
    naturalType === 'water' ||
    waterwayType === 'river' ||
    waterwayType === 'canal'
  )
}

export const markWarningRivers = (riverGeoJSON: RiverFeatureCollection, weatherText: string) => {
  const severity = getRainSeverity(weatherText)
  const candidateRivers = riverGeoJSON.features.filter(isRiverLikeFeature)
  const warningCount = Math.max(0, Math.min(candidateRivers.length, severity))

  return {
    warningRivers: candidateRivers
      .slice(0, warningCount)
      .map(feature => ({
        ...feature,
        properties: {
          ...feature.properties,
          isWarning: true,
        },
      })),
    warningCount,
  }
}

const mergeBufferedGeometry = (warningRivers: RiverFeatureCollection['features'], distanceKm: number) => {
  const buffered = turf.buffer(turf.featureCollection(warningRivers as any), distanceKm, {
    units: 'kilometers',
  }) as any

  const bufferedCollection =
    buffered?.type === 'FeatureCollection' ? buffered : turf.featureCollection([buffered])

  if (!bufferedCollection.features?.length) {
    return null
  }

  if (bufferedCollection.features.length === 1) {
    return bufferedCollection.features[0] as BufferFeature
  }

  const dissolved = turf.dissolve(bufferedCollection as any) as any
  if (dissolved?.type === 'FeatureCollection') {
    return dissolved.features?.[0] as BufferFeature
  }

  return dissolved as BufferFeature
}

export const performFloodAnalysis = (
  riverGeoJSON: RiverFeatureCollection,
  riskPointsGeoJSON: RiskPointCollection,
  weatherText: string,
): FloodAnalysisResult | null => {
  const { warningRivers, warningCount } = markWarningRivers(riverGeoJSON, weatherText)
  if (!warningRivers.length) return null

  const highRiskBuffer = mergeBufferedGeometry(warningRivers, 0.2)
  const mediumRiskBuffer = mergeBufferedGeometry(warningRivers, 0.5)
  if (!highRiskBuffer || !mediumRiskBuffer) return null

  const affectedPoints = riskPointsGeoJSON.features
    .filter((point: RiskPointFeature) => turf.booleanPointInPolygon(point as any, mediumRiskBuffer as any))
    .map((point: RiskPointFeature) => {
      const inHighRisk = turf.booleanPointInPolygon(point as any, highRiskBuffer as any)
      return {
        ...point,
        properties: {
          ...point.properties,
          riskLevel: inHighRisk ? 'high' : 'medium',
        },
      } as RiskPointFeature
    })

  return {
    highRiskBuffer,
    mediumRiskBuffer,
    affectedPoints,
    warningRiverCount: warningCount,
  }
}

export const buildFloodRiskSummary = (
  result: FloodAnalysisResult,
  weatherText: string,
): FloodRiskSummary => {
  return {
    title: '洪涝风险预警',
    weather: weatherText,
    warningRiverCount: result.warningRiverCount,
    affectedCount: result.affectedPoints.length,
    affectedSites: result.affectedPoints.map(point => ({
      name: point.properties?.name || '未命名风险点',
      type: point.properties?.type || 'unknown',
      riskLevel: point.properties?.riskLevel || 'medium',
    })),
  }
}

export const createEmptyRiskPointCollection = (): RiskPointCollection => ({
  type: 'FeatureCollection',
  features: [],
})
