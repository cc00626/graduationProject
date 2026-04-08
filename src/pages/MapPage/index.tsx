import { useEffect, useRef, useState } from 'react'
import 'ol/ol.css'
import OLMap from 'ol/Map'
import View from 'ol/View'
import { FullScreen, defaults as defaultControls } from 'ol/control'
import GeoJSON from 'ol/format/GeoJSON'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import { Fill, Stroke, Style, Text } from 'ol/style'
import { BorderOutlined, ClearOutlined } from '@ant-design/icons'
import { useMeasureTool } from '@/hooks/useMeasureTool'
import { getWeatherNow, getWindPoll } from '@/services/wind'
import style from './index.module.scss'
import WindDistributionChart from './WindChart'
type WindDistrictData = {
  district: string
  levelCounts: number[]
}

type WindPollData = {
  districts?: WindDistrictData[]
}

const MapComponent = () => {
  const mapElement = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<OLMap | null>(null)
  const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const windData = useRef<WindPollData | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [chartData, setChartData] = useState<WindDistrictData[]>([])

  const getGzStyle = (feature: any) => {
    const districtName = feature.get('name')
    const data = windData.current

    // 默认样式：半透明淡蓝
    let fillColor = 'rgba(0, 120, 255, 0.15)'

    if (data?.districts) {
      const info = data.districts.find((d: any) => d.district === districtName)

      if (info && info.levelCounts) {
        const counts = info.levelCounts // [13, 0, 0, 0, 0]

        // 从高等级向低等级遍历 (从右往左)，找到第一个有数值的等级
        // 索引 4: 五级, 3: 四级, 2: 三级, 1: 二级, 0: 一级
        if (counts[4] > 0)
          fillColor = 'rgba(255, 0, 0, 0.6)' // 五级-红色
        else if (counts[3] > 0)
          fillColor = 'rgba(255, 126, 0, 0.6)' // 四级-橙色
        else if (counts[2] > 0)
          fillColor = 'rgba(255, 255, 0, 0.6)' // 三级-黄色
        else if (counts[1] > 0)
          fillColor = 'rgba(173, 255, 47, 0.6)' // 二级-黄绿
        else if (counts[0] > 0) fillColor = 'rgba(0, 191, 255, 0.4)' // 一级-浅蓝
      }
    }

    return new Style({
      stroke: new Stroke({ color: '#fff', width: 1 }),
      fill: new Fill({ color: fillColor }),
      text: new Text({
        text: districtName,
        font: 'bold 14px "Microsoft YaHei", "Helvetica Neue", sans-serif', // 优先使用雅黑，加粗
        fill: new Fill({ color: '#222' }), // 深灰色文字
        // ✨ 重点：加粗的白色光晕
        stroke: new Stroke({ color: 'rgba(255, 255, 255, 0.95)', width: 3.5 }),
        textAlign: 'center',
        textBaseline: 'middle',
        // ✨ 新增属性：防止文字重叠
        overflow: false, // 当文字超出区域边缘时不显示（虽然会导致越秀这种小区域名字消失，但能保证大图整洁）
      }),
    })
  }
  // 初始化地图
  useEffect(() => {
    const vectorSource = new VectorSource()
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: new Style({
        fill: new Fill({ color: 'rgba(0, 120, 255, 0.12)' }),
        stroke: new Stroke({ color: '#0066cc', width: 2 }),
      }),
    })

    const initialMap: OLMap = new OLMap({
      target: mapElement.current || undefined,
      layers: [new TileLayer({ source: new OSM() }), vectorLayer],
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

    const vectorSource = new VectorSource({
      url: '/广州市.geojson',
      format: new GeoJSON({
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      }),
    })

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: getGzStyle,
    })

    map.addLayer(vectorLayer)
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
      map.removeLayer(vectorLayer)
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

  const handleGetWeatherData = async () => {
    try {
      const res = await getWeatherNow('440100', 'base', 'JSON')
      console.log('天气数据：', res)
    } catch (error) {
      console.error('获取天气失败', error)
    }
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
        </div>
      </div>
      <button
        style={{ position: 'absolute', right: '30px', top: '50px', color: 'white' }}
        onClick={() => handleGetWindData()}
      >
        查看风速数据
      </button>
      <button
        style={{ position: 'absolute', right: '160px', top: '50px', color: 'white' }}
        onClick={() => handleGetWeatherData()}
      >
        查看天气数据
      </button>
      <div>
        <WindDistributionChart data={chartData} />
      </div>
    </>
  )
}

export default MapComponent
