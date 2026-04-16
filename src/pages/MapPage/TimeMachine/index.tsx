import React, { useState, useEffect } from 'react'
import { Slider, Button, Tooltip } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons'
import style from './TimeMachine.module.scss' // 确保你有对应的样式文件

interface TimeMachineProps {
  onTimeChange: (index: number) => void
}

const TimeMachine: React.FC<TimeMachineProps> = ({ onTimeChange }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [timeIndex, setTimeIndex] = useState(24) // 默认指向最新的第24小时

  // 生成过去24小时的时间标签 (00:00, 01:00 ... 24:00)
  const timeLabels = Array.from({ length: 25 }, (_, i) => {
    return i < 10 ? `0${i}:00` : `${i}:00`
  })

  // 播放逻辑
  useEffect(() => {
    let timer: any
    if (isPlaying) {
      timer = setInterval(() => {
        setTimeIndex(prev => {
          if (prev >= 24) {
            setIsPlaying(false) // 播放到最后自动停止
            return 24
          }
          return prev + 1
        })
      }, 1000) // 1秒步进一次
    }
    return () => clearInterval(timer)
  }, [isPlaying])

  // 当索引变化时，通知父组件（地图）
  useEffect(() => {
    onTimeChange(timeIndex)
  }, [timeIndex, onTimeChange])

  return (
    <div className={style.timeMachineWrapper}>
      <div className={style.controlPanel}>
        <Tooltip title={isPlaying ? '暂停' : '播放历史演变'}>
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={() => setIsPlaying(!isPlaying)}
            className={style.playBtn}
          />
        </Tooltip>

        <div className={style.sliderContent}>
          <div className={style.timeInfo}>
            <span className={style.dateText}>2026-04-16</span>
            <span className={style.timeText}>{timeLabels[timeIndex]}</span>
          </div>

          <Slider
            min={0}
            max={24}
            step={1}
            value={timeIndex}
            onChange={val => setTimeIndex(val)}
            tooltip={{
              formatter: val => `时刻: ${timeLabels[val ?? 0]}`,
              open: isPlaying ? false : undefined, // 播放时隐藏 tooltip 避免闪烁
            }}
            marks={{
              0: '00:00',
              6: '06:00',
              12: '12:00',
              18: '18:00',
              24: '现在',
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default TimeMachine
