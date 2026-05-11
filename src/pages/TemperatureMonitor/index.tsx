import { useEffect, useMemo, useRef, useState } from 'react'
import 'ol/ol.css'
import { Map as OLMap, Overlay, View } from 'ol'
import type { FeatureLike } from 'ol/Feature'
import Feature from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON'
import Geometry from 'ol/geom/Geometry'
import Point from 'ol/geom/Point'
import DragBox from 'ol/interaction/DragBox'
import HeatmapLayer from 'ol/layer/Heatmap'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import XYZ from 'ol/source/XYZ'
import { containsCoordinate } from 'ol/extent'
import { fromLonLat, toLonLat } from 'ol/proj'
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style'
import {
  AimOutlined,
  AreaChartOutlined,
  BorderOutlined,
  DashboardOutlined,
  DotChartOutlined,
  EnvironmentOutlined,
  FireOutlined,
  GatewayOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  RadarChartOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Button, Checkbox, Segmented, Slider, Tag, Tooltip, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getWeatherNow, type WeatherNowItem } from '@/services/wind'
import styles from './index.module.scss'

type TemperatureRecord = {
  district: string
  temperature: number
  weather?: string
  humidity?: string
  reporttime?: string
  source: 'api' | 'station'
}

type StationRecord = {
  id: string
  name: string
  district: string
  temperature: number
  rainfall: number
  windSpeed: number
  updateTime: string
  coordinates: number[]
}

type DisplayMode = 'overview' | 'heat' | 'station' | 'district'
type FilterKey = 'all' | 'hot' | 'comfortable' | 'cool'

type MapPointerEvent = {
  dragging?: boolean
  pixel: number[]
  coordinate: number[]
}

const districtMeta: Record<string, { name: string; centroid: [number, number]; terrain: string }> = {
  '440103': { name: '荔湾区', centroid: [113.22, 23.12], terrain: '老城高密建成区' },
  '440104': { name: '越秀区', centroid: [113.27, 23.13], terrain: '中心城区热岛核心' },
  '440105': { name: '海珠区', centroid: [113.32, 23.08], terrain: '珠江冲积平原' },
  '440106': { name: '天河区', centroid: [113.36, 23.13], terrain: '城市商务走廊' },
  '440111': { name: '白云区', centroid: [113.27, 23.22], terrain: '山前平原过渡带' },
  '440112': { name: '黄埔区', centroid: [113.48, 23.17], terrain: '东部产业走廊' },
  '440113': { name: '番禺区', centroid: [113.36, 22.94], terrain: '水网平原' },
  '440114': { name: '花都区', centroid: [113.21, 23.4], terrain: '北部丘陵平原' },
  '440115': { name: '南沙区', centroid: [113.54, 22.8], terrain: '滨海湿地与口门' },
  '440117': { name: '从化区', centroid: [113.59, 23.55], terrain: '北部山地生态屏障' },
  '440118': { name: '增城区', centroid: [113.81, 23.26], terrain: '东部丘陵台地' },
}

const stationDistrictByPrefix: Record<string, string> = {
  LW: '荔湾区',
  YX: '越秀区',
  HZ: '海珠区',
  TH: '天河区',
  BY: '白云区',
  HP: '黄埔区',
  PY: '番禺区',
  HD: '花都区',
  NS: '南沙区',
  CH: '从化区',
  ZC: '增城区',
}

const hourOptions = [8, 10, 12, 14, 16, 18].map(hour => ({
  label: `${String(hour).padStart(2, '0')}:00`,
  value: hour,
}))

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '高温', value: 'hot' },
  { label: '舒适', value: 'comfortable' },
  { label: '偏凉', value: 'cool' },
]

const displayModeOptions = [
  { label: '综合', value: 'overview' },
  { label: '热力', value: 'heat' },
  { label: '站点', value: 'station' },
  { label: '区划', value: 'district' },
]

const displayModeConfig: Record<DisplayMode, { surface: boolean; heat: boolean; station: boolean }> = {
  overview: { surface: true, heat: true, station: true },
  heat: { surface: false, heat: true, station: false },
  station: { surface: false, heat: false, station: true },
  district: { surface: true, heat: false, station: false },
}

const temperatureStops = [
  { min: -Infinity, max: 20, label: '< 20°C', color: '#2563eb', fill: 'rgba(37, 99, 235, 0.2)' },
  { min: 20, max: 24, label: '20-24°C', color: '#16b9d4', fill: 'rgba(22, 185, 212, 0.24)' },
  { min: 24, max: 28, label: '24-28°C', color: '#35b96f', fill: 'rgba(53, 185, 111, 0.28)' },
  { min: 28, max: 32, label: '28-32°C', color: '#f2c94c', fill: 'rgba(242, 201, 76, 0.34)' },
  { min: 32, max: 35, label: '32-35°C', color: '#f08a32', fill: 'rgba(240, 138, 50, 0.42)' },
  { min: 35, max: Infinity, label: '>= 35°C', color: '#e84b3c', fill: 'rgba(232, 75, 60, 0.52)' },
]

