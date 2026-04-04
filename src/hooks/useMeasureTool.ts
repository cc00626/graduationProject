import { useCallback, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type Feature from 'ol/Feature'
import type Geometry from 'ol/geom/Geometry'
import type LineString from 'ol/geom/LineString'
import type Map from 'ol/Map'
import type { EventsKey } from 'ol/events'
import Draw from 'ol/interaction/Draw'
import VectorLayer from 'ol/layer/Vector'
import Overlay from 'ol/Overlay'
import { unByKey } from 'ol/Observable'
import VectorSource from 'ol/source/Vector'
import { getLength } from 'ol/sphere'
import { Style, Stroke } from 'ol/style'

export const useMeasureTool = (mapRef: RefObject<Map | null>) => {
  const [isMeasuring, setIsMeasuring] = useState(false)

  const source = useMemo(() => new VectorSource<Feature<Geometry>>(), [])
  const sourceRef = useRef<VectorSource<Feature<Geometry>>>(source)

  const vector = useMemo(
    () =>
      new VectorLayer<VectorSource<Feature<Geometry>>>({
        source,
        style: new Style({
          stroke: new Stroke({ color: '#ffcc33', width: 3, lineDash: [10, 10] }),
        }),
        zIndex: 999,
      }),
    [source],
  )
  const vectorRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>>>(vector)

  const drawRef = useRef<Draw | null>(null)

  // 开始测量距离
  const startMeasure = () => {
    const mapInstance = mapRef.current
    if (!mapInstance) return

    // 确保图层已添加
    if (!mapInstance.getLayers().getArray().includes(vectorRef.current)) {
      mapInstance.addLayer(vectorRef.current)
    }

    const draw = new Draw({
      source: sourceRef.current,
      type: 'LineString',
      style: new Style({
        stroke: new Stroke({ color: 'rgba(0, 210, 255, 0.8)', width: 2, lineDash: [10, 10] }),
      }),
    })

    drawRef.current = draw
    mapInstance.addInteraction(draw)
    setIsMeasuring(true)

    let measureTooltipElement: HTMLDivElement | null = null
    let measureTooltip: Overlay | null = null
    let listener: EventsKey | undefined

    draw.on('drawstart', evt => {
      const sketch = evt.feature

      measureTooltipElement = document.createElement('div')
      measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure'
      measureTooltip = new Overlay({
        element: measureTooltipElement,
        offset: [0, -15],
        positioning: 'bottom-center',
        stopEvent: false,
      })
      mapInstance.addOverlay(measureTooltip)

      const geometry = sketch.getGeometry()
      if (!geometry) return

      listener = geometry.on('change', e => {
        const geom = e.target as LineString
        const length = getLength(geom)
        const output = length > 1000 ? `${(length / 1000).toFixed(2)} km` : `${Math.round(length)} m`

        if (measureTooltipElement) {
          measureTooltipElement.innerHTML = output
        }
        if (measureTooltip) {
          measureTooltip.setPosition(geom.getLastCoordinate())
        }
      })
    })

    draw.on('drawend', () => {
      if (measureTooltipElement) {
        measureTooltipElement.className = 'ol-tooltip ol-tooltip-static'
      }
      if (measureTooltip) {
        measureTooltip.setOffset([0, -7])
      }
      if (listener) {
        unByKey(listener)
      }
    })
  }

  // 停止并清空
  const stopMeasure = useCallback(() => {
    const mapInstance = mapRef.current
    if (!mapInstance) return

    if (drawRef.current) {
      mapInstance.removeInteraction(drawRef.current)
    }
    sourceRef.current.clear()

    const overlays = mapInstance.getOverlays().getArray()
    for (let i = overlays.length - 1; i >= 0; i--) {
      const classname = overlays[i].getElement()?.className || ''
      if (classname.includes('ol-tooltip')) {
        mapInstance.removeOverlay(overlays[i])
      }
    }

    setIsMeasuring(false)
  }, [mapRef])

  return { isMeasuring, startMeasure, stopMeasure }
}
