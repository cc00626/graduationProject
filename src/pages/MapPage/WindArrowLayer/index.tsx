import { useEffect, useRef, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import OLMap from 'ol/Map'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON'
import { getCenter } from 'ol/extent'
import Point from 'ol/geom/Point'
import type Geometry from 'ol/geom/Geometry'
import { Style, Icon } from 'ol/style'
import { getGuangzhouWindData } from '@/services/wind'

interface WindArrowLayerProps {
  mapRef: MutableRefObject<OLMap | null>
  visible?: boolean
  refreshKey?: number
}

type DistrictWindRecord = {
  district?: string
  name?: string
  districtName?: string
  winddirection?: string
  windDirection?: string
  windpower?: number | string
  windpower_value?: number | string
  windPower?: number | string
  stationDetails?: Array<Record<string, unknown>>
  stations?: Array<Record<string, unknown>>
}

const windDirToRadian = (dirText: string): number => {
  const windDirMap: Record<string, number> = {
    北: 0,
    东北: 45,
    东: 90,
    东南: 135,
    南: 180,
    西南: 225,
    西: 270,
    西北: 315,
    无风: 0,
  }
  return ((windDirMap[dirText] ?? 0) * Math.PI) / 180
}

const toNumber = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : NaN
}

const normalizeDistrictName = (name: string) =>
  name
    .replace(/\s+/g, '')
    .replace(/[\[\]（）()]/g, '')
    .replace(/市/g, '')

const getDistrictName = (record: DistrictWindRecord) => {
  return String(record.district || record.districtName || record.name || '').trim()
}

const getDirection = (record: DistrictWindRecord) => {
  const direct = record.winddirection || record.windDirection
  if (direct) return String(direct)

  const station = (record.stationDetails?.[0] || record.stations?.[0]) as Record<string, unknown> | undefined
  if (!station) return '无风'

  return String(station.winddirection || station.windDirection || '无风')
}

const getPower = (record: DistrictWindRecord) => {
  const value = record.windpower_value ?? record.windpower ?? record.windPower
  const directPower = toNumber(value)
  if (Number.isFinite(directPower)) return directPower

  const station = (record.stationDetails?.[0] || record.stations?.[0]) as Record<string, unknown> | undefined
  if (!station) return 0

  const stationPower = toNumber(station.windpower_value ?? station.windpower ?? station.windPower)
  return Number.isFinite(stationPower) ? stationPower : 0
}

const extractDistricts = (payload: any): DistrictWindRecord[] => {
  if (!payload) return []
  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.districts)) return payload.districts
  if (Array.isArray(payload.data?.items)) return payload.data.items
  if (Array.isArray(payload.data?.districts)) return payload.data.districts
  return []
}

const buildCentroidMap = async (): Promise<Map<string, Point>> => {
  const resp = await fetch('/广州市.geojson')
  const geojson = await resp.json()

  const format = new GeoJSON()
  const features = format.readFeatures(geojson, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857',
  })

  const centroidMap = new Map<string, Point>()

  features.forEach(feature => {
    const geometry = feature.getGeometry() as Geometry | null
    const name = String(feature.get('name') || '').trim()
    if (!geometry || !name) return

    const center = getCenter(geometry.getExtent())
    centroidMap.set(normalizeDistrictName(name), new Point(center))
  })

  return centroidMap
}

const getWindIconPath = (power: number) => {
  const version = '20260408-contrast'
  if (power >= 8) return `/assets/icons/wind-flow-high.svg?v=${version}`
  if (power >= 6) return `/assets/icons/wind-flow-midhigh.svg?v=${version}`
  if (power >= 4) return `/assets/icons/wind-flow-mid.svg?v=${version}`
  return `/assets/icons/wind-flow-low.svg?v=${version}`
}

const hashText = (input: string) => {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

const WindArrowLayer: React.FC<WindArrowLayerProps> = ({ mapRef, visible = true, refreshKey = 0 }) => {
  const layerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const animationTimeRef = useRef(0)

  const windIconStyleFunction = useCallback((feature: Feature<Geometry>) => {
    const dir = String(feature.get('winddirection') || '无风')
    const power = Number(feature.get('windpower_value')) || 0
    const src = getWindIconPath(power)
    const phaseSeed = String(feature.get('districtName') || '')
    const phase = (hashText(phaseSeed) % 628) / 100
    const t = animationTimeRef.current
    const swing = Math.sin(t * 0.002 + phase) * 0.07
    const breathe = Math.sin(t * 0.003 + phase) * 0.035
    const scale = 0.62 + Math.min(0.42, power * 0.032) + breathe

    return new Style({
      image: new Icon({
        src,
        rotation: windDirToRadian(dir) + swing,
        rotateWithView: true,
        scale,
        opacity: 0.9 + Math.max(0, breathe * 1.5),
        anchor: [0.5, 0.5],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
      }),
    })
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const vectorSource = new VectorSource()
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: windIconStyleFunction,
      zIndex: 20,
      visible,
    })

    map.addLayer(vectorLayer)
    layerRef.current = vectorLayer

    const animate = (timestamp: number) => {
      animationTimeRef.current = timestamp
      if (layerRef.current?.getVisible()) {
        layerRef.current.changed()
      }
      animationFrameRef.current = window.requestAnimationFrame(animate)
    }
    animationFrameRef.current = window.requestAnimationFrame(animate)

    const fetchAndFillData = async () => {
      try {
        const [res, centroidMap] = await Promise.all([getGuangzhouWindData(), buildCentroidMap()])
        const districts = extractDistricts(res?.data)

        const features = districts
          .map(record => {
            const districtName = getDistrictName(record)
            const point = centroidMap.get(normalizeDistrictName(districtName))
            if (!point) return null

            const feature = new Feature({ geometry: point.clone() })
            feature.setProperties({
              winddirection: getDirection(record),
              windpower_value: getPower(record),
              districtName,
            })
            return feature
          })
          .filter((item): item is Feature => item !== null)

        if (!features.length) {
          console.warn('[WindArrowLayer] 未生成风向要素，请检查区名匹配与接口数据', districts)
        }

        vectorSource.clear()
        vectorSource.addFeatures(features)
      } catch (error) {
        console.error('风向图层数据加载失败', error)
      }
    }

    fetchAndFillData()

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      map.removeLayer(vectorLayer)
      layerRef.current = null
    }
  }, [mapRef, windIconStyleFunction, visible, refreshKey])

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.setVisible(visible)
    }
  }, [visible])

  return null
}

export default WindArrowLayer