const normalizeName = (name?: string) => String(name || '').replace(/\s|市|区/g, '')
const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`

const toNumber = (value: unknown, fallback = 0) => {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : fallback
}

const getLevel = (temperature: number) =>
  temperatureStops.find(item => temperature >= item.min && temperature < item.max) ??
  temperatureStops[2]

const getComfortLabel = (temperature: number) => {
  if (temperature >= 35) return { label: '高温预警', color: 'red' as const }
  if (temperature >= 32) return { label: '炎热', color: 'orange' as const }
  if (temperature >= 28) return { label: '偏热', color: 'gold' as const }
  if (temperature >= 20) return { label: '舒适', color: 'green' as const }
  return { label: '偏凉', color: 'blue' as const }
}

const getTemperatureRisk = (maxTemperature: number, hotCount = 0) => {
  if (maxTemperature >= 37 || hotCount >= 8) return '高风险'
  if (maxTemperature >= 35 || hotCount >= 3) return '中风险'
  return '低风险'
}

const resolveDistrictName = (feature: FeatureLike) => {
  const id = String(feature.get('id') || '')
  return districtMeta[id]?.name || String(feature.get('name') || '未知区县')
}

const resolveStationDistrict = (feature: FeatureLike) => {
  const id = String(feature.get('id') || '')
  const prefix = id.split('-')[1]
  return stationDistrictByPrefix[prefix] || String(feature.get('district') || '未知区县')
}

const resolveStationName = (feature: FeatureLike) => {
  const district = resolveStationDistrict(feature).replace('区', '')
  const id = String(feature.get('id') || '')
  return `${district || '自动'}监测站 ${id.slice(-2)}`
}

const matchFilter = (station: StationRecord, filter: FilterKey, hotThreshold: number) => {
  if (filter === 'hot') return station.temperature >= hotThreshold
  if (filter === 'comfortable') return station.temperature >= 20 && station.temperature < 28
  if (filter === 'cool') return station.temperature < 20
  return true
}

const buildStationRecords = (features: FeatureLike[]): StationRecord[] =>
  features
    .map(feature => {
      const geometry = feature.getGeometry()
      if (!(geometry instanceof Point)) return null

      return {
        id: String(feature.get('id') || crypto.randomUUID()),
        name: resolveStationName(feature),
        district: resolveStationDistrict(feature),
        temperature: toNumber(feature.get('temperature')),
        rainfall: toNumber(feature.get('rainfall')),
        windSpeed: toNumber(feature.get('wind_speed')),
        updateTime: String(feature.get('update_time') || ''),
        coordinates: geometry.getCoordinates(),
      }
    })
    .filter((item): item is StationRecord => Boolean(item))

const aggregateStations = (stations: StationRecord[]) => {
  const grouped = new globalThis.Map<string, StationRecord[]>()
  stations.forEach(station => {
    const key = normalizeName(station.district)
    grouped.set(key, [...(grouped.get(key) || []), station])
  })

  return new globalThis.Map<string, TemperatureRecord>(
    [...grouped.entries()].map(([district, items]) => [
      district,
      {
        district: items[0].district,
        temperature: Number(
          (items.reduce((sum, item) => sum + item.temperature, 0) / items.length).toFixed(1),
        ),
        reporttime: items[0].updateTime,
        source: 'station' as const,
      },
    ]),
  )
}

const TemperatureMonitor = () => {
  const navigate = useNavigate()
  const mapRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<OLMap | null>(null)
  const districtLayerRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null)
  const stationLayerRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null)
  const boxLayerRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null)
  const heatLayerRef = useRef<HeatmapLayer | null>(null)
  const stationSourceRef = useRef(new VectorSource<Feature<Geometry>>())
  const heatSourceRef = useRef(new VectorSource<Feature<Geometry>>())
  const boxSourceRef = useRef(new VectorSource<Feature<Geometry>>())
  const temperatureDataRef = useRef(new globalThis.Map<string, TemperatureRecord>())
  const stationsRef = useRef<StationRecord[]>([])
  const filterRef = useRef<FilterKey>('all')
  const hotThresholdRef = useRef(35)
  const boxQueryActiveRef = useRef(false)
  const displayModeRef = useRef<DisplayMode>('overview')
  const boundaryVisibleRef = useRef(true)

  const [hour, setHour] = useState(10)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [boxQueryActive, setBoxQueryActive] = useState(false)
  const [boxQueryStations, setBoxQueryStations] = useState<StationRecord[]>([])
  const [displayMode, setDisplayMode] = useState<DisplayMode>('overview')
  const [boundaryVisible, setBoundaryVisible] = useState(true)
  const [temperatureFilter, setTemperatureFilter] = useState<FilterKey>('all')
  const [hotThreshold, setHotThreshold] = useState(35)
  const [stations, setStations] = useState<StationRecord[]>([])
  const [temperatureData, setTemperatureData] = useState<TemperatureRecord[]>([])
  const [activeRecord, setActiveRecord] = useState<StationRecord | TemperatureRecord | null>(null)
  const filteredStations = useMemo(
    () => stations.filter(station => matchFilter(station, temperatureFilter, hotThreshold)),
    [hotThreshold, stations, temperatureFilter],
  )

  const summary = useMemo(() => {
    const values = (temperatureData.length ? temperatureData : stations)
      .map(item => item.temperature)
      .filter(Number.isFinite)

    if (!values.length) return null

    const max = Math.max(...values)
    const min = Math.min(...values)
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length
    return {
      avg: Number(avg.toFixed(1)),
      max: Number(max.toFixed(1)),
      min: Number(min.toFixed(1)),
      range: Number((max - min).toFixed(1)),
      highCount: values.filter(value => value >= hotThreshold).length,
    }
  }, [hotThreshold, stations, temperatureData])

  const topStations = useMemo(
    () => [...filteredStations].sort((a, b) => b.temperature - a.temperature).slice(0, 8),
    [filteredStations],
  )

  const trendStations = useMemo(() => {
    const districts = ['从化区', '白云区', '越秀区', '海珠区', '南沙区']
    return districts
      .map(name => stations.find(station => station.district === name))
      .filter((item): item is StationRecord => Boolean(item))
  }, [stations])

  const districtRanks = useMemo(
    () => [...temperatureData].sort((a, b) => b.temperature - a.temperature).slice(0, 5),
    [temperatureData],
  )

  const boxQuerySummary = useMemo(() => {
    if (!boxQueryStations.length) return null

    const values = boxQueryStations.map(station => station.temperature)
    const max = Math.max(...values)
    const min = Math.min(...values)
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length
    return {
      count: boxQueryStations.length,
      avg: Number(avg.toFixed(1)),
      max: Number(max.toFixed(1)),
      min: Number(min.toFixed(1)),
      hotCount: values.filter(value => value >= hotThreshold).length,
    }
  }, [boxQueryStations, hotThreshold])

  useEffect(() => {
    stationsRef.current = stations
  }, [stations])

  useEffect(() => {
    boxSourceRef.current.clear()
    setBoxQueryStations([])
  }, [hour])

  useEffect(() => {
    filterRef.current = temperatureFilter
    hotThresholdRef.current = hotThreshold
    stationLayerRef.current?.changed()
  }, [hotThreshold, temperatureFilter])

  useEffect(() => {
    boxQueryActiveRef.current = boxQueryActive
  }, [boxQueryActive])

  useEffect(() => {
    if (!playing) return undefined

    const timer = window.setInterval(() => {
      setHour(current => {
        const index = hourOptions.findIndex(item => item.value === current)
        return hourOptions[(index + 1) % hourOptions.length].value
      })
    }, 1800)

    return () => window.clearInterval(timer)
  }, [playing])

  useEffect(() => {
    const baseLayer = new TileLayer({
      className: 'temperature-base-layer',
      source: new XYZ({
        url: 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        crossOrigin: 'anonymous',
        attributions: 'OpenStreetMap contributors, CARTO',
        maxZoom: 20,
      }),
      opacity: 0.92,
      zIndex: -2,
    })

    const heatLayer = new HeatmapLayer({
      className: 'temperature-heat-layer',
      source: heatSourceRef.current,
      blur: 36,
      radius: 28,
      gradient: ['#2563eb', '#16b9d4', '#35b96f', '#f2c94c', '#f08a32', '#e84b3c'],
      weight: feature => Math.min(1, Math.max(0.08, (toNumber(feature.get('temperature')) - 18) / 22)),
      opacity: 0.72,
      visible: displayModeConfig.overview.heat,
      zIndex: 1,
    })

    const districtLayer = new VectorLayer({
      source: new VectorSource<Feature<Geometry>>({
        url: '/guang_zhou.geojson',
        format: new GeoJSON(),
      }),
      style: feature => {
        const districtName = resolveDistrictName(feature)
        const record = temperatureDataRef.current.get(normalizeName(districtName))
        const level = record ? getLevel(record.temperature) : null
        const showSurface = displayModeRef.current === 'overview' || displayModeRef.current === 'district'

        return new Style({
          fill: new Fill({
            color: showSurface ? level?.fill || 'rgba(226, 232, 240, 0.16)' : 'rgba(255,255,255,0.02)',
          }),
          stroke: new Stroke({
            color: boundaryVisibleRef.current ? 'rgba(30, 64, 175, 0.72)' : 'rgba(255,255,255,0)',
            width: boundaryVisibleRef.current ? 1.3 : 0,
          }),
          text: showSurface
            ? new Text({
                text: record ? `${districtName}\n${record.temperature.toFixed(1)}°C` : districtName,
                font: '700 12px "Microsoft YaHei", sans-serif',
                fill: new Fill({ color: '#132238' }),
                stroke: new Stroke({ color: 'rgba(255,255,255,0.96)', width: 4 }),
                overflow: false,
              })
            : undefined,
        })
      },
      visible: true,
      zIndex: 4,
    })

    const stationLayer = new VectorLayer({
      source: stationSourceRef.current,
      style: feature => {
        const stationId = String(feature.get('id') || '')
        const station = stationsRef.current.find(item => item.id === stationId)
        if (station && !matchFilter(station, filterRef.current, hotThresholdRef.current)) return undefined

        const temperature = toNumber(feature.get('temperature'))
        const level = getLevel(temperature)
        const radius = Math.min(15, Math.max(7, temperature / 3.2))

        return [
          new Style({
            image: new CircleStyle({
              radius: radius + 12,
              fill: new Fill({ color: level.fill }),
              stroke: new Stroke({ color: 'rgba(255,255,255,0.4)', width: 1 }),
            }),
          }),
          new Style({
            image: new CircleStyle({
              radius,
              fill: new Fill({ color: level.color }),
              stroke: new Stroke({ color: '#fff', width: 2.5 }),
            }),
            text: new Text({
              text: `${temperature.toFixed(0)}°`,
              font: '700 11px "Microsoft YaHei", sans-serif',
              fill: new Fill({ color: '#0f172a' }),
              stroke: new Stroke({ color: 'rgba(255,255,255,0.9)', width: 3 }),
              offsetY: -24,
            }),
          }),
        ]
      },
      visible: displayModeConfig.overview.station,
      zIndex: 8,
    })

    const boxLayer = new VectorLayer({
      source: boxSourceRef.current,
      style: feature => {
        const temperature = toNumber(feature.get('temperature'))
        const level = getLevel(temperature)

        return new Style({
          image: new CircleStyle({
            radius: 15,
            fill: new Fill({ color: 'rgba(255,255,255,0.22)' }),
            stroke: new Stroke({ color: level.color, width: 4 }),
          }),
          text: new Text({
            text: `${temperature.toFixed(0)}掳`,
            font: '800 11px "Microsoft YaHei", sans-serif',
            fill: new Fill({ color: '#0f172a' }),
            stroke: new Stroke({ color: 'rgba(255,255,255,0.96)', width: 3 }),
            offsetY: -24,
          }),
        })
      },
      zIndex: 18,
    })

    const map = new OLMap({
      target: mapRef.current || undefined,
      layers: [baseLayer, heatLayer, districtLayer, stationLayer, boxLayer],
      view: new View({
        center: fromLonLat([113.34, 23.18]),
        zoom: 9.2,
      }),
    })

    const dragBox = new DragBox({
      condition: () => boxQueryActiveRef.current,
      className: styles.dragBox,
    })

    const tooltipOverlay = new Overlay({
      element: tooltipRef.current || undefined,
      offset: [14, -12],
      positioning: 'bottom-left',
    })

    map.addOverlay(tooltipOverlay)
    map.addInteraction(dragBox)
    mapInstance.current = map
    districtLayerRef.current = districtLayer
    stationLayerRef.current = stationLayer
    boxLayerRef.current = boxLayer
    heatLayerRef.current = heatLayer

    const showTooltip = (html: string, coordinate: number[]) => {
      if (!tooltipRef.current) return
      tooltipRef.current.innerHTML = html
      tooltipRef.current.style.display = 'block'
      tooltipOverlay.setPosition(coordinate)
      map.getTargetElement().style.setProperty('cursor', 'pointer')
    }

    const hideTooltip = () => {
      if (!tooltipRef.current) return
      tooltipRef.current.style.display = 'none'
      tooltipOverlay.setPosition(undefined)
      map.getTargetElement().style.removeProperty('cursor')
    }

    const readStationFeature = (feature: FeatureLike): StationRecord | null => {
      const geometry = feature.getGeometry()
      if (!(geometry instanceof Point) || feature.get('temperature') === undefined) return null

      return {
        id: String(feature.get('id') || ''),
        name: resolveStationName(feature),
        district: resolveStationDistrict(feature),
        temperature: toNumber(feature.get('temperature')),
        rainfall: toNumber(feature.get('rainfall')),
        windSpeed: toNumber(feature.get('wind_speed')),
        updateTime: String(feature.get('update_time') || ''),
        coordinates: geometry.getCoordinates(),
      }
    }

    const handlePointerMove = (evt: MapPointerEvent) => {
      if (evt.dragging) return

      const feature = map.forEachFeatureAtPixel(evt.pixel, item => item, { hitTolerance: 8 })
      if (!feature) {
        hideTooltip()
        return
      }

      const station = readStationFeature(feature)
      if (station) {
        showTooltip(
          `
            <div class="temperature-tooltip-title">${station.name}</div>
            <div>行政区：${station.district}</div>
            <div>实测温度：${station.temperature.toFixed(1)}°C</div>
            <div>风速：${station.windSpeed.toFixed(1)} m/s</div>
            <div>更新时间：${station.updateTime || formatHour(hour)}</div>
          `,
          evt.coordinate,
        )
        return
      }

      const districtName = resolveDistrictName(feature)
      const record = temperatureDataRef.current.get(normalizeName(districtName))
      if (!record) {
        hideTooltip()
        return
      }

      showTooltip(
        `
          <div class="temperature-tooltip-title">${record.district}</div>
          <div>区划均温：${record.temperature.toFixed(1)}°C</div>
          <div>天气：${record.weather || '-'}</div>
          <div>相对湿度：${record.humidity || '-'}%</div>
          <div>数据源：${record.source === 'api' ? '实时天气接口' : '站点空间聚合'}</div>
        `,
        evt.coordinate,
      )
    }

    const handleMapClick = (evt: MapPointerEvent) => {
      if (boxQueryActiveRef.current) return

      const feature = map.forEachFeatureAtPixel(evt.pixel, item => item, { hitTolerance: 8 })
      if (!feature) return

      const station = readStationFeature(feature)
      if (station) {
        setActiveRecord(station)
        return
      }

      const districtName = resolveDistrictName(feature)
      const record = temperatureDataRef.current.get(normalizeName(districtName))
      if (record) setActiveRecord(record)
    }

    const handleBoxEnd = () => {
      const extent = dragBox.getGeometry().getExtent()
      const matched = stationsRef.current.filter(station =>
        containsCoordinate(extent, station.coordinates),
      )

      boxSourceRef.current.clear()
      const matchedIds = new Set(matched.map(station => station.id))
      const selectedFeatures = stationSourceRef.current
        .getFeatures()
        .filter(feature => matchedIds.has(String(feature.get('id') || '')))
        .map(feature => feature.clone())
      boxSourceRef.current.addFeatures(selectedFeatures)
      setBoxQueryStations([...matched].sort((a, b) => b.temperature - a.temperature))
      setPanelOpen(true)

      if (matched.length) {
        message.success(`框选命中 ${matched.length} 个温度站点`)
      } else {
        message.info('框选范围内暂无温度站点')
      }
    }

    map.on('pointermove', handlePointerMove)
    map.on('singleclick', handleMapClick)
    dragBox.on('boxend', handleBoxEnd)

    return () => {
      map.un('pointermove', handlePointerMove)
      map.un('singleclick', handleMapClick)
      dragBox.un('boxend', handleBoxEnd)
      map.removeInteraction(dragBox)
      map.setTarget(undefined)
      mapInstance.current = null
    }
  }, [])

  useEffect(() => {
    const loadStationData = async () => {
      const format = new GeoJSON()
      const readFeatures = async (url: string) => {
        const response = await fetch(url)
        if (!response.ok) throw new Error(url)
        return format.readFeatures(await response.json(), {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        }) as Feature<Geometry>[]
      }

      try {
        const features = await readFeatures(`/data/history/station_${hour}.json`)
        stationSourceRef.current.clear()
        heatSourceRef.current.clear()
        stationSourceRef.current.addFeatures(features)
        heatSourceRef.current.addFeatures(features.map(feature => feature.clone()))
        setStations(buildStationRecords(features))
      } catch {
        message.warning('当前时段站点数据不可用，已切换到基础站点图层')
        const features = await readFeatures('/station.geojson')
        stationSourceRef.current.clear()
        heatSourceRef.current.clear()
        stationSourceRef.current.addFeatures(features)
        heatSourceRef.current.addFeatures(features.map(feature => feature.clone()))
        setStations(buildStationRecords(features))
      }
    }

    void loadStationData()
  }, [hour])

  useEffect(() => {
    const loadDistrictTemperatures = async () => {
      const stationFallback = aggregateStations(stations)
      setLoading(true)

      try {
        const districts = Object.values(districtMeta).map(item => item.name)
        const results = await Promise.allSettled(
          districts.map(async district => {
            const response = await getWeatherNow(district, 'base', 'JSON')
            const live = response?.data?.lives?.[0] as WeatherNowItem | undefined
            if (!live?.temperature) return stationFallback.get(normalizeName(district))

            return {
              district,
              temperature: toNumber(live.temperature_float ?? live.temperature),
              weather: live.weather,
              humidity: live.humidity,
              reporttime: live.reporttime,
              source: 'api' as const,
            }
          }),
        )

        const records = districts
          .map((district, index) => {
            const result = results[index]
            return result.status === 'fulfilled'
              ? result.value || stationFallback.get(normalizeName(district))
              : stationFallback.get(normalizeName(district))
          })
          .filter((item): item is TemperatureRecord => Boolean(item))

        temperatureDataRef.current = new globalThis.Map(
          records.map(record => [normalizeName(record.district), record]),
        )
        setTemperatureData(records)
        districtLayerRef.current?.changed()
      } catch (error) {
        console.error('temperature data load failed:', error)
        const records = [...stationFallback.values()]
        temperatureDataRef.current = new globalThis.Map(
          records.map(record => [normalizeName(record.district), record]),
        )
        setTemperatureData(records)
        districtLayerRef.current?.changed()
      } finally {
        setLoading(false)
      }
    }

    if (stations.length) void loadDistrictTemperatures()
  }, [stations])

  useEffect(() => {
    const modeConfig = displayModeConfig[displayMode]
    displayModeRef.current = displayMode
    boundaryVisibleRef.current = boundaryVisible
    districtLayerRef.current?.setVisible(modeConfig.surface || boundaryVisible)
    districtLayerRef.current?.changed()
    stationLayerRef.current?.setVisible(modeConfig.station)
    heatLayerRef.current?.setVisible(modeConfig.heat)
  }, [boundaryVisible, displayMode])

  const focusStation = (station: StationRecord) => {
    mapInstance.current?.getView().animate({
      center: station.coordinates,
      zoom: 13,
      duration: 560,
    })
    setActiveRecord(station)
  }

  const focusDistrict = (record: TemperatureRecord) => {
    const district = Object.values(districtMeta).find(item => item.name === record.district)
    if (!district) return

    mapInstance.current?.getView().animate({
      center: fromLonLat(district.centroid),
      zoom: 11.1,
      duration: 560,
    })
    setActiveRecord(record)
  }

  const resetView = () => {
    mapInstance.current?.getView().animate({
      center: fromLonLat([113.34, 23.18]),
      zoom: 9.2,
      duration: 560,
    })
  }

  const refreshData = () => {
    setHour(current => current)
    districtLayerRef.current?.changed()
    stationLayerRef.current?.changed()
    message.success('温度图层已刷新')
  }

  const toggleBoxQuery = () => {
    setBoxQueryActive(value => {
      const nextValue = !value
      message.info(nextValue ? '已开启框选查询，拖拽地图绘制查询范围' : '已关闭框选查询')
      return nextValue
    })
  }

  const clearBoxQuery = () => {
    boxSourceRef.current.clear()
    setBoxQueryStations([])
  }

  const publishTemperatureWarning = () => {
    const targetStations = boxQueryStations.length
      ? boxQueryStations
      : activeRecord && 'name' in activeRecord
        ? [activeRecord]
        : topStations

    const values = targetStations.length
      ? targetStations.map(station => station.temperature)
      : temperatureData.map(record => record.temperature)

    if (!values.length) {
      message.warning('暂无可联动的温度监测数据')
      return
    }

    const max = Math.max(...values)
    const min = Math.min(...values)
    const avg = Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
    const hotCount = targetStations.filter(station => station.temperature >= hotThreshold).length
    const risk = getTemperatureRisk(max, hotCount)
    const highStation = targetStations[0] || topStations[0]
    const center =
      boxQueryStations.length && targetStations.length
        ? targetStations
            .reduce(
              (sum, station) => {
                const [lng, lat] = toLonLat(station.coordinates)
                return [sum[0] + lng, sum[1] + lat] as [number, number]
              },
              [0, 0] as [number, number],
            )
            .map(value => Number((value / targetStations.length).toFixed(6)))
        : activeRecord && 'coordinates' in activeRecord
          ? toLonLat(activeRecord.coordinates).map(value => Number(value.toFixed(6)))
          : activeRecord
            ? Object.values(districtMeta).find(item => item.name === activeRecord.district)?.centroid
            : highStation
              ? toLonLat(highStation.coordinates).map(value => Number(value.toFixed(6)))
              : [113.34, 23.18]

    const locationText = boxQueryStations.length
      ? `框选范围（${targetStations.length}个温度站点）`
      : activeRecord
        ? 'name' in activeRecord
          ? `${activeRecord.district} ${activeRecord.name}`
          : activeRecord.district
        : `全市高温站点（${targetStations.length || temperatureData.length}个监测单元）`

    navigate('/monitor/warning', {
      state: {
        source: 'temperature',
        center,
        radius: boxQueryStations.length ? 3 : 5,
        analysis: {
          source: '温度监测',
          location: locationText,
          count: targetStations.length || temperatureData.length,
          avg,
          max,
          min,
          hotCount,
          threshold: hotThreshold,
          risk,
          stations: targetStations.slice(0, 8).map(station => ({
            id: station.id,
            name: station.name,
            district: station.district,
            temperature: station.temperature,
            windSpeed: station.windSpeed,
            updateTime: station.updateTime,
          })),
        },
        pois: [],
      },
    })
    message.success('已带入温度监测结果，正在生成高温预警')
  }

  const activeMeta =
    activeRecord && 'name' in activeRecord
      ? {
          title: activeRecord.name,
          subtitle: `${activeRecord.district} / ${toLonLat(activeRecord.coordinates)
            .map(value => value.toFixed(3))
            .join(', ')}`,
          value: activeRecord.temperature,
          tag: getComfortLabel(activeRecord.temperature),
          details: [
            ['风速', `${activeRecord.windSpeed.toFixed(1)} m/s`],
            ['降雨', `${activeRecord.rainfall.toFixed(1)} mm`],
            ['时间', activeRecord.updateTime || formatHour(hour)],
          ],
        }
      : activeRecord
        ? {
            title: activeRecord.district,
            subtitle:
              Object.values(districtMeta).find(item => item.name === activeRecord.district)?.terrain ||
              '区划温度单元',
            value: activeRecord.temperature,
            tag: getComfortLabel(activeRecord.temperature),
            details: [
              ['天气', activeRecord.weather || '-'],
              ['湿度', `${activeRecord.humidity || '-'}%`],
              ['来源', activeRecord.source === 'api' ? '实时接口' : '站点聚合'],
            ],
          }
        : null

  return (
    <div className={styles.mapContainer}>
      <div ref={mapRef} className={styles.mapCanvas} style={{ width: panelOpen ? undefined : '100%' }} />

      <div className={styles.layerSwitch}>
        <span className={styles.layerTitle}>
          <BorderOutlined />
          图层模式
        </span>
        <Segmented
          value={displayMode}
          options={displayModeOptions}
          onChange={value => setDisplayMode(value as DisplayMode)}
        />
        <Checkbox checked={boundaryVisible} onChange={event => setBoundaryVisible(event.target.checked)}>
          行政边界
        </Checkbox>
        <Button size="small" onClick={() => setPanelOpen(value => !value)}>
          {panelOpen ? '收起面板' : '展开面板'}
        </Button>
        <Button
          size="small"
          type={boxQueryActive ? 'primary' : 'default'}
          icon={<GatewayOutlined />}
          onClick={toggleBoxQuery}
        >
          框选查询
        </Button>
      </div>

      {panelOpen && (
        <aside className={styles.monitorPanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>温度监测</h2>
              <span>
                {filteredStations.length} 个站点参与显示，当前时刻 {formatHour(hour)}
              </span>
            </div>
            <Tag color={(summary?.highCount ?? 0) > 0 ? 'red' : 'green'}>
              {loading ? '更新中' : (summary?.highCount ?? 0) > 0 ? '高温关注' : '温度平稳'}
            </Tag>
          </div>

          <div className={styles.metricGrid}>
            <div>
              <span>平均温度</span>
              <strong>{summary?.avg ?? '--'}°C</strong>
            </div>
            <div>
              <span>最高温度</span>
              <strong>{summary?.max ?? '--'}°C</strong>
            </div>
            <div>
              <span>最低温度</span>
              <strong>{summary?.min ?? '--'}°C</strong>
            </div>
            <div>
              <span>高温站点</span>
              <strong>{summary?.highCount ?? '--'} 个</strong>
            </div>
          </div>

          <div className={styles.timelineControl}>
            <div className={styles.controlTitle}>
              <span>监测时刻</span>
              <strong>{formatHour(hour)}</strong>
            </div>
            <div className={styles.timelineActions}>
              <Button
                icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => setPlaying(value => !value)}
              />
              <Segmented block value={hour} options={hourOptions} onChange={value => setHour(Number(value))} />
              <Tooltip title="刷新当前图层">
                <Button icon={<ReloadOutlined />} onClick={refreshData} />
              </Tooltip>
            </div>
          </div>

          <div className={styles.filterBlock}>
            <div className={styles.controlTitle}>
              <span>站点筛选</span>
              <strong>{filteredStations.length}/{stations.length} 个</strong>
            </div>
            <Segmented
              block
              value={temperatureFilter}
              options={filterOptions}
              onChange={value => setTemperatureFilter(value as FilterKey)}
            />
            <div className={styles.thresholdControl}>
              <span>高温阈值 {hotThreshold}°C</span>
              <Slider min={30} max={40} value={hotThreshold} onChange={setHotThreshold} />
            </div>
          </div>

          <div className={styles.boxQueryBlock}>
            <div className={styles.controlTitle}>
              <span>框选查询</span>
              <strong>{boxQueryActive ? '拖拽框选中' : `${boxQueryStations.length} 个站点`}</strong>
            </div>
            <div className={styles.boxActionRow}>
              <Button
                block
                type={boxQueryActive ? 'primary' : 'default'}
                icon={<GatewayOutlined />}
                onClick={toggleBoxQuery}
              >
                {boxQueryActive ? '关闭框选' : '开启框选'}
              </Button>
              <Button block disabled={!boxQueryStations.length} onClick={clearBoxQuery}>
                清除结果
              </Button>
            </div>
            <Button
              block
              danger
              disabled={!summary && !boxQueryStations.length && !activeRecord}
              onClick={publishTemperatureWarning}
            >
              发布高温预警
            </Button>
            <div className={styles.boxHint}>
              开启后在地图上按住鼠标拖拽矩形范围，松开即可统计范围内温度站点。
            </div>
            {boxQuerySummary && (
              <>
                <div className={styles.queryMetricGrid}>
                  <div>
                    <span>命中站点</span>
                    <strong>{boxQuerySummary.count}</strong>
                  </div>
                  <div>
                    <span>平均温度</span>
                    <strong>{boxQuerySummary.avg}°C</strong>
                  </div>
                  <div>
                    <span>最高温度</span>
                    <strong>{boxQuerySummary.max}°C</strong>
                  </div>
                  <div>
                    <span>高温站点</span>
                    <strong>{boxQuerySummary.hotCount}</strong>
                  </div>
                </div>
                <div className={styles.queryList}>
                  {boxQueryStations.slice(0, 6).map(station => (
                    <button key={station.id} type="button" onClick={() => focusStation(station)}>
                      <span>{station.name}</span>
                      <b>{station.temperature.toFixed(1)}°C</b>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className={styles.activeReadout}>
            <div>
              <span>{activeMeta?.title || '点击地图查看站点或区划温度'}</span>
              <small>{activeMeta?.subtitle || '支持热力、分级设色、阈值筛选与站点定位'}</small>
            </div>
            <strong>{activeMeta ? `${activeMeta.value.toFixed(1)}°C` : formatHour(hour)}</strong>
          </div>

          {activeMeta && (
            <div className={styles.detailCard}>
              <div className={styles.detailHead}>
                <Tag color={activeMeta.tag.color}>{activeMeta.tag.label}</Tag>
                <span>{activeMeta.title}</span>
              </div>
              <div className={styles.detailGrid}>
                {activeMeta.details.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <b>{value}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.panelSectionTitle}>
            <DashboardOutlined />
            区划均温排行
          </div>
          <div className={styles.districtList}>
            {districtRanks.map(record => {
              const level = getLevel(record.temperature)
              return (
                <button key={record.district} type="button" onClick={() => focusDistrict(record)}>
                  <span>{record.district}</span>
                  <i style={{ background: level.color }} />
                  <b>{record.temperature.toFixed(1)}°C</b>
                </button>
              )
            })}
          </div>

          <div className={styles.panelSectionTitle}>
            <FireOutlined />
            高温站点 TOP6
          </div>
          <div className={styles.stationList}>
            {topStations.slice(0, 6).map(station => {
              const level = getLevel(station.temperature)
              const width = `${Math.min(100, Math.max(30, ((station.temperature - 18) / 20) * 100))}%`

              return (
                <button
                  key={station.id}
                  className={styles.stationItem}
                  onClick={() => focusStation(station)}
                  type="button"
                >
                  <span className={styles.stationMeta}>
                    <b>{station.name}</b>
                    <em>{station.temperature.toFixed(1)}°C</em>
                  </span>
                  <span className={styles.stationTrack}>
                    <i style={{ width, background: level.color }} />
                  </span>
                  <small>{station.district} / 风速 {station.windSpeed.toFixed(1)} m/s</small>
                </button>
              )
            })}
          </div>

          <div className={styles.panelSectionTitle}>
            <AreaChartOutlined />
            北山地-中心城-滨海剖面
          </div>
          <div className={styles.transectChart}>
            {trendStations.map(station => {
              const height = Math.min(96, Math.max(24, (station.temperature - 18) * 9))
              return (
                <button key={station.id} type="button" onClick={() => focusStation(station)}>
                  <i style={{ height }} />
                  <b>{station.temperature.toFixed(1)}</b>
                  <span>{station.district.replace('区', '')}</span>
                </button>
              )
            })}
          </div>
        </aside>
      )}

      <Tooltip title="回到广州市全域视图">
        <Button className={styles.resetButton} icon={<AimOutlined />} onClick={resetView} />
      </Tooltip>

      <div className={styles.legend}>
        <div className={styles.legendTitle}>
          <RadarChartOutlined />
          温度等级
        </div>
        <div className={styles.thermometerScale}>
          <span>高</span>
          <i />
          <span>低</span>
        </div>
        <div className={styles.legendContent}>
          {[...temperatureStops].reverse().map(item => (
            <div className={styles.legendItem} key={item.label}>
              <span style={{ background: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.mapBadge}>
        <DotChartOutlined />
        站点插值与区划聚合表达
      </div>

      <div className={styles.scaleBar}>
        <EnvironmentOutlined />
        WGS84 / Web Mercator
      </div>

      <div ref={tooltipRef} className={styles.tooltip} />
    </div>
  )
}

export default TemperatureMonitor
