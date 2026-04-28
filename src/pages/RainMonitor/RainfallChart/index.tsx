import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import { Segmented } from 'antd'

const RainfallOnlyChart = () => {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  // 👇 控制时间范围
  const [range, setRange] = useState(7)

  const [data, setData] = useState<{ dates: string[]; values: number[] }>({
    dates: [],
    values: [],
  })

  // 生成日期
  const getDays = (days: number) => {
    const result: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const m = d.getMonth() + 1
      const day = d.getDate()
      result.push(`${m}-${day}`)
    }
    return result
  }

  // 模拟请求（你以后换成真实接口）
  const fetchData = async (days: number) => {
    const dates = getDays(days)

    const values = dates.map(() => Number((Math.random() * (days === 7 ? 15 : 20)).toFixed(1)))

    setData({ dates, values })
  }

  // 👇 当 range 改变时重新加载数据
  useEffect(() => {
    fetchData(range)
  }, [range])

  // 初始化 + 更新图表
  useEffect(() => {
    if (!chartRef.current) return

    let chart = chartInstanceRef.current

    if (!chart) {
      chart = echarts.init(chartRef.current)
      chartInstanceRef.current = chart
    }

    const option = {
      backgroundColor: 'rgba(255, 255, 255, 0.85)',

      title: {
        text: `广州近${range}天平均降水量 (mm)`,
        left: 'center',
        top: 15,
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
          color: '#2c3e50',
        },
      },

      tooltip: {
        trigger: 'axis',
        formatter: (params: Array<{ axisValue: string; data: number }>) => {
          const p = params[0]
          return `${p.axisValue}<br/>平均降水：<b>${p.data} mm</b>`
        },
      },

      grid: {
        top: '25%',
        left: '12%',
        right: '12%',
        bottom: '15%',
      },

      xAxis: {
        type: 'category',
        data: data.dates,
        axisLine: { lineStyle: { color: '#999' } },
      },

      yAxis: {
        type: 'value',
        name: 'mm',
        splitLine: {
          lineStyle: { type: 'dashed', color: '#eee' },
        },
      },

      visualMap: {
        show: false,
        min: 0,
        max: range === 7 ? 15 : 20,
        inRange: {
          color: ['#D1E9FF', '#70B5FF', '#1890FF', '#003A8C'],
        },
      },

      series: [
        {
          name: '平均降水',
          type: 'bar',
          barWidth: range === 7 ? '45%' : '30%', // 👈 30天柱子更细
          data: data.values,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
          },
          markPoint: {
            data: [{ type: 'max', name: '最大值' }],
            symbolSize: 40,
          },
        },
      ],
    }

    chart.setOption(option)

    const handleResize = () => chart?.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [data, range])

  return (
    <div
      style={{
        width: '100%',
        background: '#fff',
        border: '1px solid #e3ebf3',
        borderRadius: '8px',
        padding: '10px 10px 4px',
        marginBottom: '14px',
      }}
    >
      {/* 👇 切换控件 */}
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <Segmented
          options={[
            { label: '近7天', value: 7 },
            { label: '近30天', value: 30 },
          ]}
          value={range}
          onChange={val => setRange(Number(val))}
        />
      </div>

      <div
        ref={chartRef}
        style={{
          width: '100%',
          height: '220px',
        }}
      />
    </div>
  )
}

export default RainfallOnlyChart
