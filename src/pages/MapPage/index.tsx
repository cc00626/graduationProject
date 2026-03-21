import { useEffect, useRef } from 'react'
import 'ol/ol.css'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import { fromLonLat } from 'ol/proj'

// --- 1. 核心引入：处理矢量数据和样式 ---
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import { Style, Fill, Stroke } from 'ol/style'
import Control from 'ol/control/Control'
import Overlay from 'ol/Overlay'
import { getWindPoll } from '@/services/wind'
const DISTRICT_COORDS = {
  从化区: [113.587386, 23.545283],
  白云区: [113.262831, 23.162281],
  花都区: [113.211184, 23.39205], //
  黄埔区: [113.450761, 23.103239],
  越秀区: [113.280714, 23.125624], //
  海珠区: [113.262008, 23.103131], //
  荔湾区: [113.243038, 23.124943], //
  天河区: [113.335367, 23.13559], //
  增城区: [113.829579, 23.290497],
  番禺区: [113.364619, 22.938582],
  南沙区: [113.53738, 22.794531],
} as const
type DistrictName = keyof typeof DISTRICT_COORDS
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

const CARD_SIZE = {
  width: 150,
  height: 84,
}

const DISTRICT_CARD_OFFSETS: Partial<Record<DistrictName, [number, number]>> = {
  越秀区: [-175, -120],
  海珠区: [-130, 88],
  荔湾区: [-235, -18],
  天河区: [130, -64],
  白云区: [-85, -190],
  黄埔区: [205, 18],
  花都区: [-95, -86],
  番禺区: [95, 44],
}

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

const defaultDistrictStyle = new Style({
  stroke: new Stroke({
    color: '#3388ff',
    width: 2,
  }),
  fill: new Fill({
    color: 'rgba(51, 136, 255, 0.1)',
  }),
})

const activeDistrictStyle = new Style({
  stroke: new Stroke({
    color: '#ff5a36',
    width: 3,
  }),
  fill: new Fill({
    color: 'rgba(255, 90, 54, 0.22)',
  }),
})

