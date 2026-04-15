import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import GeoJSON from 'ol/format/GeoJSON'
import type OLMap from 'ol/Map'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'
import { LAYERS } from '@/constant'
import type { WeatherNowItem } from '@/services/wind'
import {
  buildFloodRiskSummary,
  createEmptyRiskPointCollection,
  isRainyWeather,
  performFloodAnalysis,
} from '../floodRisk/analysis'
import type { FloodRiskSummary, RiskPointCollection, RiverFeatureCollection } from '../floodRisk/types'

type FloodRiskLayerProps = {
  mapRef: MutableRefObject<OLMap | null>
  activeLayers: string[]
  weatherNow: WeatherNowItem | null
  onRiskSummaryChange: (summary: FloodRiskSummary | null) => void
}

const geoJsonFormat = new GeoJSON({
  dataProjection: 'EPSG:4326',
  featureProjection: 'EPSG:3857',
})

const FloodRiskLayer: React.FC<FloodRiskLayerProps> = ({
  mapRef,
  activeLayers,
  weatherNow,
  onRiskSummaryChange,
}) => {
  const bufferLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const pointLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const floodLevelRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const riversDataRef = useRef<RiverFeatureCollection | null>(null)
  const riskPointsDataRef = useRef<RiskPointCollection>(createEmptyRiskPointCollection())
  const [dataReady, setDataReady] = useState(false)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const bufferSource = new VectorSource()
    const pointSource = new VectorSource()

    const bufferLayer = new VectorLayer({
      source: bufferSource,
      style: feature => {
        const riskLevel = String(feature.get('riskLevel') || 'medium')
        const pulse = floodLevelRef.current
        const isHigh = riskLevel === 'high'

        return new Style({
          fill: new Fill({
            color: isHigh
              ? `rgba(255, 88, 88, ${0.12 + pulse * 0.15})`
              : `rgba(0, 150, 255, ${0.08 + pulse * 0.12})`,
          }),
          stroke: new Stroke({
            color: isHigh ? 'rgba(255, 99, 99, 0.9)' : 'rgba(0, 170, 255, 0.82)',
            width: isHigh ? 1.5 + pulse * 2 : 1 + pulse * 1.5,
          }),
        })
      },
      zIndex: 15,
      visible: activeLayers.includes(LAYERS.FLOOD_BUFFER),
    })

    const pointLayer = new VectorLayer({
      source: pointSource,
      style: feature => {
        const riskLevel = String(feature.get('riskLevel') || 'medium')
        const pulse = floodLevelRef.current
        const isHigh = riskLevel === 'high'

        return new Style({
          image: new CircleStyle({
            radius: isHigh ? 5 + pulse * 2.5 : 4 + pulse * 1.5,
            fill: new Fill({
              color: isHigh ? 'rgba(255, 79, 79, 0.9)' : 'rgba(255, 168, 76, 0.88)',
            }),
            stroke: new Stroke({
              color: 'rgba(255,255,255,0.95)',
              width: 1.4,
            }),
          }),
        })
      },
      zIndex: 16,
      visible: activeLayers.includes(LAYERS.RISK_POINTS),
    })

    bufferLayer.set('id', LAYERS.FLOOD_BUFFER)
    pointLayer.set('id', LAYERS.RISK_POINTS)

    map.addLayer(bufferLayer)
    map.addLayer(pointLayer)
    bufferLayerRef.current = bufferLayer
    pointLayerRef.current = pointLayer

    const animate = () => {
      const next = floodLevelRef.current + 0.015
      floodLevelRef.current = next >= 1 ? 0 : next
      bufferLayer.changed()
      pointLayer.changed()
      animationFrameRef.current = window.requestAnimationFrame(animate)
    }

    animationFrameRef.current = window.requestAnimationFrame(animate)

    void Promise.all([
      fetch('/water.geojson').then(res => res.json()) as Promise<RiverFeatureCollection>,
      fetch('/risk_points.json').then(res => res.json()) as Promise<RiskPointCollection>,
    ]).then(([riverData, riskPointData]) => {
      riversDataRef.current = riverData
      riskPointsDataRef.current = riskPointData
      setDataReady(true)
    })

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      map.removeLayer(bufferLayer)
      map.removeLayer(pointLayer)
      bufferLayerRef.current = null
      pointLayerRef.current = null
    }
  }, [mapRef])

  useEffect(() => {
    if (bufferLayerRef.current) {
      bufferLayerRef.current.setVisible(activeLayers.includes(LAYERS.FLOOD_BUFFER))
    }
    if (pointLayerRef.current) {
      pointLayerRef.current.setVisible(activeLayers.includes(LAYERS.RISK_POINTS))
    }
  }, [activeLayers])

  useEffect(() => {
    const bufferSource = bufferLayerRef.current?.getSource()
    const pointSource = pointLayerRef.current?.getSource()
    const riverData = riversDataRef.current
    const riskPointData = riskPointsDataRef.current
    const weatherText = weatherNow?.weather || ''

    if (!bufferSource || !pointSource) return

    if (!isRainyWeather(weatherText) || !riverData) {
      bufferSource.clear()
      pointSource.clear()
      onRiskSummaryChange(null)
      return
    }

    const analysisResult = performFloodAnalysis(riverData, riskPointData, weatherText)
    if (!analysisResult) {
      bufferSource.clear()
      pointSource.clear()
      onRiskSummaryChange(null)
      return
    }

    const bufferFeatures = geoJsonFormat.readFeatures(
      {
        type: 'FeatureCollection',
        features: [
          {
            ...analysisResult.mediumRiskBuffer,
            properties: {
              ...analysisResult.mediumRiskBuffer.properties,
              riskLevel: 'medium',
            },
          },
          {
            ...analysisResult.highRiskBuffer,
            properties: {
              ...analysisResult.highRiskBuffer.properties,
              riskLevel: 'high',
            },
          },
        ],
      },
      { featureProjection: 'EPSG:3857' },
    )
    bufferFeatures.forEach(feature => {
      feature.set('layerType', 'flood-buffer')
      feature.set('name', '洪涝警戒区')
    })

    const riskPointFeatures = geoJsonFormat.readFeatures(
      {
        type: 'FeatureCollection',
        features: analysisResult.affectedPoints,
      },
      { featureProjection: 'EPSG:3857' },
    )
    riskPointFeatures.forEach(feature => {
      feature.set('layerType', 'risk-point')
      feature.set('name', String(feature.get('name') || '风险点'))
    })

    bufferSource.clear()
    pointSource.clear()
    bufferSource.addFeatures(bufferFeatures)
    pointSource.addFeatures(riskPointFeatures)
    onRiskSummaryChange(buildFloodRiskSummary(analysisResult, weatherText))
  }, [dataReady, onRiskSummaryChange, weatherNow])

  return null
}

export default FloodRiskLayer
