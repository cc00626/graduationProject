import { useEffect, useMemo, useRef, useState } from 'react'
import 'ol/ol.css'
import { Feature, Map, Overlay, View } from 'ol'
import type { FeatureLike } from 'ol/Feature'
import { Point, Polygon } from 'ol/geom'
import type BaseLayer from 'ol/layer/Base'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import XYZ from 'ol/source/XYZ'
import GeoJSON from 'ol/format/GeoJSON'
import { fromLonLat, toLonLat } from 'ol/proj'
import { Fill, Stroke, Style, Circle } from 'ol/style'
import * as turf from '@turf/turf'
import { getAnalysisBufferStyle, getAnalysisPointStyle } from '@/utils/map/analysisStyles'
import style from './index.module.scss'
import {
  getBufferAnalysis,
  getRainMonitor,
  getStationDetail,
  type BufferPoiItem,
  type RainMonitorData,
  type RainPeriod,
  type RainStationDetailPayload,
} from '@/services/rain'
import { useNavigate } from 'react-router-dom'
import { Button, Checkbox, Segmented, Table, Tag, message } from 'antd'
import RainfallOnlyChart from './RainfallChart'
import { getPublishedWarningsByTypes, type WarningRecord } from '@/services/warning'
import { createWarningFeatures, getWarningPopupHtml } from '@/utils/map/warningLayer'
import { canManageWarnings, getUserPreferences } from '@/utils/auth'
const periodOptions = [
  { label: '1小时', value: '1h' },
  { label: '3小时', value: '3h' },
  { label: '6小时', value: '6h' },
  { label: '12小时', value: '12h' },
  { label: '24小时', value: '24h' },
]

const warningColorMap = {
  normal: 'default',
  watch: 'gold',
  warning: 'orange',
  danger: 'red',
} as const

const columns = [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '距离 (m)',
    dataIndex: 'distance',
    key: 'distance',
    sorter: (a: BufferPoiItem, b: BufferPoiItem) => Number(a.distance) - Number(b.distance),
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    render: (text: string) => text || '-',
  },
]

const formatLocation = (location: string) => location.split(',').map(Number)

const shouldShowWarning = (record: WarningRecord, level: 'all' | 'medium' | 'high') => {
  if (level === 'all') return true
  if (level === 'medium') return record.level === 'medium' || record.level === 'high'
  return record.level === 'high'
}

type MapPointerEvent = {
  dragging?: boolean
  pixel: number[]
  coordinate: number[]
}

