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
      url: '/guangzhou.geojson', // 文件需放在 public 目录下
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

  return (
    <div ref={mapElement} className="map-container" style={{ width: '100%', height: '600px' }} />
  )
}

export default MapComponent
