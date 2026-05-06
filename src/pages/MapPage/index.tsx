import { useCallback, useEffect, useRef, useState } from 'react'
import 'ol/ol.css'
import OLMap from 'ol/Map'
import View from 'ol/View'
import { FullScreen, defaults as defaultControls } from 'ol/control'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import XYZ from 'ol/source/XYZ'
import VectorSource from 'ol/source/Vector'
import { Fill, Stroke, Style, Text } from 'ol/style'
import { BorderOutlined, ClearOutlined } from '@ant-design/icons'
import { LAYERS } from '@/constant'
import { useMeasureTool } from '@/hooks/useMeasureTool'
import { getWeatherNow, getWindHistory, getWindPoll } from '@/services/wind'
import type { WeatherNowItem, WeatherNowResponse, WindHistoryItem } from '@/services/wind'
import style from './index.module.scss'
import DistrictInsightPanel from './DistrictInsightPanel'
import FloodRiskLayer from './FloodRiskLayer'
import LayerManager from './LayerManager'
import WindDistributionChart from './WindChart'
import WindArrowLayer from './WindArrowLayer'
import WindTrendChart from './WindQuShi'
import type { FloodRiskSummary } from './floodRisk/types'
import {
  createDistrictLayer,
  createStationLayer,
  createWaterLayer,
  createWeatherImageLayer,
} from './mapLayers'
import { DragBox } from 'ol/interaction'
import { platformModifierKeyOnly } from 'ol/events/condition'
import { highlightStationStyle } from './mapLayers'
import TimeMachine from './TimeMachine'
import type ImageLayer from 'ol/layer/Image'
import Static from 'ol/source/ImageStatic'
import { useNavigate } from 'react-router-dom'
type WindDistrictData = {
  district: string
  levelCounts: number[]
}

type WindPollData = {
  districts?: WindDistrictData[]
}

