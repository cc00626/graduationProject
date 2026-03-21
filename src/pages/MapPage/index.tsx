import { useEffect, useMemo, useRef, useState } from 'react'
import 'ol/ol.css'
import OLMap from 'ol/Map'
import Feature from 'ol/Feature'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import XYZ from 'ol/source/XYZ'
import { fromLonLat, toLonLat } from 'ol/proj'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import Point from 'ol/geom/Point'
import CircleGeom from 'ol/geom/Circle'
import LineString from 'ol/geom/LineString'
import Polygon from 'ol/geom/Polygon'
import { Style, Fill, Stroke, Circle as CircleStyle, Text as TextStyle } from 'ol/style'
import Control from 'ol/control/Control'
import { defaults as defaultControls, FullScreen, OverviewMap, ScaleLine, ZoomSlider } from 'ol/control'
import Overlay from 'ol/Overlay'
import Draw from 'ol/interaction/Draw'
import DragBox from 'ol/interaction/DragBox'
import { getArea, getLength } from 'ol/sphere'
import { Typography } from 'antd'
import { getWindPoll } from '@/services/wind'
import style from './index.module.scss'

const { Title, Text } = Typography

type Coordinate = readonly [number, number]
const INITIAL_CENTER: Coordinate = [113.2644, 23.1291]
const INITIAL_ZOOM = 9

const DISTRICT_COORDS = {
  从化区: [113.587386, 23.545283],
  白云区: [113.262831, 23.162281],
  花都区: [113.211184, 23.39205],
  黄埔区: [113.450761, 23.103239],
  越秀区: [113.280714, 23.125624],
  海珠区: [113.262008, 23.103131],
  荔湾区: [113.243038, 23.124943],
  天河区: [113.335367, 23.13559],
  增城区: [113.829579, 23.290497],
  番禺区: [113.364619, 22.938582],
  南沙区: [113.53738, 22.794531],
} as const

type DistrictName = keyof typeof DISTRICT_COORDS
type RiskLevel = 0 | 1 | 2 | 3 | 4

type WindDistrict = {
  district: string
  levelCounts?: number[]
}

type WindPollResponse = {
  code: number
  data?: {
    districts: WindDistrict[]
    time: string
  }
}

type DistrictMetrics = {
  district: DistrictName
  levelCounts: [number, number, number, number]
  total: number
  riskScore: number
  riskLevel: RiskLevel
}

type BaseMapType = 'vector' | 'terrain' | 'dark'
type SidebarPanelKey = 'summary' | 'district' | 'buffer' | 'station' | 'query'
type MapToolType = 'none' | 'distance' | 'area' | 'box'

type LayerVisibility = {
  stations: boolean
  shelters: boolean
  floodPoints: boolean
  buffer: boolean
}

type StationRecord = {
  id: string
  name: string
  district: DistrictName
  coord: Coordinate
  temperature: number
  humidity: number
  windSpeed: number
  trend24h: number[]
}

type PoiCategory = '学校' | '医院' | '地铁站' | '避难场所' | '易涝点'

type PoiRecord = {
  id: string
  name: string
  district: DistrictName
  category: PoiCategory
  coord: Coordinate
}

type QueryResult = {
  id: string
  name: string
  category: string
}

const CARD_SIZE = {
  width: 170,
  height: 108,
}

const DISTRICT_CARD_OFFSETS: Partial<Record<DistrictName, Coordinate>> = {
  越秀区: [-190, -132],
  海珠区: [-138, 92],
  荔湾区: [-238, -18],
  天河区: [136, -64],
  白云区: [-92, -196],
  黄埔区: [208, 18],
  花都区: [-108, -92],
  番禺区: [100, 50],
}

const LEVEL_LABELS = ['静稳', '关注', '预警', '较高', '严重'] as const
const LEVEL_COLORS = ['#5b6b81', '#2f7df6', '#f3b21a', '#ef7d32', '#de425b'] as const
const DISTRICT_NAMES = Object.keys(DISTRICT_COORDS) as DistrictName[]
const SIDEBAR_TABS: Array<{ key: SidebarPanelKey; label: string }> = [
  { key: 'summary', label: '总览' },
  { key: 'district', label: '区域' },
  { key: 'buffer', label: '缓冲区' },
  { key: 'station', label: '站点' },
  { key: 'query', label: '分析' },
]
const styleCache = new Map<string, Style>()

const MONITOR_STATIONS: StationRecord[] = [
  {
    id: 'gz-center',
    name: '广州中心站',
    district: '越秀区',
    coord: [113.274, 23.135],
    temperature: 26.4,
    humidity: 78,
    windSpeed: 5.2,
    trend24h: [24, 24, 23, 23, 22, 23, 24, 26, 28, 29, 30, 31, 31, 30, 29, 28, 27, 26, 26, 25, 25, 25, 24, 24],
  },
  {
    id: 'tianhe-station',
    name: '天河观测站',
    district: '天河区',
    coord: [113.361, 23.139],
    temperature: 27.2,
    humidity: 74,
    windSpeed: 6.1,
    trend24h: [24, 24, 23, 23, 23, 24, 25, 27, 28, 29, 30, 31, 32, 31, 30, 29, 28, 27, 27, 26, 26, 25, 25, 25],
  },
  {
    id: 'panyu-station',
    name: '番禺观测站',
    district: '番禺区',
    coord: [113.392, 22.952],
    temperature: 26.8,
    humidity: 81,
    windSpeed: 4.8,
    trend24h: [23, 23, 22, 22, 22, 23, 24, 25, 27, 28, 29, 30, 30, 29, 29, 28, 27, 26, 26, 25, 25, 24, 24, 24],
  },
  {
    id: 'nansha-station',
    name: '南沙沿海站',
    district: '南沙区',
    coord: [113.57, 22.79],
    temperature: 27.6,
    humidity: 84,
    windSpeed: 7.3,
    trend24h: [24, 24, 24, 23, 23, 24, 25, 26, 27, 28, 29, 30, 31, 31, 30, 29, 28, 28, 27, 27, 26, 26, 25, 25],
  },
]