const RainMonitor = () => {
  const userPreferences = useMemo(() => getUserPreferences(), [])
  const canEditWarnings = canManageWarnings()
  const boundaryLabel = '\u884c\u653f\u8fb9\u754c'
  const rainLayerLabel = '\u964d\u96e8\u56fe\u5c42'
  const legendTitle = '\u964d\u6c34\u91cf\u9884\u62a5(mm)'

  const mapRef = useRef(null)
  const mapInstance = useRef<Map | null>(null)
  const [currentTime] = useState('10:00')
  const [rainPeriod, setRainPeriod] = useState<RainPeriod>('1h')
  const [monitorData, setMonitorData] = useState<RainMonitorData | null>(null)
  const [bufferRadius, setBufferRadius] = useState(0.5)
  const [lastRightClickCoord, setLastRightClickCoord] = useState<{
    lonLat: number[]
    originalCoord: number[]
  } | null>(null)
  const rainSourceRef = useRef(new VectorSource())
  const [layersVisibility, setLayersVisibility] = useState({
    boundary: true,
    rain: userPreferences.enabledLayers.includes('rain'),
    warning: userPreferences.enabledLayers.includes('warning'),
  })
  const navigate = useNavigate()
  const boundaryLayerRef = useRef<BaseLayer | null>(null)
  const rainLayerRef = useRef<BaseLayer | null>(null)
  const analysisSourceRef = useRef(new VectorSource())
  const poiSourceRef = useRef(new VectorSource())
  const warningSourceRef = useRef(new VectorSource())
  const warningLayerRef = useRef<BaseLayer | null>(null)
  const warningPopupRef = useRef<HTMLDivElement | null>(null)
  const warningOverlayRef = useRef<Overlay | null>(null)
  const poiPopupRef = useRef<HTMLDivElement | null>(null)
  const poiOverlayRef = useRef<Overlay | null>(null)
  const [pointResults, setPoiResults] = useState<BufferPoiItem[]>([])
  const [selectedStation, setSelectedStation] = useState<NonNullable<
    RainStationDetailPayload['data']
  > | null>(null)
  const [analysisResult, setAnalysisResult] = useState<{
    count: number
    avg: number
    max: number
    risk: string
  } | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [panelOpen, setPanelOpen] = useState(userPreferences.autoOpenWarningPanel)
  const performBufferAnalysis = (lonLat: number[], originalCoord: number[], radius: number) => {
    analysisSourceRef.current.clear()
    setLastRightClickCoord({ lonLat, originalCoord })

    const pointFeature = new Feature({
      geometry: new Point(originalCoord),
    })

    const point = turf.point(lonLat)
    const buffered = turf.buffer(point, radius, { units: 'kilometers' })

    const bufferFeature = new GeoJSON().readFeature(buffered, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    }) as Feature<Polygon>

    const allRainFeatures = rainSourceRef.current.getFeatures()
    const trappedFeatures = allRainFeatures.filter(feature => {
      const geometry = feature.getGeometry()
      return geometry
        ? (bufferFeature.getGeometry()?.intersectsExtent(geometry.getExtent()) ?? false)
        : false
    })
    const values = trappedFeatures
      .map(f => {
        const range = f.get('precip')
        if (!range) return 0
        return parseFloat(range.split('-')[0])
      })
      .filter(v => v > 0)

    let avg = 0
    let max = 0

    if (values.length) {
      avg = values.reduce((a, b) => a + b, 0) / values.length
      max = Math.max(...values)
    }

    // 👉 风险等级
    let risk = '低风险'
    if (max > 50) risk = '高风险'
    else if (max > 20) risk = '中风险'

    setAnalysisResult({
      count: values.length,
      avg: Number(avg.toFixed(2)),
      max,
      risk,
    })
    console.log('buffer hits:', trappedFeatures.length)
    analysisSourceRef.current.addFeatures([pointFeature, bufferFeature])
  }

  useEffect(() => {
    const baseLayer = new TileLayer({
      className: 'weather-base-layer',
      source: new XYZ({
        url: 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        crossOrigin: 'anonymous',
        attributions: '© OpenStreetMap contributors © CARTO',
        maxZoom: 20,
      }),
      opacity: 0.92,
      zIndex: -1,
    })

    const boundaryLayer = new VectorLayer({
      source: new VectorSource({
        url: '/guang_zhou.geojson',
        format: new GeoJSON(),
      }),
      style: new Style({
        stroke: new Stroke({ color: '#0f5fb8', width: 2.4, lineDash: [5, 5] }),
        fill: new Fill({ color: 'rgba(15, 95, 184, 0.04)' }),
      }),
      visible: layersVisibility.boundary,
      zIndex: 0,
    })

    const rainBreaks = [0.1, 1, 2.5, 5, 10, 25, 50, 80]
    const breakStyles = [
      { fill: '#d6f7c5', opacity: 0.5 },
      { fill: '#9ae77e', opacity: 0.58 },
      { fill: '#60cd65', opacity: 0.66 },
      { fill: '#5ab6ff', opacity: 0.72 },
      { fill: '#3178ff', opacity: 0.78 },
      { fill: '#7c4dff', opacity: 0.84 },
      { fill: '#d03eff', opacity: 0.9 },
    ]

    const hexToRgba = (hex: string, opacity: number) => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return `rgba(${r}, ${g}, ${b}, ${opacity})`
    }

    const rainStyle = (feature: FeatureLike) => {
      const range = feature.get('precip')
      if (!range) return undefined

      const lowerValue = parseFloat(range.split('-')[0])
      if (lowerValue < 0.1) return undefined

      const styleIdx = rainBreaks.findIndex(value => value === lowerValue)
      const styleConfig = breakStyles[styleIdx]
      if (!styleConfig) return undefined

      return new Style({
        fill: new Fill({
          color: hexToRgba(styleConfig.fill, styleConfig.opacity),
        }),
        stroke: new Stroke({
          color: 'rgba(255,255,255,0.28)',
          width: 0.6,
        }),
      })
    }

    const rainLayer = new VectorLayer({
      source: rainSourceRef.current,
      style: rainStyle,
      visible: layersVisibility.rain,
      zIndex: 1,
    })

    const analysisLayer = new VectorLayer({
      source: analysisSourceRef.current,
      style: feature => {
        const geometry = feature.getGeometry()
        if (geometry instanceof Point) {
          return getAnalysisPointStyle()
        }
        if (geometry instanceof Polygon) {
          return getAnalysisBufferStyle()
        }
        return undefined
      },
      zIndex: 20,
    })
    const poiLayer = new VectorLayer({
      source: poiSourceRef.current,
      zIndex: 30, // 确保在最顶层
    })
    const warningLayer = new VectorLayer({
      source: warningSourceRef.current,
      visible: layersVisibility.warning,
      zIndex: 35,
    })
    boundaryLayerRef.current = boundaryLayer
    rainLayerRef.current = rainLayer
    warningLayerRef.current = warningLayer
    mapInstance.current = new Map({
      target: mapRef.current ?? undefined,
      layers: [baseLayer, boundaryLayer, rainLayer, analysisLayer, poiLayer, warningLayer],
      view: new View({
        center: fromLonLat([113.26, 23.13]),
        zoom: 9,
      }),
    })

    if (warningPopupRef.current) {
      const warningOverlay = new Overlay({
        element: warningPopupRef.current,
        offset: [12, -12],
        positioning: 'bottom-left',
      })
      warningOverlayRef.current = warningOverlay
      mapInstance.current.addOverlay(warningOverlay)
    }

    if (poiPopupRef.current) {
      const poiOverlay = new Overlay({
        element: poiPopupRef.current,
        offset: [14, -10],
        positioning: 'bottom-left',
      })
      poiOverlayRef.current = poiOverlay
      mapInstance.current.addOverlay(poiOverlay)
    }

    const loadWarningLayer = async () => {
      try {
        const warnings = await getPublishedWarningsByTypes(['rain', 'flood'])
        warningSourceRef.current.clear()
        warningSourceRef.current.addFeatures(
          createWarningFeatures(
            warnings.filter(warning => shouldShowWarning(warning, userPreferences.warningLevel)),
          ),
        )
      } catch (error) {
        console.error('预警图层加载失败:', error)
      }
    }

    void loadWarningLayer()

    const handlePointerMove = (evt: MapPointerEvent) => {
      if (evt.dragging || !poiPopupRef.current) return

      const poiFeature = mapInstance.current?.forEachFeatureAtPixel(evt.pixel, feature => {
        const name = feature.get('name')
        const distance = feature.get('distance')
        return name && distance ? feature : null
      })

      if (!poiFeature) {
        poiPopupRef.current.style.display = 'none'
        poiOverlayRef.current?.setPosition(undefined)
        mapInstance.current?.getTargetElement().style.removeProperty('cursor')
        return
      }

      const name = poiFeature.get('name') || '-'
      const address = poiFeature.get('address') || '-'
      const distance = poiFeature.get('distance') || '-'
      const poiType = poiFeature.get('poiType') || '-'

      poiPopupRef.current.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 6px; color: #102033;">${name}</div>
        <div>类型：${poiType}</div>
        <div>距离中心：${distance} m</div>
        <div style="margin-top: 4px; max-width: 280px; white-space: normal;">地址：${address}</div>
      `
      poiPopupRef.current.style.display = 'block'
      poiOverlayRef.current?.setPosition(evt.coordinate)
      mapInstance.current?.getTargetElement().style.setProperty('cursor', 'pointer')
    }

    mapInstance.current.on('pointermove', handlePointerMove)

    return () => {
      mapInstance.current?.un('pointermove', handlePointerMove)
      mapInstance.current?.setTarget(undefined)
    }
  }, [])

  useEffect(() => {
    const fetchRainData = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/rain-map-data?time=${currentTime}&period=${rainPeriod}`,
        )
        const result = await response.json()

        if (result.success && result.data) {
          const features = new GeoJSON().readFeatures(result.data, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          })

          rainSourceRef.current.clear()
          rainSourceRef.current.addFeatures(features)
        }
      } catch (err) {
        console.error('rain data load failed:', err)
      }
    }

    void fetchRainData()
  }, [currentTime, rainPeriod, reloadTick])

  useEffect(() => {
    const loadMonitorData = async () => {
      try {
        const res = await getRainMonitor(rainPeriod, currentTime)
        if (res.success) {
          setMonitorData(res.data)
        }
      } catch (error) {
        console.error('降水监测摘要加载失败:', error)
        message.error('降水监测摘要加载失败')
      }
    }

    void loadMonitorData()
  }, [currentTime, rainPeriod, reloadTick])

  useEffect(() => {
    boundaryLayerRef.current?.setVisible(layersVisibility.boundary)
    rainLayerRef.current?.setVisible(layersVisibility.rain)
    warningLayerRef.current?.setVisible(layersVisibility.warning)
  }, [layersVisibility])

  useEffect(() => {
    const interval = Math.max(userPreferences.refreshInterval, 1) * 60 * 1000
    const timer = window.setInterval(() => {
      setReloadTick(value => value + 1)
    }, interval)

    return () => window.clearInterval(timer)
  }, [userPreferences.refreshInterval])

  useEffect(() => {
    if (!lastRightClickCoord) return

    performBufferAnalysis(
      lastRightClickCoord.lonLat,
      lastRightClickCoord.originalCoord,
      bufferRadius,
    )
  }, [bufferRadius])

  useEffect(() => {
    if (!mapInstance.current) return

    const map = mapInstance.current
    const viewport = map.getViewport()

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()

      const pixel = map.getEventPixel(event)
      const coordinate = map.getCoordinateFromPixel(pixel)
      const lonLat = toLonLat(coordinate)

      performBufferAnalysis(lonLat, coordinate, bufferRadius)
    }

    viewport.addEventListener('contextmenu', handleContextMenu)
    return () => viewport.removeEventListener('contextmenu', handleContextMenu)
  }, [bufferRadius, currentTime])
  useEffect(() => {
    if (!mapInstance.current) return

    const map = mapInstance.current

    const handleMapClick = async (evt: MapPointerEvent) => {
      const warningFeature = map.forEachFeatureAtPixel(evt.pixel, feature => {
        const warning = feature.get('warning') as WarningRecord | undefined
        return warning ? feature : null
      })

      if (warningFeature) {
        const warning = warningFeature.get('warning') as WarningRecord
        if (warningPopupRef.current) {
          warningPopupRef.current.innerHTML = getWarningPopupHtml(warning)
          warningPopupRef.current.style.display = 'block'
        }
        warningOverlayRef.current?.setPosition(evt.coordinate)
        return
      }

      if (warningPopupRef.current) {
        warningPopupRef.current.style.display = 'none'
      }

      // 1. 将点击的屏幕坐标转为经纬度 [lng, lat]
      const coordinate = toLonLat(evt.coordinate)
      const [lng, lat] = coordinate

      try {
        // 2. 调用后端接口，传入经纬度和当前状态中的 currentTime
        const res = await getStationDetail({ lng, lat, time: currentTime, period: rainPeriod })
        console.log(res)

        if (res.success && res.data) {
          console.log('查询到的站点详情:', res.data)
          setSelectedStation(res.data)
        } else {
          console.log('该位置附近 5km 内没有监测站')
          setSelectedStation(null)
        }
      } catch (error) {
        console.error('获取站点详情失败:', error)
      }
    }

    map.on('singleclick', handleMapClick)

    return () => {
      map.un('singleclick', handleMapClick)
    }
  }, [currentTime, rainPeriod])
  const handleLayerToggle = (layerName: keyof typeof layersVisibility) => {
    setLayersVisibility(prev => ({
      ...prev,
      [layerName]: !prev[layerName],
    }))
  }

  //处理缓冲区分析
  const handleBuffer = async () => {
    if (!lastRightClickCoord) return
    console.log('开始缓冲区分析')
    const { lonLat } = lastRightClickCoord
    // 注意：高德需要的格式是 "经度,纬度"
    const locationStr = `${lonLat[0]},${lonLat[1]}`
    const radiusInMeters = bufferRadius * 1000

    try {
      // 调用对接的接口
      const res = await getBufferAnalysis(locationStr, radiusInMeters, 'flood')

      if (res.success) {
        // --- 1. 清空旧的分析点数据 ---
        poiSourceRef.current.clear()

        // --- 2. 遍历返回的 POI 数据生成 Feature ---
        const poiFeatures = res.pois.map(poi => {
          // 高德返回的 location 是 "113.543155,23.549722"
          const coords = poi.location.split(',').map(Number)

          const feature = new Feature({
            geometry: new Point(fromLonLat(coords)), // 坐标转换
            name: poi.name,
            address: poi.address,
            distance: poi.distance,
            poiType: poi.type,
          })

          // --- 3. 设置样式（根据类型显示不同颜色或图标） ---
          feature.setStyle(
            new Style({
              image: new Circle({
                radius: 6,
                fill: new Fill({ color: poi.type.includes('公交') ? '#1890ff' : '#ff4d4f' }),
                stroke: new Stroke({ color: '#fff', width: 2 }),
              }),
            }),
          )

          return feature
        })

        // --- 4. 将新要素添加到地图 ---
        poiSourceRef.current.addFeatures(poiFeatures)

        // --- 5. 更新 React 状态用于列表展示 ---
        setPoiResults(res.pois)

        // (可选) 自动缩放到包含所有点的范围
        mapInstance.current
          ?.getView()
          .fit(poiSourceRef.current.getExtent(), { padding: [50, 50, 50, 50], duration: 500 })
      } else {
        console.error('分析失败:', res.msg)
      }
    } catch (error) {
      console.error('接口请求异常:', error)
    }
  }

  //取消分析
  const handleClearAnalysis = () => {
    // 清空缓冲区图层（点 + buffer）
    analysisSourceRef.current.clear()

    // 清空POI图层
    poiSourceRef.current.clear()

    // 重置状态
    setLastRightClickCoord(null)
    setAnalysisResult(null)
    setPoiResults([])
  }

  return (
    <div className={style.mapContainer} style={{ position: 'relative' }}>
      <div
        ref={mapRef}
        className={style.mapCanvas}
        key={'map2'}
        style={{ width: panelOpen ? undefined : '100%' }}
      />
      <div className={style.layerSwitch}>
        <span className={style.layerTitle}>图层</span>
        <Checkbox
          checked={layersVisibility.boundary}
          onChange={() => handleLayerToggle('boundary')}
        >
          {boundaryLabel}
        </Checkbox>
        <Checkbox checked={layersVisibility.rain} onChange={() => handleLayerToggle('rain')}>
          {rainLayerLabel}
        </Checkbox>
        <Checkbox checked={layersVisibility.warning} onChange={() => handleLayerToggle('warning')}>
          预警标注
        </Checkbox>
        <Button size="small" onClick={() => setPanelOpen(value => !value)}>
          {panelOpen ? '收起面板' : '展开面板'}
        </Button>
      </div>

      {panelOpen && (
        <aside className={style.monitorPanel}>
          {lastRightClickCoord ? (
            <div className={style.analysisPanel}>
              <div className={style.panelHeader}>
                <div>
                  <h2>缓冲区分析</h2>
                  <span>
                    中心点：{lastRightClickCoord.lonLat[0].toFixed(4)}，
                    {lastRightClickCoord.lonLat[1].toFixed(4)}
                  </span>
                </div>
                <Tag
                  color={
                    analysisResult?.risk === '高风险' ? 'red' : analysisResult ? 'orange' : 'blue'
                  }
                >
                  {analysisResult?.risk ?? '待分析'}
                </Tag>
              </div>

              <div className={style.radiusControl}>
                <div>
                  <span>影响半径</span>
                  <strong>{bufferRadius} km</strong>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="50"
                  step="0.5"
                  value={bufferRadius}
                  onChange={event => setBufferRadius(parseFloat(event.target.value))}
                />
                <div className={style.rangeHint}>
                  <span>500m</span>
                  <span>50km</span>
                </div>
              </div>

              <div className={style.actionRow}>
                <Button type="primary" onClick={handleBuffer}>
                  开始分析
                </Button>
                <Button onClick={handleClearAnalysis}>取消分析</Button>
                <Button
                  disabled={!canEditWarnings}
                  onClick={() => {
                    if (!analysisResult || !lastRightClickCoord) {
                      alert('先分析，再发布，别乱点')
                      return
                    }

                    navigate('/monitor/warning', {
                      state: {
                        center: lastRightClickCoord.lonLat,
                        radius: bufferRadius,
                        analysis: analysisResult,
                        pois: pointResults,
                      },
                    })
                  }}
                >
                  发布预警
                </Button>
              </div>

              {analysisResult && (
                <div className={style.metricGrid}>
                  <div>
                    <span>命中雨区</span>
                    <strong>{analysisResult.count} 个</strong>
                  </div>
                  <div>
                    <span>平均雨量</span>
                    <strong>{analysisResult.avg} mm</strong>
                  </div>
                  <div>
                    <span>最大雨量</span>
                    <strong>{analysisResult.max} mm</strong>
                  </div>
                  <div>
                    <span>影响设施</span>
                    <strong>{pointResults.length} 个</strong>
                  </div>
                </div>
              )}

              <div className={style.tableTitle}>影响设施列表</div>
              <div className={style.analysisTable}>
                <Table
                  rowKey={(record, index) => record.id || String(index ?? 0)}
                  columns={columns}
                  dataSource={pointResults}
                  size="small"
                  pagination={{ pageSize: 6 }}
                  locale={{ emptyText: '点击“开始分析”获取周边设施' }}
                  onRow={record => ({
                    onClick: () => {
                      const coords = formatLocation(record.location)

                      mapInstance.current?.getView().animate({
                        center: fromLonLat(coords),
                        zoom: 13,
                        duration: 500,
                      })
                    },
                  })}
                />
              </div>
            </div>
          ) : (
            <>
              <div className={style.panelHeader}>
                <div>
                  <h2>降水监测</h2>
                  <span>
                    {userPreferences.defaultDistrict === '全市'
                      ? `${monitorData?.stationCount ?? 0} 个自动雨量站`
                      : `关注 ${userPreferences.defaultDistrict}`}
                  </span>
                </div>
                <Tag
                  color={
                    monitorData?.thresholds.danger
                      ? 'red'
                      : monitorData?.thresholds.warning
                        ? 'orange'
                        : 'green'
                  }
                >
                  {monitorData?.thresholds.danger
                    ? '高风险'
                    : monitorData?.thresholds.warning
                      ? '暴雨阈值'
                      : '平稳'}
                </Tag>
              </div>

              <Segmented
                block
                value={rainPeriod}
                options={periodOptions}
                onChange={value => setRainPeriod(value as RainPeriod)}
              />

              <div className={style.metricGrid}>
                <div>
                  <span>平均雨量</span>
                  <strong>{monitorData?.avgPrecip ?? '--'} mm</strong>
                </div>
                <div>
                  <span>最大雨量</span>
                  <strong>{monitorData?.maxPrecip ?? '--'} mm</strong>
                </div>
                <div>
                  <span>暴雨站点</span>
                  <strong>{monitorData?.thresholds.warning ?? '--'} 个</strong>
                </div>
                <div>
                  <span>大暴雨站点</span>
                  <strong>{monitorData?.thresholds.danger ?? '--'} 个</strong>
                </div>
              </div>

              <div className={style.thresholdBox}>
                <div>{monitorData?.thresholds.message ?? '正在加载阈值状态'}</div>
                {monitorData?.thresholds.maxStation && (
                  <span>
                    最强站点：{monitorData.thresholds.maxStation.stationName}，
                    {monitorData.thresholds.maxStation.precip} mm
                  </span>
                )}
              </div>

              <RainfallOnlyChart />

              {selectedStation && (
                <div className={style.stationDetail}>
                  <div className={style.detailTitle}>
                    <strong>{selectedStation.stationName}</strong>
                    <Tag color={warningColorMap[selectedStation.level.warningLevel]}>
                      {selectedStation.level.label}
                    </Tag>
                  </div>
                  <div className={style.detailGrid}>
                    <span>所属区县</span>
                    <b>{selectedStation.district}</b>
                    <span>累计雨量</span>
                    <b>{selectedStation.precip} mm</b>
                    <span>站点编号</span>
                    <b>{selectedStation.stationCode}</b>
                    <span>距点击点</span>
                    <b>{selectedStation.distanceKm} km</b>
                  </div>
                </div>
              )}

            </>
          )}
        </aside>
      )}

      <div className={style.legend}>
        <div className={style.legendTitle}>{legendTitle}</div>
        <div className={style.legendContent}>
          <div className={style.legendItem}>
            <span style={{ background: '#d6f7c5' }}></span> 0.1-1
          </div>
          <div className={style.legendItem}>
            <span style={{ background: '#9ae77e' }}></span> 1-2.5
          </div>
          <div className={style.legendItem}>
            <span style={{ background: '#60cd65' }}></span> 2.5-5
          </div>
          <div className={style.legendItem}>
            <span style={{ background: '#5ab6ff' }}></span> 5-10
          </div>
          <div className={style.legendItem}>
            <span style={{ background: '#3178ff' }}></span> 10-25
          </div>
          <div className={style.legendItem}>
            <span style={{ background: '#7c4dff' }}></span> 25-50
          </div>
          <div className={style.legendItem}>
            <span style={{ background: '#d03eff' }}></span> 50-80
          </div>
          <div className={style.legendItem}>
            <span style={{ background: '#730000' }}></span> 80
          </div>
        </div>
      </div>
      <div
        ref={warningPopupRef}
        style={{
          display: 'none',
          minWidth: '240px',
          maxWidth: '320px',
          padding: '12px',
          color: '#1f2d3d',
          background: '#fff',
          border: '1px solid #e8edf3',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          fontSize: '13px',
          lineHeight: 1.7,
        }}
      />
      <div ref={poiPopupRef} className={style.poiPopup} style={{ display: 'none' }} />
    </div>
  )
}

export default RainMonitor
