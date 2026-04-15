export type RiskLevel = 'high' | 'medium'

export type GeoJsonGeometry = {
  type: string
  coordinates: unknown
}

export type GeoJsonFeature<TProperties = Record<string, unknown>> = {
  type: 'Feature'
  properties: TProperties
  geometry: GeoJsonGeometry
}

export type GeoJsonFeatureCollection<TProperties = Record<string, unknown>> = {
  type: 'FeatureCollection'
  features: Array<GeoJsonFeature<TProperties>>
}

export type RiverProperties = {
  isWarning?: boolean
  water?: string
  natural?: string
  waterway?: string
  [key: string]: unknown
}

export type RiskPointProperties = {
  name?: string
  type?: string
  riskLevel?: RiskLevel
  [key: string]: unknown
}

export type RiverFeature = GeoJsonFeature<RiverProperties>
export type RiverFeatureCollection = GeoJsonFeatureCollection<RiverProperties>
export type RiskPointFeature = GeoJsonFeature<RiskPointProperties>
export type RiskPointCollection = GeoJsonFeatureCollection<RiskPointProperties>
export type BufferFeature = GeoJsonFeature<Record<string, unknown>>

export type FloodRiskSummary = {
  title: string
  weather: string
  warningRiverCount: number
  affectedCount: number
  affectedSites: Array<{
    name: string
    type: string
    riskLevel: RiskLevel
  }>
}

export type FloodAnalysisResult = {
  highRiskBuffer: BufferFeature
  mediumRiskBuffer: BufferFeature
  affectedPoints: RiskPointFeature[]
  warningRiverCount: number
}
