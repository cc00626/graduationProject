import { LAYERS } from '@/constant'
import style from './index.module.scss'

type LayerManagerProps = {
  activeLayers: string[]
  onToggle: (layerId: string) => void
}

const layerOptions = [
  { id: LAYERS.DISTRICT, label: '广州区划' },
  { id: LAYERS.WATER, label: '水系图层' },
  { id: LAYERS.FLOOD_BUFFER, label: '洪涝缓冲区' },
  { id: LAYERS.RISK_POINTS, label: '风险点' },
]

const LayerManager: React.FC<LayerManagerProps> = ({ activeLayers, onToggle }) => {
  return (
    <div className={style.panel}>
      <div className={style.title}>图层管理</div>
      <div className={style.list}>
        {layerOptions.map(layer => {
          const active = activeLayers.includes(layer.id)
          return (
            <button
              key={layer.id}
              type="button"
              className={active ? style.itemActive : style.item}
              onClick={() => onToggle(layer.id)}
            >
              <span className={style.dot} />
              {layer.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default LayerManager
