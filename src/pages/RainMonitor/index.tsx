import { useEffect, useRef, useState } from 'react'
import 'ol/ol.css'
import { Feature, Map, View } from 'ol'
import { Point, Polygon } from 'ol/geom'
import type BaseLayer from 'ol/layer/Base'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'
import GeoJSON from 'ol/format/GeoJSON'
import { fromLonLat, toLonLat } from 'ol/proj'
import { Fill, Stroke, Style, Circle } from 'ol/style'
import * as turf from '@turf/turf'
import { getAnalysisBufferStyle, getAnalysisPointStyle } from '@/utils/map/analysisStyles'
import style from './index.module.scss'
import { getBufferAnalysis } from '@/services/rain'
const RainMonitor = () => {
  const boundaryLabel = '\u884c\u653f\u8fb9\u754c'
  const rainLayerLabel = '\u964d\u96e8\u56fe\u5c42'
  const panelTitle = '\u7f13\u51b2\u533a\u5206\u6790'
  const radiusLabel = '\u5f71\u54cd\u534a\u5f84'
  const timeLabel = '\u76d1\u6d4b\u65f6\u523b'
  const legendTitle = '\u964d\u6c34\u91cf\u9884\u62a5(mm)'

  const mapRef = useRef(null)
  const mapInstance = useRef<Map | null>(null)
  const [currentTime, setCurrentTime] = useState('10:00')
  const [bufferRadius, setBufferRadius] = useState(0.5)
  const [lastRightClickCoord, setLastRightClickCoord] = useState<{
    lonLat: number[]
    originalCoord: number[]
  } | null>(null)
  const rainSourceRef = useRef(new VectorSource())
  const [layersVisibility, setLayersVisibility] = useState({
    boundary: true,
    rain: true,
  })

  const boundaryLayerRef = useRef<BaseLayer | null>(null)
  const rainLayerRef = useRef<BaseLayer | null>(null)
  const analysisSourceRef = useRef(new VectorSource())
  const poiSourceRef = useRef(new VectorSource())
  const [pointResults, setPoiResults] = useState([])
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
    })

    const allRainFeatures = rainSourceRef.current.getFeatures()
    const trappedFeatures = allRainFeatures.filter(feature => {
      const geometry = feature.getGeometry()
      return bufferFeature.getGeometry().intersectsExtent(geometry.getExtent())
    })

    console.log('buffer hits:', trappedFeatures.length)
    analysisSourceRef.current.addFeatures([pointFeature, bufferFeature])
  }

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
      visible: layersVisibility.boundary,
      zIndex: 0,
    })

    const rainBreaks = [0.1, 1, 2.5, 5, 10, 25, 50, 80]
    const breakStyles = [
      { fill: '#d6f7c5', opacity: 0.3 },
      { fill: '#9ae77e', opacity: 0.4 },
      { fill: '#60cd65', opacity: 0.5 },
      { fill: '#5ab6ff', opacity: 0.6 },
      { fill: '#3178ff', opacity: 0.7 },
      { fill: '#7c4dff', opacity: 0.8 },
      { fill: '#d03eff', opacity: 0.9 },
    ]

    const hexToRgba = (hex: string, opacity: number) => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return `rgba(${r}, ${g}, ${b}, ${opacity})`
    }

    const rainStyle = feature => {
      const range = feature.get('precip')
      if (!range) return null

      const lowerValue = parseFloat(range.split('-')[0])
      if (lowerValue < 0.1) return null

      const styleIdx = rainBreaks.findIndex(value => value === lowerValue)
      const styleConfig = breakStyles[styleIdx]
      if (!styleConfig) return null

      return new Style({
        fill: new Fill({
          color: hexToRgba(styleConfig.fill, styleConfig.opacity),
        }),
        stroke: new Stroke({
          color: 'transparent',
          width: 0,
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
    boundaryLayerRef.current = boundaryLayer
    rainLayerRef.current = rainLayer
    mapInstance.current = new Map({
      target: mapRef.current ?? undefined,
      layers: [
        new TileLayer({ source: new OSM() }),
        boundaryLayer,
        rainLayer,
        analysisLayer,
        poiLayer,
      ],
      view: new View({
        center: fromLonLat([113.26, 23.13]),
        zoom: 9,
      }),
    })

    return () => mapInstance.current?.setTarget(undefined)
  }, [])

  useEffect(() => {
    const fetchRainData = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/rain-map-data?time=${currentTime}`)
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

    fetchRainData()
  }, [currentTime])

  useEffect(() => {
    boundaryLayerRef.current?.setVisible(layersVisibility.boundary)
    rainLayerRef.current?.setVisible(layersVisibility.rain)
  }, [layersVisibility])

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

    const handleContextMenu = event => {
      event.preventDefault()

      const pixel = map.getEventPixel(event)
      const coordinate = map.getCoordinateFromPixel(pixel)
      const lonLat = toLonLat(coordinate)

      performBufferAnalysis(lonLat, coordinate, bufferRadius)
    }

    viewport.addEventListener('contextmenu', handleContextMenu)
    return () => viewport.removeEventListener('contextmenu', handleContextMenu)
  }, [bufferRadius, currentTime])

  const handleLayerToggle = (layerName: keyof typeof layersVisibility) => {
    setLayersVisibility(prev => ({
      ...prev,
      [layerName]: !prev[layerName],
    }))
  }

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
          .getView()
          .fit(poiSourceRef.current.getExtent(), { padding: [50, 50, 50, 50], duration: 500 })
      } else {
        console.error('分析失败:', res.msg)
      }
    } catch (error) {
      console.error('接口请求异常:', error)
    }
  }
  return (
    <div className={style.mapContainer} style={{ position: 'relative' }}>
      <div ref={mapRef} style={{ width: '60%', height: '70vh' }} />
      <div>
        <label>
          <input
            type="checkbox"
            checked={layersVisibility.boundary}
            onChange={() => handleLayerToggle('boundary')}
          />
          {boundaryLabel}
        </label>
        <label>
          <input
            type="checkbox"
            checked={layersVisibility.rain}
            onChange={() => handleLayerToggle('rain')}
          />
          {rainLayerLabel}
        </label>
      </div>

      {lastRightClickCoord && (
        <div
          style={{
            position: 'absolute',
            top: '0px',
            right: '180px',
            width: '290px',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(4px)',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 100,
          }}
        >
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>{panelTitle}</h3>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>{radiusLabel}</span>
              <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{bufferRadius} km</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="50"
              step="0.5"
              value={bufferRadius}
              onChange={event => setBufferRadius(parseFloat(event.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#999',
              }}
            >
              <span>500m</span>
              <span>50km</span>
            </div>
          </div>
          <div
            style={{
              borderTop: '1px solid #eee',
              paddingTop: '15px',
              fontSize: '13px',
              color: '#666',
            }}
          >
            {/* {panelTip} */}
            <button onClick={handleBuffer}>开始分析</button>
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          left: '40%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          background: '#fff',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
          {timeLabel}: {currentTime}
        </div>
        <input
          type="range"
          min="10"
          max="12"
          step="1"
          value={currentTime.split(':')[0]}
          onChange={event => setCurrentTime(`${event.target.value}:00`)}
          style={{ width: '200px' }}
        />
      </div>

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
    </div>
  )
}

export default RainMonitor
