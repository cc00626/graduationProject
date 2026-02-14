import React, { useEffect, useRef } from 'react'
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
}

const DISTRICT_OFFSETS = {
  越秀区: [0, -40], // 向上飘一点
  海珠区: [0, 40], // 向下飘一点
  荔湾区: [-60, 0], // 向左偏
  天河区: [60, 0], // 向右偏
}
const MapComponent = () => {
  const mapElement = useRef()
  const mapRef = useRef()

  useEffect(() => {
    class TitleControl extends Control {
      constructor(title) {
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
      style: new Style({
        stroke: new Stroke({
          color: '#3388ff', // 边界线颜色
          width: 2,
        }),
        fill: new Fill({
          color: 'rgba(51, 136, 255, 0.1)', // 填充颜色（透明蓝色）
        }),
      }),
    })

    // 4. 初始化地图实例
    const initialMap = new Map({
      target: mapElement.current,
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

    return () => initialMap.setTarget(null)
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
    let lastTime = undefined
    const overlayMap = new Map() // 用于缓存各个区的 Overlay 实例

    const startPolling = async () => {
      while (isRunning && mapRef.current) {
        try {
          const res = await getWindPoll(lastTime)
          if (!isRunning) break

          if (res.code === 0 && res.data) {
            const { districts, time } = res.data

            districts.forEach(item => {
              const name = item.district
              const coords = DISTRICT_COORDS[name]
              const offset = DISTRICT_OFFSETS[name] || [0, 0] // 默认不偏移
              if (!coords) return

              let overlay = overlayMap.get(name)
              if (!overlay) {
                const el = document.createElement('div')
                el.style.cssText = `
                  background: rgba(255, 255, 255, 0.95);
                  border: 1px solid #666;
                  padding: 4px 8px;
                  border-radius: 4px;
                  box-shadow: 2px 2px 6px rgba(0,0,0,0.3);
                  pointer-events: none;
                `
                overlay = new Overlay({
                  element: el,
                  position: fromLonLat(coords),
                  positioning: 'bottom-center',
                  offset: offset, // 向上偏移一点，避免遮挡中心点
                })
                mapRef.current.addOverlay(overlay)
                overlayMap.set(name, overlay)
              }

              // 设置四个等级的数据显示
              const counts = item.levelCounts || []
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

              overlay.getElement().innerHTML = content
            })

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
      // 清理所有已添加的 Overlay
      // overlayMap.forEach(overlay => {
      //   mapRef.current?.removeOverlay(overlay)
      // })
      // overlayMap.clear()
    }
  }, [])
  return (
    <div ref={mapElement} className="map-container" style={{ width: '100%', height: '600px' }} />
  )
}

export default MapComponent