const RISK_POIS: PoiRecord[] = [
  { id: 'poi-1', name: '中山大学附属医院', district: '海珠区', category: '医院', coord: [113.297, 23.094] },
  { id: 'poi-2', name: '广州火车东站', district: '天河区', category: '地铁站', coord: [113.332, 23.154] },
  { id: 'poi-3', name: '越秀区第一中学', district: '越秀区', category: '学校', coord: [113.278, 23.129] },
  { id: 'poi-4', name: '白云体育馆避难点', district: '白云区', category: '避难场所', coord: [113.272, 23.182] },
  { id: 'poi-5', name: '黄埔大道易涝点', district: '天河区', category: '易涝点', coord: [113.347, 23.128] },
  { id: 'poi-6', name: '番禺广场站', district: '番禺区', category: '地铁站', coord: [113.384, 22.944] },
  { id: 'poi-7', name: '南沙中心医院', district: '南沙区', category: '医院', coord: [113.532, 22.804] },
  { id: 'poi-8', name: '花都应急避难广场', district: '花都区', category: '避难场所', coord: [113.218, 23.391] },
]

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const getConnectorStyle = (offsetX: number, offsetY: number) => {
  const targetX = clamp(0, offsetX, offsetX + CARD_SIZE.width)
  const targetY = clamp(0, offsetY, offsetY + CARD_SIZE.height)
  const distance = Math.hypot(targetX, targetY)
  const angle = (Math.atan2(targetY, targetX) * 180) / Math.PI

  return {
    width: `${distance}px`,
    transform: `rotate(${angle}deg)`,
  }
}

const resolveDistrictName = (rawName: string): DistrictName | null => {
  const name = rawName.replace(/\s/g, '')
  return name in DISTRICT_COORDS ? (name as DistrictName) : null
}

const normalizeCounts = (counts?: number[]): [number, number, number, number] => [
  counts?.[0] || 0,
  counts?.[1] || 0,
  counts?.[2] || 0,
  counts?.[3] || 0,
]

const createMetrics = (district: DistrictName, rawCounts?: number[]): DistrictMetrics => {
  const levelCounts = normalizeCounts(rawCounts)
  const total = levelCounts.reduce((sum, current) => sum + current, 0)
  const riskScore = levelCounts[0] + levelCounts[1] * 2 + levelCounts[2] * 3 + levelCounts[3] * 4

  let riskLevel: RiskLevel = 0
  if (levelCounts[3] > 0) {
    riskLevel = 4
  } else if (levelCounts[2] > 0) {
    riskLevel = 3
  } else if (levelCounts[1] > 0) {
    riskLevel = 2
  } else if (levelCounts[0] > 0) {
    riskLevel = 1
  }

  return {
    district,
    levelCounts,
    total,
    riskScore,
    riskLevel,
  }
}

const getRiskTag = (riskLevel: RiskLevel) => ({
  label: LEVEL_LABELS[riskLevel],
  color: LEVEL_COLORS[riskLevel],
})

const getRiskAdvice = (metrics: DistrictMetrics) => {
  if (metrics.riskLevel >= 4) return '建议立即启动重点区域巡查，检查户外设施和临时搭建物。'
  if (metrics.riskLevel === 3) return '建议加强监测频次，提前发布公众出行提醒。'
  if (metrics.riskLevel === 2) return '建议关注风场变化，做好设备值守和信息更新。'
  if (metrics.riskLevel === 1) return '当前为轻度波动，可持续观测。'
  return '当前区域状态平稳，可作为基线参考。'
}

const formatTimestamp = (value?: string) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

const toProjected = (coord: Coordinate) => fromLonLat([...coord])

const getDistanceMeters = (start: Coordinate, end: Coordinate) => {
  const toRadians = (value: number) => (value * Math.PI) / 180
  const earthRadius = 6371000
  const dLat = toRadians(end[1] - start[1])
  const dLng = toRadians(end[0] - start[0])
  const lat1 = toRadians(start[1])
  const lat2 = toRadians(end[1])
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * earthRadius * Math.asin(Math.sqrt(a))
}

const formatMeasureText = (tool: MapToolType, geometry: LineString | Polygon) => {
  if (tool === 'area' && geometry instanceof Polygon) {
    const area = getArea(geometry)
    return area >= 1000000 ? `${(area / 1000000).toFixed(2)} km2` : `${Math.round(area)} m2`
  }

  const length = getLength(geometry)
  return length >= 1000 ? `${(length / 1000).toFixed(2)} km` : `${Math.round(length)} m`
}

const createPointStyle = (color: string, label?: string) =>
  new Style({
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#ffffff', width: 2 }),
    }),
    text: label
      ? new TextStyle({
          text: label,
          offsetY: -14,
          font: '12px sans-serif',
          fill: new Fill({ color: '#334155' }),
          backgroundFill: new Fill({ color: 'rgba(255,255,255,0.9)' }),
          padding: [2, 4, 2, 4],
        })
      : undefined,
  })

const createBufferStyle = () =>
  new Style({
    stroke: new Stroke({
      color: '#1d4ed8',
      width: 2,
      lineDash: [8, 6],
    }),
    fill: new Fill({
      color: 'rgba(59, 130, 246, 0.08)',
    }),
  })

const getDistrictStyle = (riskLevel: RiskLevel, isSelected: boolean) => {
  const key = `${riskLevel}-${isSelected ? 'selected' : 'normal'}`
  const cached = styleCache.get(key)
  if (cached) return cached

  const palette = [
    { fill: 'rgba(149, 165, 166, 0.14)', stroke: '#6b7a90' },
    { fill: 'rgba(47, 125, 246, 0.2)', stroke: '#2f7df6' },
    { fill: 'rgba(243, 178, 26, 0.24)', stroke: '#d29b0e' },
    { fill: 'rgba(239, 125, 50, 0.26)', stroke: '#ef7d32' },
    { fill: 'rgba(222, 66, 91, 0.28)', stroke: '#de425b' },
  ][riskLevel]

  const districtStyle = new Style({
    stroke: new Stroke({
      color: isSelected ? '#ffffff' : palette.stroke,
      width: isSelected ? 3.6 : 2.2,
    }),
    fill: new Fill({
      color: isSelected ? 'rgba(24, 144, 255, 0.34)' : palette.fill,
    }),
  })

  styleCache.set(key, districtStyle)
  return districtStyle
}

