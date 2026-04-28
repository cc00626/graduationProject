import { useEffect, useMemo, useRef, useState } from 'react'
import 'ol/ol.css'
import { Feature, Map, Overlay, View } from 'ol'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'
import GeoJSON from 'ol/format/GeoJSON'
import { fromLonLat } from 'ol/proj'
import { Fill, Stroke, Style, Text } from 'ol/style'
import CircleStyle from 'ol/style/Circle'
import { LineString, Point, Polygon } from 'ol/geom'
import { WindLayer } from 'ol-wind'
import { Alert, Button, Empty, List, Select, Slider, Space, Tag } from 'antd'
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getPublishedWarningsByTypes, type WarningRecord } from '@/services/warning'
import { getTyphoonList, getTyphoonPath, getWindData } from '@/services/typhoon'
import { createWarningFeatures, getWarningPopupHtml } from '@/utils/map/warningLayer'
import { canManageWarnings, getUserPreferences } from '@/utils/auth'
import styles from './index.module.scss'

type WindCircle = {
  ne: number
  se: number
  sw: number
  nw: number
}

type TyphoonPoint = {
  LON: number
  LAT: number
  WINDVELOCITY: number
  PRESS: number
  YYYYMMDDHHMM: string
  FORECASTTIMES: number
  TYPHOONNAME: string
  isForecast: boolean
  movement: string
  radius7: WindCircle
  radius10?: WindCircle
  radius12?: WindCircle
}

type WarningLevel = 'blue' | 'yellow' | 'orange' | 'red'

type TyphoonListItem = {
  no: string
  name: string
  englishName: string
  color: string
  status: 'active' | 'history'
  warningLevel: WarningLevel
  latestTime: string
  maxWindSpeed: number
  minPressure: number
}

type TyphoonPayload = {
  no: string
  name: string
  englishName: string
  color: string
  sources: Record<string, TyphoonPoint[]>
  primaryPath: TyphoonPoint[]
  intensity: Array<{
    time: string
    forecastHour: number
    isForecast: boolean
    windSpeed: number
    pressure: number
  }>
  impact: {
    landingRisk: string
    summary: string
    cities: Array<{
      city: string
      distanceKm: number
      nearestTime: string
      riskLevel: string
      windSpeed: number
      pressure: number
    }>
  }
  warning: {
    level: WarningLevel
    issueTime: string
    affectedAreas: string[]
    defenseAdvice: string[]
  }
  dataNote: string
}

const sourceStyle: Record<string, { color: string; width: number; name: string }> = {
  BABJ: { color: '#ff4d4f', width: 3, name: '中央气象台' },
  RJTD: { color: '#64748b', width: 2, name: '日本气象厅' },
  RKSL: { color: '#94a3b8', width: 2, name: '韩国气象厅' },
}

const levelMeta: Record<WarningLevel, { label: string; color: string }> = {
  blue: { label: '蓝色预警', color: '#1677ff' },
  yellow: { label: '黄色预警', color: '#d89614' },
  orange: { label: '橙色预警', color: '#fa8c16' },
  red: { label: '红色预警', color: '#ff4d4f' },
}

const toPoint = (item: TyphoonPoint) => ({
  lng: Number(item.LON),
  lat: Number(item.LAT),
  wind: Number(item.WINDVELOCITY),
  press: Number(item.PRESS),
  time: item.YYYYMMDDHHMM,
  forecastHour: Number(item.FORECASTTIMES),
  isForecast: Boolean(item.isForecast),
  movement: item.movement,
  radius7: item.radius7,
  radius10: item.radius10,
  radius12: item.radius12,
})