/*
The function `handleGetDistrictWeatherNow` takes a district name, fetches the latest weather data for the district, and updates the state of the application with the latest data. The function `handleGetWeatherData` takes a date and fetch the latest weather data for the date. The function `handleGetWindData` takes an optional date and fetch the latest wind data for the date. The function `handleGetWeatherNow` takes a district name and fetches the latest weather data for the district. The function `handleGetDistrictWeatherNow` takes a district name, fetches the latest weather data for the district, and updates the state of the application with the latest data.
*/
const MapComponent = () => {
  const mapElement = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<OLMap | null>(null)
  const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const windData = useRef<WindPollData | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [chartData, setChartData] = useState<WindDistrictData[]>([])
  const [trendData, setTrendData] = useState<WindHistoryItem[]>([])
  const [arrowRefreshKey, setArrowRefreshKey] = useState(0)
  // 记录当前选中的区名
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null) //选中高亮状态
  const [activeDetail, setActiveDetail] = useState<WindDistrictData | null>(null)
  const [weatherNow, setWeatherNow] = useState<WeatherNowItem | null>(null)
  const [weatherMeta, setWeatherMeta] = useState<WeatherNowResponse | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [floodRiskSummary, setFloodRiskSummary] = useState<FloodRiskSummary | null>(null)
  const [activeLayers, setActiveLayers] = useState<string[]>([LAYERS.DISTRICT])
  const stationLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const [selectedStations, setSelectedStations] = useState<any[]>([]) // 存储框选到的站点信息
  const highlightSourceRef = useRef(new VectorSource()) // 高亮图层的数据源
  const weatherImageLayerRef = useRef<ImageLayer<Static> | null>(null)
  const [activeWeatherType] = useState<'rain_standard' | 'temp' | 'wind'>('rain_standard')
  const [hasNotified] = useState(false)
  const navigate = useNavigate()
  // const getGzStyle = (feature: any) => {
  //   const districtName = feature.get('name')
  //   const data = windData.current

  //   // 默认样式：低饱和冷色，避免和底图争抢注意力
  //   let fillColor = 'rgba(45, 84, 124, 0.12)'

  //   if (data?.districts) {
  //     const info = data.districts.find((d: any) => d.district === districtName)

  //     if (info && info.levelCounts) {
  //       const counts = info.levelCounts // [13, 0, 0, 0, 0]

  //       // 从高等级向低等级遍历 (从右往左)，找到第一个有数值的等级
  //       // 索引 4: 五级, 3: 四级, 2: 三级, 1: 二级, 0: 一级
  //       if (counts[4] > 0)
  //         fillColor = 'rgba(204, 61, 61, 0.26)' // 五级-红
  //       else if (counts[3] > 0)
  //         fillColor = 'rgba(235, 112, 60, 0.24)' // 四级-橙红
  //       else if (counts[2] > 0)
  //         fillColor = 'rgba(245, 176, 65, 0.22)' // 三级-橙黄
  //       else if (counts[1] > 0)
  //         fillColor = 'rgba(44, 171, 130, 0.2)' // 二级-绿
  //       else if (counts[0] > 0) fillColor = 'rgba(66, 135, 245, 0.18)' // 一级-蓝
  //     }
  //   }

  //   return new Style({
  //     stroke: new Stroke({ color: 'rgba(219, 231, 243, 0.95)', width: 1.2 }),
  //     fill: new Fill({ color: fillColor }),
  //     text: new Text({
  //       text: districtName,
  //       font: 'bold 14px "Microsoft YaHei", "Helvetica Neue", sans-serif', // 优先使用雅黑，加粗
  //       fill: new Fill({ color: '#10233a' }), // 深蓝灰文字，提高在浅底图上的识别度
  //       // ✨ 重点：加粗的白色光晕
  //       stroke: new Stroke({ color: 'rgba(255, 255, 255, 0.98)', width: 4 }),
  //       textAlign: 'center',
  //       textBaseline: 'middle',
  //       // ✨ 新增属性：防止文字重叠
  //       overflow: false, // 当文字超出区域边缘时不显示（虽然会导致越秀这种小区域名字消失，但能保证大图整洁）
  //     }),
  //   })
  // }

  const getGzStyle = useCallback(
    (feature: any) => {
      const districtName = feature.get('name')
      const data = windData.current

      // ✨ 判断当前要素是否被选中
      const isSelected = districtName === selectedDistrict

      // 1. 默认填充颜色计算逻辑 (保持不变)
      let fillColor = 'rgba(45, 84, 124, 0.12)'
      if (data?.districts) {
        const info = data.districts.find((d: any) => d.district === districtName)
        if (info && info.levelCounts) {
          const counts = info.levelCounts
          if (counts[4] > 0)
            fillColor = 'rgba(204, 61, 61, 0.26)' // 五级-红
          else if (counts[3] > 0)
            fillColor = 'rgba(235, 112, 60, 0.24)' // 四级-橙红
          else if (counts[2] > 0)
            fillColor = 'rgba(245, 176, 65, 0.22)' // 三级-橙黄
          else if (counts[1] > 0)
            fillColor = 'rgba(44, 171, 130, 0.2)' // 二级-绿
          else if (counts[0] > 0) fillColor = 'rgba(66, 135, 245, 0.18)' // 一级-蓝
        }
      }

      // ✨ 2. 动态计算边框样式 (高亮核心)
      // 如果被选中，使用醒目的颜色（如纯白或亮黄），并加粗
      const strokeColor = isSelected ? '#ffffff' : 'rgba(219, 231, 243, 0.95)'
      const strokeWidth = isSelected ? 3.5 : 1.2 // 选中时边框加粗

      // ✨ 3. 动态计算填充样式 (可选优化)
      // 选中时，可以让填充色略微变亮或增加透明度，突出显示
      const finalFillColor = isSelected ? 'rgba(255, 255, 255, 0.3)' : fillColor

      return new Style({
        stroke: new Stroke({
          color: strokeColor,
          width: strokeWidth,
        }),
        fill: new Fill({
          color: finalFillColor,
        }),
        text: new Text({
          text: districtName,
          font: isSelected
            ? 'bold 16px "Microsoft YaHei", sans-serif' // 选中时文字放大
            : 'bold 14px "Microsoft YaHei", sans-serif',
          fill: new Fill({ color: isSelected ? '#fff' : '#10233a' }), // 选中时文字变白
          stroke: new Stroke({
            color: isSelected ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.98)',
            width: isSelected ? 3 : 4,
          }),
          textAlign: 'center',
          textBaseline: 'middle',
          overflow: false,
        }),
        // ✨ 4. 样式层级 (Z-Index)
        // 确保选中的要素样式绘制在最上层，防止边框被相邻区域遮挡
        zIndex: isSelected ? 100 : 1,
      })
    },
    [selectedDistrict],
  )
  // 初始化地图
  useEffect(() => {
    const vectorSource = new VectorSource()
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: new Style({
        fill: new Fill({ color: 'rgba(45, 84, 124, 0.12)' }),
        stroke: new Stroke({ color: 'rgba(133, 170, 206, 0.9)', width: 1.8 }),
      }),
    })

    const initialMap: OLMap = new OLMap({
      target: mapElement.current || undefined,
      layers: [
        new TileLayer({
          className: 'weather-base-layer',
          source: new XYZ({
            url: 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            crossOrigin: 'anonymous',
            attributions: '© OpenStreetMap contributors © CARTO',
            maxZoom: 20,
          }),
          opacity: 0.9,
          zIndex: -1,
        }),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat([113.26, 23.13]),
        zoom: 10,
      }),
      controls: defaultControls().extend([
        new FullScreen({
          tipLabel: '全屏',
        }),
      ]),
    })

    mapRef.current = initialMap

    return () => {
      initialMap.setTarget(undefined)
      mapRef.current = null
    }
  }, [])

  const { isMeasuring, startMeasure, stopMeasure } = useMeasureTool(mapRef)

  const handleMeasureToggle = () => {
    if (isMeasuring) {
      stopMeasure()
    } else {
      startMeasure()
    }
  }

  // 加载广州市 geojson
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const highlightLayer = new VectorLayer({
      source: highlightSourceRef.current,
      style: highlightStationStyle, // 使用上面定义的样式
      zIndex: 1000,
    })
    map.addLayer(highlightLayer)
    const stationLayer = createStationLayer() //气象站点图层
    const vectorLayer = createDistrictLayer(getGzStyle)
    const waterLayer = createWaterLayer()

    const vectorSource = vectorLayer.getSource()
    if (!vectorSource) return
    stationLayerRef.current = stationLayer
    const weatherImageLayer = createWeatherImageLayer('wind', 0)
    weatherImageLayerRef.current = weatherImageLayer
    map.addLayer(vectorLayer)
    map.addLayer(waterLayer)
    map.addLayer(stationLayer)
    map.addLayer(weatherImageLayer)
    vectorLayerRef.current = vectorLayer

    const listener = () => {
      if (vectorSource.getState() === 'ready') {
        const extent = vectorSource.getExtent()
        if (extent && extent[0] !== Infinity) {
          map.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom: 12,
            duration: 800,
          })
        }
        vectorSource.un('change', listener)
      }
    }

    vectorSource.on('change', listener)

    return () => {
      map.removeLayer(waterLayer)
      map.removeLayer(vectorLayer)
      map.removeLayer(stationLayer)
      map.removeLayer(highlightLayer)
    }
  }, [getGzStyle])

  //获取风速站点数据
  const handleGetWindData = async () => {
    try {
      const res = await getWindPoll(new Date(0).toISOString())
      if (res && res.data) {
        // 更新 Ref 供地图样式使用（地图样式 getGzStyle 依赖 windData.current）
        windData.current = res.data as WindPollData
        // 更新 State 供 ECharts 使用
        setChartData(res.data.districts || [])
        // 手动触发地图重绘以更新颜色
        if (vectorLayerRef.current) {
          vectorLayerRef.current.changed()
        }
        console.log('数据已更新：', res.data)
        if (vectorLayerRef.current) {
          vectorLayerRef.current.changed()
        }
        console.log('数据已更新并同步至地图')
      }
    } catch (error) {
      console.error('获取风速失败', error)
    }
  }
  useEffect(() => {
    // 首次进入页面异步触发一次，避免在 effect 同步阶段直接触发 setState
    const initialTimer = setTimeout(() => {
      handleGetWindData()
    }, 0)

    // 设置定时器
    const timer = setInterval(() => {
      console.log('正在执行自动轮询...')
      handleGetWindData()
    }, 18000000000)

    // 🔴 关键：组件卸载时必须清除定时器，防止内存泄漏和无效请求
    return () => {
      clearTimeout(initialTimer)
      clearInterval(timer)
    }
  }, [])

  const handleGetWeatherData = async () => {
    try {
      const res = await getWindHistory({
        page: 1,
        pageSize: 20,
        sort: 'asc',
      })
      const recentItems = Array.isArray(res?.data) ? res.data : []
      const sortedByTime = [...recentItems].sort((a, b) => {
        const ta = a?.time ? new Date(a.time).getTime() : NaN
        const tb = b?.time ? new Date(b.time).getTime() : NaN
        if (Number.isNaN(ta) || Number.isNaN(tb)) return 0
        return ta - tb
      })
      setTrendData(sortedByTime)
      console.log('历史风速数据：', res)
    } catch (error) {
      console.error('获取历史数据失败', error)
    }
  }

  useEffect(() => {
    const initialHistoryTimer = setTimeout(() => {
      handleGetWeatherData()
    }, 0)

    return () => clearTimeout(initialHistoryTimer)
  }, [])

  const handleGetDistrictWeatherNow = useCallback(async (districtName: string) => {
    setWeatherLoading(true)
    try {
      const res = await getWeatherNow(districtName, 'base', 'JSON')
      setWeatherMeta(res || null)
      const liveInfo = Array.isArray(res?.data?.lives) ? res.data.lives[0] : null
      setWeatherNow(liveInfo || null)
      console.log('区域实时天气：', liveInfo)
    } catch (error) {
      setWeatherMeta(null)
      setWeatherNow(null)
      console.error('获取实时天气失败', error)
    } finally {
      setWeatherLoading(false)
    }
  }, [])

  //获取单个区域的风速数据
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const handleMapClick = async (event: any) => {
      // 获取点击位置的 Feature
      const feature = map.forEachFeatureAtPixel(event.pixel, f => f)

      if (feature) {
        const districtName = feature.get('name') // 从 GeoJSON 中获取区名
        setSelectedDistrict(districtName)
        console.log('点击了区:', districtName)
        // 从已有的 windData 中查找该区的详细数据
        const detail = windData.current?.districts?.find(d => d.district === districtName)
        if (detail) {
          setActiveDetail(detail)
        } else {
          // 如果数据中没有（可能是暂无站点），可以设置一个默认结构
          setActiveDetail({ district: districtName, levelCounts: [0, 0, 0, 0, 0] })
        }
        await handleGetDistrictWeatherNow(districtName)
      } else {
        // 点击空白处关闭详情
        setSelectedDistrict(null)
        setActiveDetail(null)
        setWeatherMeta(null)
        setWeatherNow(null)
      }
    }

    map.on('singleclick', handleMapClick)
    return () => map.un('singleclick', handleMapClick)
  }, [handleGetDistrictWeatherNow])

  // 核心切换函数：保证可维护性的关键
  const toggleLayer = useCallback((layerId: string) => {
    const map = mapRef.current
    if (!map) return

    // 找到地图中已存在的图层
    const layers = map.getLayers().getArray()
    const targetLayer = layers.find(layer => layer.get('id') === layerId)

    if (targetLayer) {
      // 如果图层已存在，切换可见性
      const isVisible = targetLayer.getVisible()
      targetLayer.setVisible(!isVisible)

      // 更新状态用于 UI 反馈
      setActiveLayers(prev => (isVisible ? prev.filter(id => id !== layerId) : [...prev, layerId]))
    }
  }, [])

  //框选查询
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const dragBox = new DragBox({
      condition: platformModifierKeyOnly,
    })

    map.addInteraction(dragBox)

    dragBox.on('boxend', () => {
      const extent = dragBox.getGeometry().getExtent()
      const stationsSource = stationLayerRef.current?.getSource()
      const highlightSource = highlightSourceRef.current

      // ✨ 清除上一次的高亮
      highlightSource.clear()

      if (stationsSource) {
        const selected: any[] = []

        stationsSource.forEachFeatureIntersectingExtent(extent, feature => {
          const cloneFeature = feature.clone()
          highlightSource.addFeature(cloneFeature)
          const properties = feature.getProperties()

          selected.push({
            ...properties, // 展开所有属性 (id, name, wind_speed, rainfall, status 等)
            geometry: feature.getGeometry(), // 存入几何体以便后续做地图联动
          })
        })

        setSelectedStations(selected)
        console.log('选中的站点：', selected)
      }
    })

    dragBox.on('boxstart', () => {
      highlightSourceRef.current.clear() // 开始新框选时清除高亮
      setSelectedStations([])
    })

    return () => {
      map.removeInteraction(dragBox)
    }
  }, [])

  //时间轴
  // 在你的地图主页面中
  const onTimeChange = useCallback(
    (hour: number) => {
      const weatherLayer = weatherImageLayerRef.current
      if (!weatherLayer) return

      // 创建新的 Source
      const newSource = new Static({
        url: `/layers/standard_rain/${activeWeatherType}_${hour}.png`, // 使用状态中的类型
        imageExtent: [112.9, 22.5, 114.1, 24.0],
        projection: 'EPSG:4326',
      })

      weatherLayer.setSource(newSource)

      // 同时联动站点数据 (如果你之前的 history 文件夹里有对应的 station_x.json)
      const stationSource = stationLayerRef.current?.getSource()
      if (stationSource) {
        stationSource.setUrl(`/data/history/station_${hour}.json`)
        stationSource.refresh()
      }
    },
    [activeWeatherType],
  )

  const handleAlertAndAnalysis = (station: any) => {
    console.log('123')
    // 1. 执行预警逻辑...

    // 2. 跳转并传递站点 ID 或坐标
    navigate(`/emergency-detail/${station.id}`, {
      state: { center: [station.longitude, station.latitude], name: station.name },
    })
  }
  return (
    <>
      <div className={style.page}>
        <div ref={mapElement} className={style.mapContainer}>
          <div className={style.toolPanel} onClick={() => setIsExpanded(() => !isExpanded)}>
            <button className={style.expandBtn}>{isExpanded ? '✕' : '☰'}</button>
          </div>

          {isExpanded && (
            <div className={style.toolMeasure}>
              <button className={style.expandBtn} onClick={handleMeasureToggle}>
                {!isMeasuring ? <BorderOutlined /> : <ClearOutlined />}
              </button>
            </div>
          )}

          <LayerManager activeLayers={activeLayers} onToggle={toggleLayer} />
        </div>
      </div>
      <WindArrowLayer mapRef={mapRef} refreshKey={arrowRefreshKey} />
      <FloodRiskLayer
        mapRef={mapRef}
        activeLayers={activeLayers}
        weatherNow={weatherNow}
        onRiskSummaryChange={setFloodRiskSummary}
      />
      <button
        style={{ position: 'absolute', right: '290px', top: '50px', color: 'white' }}
        onClick={() => setArrowRefreshKey(prev => prev + 1)}
      >
        刷新风向
      </button>
      {/* 右侧展示 */}
      {selectedStations.length > 0 ? (
        <div className={style.selectionPanel}>
          <div className={style.panelHeader}>
            <h3>区域监测详情</h3>
            <span className={style.countTag}>{selectedStations.length} 个站点</span>
          </div>

          <div className={style.stationList}>
            {selectedStations.map((station, index) => {
              // 动态定义风险状态文案与等级
              const isDanger = station.status === 'danger'
              const isWarning = station.status === 'warning'

              return (
                <div
                  key={station.id || index}
                  className={`${style.stationCard} ${style[station.status] || ''}`}
                >
                  {/* 状态顶部栏 */}
                  <div className={style.cardTop}>
                    <div className={style.mainInfo}>
                      <span className={style.name}>{station.name || '未知站点'}</span>
                      <span className={style.dist}>{station.district}</span>
                    </div>
                    {/* 风险标签 */}
                    {(isDanger || isWarning) && (
                      <div className={style.riskBadge}>{isDanger ? '极高风险' : '中高风险'}</div>
                    )}
                  </div>

                  {/* 核心数据网格 */}
                  <div className={style.dataGrid}>
                    <div
                      className={`${style.dataItem} ${station.wind_speed > 17.2 ? style.warn : ''}`}
                    >
                      <span className={style.label}>风速</span>
                      <span className={style.value}>
                        {station.wind_speed ?? '--'}
                        <small>m/s</small>
                      </span>
                    </div>
                    <div className={`${style.dataItem} ${station.rainfall > 30 ? style.warn : ''}`}>
                      <span className={style.label}>雨量</span>
                      <span className={style.value}>
                        {station.rainfall ?? '--'}
                        <small>mm</small>
                      </span>
                    </div>
                    <div className={style.dataItem}>
                      <span className={style.label}>气温</span>
                      <span className={style.value}>
                        {station.temperature ?? '--'}
                        <small>°C</small>
                      </span>
                    </div>
                  </div>

                  <div className={style.actionSection}>
                    {isDanger || isWarning ? (
                      <button
                        className={`${style.alertBtn} ${hasNotified ? style.btnDisabled : ''}`}
                        // disabled={true}
                        onClick={() => handleAlertAndAnalysis(station)}
                      >
                        {hasNotified ? '✅ 预警已下发' : '🚨 发布预警并分析周边'}
                      </button>
                    ) : (
                      <button style={{ color: 'white' }}>查看站点详情</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className={style.panelFooter}>
            <button
              onClick={() => {
                setSelectedStations([])
                highlightSourceRef.current.clear()
              }}
            >
              清除框选
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className={style.chartContainer}>
            <WindDistributionChart data={chartData} />
          </div>
          <div className={style.trendContainer}>
            <WindTrendChart data={trendData} />
          </div>
        </div>
      )}
      <DistrictInsightPanel
        districtName={selectedDistrict}
        windDetail={activeDetail}
        weatherNow={weatherNow}
        weatherMeta={weatherMeta}
        weatherLoading={weatherLoading}
        floodRiskSummary={floodRiskSummary}
      />
      {/* 时间轴组件 */}
      <TimeMachine onTimeChange={onTimeChange} />
    </>
  )
}

export default MapComponent