const MapComponent = () => {
  const mapElement = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<OLMap | null>(null)
  const vectorBaseLayerRef = useRef<TileLayer<OSM> | null>(null)
  const terrainBaseLayerRef = useRef<TileLayer<XYZ> | null>(null)
  const darkBaseLayerRef = useRef<TileLayer<XYZ> | null>(null)
  const districtLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const stationLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const shelterLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const floodLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const bufferLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const measureLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const queryLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const drawInteractionRef = useRef<Draw | null>(null)
  const dragBoxRef = useRef<DragBox | null>(null)
  const districtCentersRef = useRef<Partial<Record<DistrictName, Coordinate>>>({})
  const windDataRef = useRef<Partial<Record<DistrictName, [number, number, number, number]>>>({})
  const districtMetricsRef = useRef<Record<DistrictName, DistrictMetrics>>(
    DISTRICT_NAMES.reduce(
      (acc, district) => {
        acc[district] = createMetrics(district)
        return acc
      },
      {} as Record<DistrictName, DistrictMetrics>,
    ),
  )
  const selectedDistrictRef = useRef<DistrictName | null>(null)
  const selectedOverlayRef = useRef<Overlay | null>(null)

  const [districtMetrics, setDistrictMetrics] = useState<Record<DistrictName, DistrictMetrics>>(() =>
    districtMetricsRef.current,
  )
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictName | null>(null)
  const [selectedStation, setSelectedStation] = useState<StationRecord | null>(null)
  const [lastUpdateTime, setLastUpdateTime] = useState('--')
  const [systemStatus, setSystemStatus] = useState<'idle' | 'live' | 'warning'>('idle')
  const [baseMap, setBaseMap] = useState<BaseMapType>('vector')
  const [activePanel, setActivePanel] = useState<SidebarPanelKey>('summary')
  const [activeMapTool, setActiveMapTool] = useState<MapToolType>('none')
  const [bufferRadius, setBufferRadius] = useState(5000)
  const [mapZoom, setMapZoom] = useState(INITIAL_ZOOM)
  const [mapCenterText, setMapCenterText] = useState(`${INITIAL_CENTER[0].toFixed(3)}, ${INITIAL_CENTER[1].toFixed(3)}`)
  const [cursorText, setCursorText] = useState('--')
  const [measureResult, setMeasureResult] = useState('未开始测量')
  const [queryResults, setQueryResults] = useState<QueryResult[]>([])
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    stations: true,
    shelters: true,
    floodPoints: true,
    buffer: true,
  })
  const [impactedPois, setImpactedPois] = useState<PoiRecord[]>([])

  const overview = useMemo(() => {
    const metricsList = Object.values(districtMetrics)
    const alertCount = metricsList.filter(item => item.riskLevel >= 2).length
    const highRiskCount = metricsList.filter(item => item.riskLevel >= 3).length
    const totalRiskScore = metricsList.reduce((sum, item) => sum + item.riskScore, 0)
    const topDistrict = [...metricsList].sort((a, b) => b.riskScore - a.riskScore)[0]

    return {
      districtCount: metricsList.length,
      alertCount,
      highRiskCount,
      totalRiskScore,
      topDistrict,
    }
  }, [districtMetrics])

  const ranking = useMemo(
    () => [...Object.values(districtMetrics)].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5),
    [districtMetrics],
  )

  const selectedMetrics = selectedDistrict ? districtMetrics[selectedDistrict] : null
  const shelterPois = useMemo(() => RISK_POIS.filter(item => item.category === '避难场所'), [])
  const floodPois = useMemo(() => RISK_POIS.filter(item => item.category === '易涝点'), [])
  const visibleLayerCount = useMemo(
    () => Object.values(layerVisibility).filter(Boolean).length,
    [layerVisibility],
  )
  const activeBaseMapLabel = useMemo(() => {
    if (baseMap === 'terrain') return '地形底图'
    if (baseMap === 'dark') return '深色底图'
    return '矢量底图'
  }, [baseMap])

  useEffect(() => {
    districtMetricsRef.current = districtMetrics
  }, [districtMetrics])

  const renderDistrictOverlay = (name: DistrictName) => {
    const map = mapRef.current
    if (!map) return

    const metrics = districtMetricsRef.current[name] || createMetrics(name, windDataRef.current[name])
    const tag = getRiskTag(metrics.riskLevel)
    const coords = districtCentersRef.current[name] || DISTRICT_COORDS[name]
    const [offsetX, offsetY] = DISTRICT_CARD_OFFSETS[name] || [140, -70]
    const connectorStyle = getConnectorStyle(offsetX, offsetY)
    const content = `
      <div style="font-size: 12px; line-height: 1.5; color: #1f2a3d;">
        <div style="display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
          <strong>${name}</strong>
          <span style="padding: 1px 8px; border-radius: 999px; background: ${tag.color}; color: #fff;">${tag.label}</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px;">
          <span>1级: ${metrics.levelCounts[0]}</span>
          <span>2级: ${metrics.levelCounts[1]}</span>
          <span>3级: ${metrics.levelCounts[2]}</span>
          <span>4级: ${metrics.levelCounts[3]}</span>
        </div>
        <div style="margin-top: 6px; color: #56657f;">综合风险指数: ${metrics.riskScore}</div>
      </div>
    `

    let overlay = selectedOverlayRef.current
    if (!overlay) {
      const wrapper = document.createElement('div')
      wrapper.style.cssText = 'position: relative; width: 0; height: 0; pointer-events: none;'

      const anchor = document.createElement('div')
      anchor.style.cssText = `
        position: absolute;
        left: -4px;
        top: -4px;
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #133761;
        box-shadow: 0 0 0 4px rgba(19, 55, 97, 0.18);
      `

      const connector = document.createElement('div')
      connector.className = 'wind-connector'
      connector.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        height: 2px;
        transform-origin: 0 0;
        background: rgba(27, 60, 102, 0.48);
      `

      const card = document.createElement('div')
      card.className = 'wind-card'
      card.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        width: ${CARD_SIZE.width}px;
        min-height: ${CARD_SIZE.height}px;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(79, 107, 153, 0.4);
        padding: 10px 12px;
        border-radius: 14px;
        box-shadow: 0 16px 30px rgba(17, 33, 58, 0.2);
      `

      wrapper.appendChild(anchor)
      wrapper.appendChild(connector)
      wrapper.appendChild(card)

      overlay = new Overlay({
        element: wrapper,
        positioning: 'top-left',
      })
      map.addOverlay(overlay)
      selectedOverlayRef.current = overlay
    }

    overlay.setPosition(fromLonLat([...coords]))
    const wrapper = overlay.getElement()
    if (!wrapper) return

    const connectorEl = wrapper.querySelector<HTMLDivElement>('.wind-connector')
    const cardEl = wrapper.querySelector<HTMLDivElement>('.wind-card')

    if (connectorEl) {
      connectorEl.style.width = connectorStyle.width
      connectorEl.style.transform = connectorStyle.transform
    }

    if (cardEl) {
      cardEl.style.transform = `translate(${offsetX}px, ${offsetY}px)`
      cardEl.innerHTML = content
    }
  }

  const renderStationOverlay = (station: StationRecord) => {
    const map = mapRef.current
    if (!map) return

    const content = `
      <div style="font-size: 12px; line-height: 1.6; color: #1f2a3d;">
        <div style="font-weight: 700; margin-bottom: 4px;">${station.name}</div>
        <div>所属区域：${station.district}</div>
        <div>温度：${station.temperature.toFixed(1)}°C</div>
        <div>湿度：${station.humidity}%</div>
        <div>风速：${station.windSpeed.toFixed(1)} m/s</div>
      </div>
    `

    let overlay = selectedOverlayRef.current
    if (!overlay) {
      const element = document.createElement('div')
      overlay = new Overlay({
        element,
        positioning: 'bottom-center',
        offset: [0, -12],
      })
      map.addOverlay(overlay)
      selectedOverlayRef.current = overlay
    }

    const element = overlay.getElement()
    if (!element) return
    element.innerHTML = content
    ;(element as HTMLDivElement).style.cssText = `
      min-width: 170px;
      padding: 10px 12px;
      border: 1px solid #dbe3ec;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
    `
    overlay.setPosition(toProjected(station.coord))
  }

  const handleResetView = () => {
    const map = mapRef.current
    if (!map) return

    map.getView().animate({
      center: fromLonLat([...INITIAL_CENTER]),
      zoom: INITIAL_ZOOM,
      duration: 600,
    })
  }

  const handleFocusTopDistrict = () => {
    const map = mapRef.current
    const topDistrict = overview.topDistrict
    if (!map || !topDistrict) return

    const center = districtCentersRef.current[topDistrict.district] || DISTRICT_COORDS[topDistrict.district]
    map.getView().animate({
      center: fromLonLat([...center]),
      zoom: 10.5,
      duration: 600,
    })
    selectedDistrictRef.current = topDistrict.district
    setSelectedDistrict(topDistrict.district)
    setSelectedStation(null)
    setActivePanel('district')
    districtLayerRef.current?.changed()
    renderDistrictOverlay(topDistrict.district)
  }

  useEffect(() => {
    class TitleControl extends Control {
      constructor(title: string) {
        const element = document.createElement('div')
        element.className = 'map-title'
        element.innerHTML = title
        super({ element })
      }
    }

    const vectorBaseLayer = new TileLayer({
      source: new OSM(),
      visible: true,
    })
    vectorBaseLayerRef.current = vectorBaseLayer

    const terrainBaseLayer = new TileLayer({
      source: new XYZ({
        url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
      }),
      visible: false,
    })
    terrainBaseLayerRef.current = terrainBaseLayer

    const darkBaseLayer = new TileLayer({
      source: new XYZ({
        url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      }),
      visible: false,
    })
    darkBaseLayerRef.current = darkBaseLayer

    const vectorSource = new VectorSource({
      url: '/广州市.geojson',
      format: new GeoJSON(),
    })

    const guangzhouLayer = new VectorLayer({
      source: vectorSource,
      style: feature => {
        const rawName = feature.get('name')
        const featureName = typeof rawName === 'string' ? resolveDistrictName(rawName) : null
        if (!featureName) return getDistrictStyle(0, false)

        const metrics = districtMetricsRef.current[featureName] || createMetrics(featureName)
        const isSelected = selectedDistrictRef.current === featureName
        return getDistrictStyle(metrics.riskLevel, isSelected)
      },
    })

    districtLayerRef.current = guangzhouLayer

    const stationLayer = new VectorLayer({
      source: new VectorSource({
        features: MONITOR_STATIONS.map(station => {
          const feature = new Feature({
            geometry: new Point(toProjected(station.coord)),
          })
          feature.set('featureType', 'station')
          feature.set('data', station)
          return feature
        }),
      }),
      style: feature => {
        const station = feature.get('data') as StationRecord
        return createPointStyle('#0f766e', station.name)
      },
    })
    stationLayerRef.current = stationLayer

    const shelterLayer = new VectorLayer({
      source: new VectorSource({
        features: shelterPois.map(poi => {
          const feature = new Feature({
            geometry: new Point(toProjected(poi.coord)),
          })
          feature.set('featureType', 'shelter')
          feature.set('data', poi)
          return feature
        }),
      }),
      style: feature => {
        const poi = feature.get('data') as PoiRecord
        return createPointStyle('#16a34a', poi.name)
      },
    })
    shelterLayerRef.current = shelterLayer

    const floodLayer = new VectorLayer({
      source: new VectorSource({
        features: floodPois.map(poi => {
          const feature = new Feature({
            geometry: new Point(toProjected(poi.coord)),
          })
          feature.set('featureType', 'floodPoint')
          feature.set('data', poi)
          return feature
        }),
      }),
      style: feature => {
        const poi = feature.get('data') as PoiRecord
        return createPointStyle('#dc2626', poi.name)
      },
    })
    floodLayerRef.current = floodLayer

    const bufferLayer = new VectorLayer({
      source: new VectorSource(),
      style: createBufferStyle(),
    })
    bufferLayerRef.current = bufferLayer

    const measureLayer = new VectorLayer({
      source: new VectorSource(),
      style: new Style({
        stroke: new Stroke({
          color: '#2563eb',
          width: 3,
          lineDash: [10, 6],
        }),
        fill: new Fill({
          color: 'rgba(37, 99, 235, 0.10)',
        }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#2563eb' }),
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
      }),
    })
    measureLayerRef.current = measureLayer

    const queryLayer = new VectorLayer({
      source: new VectorSource(),
      style: new Style({
        stroke: new Stroke({
          color: '#7c3aed',
          width: 2,
        }),
        fill: new Fill({
          color: 'rgba(124, 58, 237, 0.08)',
        }),
      }),
    })
    queryLayerRef.current = queryLayer

    const initialMap = new OLMap({
      target: mapElement.current ?? undefined,
      layers: [
        vectorBaseLayer,
        terrainBaseLayer,
        darkBaseLayer,
        guangzhouLayer,
        bufferLayer,
        queryLayer,
        measureLayer,
        stationLayer,
        shelterLayer,
        floodLayer,
      ],
      controls: defaultControls({ zoom: false }).extend([
        new FullScreen(),
        new ZoomSlider(),
        new ScaleLine({ bar: true, text: true, minWidth: 120 }),
        new OverviewMap({
          collapsed: false,
          layers: [
            new TileLayer({
              source: new OSM(),
            }),
          ],
        }),
      ]),
      view: new View({
        center: fromLonLat([...INITIAL_CENTER]),
        zoom: INITIAL_ZOOM,
      }),
    })

    const syncMapViewState = () => {
      const view = initialMap.getView()
      const center = view.getCenter()
      if (center) {
        const [lon, lat] = toLonLat(center)
        setMapCenterText(`${lon.toFixed(3)}, ${lat.toFixed(3)}`)
      }
      setMapZoom(Number((view.getZoom() || INITIAL_ZOOM).toFixed(1)))
    }

    const handlePointerMove = (event: { coordinate: number[] }) => {
      const [lon, lat] = toLonLat(event.coordinate)
      setCursorText(`${lon.toFixed(4)}, ${lat.toFixed(4)}`)
    }

    const viewport = initialMap.getViewport()
    const handleMouseLeave = () => setCursorText('--')

    viewport.addEventListener('mouseleave', handleMouseLeave)
    initialMap.on('pointermove', handlePointerMove)
    initialMap.on('moveend', syncMapViewState)
    syncMapViewState()

    initialMap.addControl(new TitleControl('广州市气象灾害监测图'))
    mapRef.current = initialMap

    initialMap.on('click', event => {
      const feature = initialMap.forEachFeatureAtPixel(event.pixel, currentFeature => currentFeature)
      if (!feature) {
        selectedDistrictRef.current = null
        setSelectedDistrict(null)
        setSelectedStation(null)
        districtLayerRef.current?.changed()
        return
      }

      const featureType = feature.get('featureType')
      if (featureType === 'station') {
        const station = feature.get('data') as StationRecord
        setSelectedStation(station)
        setActivePanel('station')
        renderStationOverlay(station)
        return
      }

      const rawName = feature.get('name')
      if (typeof rawName !== 'string') {
        selectedDistrictRef.current = null
        setSelectedDistrict(null)
        setSelectedStation(null)
        districtLayerRef.current?.changed()
        return
      }

      const name = resolveDistrictName(rawName)
      if (!name) {
        selectedDistrictRef.current = null
        setSelectedDistrict(null)
        setSelectedStation(null)
        districtLayerRef.current?.changed()
        return
      }

      selectedDistrictRef.current = name
      setSelectedDistrict(name)
      setSelectedStation(null)
      setActivePanel('district')
      districtLayerRef.current?.changed()
      renderDistrictOverlay(name)
    })

    fetch('/广州市.geojson')
      .then(response => response.json())
      .then((json: unknown) => {
        if (!json || typeof json !== 'object' || !('features' in json)) return
        const features = (json as { features?: unknown[] }).features
        if (!Array.isArray(features)) return

        const nextCenters: Partial<Record<DistrictName, [number, number]>> = {}
        features.forEach(feature => {
          const properties = (feature as { properties?: Record<string, unknown> }).properties
          if (!properties) return

          const rawName = properties.name
          const center = properties.center
          if (typeof rawName !== 'string' || !Array.isArray(center) || center.length < 2) return

          const name = resolveDistrictName(rawName)
          if (!name) return
          if (typeof center[0] !== 'number' || typeof center[1] !== 'number') return
          nextCenters[name] = [center[0], center[1]]
        })
        districtCentersRef.current = nextCenters
      })
      .catch(error => {
        console.error('读取广州市.geojson失败，回退到默认坐标:', error)
      })

    return () => {
      viewport.removeEventListener('mouseleave', handleMouseLeave)
      initialMap.setTarget(undefined)
    }
  }, [])

  useEffect(() => {
    let isRunning = true
    let lastTime: string | undefined

    const startPolling = async () => {
      while (isRunning && mapRef.current) {
        try {
          const res = (await getWindPoll(lastTime)) as WindPollResponse
          if (!isRunning) break

          if (res.code === 0 && res.data) {
            const nextMetrics = DISTRICT_NAMES.reduce(
              (acc, district) => {
                acc[district] = createMetrics(district, windDataRef.current[district])
                return acc
              },
              {} as Record<DistrictName, DistrictMetrics>,
            )

            res.data.districts.forEach(item => {
              const name = resolveDistrictName(item.district)
              if (!name) return
              const counts = normalizeCounts(item.levelCounts)
              windDataRef.current[name] = counts
              nextMetrics[name] = createMetrics(name, counts)
            })

            districtMetricsRef.current = nextMetrics
            setDistrictMetrics(nextMetrics)
            setLastUpdateTime(formatTimestamp(res.data.time))
            setSystemStatus(Object.values(nextMetrics).some(item => item.riskLevel >= 3) ? 'warning' : 'live')
            districtLayerRef.current?.changed()

            if (selectedDistrictRef.current) {
              renderDistrictOverlay(selectedDistrictRef.current)
            }

            lastTime = res.data.time
          }
        } catch (error) {
          console.error('轮询出错:', error)
          setSystemStatus('warning')
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      }
    }

    startPolling()

    return () => {
      isRunning = false
      if (mapRef.current && selectedOverlayRef.current) {
        mapRef.current.removeOverlay(selectedOverlayRef.current)
      }
      selectedOverlayRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!vectorBaseLayerRef.current || !terrainBaseLayerRef.current || !darkBaseLayerRef.current) return

    vectorBaseLayerRef.current.setVisible(baseMap === 'vector')
    terrainBaseLayerRef.current.setVisible(baseMap === 'terrain')
    darkBaseLayerRef.current.setVisible(baseMap === 'dark')
  }, [baseMap])

  useEffect(() => {
    stationLayerRef.current?.setVisible(layerVisibility.stations)
    shelterLayerRef.current?.setVisible(layerVisibility.shelters)
    floodLayerRef.current?.setVisible(layerVisibility.floodPoints)
    bufferLayerRef.current?.setVisible(layerVisibility.buffer)
  }, [layerVisibility])

  useEffect(() => {
    const map = mapRef.current
    const measureLayer = measureLayerRef.current
    const queryLayer = queryLayerRef.current
    if (!map || !measureLayer || !queryLayer) return

    if (drawInteractionRef.current) {
      map.removeInteraction(drawInteractionRef.current)
      drawInteractionRef.current = null
    }

    if (dragBoxRef.current) {
      map.removeInteraction(dragBoxRef.current)
      dragBoxRef.current = null
    }

    measureLayer.getSource()?.clear()
    queryLayer.getSource()?.clear()

    if (activeMapTool === 'none') {
      setQueryResults([])
      setMeasureResult('未开始测量')
      return
    }

    if (activeMapTool === 'distance' || activeMapTool === 'area') {
      setQueryResults([])
      setMeasureResult(activeMapTool === 'distance' ? '请在地图上绘制线段开始测距' : '请在地图上绘制面开始测面积')
      const draw = new Draw({
        source: measureLayer.getSource() || new VectorSource(),
        type: activeMapTool === 'distance' ? 'LineString' : 'Polygon',
      })

      draw.on('drawstart', () => {
        measureLayer.getSource()?.clear()
      })

      draw.on('drawend', event => {
        const geometry = event.feature.getGeometry()
        if (!geometry) return
        if (geometry instanceof LineString || geometry instanceof Polygon) {
          setMeasureResult(formatMeasureText(activeMapTool, geometry))
          setActivePanel('query')
        }
      })

      map.addInteraction(draw)
      drawInteractionRef.current = draw
      return
    }

    if (activeMapTool === 'box') {
      setMeasureResult('按住 Shift 键并拖拽鼠标进行框选')
      const dragBox = new DragBox()
      dragBox.on('boxend', () => {
        const geometry = dragBox.getGeometry()
        if (!geometry) return

        const extent = geometry.getExtent()
        queryLayer.getSource()?.clear()
        queryLayer.getSource()?.addFeature(new Feature(geometry.clone()))

        const nextResults: QueryResult[] = []

        stationLayerRef.current
          ?.getSource()
          ?.getFeaturesInExtent(extent)
          .forEach(feature => {
            const station = feature.get('data') as StationRecord
            if (!station) return
            nextResults.push({ id: station.id, name: station.name, category: '监测站' })
          })

        shelterLayerRef.current
          ?.getSource()
          ?.getFeaturesInExtent(extent)
          .forEach(feature => {
            const poi = feature.get('data') as PoiRecord
            if (!poi) return
            nextResults.push({ id: poi.id, name: poi.name, category: poi.category })
          })

        floodLayerRef.current
          ?.getSource()
          ?.getFeaturesInExtent(extent)
          .forEach(feature => {
            const poi = feature.get('data') as PoiRecord
            if (!poi) return
            nextResults.push({ id: poi.id, name: poi.name, category: poi.category })
          })

        setQueryResults(nextResults)
        setMeasureResult(`框选结果 ${nextResults.length} 个要素`)
        setActivePanel('query')
      })

      map.addInteraction(dragBox)
      dragBoxRef.current = dragBox
    }

    return () => {
      if (drawInteractionRef.current) {
        map.removeInteraction(drawInteractionRef.current)
        drawInteractionRef.current = null
      }
      if (dragBoxRef.current) {
        map.removeInteraction(dragBoxRef.current)
        dragBoxRef.current = null
      }
    }
  }, [activeMapTool])

  useEffect(() => {
    const bufferLayer = bufferLayerRef.current
    if (!bufferLayer) return

    const source = bufferLayer.getSource()
    if (!source) return
    source.clear()

    if (!selectedDistrict || !layerVisibility.buffer) {
      setImpactedPois([])
      return
    }

    const center = districtCentersRef.current[selectedDistrict] || DISTRICT_COORDS[selectedDistrict]
    const circle = new CircleGeom(toProjected(center), bufferRadius)
    const feature = new Feature(circle)
    source.addFeature(feature)

    const impacted = RISK_POIS.filter(item => getDistanceMeters(center, item.coord) <= bufferRadius)
    setImpactedPois(impacted)
  }, [bufferRadius, layerVisibility.buffer, selectedDistrict])

  return (
    <div className={style.page}>
      {/* <div className={style.header}>
        <div>
          <Text className={style.eyebrow}>气象监测与预警</Text>
          <Title level={2} className={style.pageTitle}>
            广州市气象灾害预警可视化平台
          </Title>
          <Text className={style.pageDesc}>
            展示广州各行政区实时风场信息、风险等级分布和重点区域研判结果。
          </Text>
        </div>
        <div className={style.statusPanel}>
          <span
            className={`${style.statusDot} ${systemStatus === 'warning' ? style.statusWarning : style.statusLive}`}
          />
          <div>
            <Text className={style.statusLabel}>系统状态</Text>
            <div className={style.statusValue}>{systemStatus === 'warning' ? '重点监测中' : '实时运行中'}</div>
          </div>
        </div>
      </div> */}

      <div className={style.mainGrid}>
        <section className={style.mapPanel}>
          <div className={style.panelHeader}>
            <div>
              <Title level={4} className={style.panelTitle}>
                风险分布地图
              </Title>
              <Text className={style.panelDesc}>点击区块可查看详细风力等级统计与风险说明。</Text>
            </div>
            <Text className={style.updateTime}>最近更新：{lastUpdateTime}</Text>
          </div>

          <div className={style.toolRow}>
            <div className={style.toolGroup}>
              <span className={style.toolLabel}>底图切换</span>
              {[
                { key: 'vector', label: '矢量底图' },
                { key: 'terrain', label: '地形底图' },
                { key: 'dark', label: '深色底图' },
              ].map(item => (
                <button
                  key={item.key}
                  type="button"
                  className={`${style.toolButton} ${baseMap === item.key ? style.toolButtonActive : ''}`}
                  onClick={() => setBaseMap(item.key as BaseMapType)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className={style.toolGroup}>
              <span className={style.toolLabel}>图层管理</span>
              {[
                { key: 'stations', label: '监测站' },
                { key: 'shelters', label: '避难场所' },
                { key: 'floodPoints', label: '易涝点' },
                { key: 'buffer', label: '缓冲区' },
              ].map(item => (
                <button
                  key={item.key}
                  type="button"
                  className={`${style.toolButton} ${
                    layerVisibility[item.key as keyof LayerVisibility] ? style.toolButtonActive : ''
                  }`}
                  onClick={() =>
                    setLayerVisibility(prev => ({
                      ...prev,
                      [item.key]: !prev[item.key as keyof LayerVisibility],
                    }))
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className={style.legend}>
            {[0, 1, 2, 3, 4].map(level => {
              const tag = getRiskTag(level as RiskLevel)
              return (
                <div key={level} className={style.legendItem}>
                  <span className={style.legendSwatch} style={{ backgroundColor: tag.color }} />
                  <span>{tag.label}</span>
                </div>
              )
            })}
          </div>

          <div className={style.mapToolbar}>
            <div className={style.mapActionGroup}>
              <button type="button" className={style.mapActionButton} onClick={handleResetView}>
                重置视图
              </button>
              <button type="button" className={style.mapActionButton} onClick={handleFocusTopDistrict}>
                聚焦高风险区
              </button>
            </div>
            <div className={style.mapChipGroup}>
              <span className={style.mapChip}>底图: {activeBaseMapLabel}</span>
              <span className={style.mapChip}>已开图层: {visibleLayerCount}</span>
              <span className={style.mapChip}>缩放: {mapZoom}</span>
            </div>
          </div>

          <div className={style.analysisToolbar}>
            <span className={style.toolLabel}>空间工具</span>
            {[
              { key: 'none', label: '浏览' },
              { key: 'distance', label: '测距' },
              { key: 'area', label: '测面积' },
              { key: 'box', label: '框选查询' },
            ].map(item => (
              <button
                key={item.key}
                type="button"
                className={`${style.toolButton} ${activeMapTool === item.key ? style.toolButtonActive : ''}`}
                onClick={() => setActiveMapTool(item.key as MapToolType)}
              >
                {item.label}
              </button>
            ))}
            <span className={style.measureHint}>当前结果: {measureResult}</span>
          </div>

          <div ref={mapElement} className={style.mapCanvas} />

          <div className={style.mapFooter}>
            <span className={style.mapFooterItem}>中心坐标: {mapCenterText}</span>
            <span className={style.mapFooterItem}>鼠标坐标: {cursorText}</span>
            <span className={style.mapFooterItem}>监测站点: {MONITOR_STATIONS.length}</span>
          </div>
        </section>

        <aside className={style.sidebar}>
          <section className={`${style.sideCard} ${style.sideTabsCard}`}>
            <div className={style.sideTabs}>
              {SIDEBAR_TABS.map(item => (
                <button
                  key={item.key}
                  type="button"
                  className={`${style.sideTabButton} ${activePanel === item.key ? style.sideTabButtonActive : ''}`}
                  onClick={() => setActivePanel(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className={style.sideContent}>
              {activePanel === 'summary' && (
                <>
                  <section className={style.contentSection}>
                    <Title level={5} className={style.sideTitle}>
                      监测概览
                    </Title>
                    <div className={style.metricsGrid}>
                      <div className={style.metricCard}>
                        <Text className={style.metricLabel}>覆盖区域</Text>
                        <div className={style.metricValue}>{overview.districtCount}</div>
                        <Text className={style.metricSub}>广州各行政区风险概览</Text>
                      </div>
                      <div className={style.metricCard}>
                        <Text className={style.metricLabel}>告警区域</Text>
                        <div className={style.metricValue}>{overview.alertCount}</div>
                        <Text className={style.metricSub}>达到关注及以上等级</Text>
                      </div>
                      <div className={style.metricCard}>
                        <Text className={style.metricLabel}>高风险区域</Text>
                        <div className={style.metricValue}>{overview.highRiskCount}</div>
                        <Text className={style.metricSub}>较高或严重等级</Text>
                      </div>
                      <div className={style.metricCard}>
                        <Text className={style.metricLabel}>风险指数</Text>
                        <div className={style.metricValue}>{overview.totalRiskScore}</div>
                        <Text className={style.metricSub}>1-4 级权重统计</Text>
                      </div>
                    </div>
                  </section>

                  <section className={style.contentSection}>
                    <Title level={5} className={style.sideTitle}>
                      风险排行榜
                    </Title>
                    <div className={style.rankList}>
                      {ranking.map((item, index) => {
                        const tag = getRiskTag(item.riskLevel)
                        return (
                          <div key={item.district} className={style.rankItem}>
                            <div className={style.rankIndex}>{index + 1}</div>
                            <div className={style.rankBody}>
                              <div className={style.rankHead}>
                                <span>{item.district}</span>
                                <span className={style.rankTag} style={{ backgroundColor: tag.color }}>
                                  {tag.label}
                                </span>
                              </div>
                              <div className={style.rankBarTrack}>
                                <div
                                  className={style.rankBarValue}
                                  style={{ width: `${Math.min(item.riskScore * 5, 100)}%` }}
                                />
                              </div>
                            </div>
                            <div className={style.rankScore}>{item.riskScore}</div>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  <section className={style.contentSection}>
                    <Title level={5} className={style.sideTitle}>
                      当前研判
                    </Title>
                    <div className={style.analysisItem}>
                      <span>最高风险区域</span>
                      <strong>{overview.topDistrict?.district || '--'}</strong>
                    </div>
                    <div className={style.analysisItem}>
                      <span>最高风险等级</span>
                      <strong>{overview.topDistrict ? getRiskTag(overview.topDistrict.riskLevel).label : '--'}</strong>
                    </div>
                    <div className={style.analysisItem}>
                      <span>建议处置重点</span>
                      <strong>{overview.highRiskCount > 0 ? '加强高风险区巡检' : '保持常规监测'}</strong>
                    </div>
                  </section>
                </>
              )}

              {activePanel === 'district' &&
                (selectedMetrics ? (
                  <section className={style.contentSection}>
                    <Title level={5} className={style.sideTitle}>
                      区域详情
                    </Title>
                    <div className={style.detailCard}>
                      <div className={style.detailHead}>
                        <div>
                          <div className={style.detailName}>{selectedMetrics.district}</div>
                          <Text className={style.detailHint}>点击地图后同步更新分析内容</Text>
                        </div>
                        <span
                          className={style.detailTag}
                          style={{ backgroundColor: getRiskTag(selectedMetrics.riskLevel).color }}
                        >
                          {getRiskTag(selectedMetrics.riskLevel).label}
                        </span>
                      </div>

                      <div className={style.detailMetrics}>
                        {selectedMetrics.levelCounts.map((count, index) => (
                          <div key={index} className={style.detailMetricRow}>
                            <div className={style.detailMetricTop}>
                              <span>{index + 1}级风力点位</span>
                              <span>{count}</span>
                            </div>
                            <div className={style.detailBarTrack}>
                              <div
                                className={style.detailBarValue}
                                style={{
                                  width: `${selectedMetrics.total ? (count / selectedMetrics.total) * 100 : 0}%`,
                                  backgroundColor: LEVEL_COLORS[index + 1],
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className={style.adviceBox}>
                        <div className={style.adviceTitle}>预警建议</div>
                        <Text>{getRiskAdvice(selectedMetrics)}</Text>
                      </div>
                    </div>
                  </section>
                ) : (
                  <div className={style.emptyState}>
                    <Text>点击地图中的任一区域，可查看该区的风险等级、点位分布和预警建议。</Text>
                  </div>
                ))}

              {activePanel === 'buffer' && (
                <section className={style.contentSection}>
                  <Title level={5} className={style.sideTitle}>
                    缓冲区分析
                  </Title>
                  <div className={style.bufferControls}>
                    {[3000, 5000, 10000].map(radius => (
                      <button
                        key={radius}
                        type="button"
                        className={`${style.toolButton} ${bufferRadius === radius ? style.toolButtonActive : ''}`}
                        onClick={() => setBufferRadius(radius)}
                      >
                        {radius / 1000} km
                      </button>
                    ))}
                  </div>
                  <div className={style.analysisItem}>
                    <span>分析中心</span>
                    <strong>{selectedDistrict || '未选择区域'}</strong>
                  </div>
                  <div className={style.analysisItem}>
                    <span>缓冲半径</span>
                    <strong>{bufferRadius / 1000} km</strong>
                  </div>
                  <div className={style.analysisItem}>
                    <span>影响要素数</span>
                    <strong>{impactedPois.length}</strong>
                  </div>
                  <div className={style.poiList}>
                    {impactedPois.length > 0 ? (
                      impactedPois.map(item => (
                        <div key={item.id} className={style.poiItem}>
                          <span>{item.name}</span>
                          <span>{item.category}</span>
                        </div>
                      ))
                    ) : (
                      <div className={style.emptyState}>
                        <Text>选择行政区后，可识别缓冲区内学校、医院、地铁站和避难场所。</Text>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {activePanel === 'station' &&
                (selectedStation ? (
                  <section className={style.contentSection}>
                    <Title level={5} className={style.sideTitle}>
                      监测站详情
                    </Title>
                    <div className={style.detailCard}>
                      <div className={style.detailHead}>
                        <div>
                          <div className={style.detailName}>{selectedStation.name}</div>
                          <Text className={style.detailHint}>{selectedStation.district}实时观测数据</Text>
                        </div>
                      </div>
                      <div className={style.stationStats}>
                        <div className={style.stationStat}>
                          <span>温度</span>
                          <strong>{selectedStation.temperature.toFixed(1)}°C</strong>
                        </div>
                        <div className={style.stationStat}>
                          <span>湿度</span>
                          <strong>{selectedStation.humidity}%</strong>
                        </div>
                        <div className={style.stationStat}>
                          <span>风速</span>
                          <strong>{selectedStation.windSpeed.toFixed(1)} m/s</strong>
                        </div>
                      </div>
                      <div className={style.trendBlock}>
                        <div className={style.adviceTitle}>近 24 小时温度变化</div>
                        <div className={style.sparkline}>
                          {selectedStation.trend24h.map((value, index) => (
                            <span
                              key={index}
                              className={style.sparkBar}
                              style={{ height: `${Math.max((value - 20) * 4, 12)}px` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                ) : (
                  <div className={style.emptyState}>
                    <Text>点击地图中的监测站点，可查看实时温湿风数据和近 24 小时变化趋势。</Text>
                  </div>
                ))}

              {activePanel === 'query' && (
                <section className={style.contentSection}>
                  <Title level={5} className={style.sideTitle}>
                    空间分析结果
                  </Title>
                  <div className={style.adviceBox}>
                    <div className={style.adviceTitle}>当前工具</div>
                    <Text>
                      {activeMapTool === 'distance' && '测距分析'}
                      {activeMapTool === 'area' && '测面积分析'}
                      {activeMapTool === 'box' && '框选查询'}
                      {activeMapTool === 'none' && '浏览模式'}
                    </Text>
                    <div className={style.analysisResultText}>{measureResult}</div>
                  </div>

                  <div className={style.analysisItem}>
                    <span>查询要素数</span>
                    <strong>{queryResults.length}</strong>
                  </div>
                  <div className={style.poiList}>
                    {queryResults.length > 0 ? (
                      queryResults.map(item => (
                        <div key={item.id} className={style.poiItem}>
                          <span>{item.name}</span>
                          <span>{item.category}</span>
                        </div>
                      ))
                    ) : (
                      <div className={style.emptyState}>
                        <Text>使用测距、测面积或按住 Shift 键拖拽框选，可在这里查看空间分析结果。</Text>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default MapComponent
