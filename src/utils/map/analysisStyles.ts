import { Fill, Icon, Stroke, Style } from 'ol/style'

const pointIconSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <path fill="#ff4d4f" d="M14 2C9.582 2 6 5.582 6 10c0 5.577 6.302 12.812 7.334 13.967a.9.9 0 0 0 1.332 0C15.698 22.812 22 15.577 22 10c0-4.418-3.582-8-8-8z"/>
    <circle cx="14" cy="10" r="3.2" fill="#fff"/>
  </svg>
`

const pointIconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pointIconSvg)}`

const pointMarkerStyle = new Style({
  image: new Icon({
    src: pointIconUrl,
    anchor: [0.5, 1],
    anchorXUnits: 'fraction',
    anchorYUnits: 'fraction',
  }),
})

const bufferAreaStyle = new Style({
  fill: new Fill({
    color: 'rgba(255, 77, 79, 0.12)',
  }),
  stroke: new Stroke({
    color: '#ff4d4f',
    width: 2,
    lineDash: [6, 4],
  }),
})

export const getAnalysisPointStyle = () => pointMarkerStyle

export const getAnalysisBufferStyle = () => bufferAreaStyle