const formatApiTime = (value?: string) => {
  if (!value) return '-'
  if (value.includes('-')) return value
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}`
}

const getRiskColor = (risk: string) => {
  if (risk === '高') return 'red'
  if (risk === '中') return 'orange'
  return 'green'
}

const getRiskHex = (risk: string) => {
  if (risk === '高') return '#ff4d4f'
  if (risk === '中') return '#fa8c16'
  return '#52c41a'
}

const shouldShowWarning = (record: WarningRecord, level: 'all' | 'medium' | 'high') => {
  if (level === 'all') return true
  if (level === 'medium') return record.level === 'medium' || record.level === 'high'
  return record.level === 'high'
}

const buildWindPolygon = (center: { lng: number; lat: number }, circle: WindCircle) => {
  const coordinates: number[][] = []
  for (let angle = 0; angle <= 360; angle += 8) {
    const radius =
      angle <= 90 ? circle.ne : angle <= 180 ? circle.nw : angle <= 270 ? circle.sw : circle.se
    const rad = (angle * Math.PI) / 180
    const latRadius = radius / 111
    const lngRadius = radius / (111 * Math.cos((center.lat * Math.PI) / 180))
    coordinates.push(fromLonLat([center.lng + Math.cos(rad) * lngRadius, center.lat + Math.sin(rad) * latRadius]))
  }
  coordinates.push(coordinates[0])
  return new Polygon([coordinates])
}

const makeWindCircleStyle = (color: string, opacity: number) =>
  new Style({
    fill: new Fill({ color: color.replace('OPACITY', String(opacity)) }),
    stroke: new Stroke({
      color: color.replace('OPACITY', String(Math.min(opacity + 0.2, 0.7))),
      width: 1.5,
    }),
  })

const chartPoints = (values: number[], width: number, height: number, reverse = false) => {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const gap = Math.max(max - min, 1)
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
      const ratio = (value - min) / gap
      const y = reverse ? ratio * height : height - ratio * height
      return `${x},${y}`
    })
    .join(' ')
}

const MiniIntensityChart = ({ data }: { data: TyphoonPayload['intensity'] }) => {
  if (data.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
  const width = 360
  const height = 120
  const wind = data.map(item => item.windSpeed)
  const pressure = data.map(item => item.pressure)

  return (
    <div className={styles.chartBox}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.chartSvg}>
        <line x1="0" y1="104" x2={width} y2="104" stroke="#e2e8f0" />
        <polyline points={chartPoints(wind, width, 92)} fill="none" stroke="#ff4d4f" strokeWidth="3" />
        <polyline points={chartPoints(pressure, width, 92, true)} fill="none" stroke="#1677ff" strokeWidth="3" />
        {data.map((item, index) => {
          const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width
          return <circle key={item.forecastHour} cx={x} cy="104" r={item.isForecast ? 3 : 4} fill={item.isForecast ? '#94a3b8' : '#172033'} />
        })}
      </svg>
      <Space size={14} wrap>
        <span className={styles.windLegend}>最大风速</span>
        <span className={styles.pressureLegend}>中心气压</span>
      </Space>
    </div>
  )
}

const TyphoonTrack = () => {
  const userPreferences = useMemo(() => getUserPreferences(), [])
  const canEditWarnings = canManageWarnings()
  const mapRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<Map | null>(null)
  const windLayerRef = useRef<WindLayer | null>(null)
  const trackSourceRef = useRef<VectorSource>(new VectorSource())
  const warningSourceRef = useRef<VectorSource>(new VectorSource())

  const [typhoonList, setTyphoonList] = useState<TyphoonListItem[]>([])
  const [selectedTyphoon, setSelectedTyphoon] = useState('2309')
  const [typhoonData, setTyphoonData] = useState<TyphoonPayload | null>(null)
  const [activePoint, setActivePoint] = useState<ReturnType<typeof toPoint> | null>(null)
  const [replayIndex, setReplayIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const navigate = useNavigate()

  const primaryPoints = useMemo(() => typhoonData?.primaryPath.map(toPoint) ?? [], [typhoonData])
  const displayPoint = primaryPoints[replayIndex] ?? activePoint
  const selectedMeta = typhoonList.find(item => item.no === selectedTyphoon)
  const primaryPointsRef = useRef<ReturnType<typeof toPoint>[]>([])

  useEffect(() => {
    primaryPointsRef.current = primaryPoints
  }, [primaryPoints])

  useEffect(() => {
    const boundaryLayer = new VectorLayer({
      source: new VectorSource({
        url: '/guang_zhou.geojson',
        format: new GeoJSON(),
      }),
      style: new Style({
        stroke: new Stroke({ color: '#1890ff', width: 2, lineDash: [4, 4] }),
        fill: new Fill({ color: 'rgba(24, 144, 255, 0.05)' }),
      }),
      zIndex: 0,
    })

    const trackLayer = new VectorLayer({
      source: trackSourceRef.current,
      visible: userPreferences.enabledLayers.includes('typhoon'),
      zIndex: 10,
    })
    const warningLayer = new VectorLayer({
      source: warningSourceRef.current,
      visible: userPreferences.enabledLayers.includes('warning'),
      zIndex: 20,
    })
    const tooltipOverlay = new Overlay({
      element: tooltipRef.current!,
      offset: [12, -12],
      positioning: 'bottom-left',
    })

    const map = new Map({
      target: mapRef.current || undefined,
      layers: [
        new TileLayer({ source: new OSM() }),
        boundaryLayer,
        trackLayer,
        warningLayer,
      ],
      view: new View({ center: fromLonLat([113.26, 23.13]), zoom: 7 }),
    })

    mapInstance.current = map
    map.addOverlay(tooltipOverlay)

    const fetchAndRenderWind = async () => {
      if (!userPreferences.enabledLayers.includes('wind')) return
      const data = await getWindData()
      if (data && mapInstance.current) {
        windLayerRef.current = new WindLayer(data, {
          windOptions: {
            colorScale: ['#2468b4', '#3c9dc2', '#80cdc1', '#97daa8', '#c6e7b5', '#fff29f', '#fcac63', '#f36343', '#cb3644'],
            velocityScale: 0.005,
            paths: 2400,
            age: 60,
            fieldOptions: { wrapX: true },
          },
          map: mapInstance.current,
        })
      }
    }

    const loadWarningLayer = async () => {
      const warnings = await getPublishedWarningsByTypes(['typhoon'])
      warningSourceRef.current.clear()
      warningSourceRef.current.addFeatures(
        createWarningFeatures(
          warnings.filter(warning => shouldShowWarning(warning, userPreferences.warningLevel)),
        ),
      )
    }

    map.on('singleclick', evt => {
      map.forEachFeatureAtPixel(evt.pixel, feature => {
        const data = feature.get('data')
        if (data) {
          setActivePoint(data)
          const index = primaryPointsRef.current.findIndex(item => item.time === data.time)
          if (index >= 0) setReplayIndex(index)
        }
        return feature
      })
    })

    map.on('pointermove', evt => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, f => f)
      if (!tooltipRef.current) return

      if (feature?.get('warning')) {
        tooltipOverlay.setPosition(evt.coordinate)
        tooltipRef.current.style.display = 'block'
        tooltipRef.current.innerHTML = getWarningPopupHtml(feature.get('warning') as WarningRecord)
        return
      }

      if (feature?.get('data')) {
        const data = feature.get('data') as ReturnType<typeof toPoint>
        tooltipOverlay.setPosition(evt.coordinate)
        tooltipRef.current.style.display = 'block'
        tooltipRef.current.innerHTML = `
          <div>时间：${formatApiTime(data.time)}</div>
          <div>最大风速：${data.wind} m/s</div>
          <div>中心气压：${data.press} hPa</div>
          <div>7级风圈：${Math.max(...Object.values(data.radius7 ?? { ne: 0 }))} km</div>
          <div>路径类型：${data.isForecast ? '预测路径' : '历史路径'}</div>
        `
        return
      }

      tooltipRef.current.style.display = 'none'
    })

    void fetchAndRenderWind()
    void loadWarningLayer()

    return () => {
      windLayerRef.current = null
      map.getLayers().clear()
      map.setTarget(undefined)
      mapInstance.current = null
    }
  }, [])

  useEffect(() => {
    const loadList = async () => {
      const res = (await getTyphoonList()) as { data?: TyphoonListItem[] } | null
      if (res?.data?.length) {
        const list = res.data
        setTyphoonList(list)
        setSelectedTyphoon(current => current || list[0].no)
      }
    }
    void loadList()
  }, [])

  useEffect(() => {
    const loadData = async () => {
      const res = (await getTyphoonPath(selectedTyphoon)) as TyphoonPayload | null
      if (res) {
        setTyphoonData(res)
        setReplayIndex(0)
        setPlaying(false)
        setActivePoint(res.primaryPath?.[0] ? toPoint(res.primaryPath[0]) : null)
      }
    }
    void loadData()
  }, [selectedTyphoon])

  useEffect(() => {
    if (!playing || primaryPoints.length <= 1) return
    const timer = window.setInterval(() => {
      setReplayIndex(index => {
        if (index >= primaryPoints.length - 1) {
          setPlaying(false)
          return index
        }
        return index + 1
      })
    }, 900)
    return () => window.clearInterval(timer)
  }, [playing, primaryPoints.length])

  useEffect(() => {
    const map = mapInstance.current
    if (!map || !typhoonData) return

    trackSourceRef.current.clear()
    const renderLimit = Math.min(replayIndex + 1, primaryPoints.length)

    Object.entries(typhoonData.sources).forEach(([agency, rawPoints]) => {
      const config = sourceStyle[agency] || { color: '#ccc', width: 1.5, name: agency }
      const points = rawPoints.map(toPoint).slice(0, renderLimit)
      const history = points.filter(point => !point.isForecast)
      const forecast = points.filter(point => point.isForecast)
      const lastHistory = history.at(-1)

      const addLine = (items: typeof points, dash?: number[]) => {
        if (items.length < 2) return
        const lineFeature = new Feature({
          geometry: new LineString(items.map(point => fromLonLat([point.lng, point.lat]))),
        })
        lineFeature.setStyle(
          new Style({
            stroke: new Stroke({ color: config.color, width: config.width, lineDash: dash }),
          }),
        )
        trackSourceRef.current.addFeature(lineFeature)
      }

      addLine(history)
      addLine(lastHistory ? [lastHistory, ...forecast] : forecast, [8, 8])

      points.forEach((point, index) => {
        const isLatest = index === points.length - 1
        const feature = new Feature({
          geometry: new Point(fromLonLat([point.lng, point.lat])),
          data: point,
          agency,
        })
        feature.setStyle(
          new Style({
            image: new CircleStyle({
              radius: isLatest ? 7 : point.isForecast ? 4 : 5,
              fill: new Fill({ color: point.isForecast ? 'rgba(255,255,255,0.75)' : config.color }),
              stroke: new Stroke({ color: '#fff', width: isLatest ? 2.5 : 1.5 }),
            }),
            text:
              isLatest && agency === 'BABJ'
                ? new Text({
                    text: `${config.name} ${point.wind}m/s`,
                    font: '12px sans-serif',
                    fill: new Fill({ color: '#fff' }),
                    backgroundFill: new Fill({ color: 'rgba(15, 23, 42, 0.74)' }),
                    padding: [3, 6, 3, 6],
                    offsetY: -22,
                  })
                : undefined,
          }),
        )
        trackSourceRef.current.addFeature(feature)
      })
    })

    const focus = primaryPoints[Math.min(replayIndex, primaryPoints.length - 1)]
    if (focus) {
      const windLayers = [
        { key: 'radius7', label: '7级风圈', color: 'rgba(82,196,26,OPACITY)', opacity: 0.16 },
        { key: 'radius10', label: '10级风圈', color: 'rgba(250,140,22,OPACITY)', opacity: 0.18 },
        { key: 'radius12', label: '12级风圈', color: 'rgba(255,77,79,OPACITY)', opacity: 0.2 },
      ] as const

      windLayers.forEach(layer => {
        const circle = focus[layer.key]
        if (!circle) return
        const feature = new Feature({
          geometry: buildWindPolygon({ lng: focus.lng, lat: focus.lat }, circle),
          windCircle: layer.label,
        })
        feature.setStyle(makeWindCircleStyle(layer.color, layer.opacity))
        trackSourceRef.current.addFeature(feature)
      })
    }

    if (trackSourceRef.current.getFeatures().length > 0) {
      map.getView().fit(trackSourceRef.current.getExtent(), {
        padding: [60, 60, 120, 60],
        duration: 500,
        maxZoom: 8,
      })
    }
  }, [typhoonData, replayIndex, primaryPoints])

  const replayMarks = useMemo(() => {
    const lastIndex = Math.max(primaryPoints.length - 1, 0)
    return {
      0: '开始',
      [lastIndex]: '未来',
    }
  }, [primaryPoints.length])

  const createTyphoonWarning = () => {
    if (!typhoonData || !displayPoint) return

    const radius = Math.min(Math.max(...Object.values(displayPoint.radius7)), 500)
    const risk = typhoonData.impact.landingRisk
    const level = risk === '高' ? 'high' : risk === '中' ? 'medium' : 'low'
    const title = `${typhoonData.name}${levelMeta[typhoonData.warning.level].label}`
    const cityText = typhoonData.impact.cities
      .map(city => `${city.city}最近距离约${city.distanceKm}km，${city.riskLevel}风险`)
      .join('；')
    const description = [
      `${typhoonData.name}（${typhoonData.englishName}）中心位于${displayPoint.lng.toFixed(1)}E、${displayPoint.lat.toFixed(1)}N，最大风速${displayPoint.wind}m/s，中心气压${displayPoint.press}hPa。`,
      `7级风圈半径约${radius}km，移动趋势：${displayPoint.movement}。`,
      cityText,
      `防御建议：${typhoonData.warning.defenseAdvice.join('；')}。`,
    ].join('\n')

    navigate('/monitor/warning', {
      state: {
        center: [displayPoint.lng, displayPoint.lat],
        radius,
        typhoonWarning: {
          no: typhoonData.no,
          name: typhoonData.name,
          englishName: typhoonData.englishName,
          warningLevel: typhoonData.warning.level,
          level,
          title,
          location: typhoonData.warning.affectedAreas.join('、'),
          description,
          analysis: {
            typhoonNo: typhoonData.no,
            typhoonName: `${typhoonData.name} ${typhoonData.englishName}`,
            risk: `${risk}风险`,
            landingRisk: risk,
            windSpeed: displayPoint.wind,
            pressure: displayPoint.press,
            movement: displayPoint.movement,
            cities: typhoonData.impact.cities,
            warning: typhoonData.warning,
          },
        },
      },
    })
  }

  return (
    <div className={styles.mapContainer}>
      <div ref={mapRef} className={styles.mapCanvas} />

      <div className={styles.layerSwitch}>
        <span className={styles.layerTitle}>台风</span>
        <Select
          size="small"
          value={selectedTyphoon}
          style={{ width: 230 }}
          options={typhoonList.map(item => ({
            value: item.no,
            label: `${item.no} ${item.name} ${item.englishName}`,
          }))}
          onChange={setSelectedTyphoon}
        />
      </div>

      <aside className={styles.monitorPanel}>
        {typhoonData ? (
          <>
            <div className={styles.panelHeader}>
              <div>
                <h2>台风监测</h2>
                <span>
                  {typhoonData.no} {typhoonData.name} {typhoonData.englishName}
                </span>
              </div>
              <Tag color={levelMeta[typhoonData.warning.level].color}>
                {levelMeta[typhoonData.warning.level].label}
              </Tag>
            </div>

            <Alert message={typhoonData.impact.summary} type="warning" showIcon />

            <div className={styles.metricGrid}>
              <div>
                <span>登陆风险</span>
                <strong style={{ color: getRiskHex(typhoonData.impact.landingRisk) }}>
                  {typhoonData.impact.landingRisk}
                </strong>
              </div>
              <div>
                <span>最大风速</span>
                <strong>{selectedMeta?.maxWindSpeed ?? displayPoint?.wind ?? '--'} m/s</strong>
              </div>
              <div>
                <span>最低气压</span>
                <strong>{selectedMeta?.minPressure ?? displayPoint?.press ?? '--'} hPa</strong>
              </div>
              <div>
                <span>当前时次</span>
                <strong>{formatApiTime(displayPoint?.time).slice(5)}</strong>
              </div>
            </div>

            <div className={styles.actionRow}>
              <Button
                type="primary"
                icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => setPlaying(value => !value)}
              >
                {playing ? '暂停' : '回放'}
              </Button>
              <Button disabled={!canEditWarnings} onClick={createTyphoonWarning}>
                生成预警
              </Button>
            </div>

            {displayPoint && (
              <div className={styles.detailBox}>
                <div className={styles.detailTitle}>
                  <strong>路径点详情</strong>
                  <Tag color={displayPoint.isForecast ? 'default' : 'blue'}>
                    {displayPoint.isForecast ? '预测' : '历史'}
                  </Tag>
                </div>
                <div className={styles.detailGrid}>
                  <span>中心位置</span>
                  <b>{displayPoint.lng.toFixed(2)}, {displayPoint.lat.toFixed(2)}</b>
                  <span>移动方向</span>
                  <b>{displayPoint.movement}</b>
                  <span>7级风圈</span>
                  <b>{Object.values(displayPoint.radius7).join('/')} km</b>
                  <span>10级风圈</span>
                  <b>{displayPoint.radius10 ? `${Object.values(displayPoint.radius10).join('/')} km` : '-'}</b>
                  <span>12级风圈</span>
                  <b>{displayPoint.radius12 ? `${Object.values(displayPoint.radius12).join('/')} km` : '-'}</b>
                </div>
              </div>
            )}

            <div className={styles.tableTitle}>强度变化</div>
            <MiniIntensityChart data={typhoonData.intensity} />

            <div className={styles.tableTitle}>广东城市影响</div>
            <div className={styles.cityList}>
              {typhoonData.impact.cities.map(city => (
                <div key={city.city}>
                  <span>{city.city}</span>
                  <strong>{city.distanceKm} km</strong>
                  <Tag color={getRiskColor(city.riskLevel)}>{city.riskLevel}风险</Tag>
                </div>
              ))}
            </div>

            <div className={styles.tableTitle}>预警与防御建议</div>
            <div className={styles.thresholdBox}>
              <b>发布时间：{typhoonData.warning.issueTime}</b>
              <Space wrap style={{ marginTop: 8 }}>
                {typhoonData.warning.affectedAreas.map(area => <Tag key={area}>{area}</Tag>)}
              </Space>
            </div>
            <div className={styles.adviceList}>
              <List
                size="small"
                dataSource={typhoonData.warning.defenseAdvice}
                renderItem={item => <List.Item>{item}</List.Item>}
              />
            </div>

            <div className={styles.dataNote}>{typhoonData.dataNote}</div>
          </>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无台风数据" />
        )}
      </aside>

      <div className={styles.timeControl}>
        <div className={styles.timeTitle}>路径回放：{formatApiTime(displayPoint?.time)}</div>
        <Slider
          min={0}
          max={Math.max(primaryPoints.length - 1, 0)}
          value={replayIndex}
          marks={replayMarks}
          onChange={value => {
            setPlaying(false)
            setReplayIndex(value)
            setActivePoint(primaryPoints[value] ?? null)
          }}
        />
      </div>

      <div className={styles.legend}>
        <div className={styles.legendTitle}>风圈图例</div>
        <div className={styles.legendContent}>
          <div className={styles.legendItem}><span style={{ background: 'rgba(82,196,26,0.36)' }} />7级风圈</div>
          <div className={styles.legendItem}><span style={{ background: 'rgba(250,140,22,0.38)' }} />10级风圈</div>
          <div className={styles.legendItem}><span style={{ background: 'rgba(255,77,79,0.4)' }} />12级风圈</div>
          <div className={styles.legendDash}>虚线为预测路径</div>
        </div>
      </div>

      <div ref={tooltipRef} className={styles.tooltip} />
    </div>
  )
}

export default TyphoonTrack