const MapComponent = () => {
  const mapElement = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Map | null>(null)
  const districtCentersRef = useRef<Partial<Record<DistrictName, [number, number]>>>({})
  const windDataRef = useRef<Partial<Record<DistrictName, number[]>>>({})
  const selectedDistrictRef = useRef<DistrictName | null>(null)
  const selectedOverlayRef = useRef<Overlay | null>(null)

  const renderDistrictOverlay = (name: DistrictName) => {
    const map = mapRef.current
    if (!map) return

    const coords = districtCentersRef.current[name] || DISTRICT_COORDS[name]
    const [offsetX, offsetY] = DISTRICT_CARD_OFFSETS[name] || [140, -70]
    const connectorStyle = getConnectorStyle(offsetX, offsetY)
    const counts = windDataRef.current[name] || [0, 0, 0, 0]
    const colors = ['#2E7D32', '#FBC02D', '#EF6C00', '#C62828']
    const content = `
      <div style="font-size: 12px; line-height: 1.4;">
        <div style="font-weight: bold; color: #333; border-bottom: 1px solid #eee;">${name}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; margin-top: 2px;">
          <span style="color: ${colors[0]}">1级: ${counts[0] || 0}</span>
          <span style="color: ${colors[1]}">2级: ${counts[1] || 0}</span>
          <span style="color: ${colors[2]}">3级: ${counts[2] || 0}</span>
          <span style="color: ${colors[3]}">4级: ${counts[3] || 0}</span>
        </div>
      </div>
    `

    let overlay = selectedOverlayRef.current
    if (!overlay) {
      const wrapper = document.createElement('div')
      wrapper.style.cssText = 'position: relative; width: 0; height: 0; pointer-events: none;'

      const anchor = document.createElement('div')
      anchor.style.cssText = `
        position: absolute;
        left: -3px;
        top: -3px;
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: #243553;
      `

      const connector = document.createElement('div')
      connector.className = 'wind-connector'
      connector.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        height: 1.5px;
        transform-origin: 0 0;
        background: rgba(36, 53, 83, 0.55);
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
        border: 1px solid #4f6b99;
        padding: 6px 8px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
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

  useEffect(() => {
    class TitleControl extends Control {
      constructor(title: string) {
        const element = document.createElement('div')
        element.className = 'map-title'
        element.innerHTML = title
        element.style.cssText = `
      background: rgba(255,255,255,0.8);
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: bold;
    `
        super({ element })
      }
    }

    // --- 2. 创建矢量数据源，加载 JSON 文件 ---
    const vectorSource = new VectorSource({
      url: '/广州市.geojson', // 文件需放在 public 目录下
      format: new GeoJSON(),
    })

    // --- 3. 创建矢量图层并设置样式 ---
    const guangzhouLayer = new VectorLayer({
      source: vectorSource,
      style: feature => {
        const rawName = feature.get('name')
        const featureName = typeof rawName === 'string' ? resolveDistrictName(rawName) : null
        if (featureName && selectedDistrictRef.current === featureName) {
          return activeDistrictStyle
        }
        return defaultDistrictStyle
      },
    })

    // 4. 初始化地图实例
    const initialMap = new Map({
      target: mapElement.current ?? undefined,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        guangzhouLayer, // --- 5. 将 JSON 图层添加到地图中 ---
      ],
      view: new View({
        center: fromLonLat([113.2644, 23.1291]),
        zoom: 9, // 调整缩放级别以适应广州全市范围
      }),
    })
    initialMap.addControl(new TitleControl('广州市地图'))
    mapRef.current = initialMap

    initialMap.on('click', event => {
      const feature = initialMap.forEachFeatureAtPixel(event.pixel, currentFeature => currentFeature)
      if (!feature) {
        selectedDistrictRef.current = null
        guangzhouLayer.changed()
        return
      }
      const rawName = feature.get('name')
      if (typeof rawName !== 'string') {
        selectedDistrictRef.current = null
        guangzhouLayer.changed()
        return
      }
      const name = resolveDistrictName(rawName)
      if (!name) {
        selectedDistrictRef.current = null
        guangzhouLayer.changed()
        return
      }
      selectedDistrictRef.current = name
      guangzhouLayer.changed()
      renderDistrictOverlay(name)
    })

    // 优先使用 geojson 中每个区的 center 作为连线锚点
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

    return () => initialMap.setTarget(undefined)
  }, [])

  // 在这里添加轮询逻辑
  // useEffect(() => {
  //   let isRunning = true
  //   let lastTime = undefined
  //   const overlayMap = new Map()
  //   const startPolling = async () => {
  //     // 循环条件：组件未卸载 且 地图实例已存在
  //     while (isRunning && mapRef.current) {
  //       try {
  //         // 1. 调用你之前定义的 getWindPoll 接口
  //         const res = await getWindPoll(lastTime)

  //         // 如果请求期间组件卸载了，直接退出
  //         if (!isRunning) break

  //         if (res.code === 0 && res.data) {
  //           console.log('监听到新风速:', res.data)
  //           const { district, time } = res.data
  //           // 2. 这里处理数据逻辑（比如更新地图上的覆盖物或文字）
  //           // 示例：如果你想在控制台打印或更新某个 state
  //           // updateMyMapData(res.data);

  //           // 3. 更新时间戳基准
  //           lastTime = res.data.time
  //         }
  //       } catch (error) {
  //         console.error('轮询出错:', error)
  //         // 出错时等待 5 秒再试，防止 ERR_CONNECTION_REFUSED 刷屏
  //         await new Promise(resolve => setTimeout(resolve, 5000))
  //       }
  //     }
  //   }

  //   // 启动轮询
  //   startPolling()

  //   // 清理函数：组件卸载时停止轮询
  //   return () => {
  //     isRunning = false
  //   }
  // }, []) // 依赖为空，表示只在挂载后执行一次

  useEffect(() => {
    let isRunning = true
    let lastTime: string | undefined = undefined

    const startPolling = async () => {
      while (isRunning && mapRef.current) {
        try {
          const res = (await getWindPoll(lastTime)) as unknown as WindPollResponse
          if (!isRunning) break

          if (res.code === 0 && res.data) {
            const { districts, time } = res.data
            districts.forEach(item => {
              const name = resolveDistrictName(item.district)
              if (!name) return
              windDataRef.current[name] = item.levelCounts || [0, 0, 0, 0]
            })

            if (selectedDistrictRef.current) {
              renderDistrictOverlay(selectedDistrictRef.current)
            }
            lastTime = time
          }
        } catch (error) {
          console.error('轮询出错:', error)
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
  return (
    <div ref={mapElement} className="map-container" style={{ width: '100%', height: '600px' }} />
  )
}

export default MapComponent
