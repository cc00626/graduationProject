import { type FC, useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import {
  AlertOutlined,
  CloudOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Empty,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import style from './index.module.scss'
import { getAmapDashboard, type AmapDashboardPayload } from '@/services/dashboard'
import { getRainMonitor, type RainMonitorData } from '@/services/rain'
import { getWarnings, type WarningRecord } from '@/services/warning'

const { Title, Text } = Typography

const warningLevelText: Record<WarningRecord['level'], string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
}

const warningLevelColor: Record<WarningRecord['level'], string> = {
  low: 'blue',
  medium: 'orange',
  high: 'red',
}

const statusText: Record<WarningRecord['status'], string> = {
  draft: '草稿',
  published: '已发布',
  resolved: '已解除',
  archived: '已归档',
}

const statusColor: Record<WarningRecord['status'], string> = {
  draft: 'default',
  published: 'green',
  resolved: 'blue',
  archived: 'default',
}

const chartPalette = ['#1677ff', '#13c2c2', '#faad14', '#ff7a45', '#f5222d', '#722ed1', '#52c41a']

const riskColor = (risk: number) => {
  if (risk >= 70) return 'red'
  if (risk >= 40) return 'orange'
  return 'green'
}

const formatTime = (value?: string) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

const getCastTempText = (day?: string, night?: string) => {
  if (!day && !night) return '--'
  if (day === night) return `${day}°C`
  return `${night || '--'} / ${day || '--'}°C`
}

const countBy = <T,>(items: T[], getKey: (item: T) => string) =>
  items.reduce<Record<string, number>>((result, item) => {
    const key = getKey(item) || '未知'
    result[key] = (result[key] || 0) + 1
    return result
  }, {})

const createPieData = (data: Record<string, number>) =>
  Object.entries(data).map(([name, value]) => ({ name, value }))

const ChartBlock = ({
  option,
  loading,
  empty,
  height = 300,
}: {
  option: EChartsOption
  loading?: boolean
  empty?: boolean
  height?: number
}) => {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (loading || empty || !chartRef.current || chartInstanceRef.current) return

    chartInstanceRef.current = echarts.init(chartRef.current)
    const handleResize = () => chartInstanceRef.current?.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstanceRef.current?.dispose()
      chartInstanceRef.current = null
    }
  }, [empty, loading])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart || empty) return
    chart.setOption(option, true)
    window.setTimeout(() => chart.resize(), 0)
  }, [empty, option])

  if (loading) {
    return <Skeleton active paragraph={{ rows: 7 }} title={false} />
  }

  if (empty) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无图表数据" />
  }

  return <div ref={chartRef} className={style.chart} style={{ height }} />
}

const DashBoard: FC = () => {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [amapData, setAmapData] = useState<AmapDashboardPayload | null>(null)
  const [rainData, setRainData] = useState<RainMonitorData | null>(null)
  const [warnings, setWarnings] = useState<WarningRecord[]>([])
  const [warningTotal, setWarningTotal] = useState(0)

  const loadData = async (silent = false) => {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const [amapRes, rainRes, warningRes] = await Promise.allSettled([
        getAmapDashboard(),
        getRainMonitor('1h', ''),
        getWarnings({ page: 1, pageSize: 8 }),
      ])

      if (amapRes.status === 'fulfilled' && amapRes.value.success) {
        setAmapData(amapRes.value.data)
      } else {
        const reason = amapRes.status === 'rejected' ? amapRes.reason : amapRes.value.msg
        console.error('amap dashboard failed:', reason)
        message.warning('高德看板数据暂时不可用，请检查后端 AMAP_WEATHER_API_KEY')
      }

      if (rainRes.status === 'fulfilled' && rainRes.value.success) {
        setRainData(rainRes.value.data)
      }

      if (warningRes.status === 'fulfilled' && warningRes.value.code === 0) {
        setWarnings(warningRes.value.data.items)
        setWarningTotal(warningRes.value.data.total)
      }
    } catch (error) {
      console.error('dashboard load failed:', error)
      message.error('看板数据加载失败，请稍后重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadData()
    const timer = window.setInterval(
      () => {
        void loadData(true)
      },
      5 * 60 * 1000,
    )

    return () => window.clearInterval(timer)
  }, [])

  const districts = amapData?.districts || []
  const activeWarnings = warnings.filter(item => item.status === 'published')
  const hottestDistrict = useMemo(
    () => [...districts].sort((a, b) => b.temperature - a.temperature)[0],
    [districts],
  )
  const riskDistricts = useMemo(() => [...districts].sort((a, b) => b.risk - a.risk), [districts])
  const rainDistricts = useMemo(
    () => [...(rainData?.districts || [])].sort((a, b) => b.max - a.max),
    [rainData?.districts],
  )

  const riskTrendOption = useMemo<EChartsOption>(() => {
    const sorted = [...districts].sort((a, b) => b.risk - a.risk)

    return {
      color: ['#f5222d', '#ff7a45', '#1677ff'],
      tooltip: { trigger: 'axis' },
      legend: { top: 0, right: 6, textStyle: { color: '#64748b' } },
      grid: { top: 50, right: 42, bottom: 42, left: 44, containLabel: true },
      xAxis: {
        type: 'category',
        data: sorted.map(item => item.district),
        axisTick: { show: false },
        axisLabel: { color: '#64748b' },
        axisLine: { lineStyle: { color: '#d8e3ee' } },
      },
      yAxis: [
        {
          type: 'value',
          name: '风险/温度',
          axisLabel: { color: '#64748b' },
          splitLine: { lineStyle: { color: '#edf2f7' } },
        },
        {
          type: 'value',
          name: '湿度',
          max: 100,
          axisLabel: { color: '#64748b', formatter: '{value}%' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '综合风险',
          type: 'bar',
          barWidth: 18,
          data: sorted.map(item => item.risk),
          itemStyle: { borderRadius: [6, 6, 0, 0] },
        },
        {
          name: '温度',
          type: 'line',
          smooth: true,
          symbolSize: 8,
          data: sorted.map(item => item.temperature),
        },
        {
          name: '湿度',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbolSize: 8,
          data: sorted.map(item => item.humidity),
        },
      ],
    }
  }, [districts])

  const rainOption = useMemo<EChartsOption>(() => {
    const topRain = rainDistricts.slice(0, 8).reverse()

    return {
      color: ['#1677ff', '#13c2c2'],
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, right: 6, textStyle: { color: '#64748b' } },
      grid: { top: 42, right: 28, bottom: 24, left: 72, containLabel: true },
      xAxis: {
        type: 'value',
        name: 'mm',
        axisLabel: { color: '#64748b' },
        splitLine: { lineStyle: { color: '#edf2f7' } },
      },
      yAxis: {
        type: 'category',
        data: topRain.map(item => item.district),
        axisTick: { show: false },
        axisLabel: { color: '#64748b' },
        axisLine: { lineStyle: { color: '#d8e3ee' } },
      },
      series: [
        {
          name: '平均雨量',
          type: 'bar',
          data: topRain.map(item => item.avg),
          itemStyle: { borderRadius: [0, 6, 6, 0] },
        },
        {
          name: '最大雨量',
          type: 'bar',
          data: topRain.map(item => item.max),
          itemStyle: { borderRadius: [0, 6, 6, 0] },
        },
      ],
    }
  }, [rainDistricts])

  const windOption = useMemo<EChartsOption>(() => {
    const windData = createPieData(countBy(districts, item => item.winddirection))

    return {
      color: chartPalette,
      tooltip: { trigger: 'item' },
      legend: { type: 'scroll', bottom: 0, textStyle: { color: '#64748b' } },
      series: [
        {
          name: '风向区县数',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '46%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: '#fff', borderWidth: 2 },
          label: { formatter: '{b}\n{c}区', color: '#334155' },
          data: windData,
        },
      ],
    }
  }, [districts])

  const forecastOption = useMemo<EChartsOption>(() => {
    const casts = amapData?.city.forecast?.casts || []

    return {
      color: ['#ff7a45', '#1677ff'],
      tooltip: { trigger: 'axis' },
      legend: { top: 0, right: 6, textStyle: { color: '#64748b' } },
      grid: { top: 42, right: 24, bottom: 32, left: 38, containLabel: true },
      xAxis: {
        type: 'category',
        data: casts.map(item => item.date.slice(5)),
        boundaryGap: false,
        axisTick: { show: false },
        axisLabel: { color: '#64748b' },
        axisLine: { lineStyle: { color: '#d8e3ee' } },
      },
      yAxis: {
        type: 'value',
        name: '°C',
        axisLabel: { color: '#64748b' },
        splitLine: { lineStyle: { color: '#edf2f7' } },
      },
      series: [
        {
          name: '白天温度',
          type: 'line',
          smooth: true,
          areaStyle: { color: 'rgba(255, 122, 69, 0.16)' },
          data: casts.map(item => Number(item.daytemp)),
        },
        {
          name: '夜间温度',
          type: 'line',
          smooth: true,
          areaStyle: { color: 'rgba(22, 119, 255, 0.12)' },
          data: casts.map(item => Number(item.nighttemp)),
        },
      ],
    }
  }, [amapData?.city.forecast?.casts])

  const warningOption = useMemo<EChartsOption>(() => {
    const levelData = createPieData(countBy(warnings, item => warningLevelText[item.level]))
    const typeData = createPieData(
      countBy(warnings, item => {
        if (item.type === 'rain') return '暴雨'
        if (item.type === 'flood') return '内涝'
        return '台风'
      }),
    )

    return {
      color: chartPalette,
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: '#64748b' } },
      series: [
        {
          name: '预警等级',
          type: 'pie',
          selectedMode: 'single',
          radius: [0, '34%'],
          center: ['50%', '44%'],
          label: { position: 'inner', formatter: '{b}' },
          data: levelData,
        },
        {
          name: '预警类型',
          type: 'pie',
          radius: ['48%', '68%'],
          center: ['50%', '44%'],
          itemStyle: { borderColor: '#fff', borderWidth: 2 },
          label: { formatter: '{b} {c}', color: '#334155' },
          data: typeData,
        },
      ],
    }
  }, [warnings])

  const radarOption = useMemo<EChartsOption>(() => {
    const highRisk = riskDistricts[0]

    return {
      color: ['#1677ff'],
      tooltip: { trigger: 'item' },
      radar: {
        center: ['50%', '52%'],
        radius: '66%',
        splitNumber: 4,
        axisName: { color: '#334155' },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
        splitArea: { areaStyle: { color: ['#f8fafc', '#ffffff'] } },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        indicator: [
          { name: '风险', max: 100 },
          { name: '温度', max: 45 },
          { name: '湿度', max: 100 },
          { name: '风力', max: 12 },
          { name: '雨量', max: Math.max(rainData?.maxPrecip || 100, 100) },
        ],
      },
      series: [
        {
          name: highRisk?.district || '最高风险区',
          type: 'radar',
          symbol: 'circle',
          symbolSize: 7,
          areaStyle: { color: 'rgba(22, 119, 255, 0.18)' },
          lineStyle: { width: 2 },
          data: [
            {
              name: highRisk?.district || '最高风险区',
              value: [
                highRisk?.risk || 0,
                highRisk?.temperature || 0,
                highRisk?.humidity || 0,
                highRisk?.windLevel || 0,
                rainData?.maxPrecip || 0,
              ],
            },
          ],
        },
      ],
    }
  }, [rainData?.maxPrecip, riskDistricts])

  const warningColumns: ColumnsType<WarningRecord> = [
    { title: '标题', dataIndex: 'title', ellipsis: true },
    {
      title: '等级',
      dataIndex: 'level',
      width: 88,
      render: (level: WarningRecord['level']) => (
        <Tag color={warningLevelColor[level]}>{warningLevelText[level]}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 88,
      render: (status: WarningRecord['status']) => (
        <Tag color={statusColor[status]}>{statusText[status]}</Tag>
      ),
    },
  ]

  const tabItems = [
    {
      key: 'weather',
      label: '实况天气',
      children: (
        <div className={style.tabGridThree}>
          <Card title="区县风险、温度与湿度" className={style.card}>
            <ChartBlock option={riskTrendOption} loading={loading} empty={!districts.length} />
          </Card>
          <Card title="风向分布" className={style.card}>
            <ChartBlock option={windOption} loading={loading} empty={!districts.length} />
          </Card>
          <Card title="未来温度趋势" className={style.card}>
            <ChartBlock
              option={forecastOption}
              loading={loading}
              empty={!amapData?.city.forecast?.casts.length}
            />
          </Card>
        </div>
      ),
    },
    {
      key: 'rain',
      label: '降雨监测',
      children: (
        <div className={style.tabGridSingle}>
          <Card title="降雨强度区县排行" className={style.card}>
            <ChartBlock
              option={rainOption}
              loading={loading}
              empty={!rainDistricts.length}
              height={320}
            />
          </Card>
        </div>
      ),
    },
    {
      key: 'warning',
      label: '预警风险',
      children: (
        <div className={style.tabGridTwo}>
          <Card title="预警类型与等级" className={style.card}>
            <ChartBlock
              option={warningOption}
              loading={loading}
              empty={!warnings.length}
              height={320}
            />
          </Card>
          <Card title="最新预警" className={style.card}>
            {loading ? (
              <Skeleton active paragraph={{ rows: 4 }} title={false} />
            ) : warnings.length ? (
              <Table
                rowKey="_id"
                columns={warningColumns}
                dataSource={warnings}
                pagination={false}
                size="small"
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无预警" />
            )}
          </Card>
        </div>
      ),
    },
    {
      key: 'detail',
      label: '预报明细',
      children: (
        <div className={style.tabGridTwo}>
          <Card title="最高风险区雷达" className={style.card}>
            <ChartBlock option={radarOption} loading={loading} empty={!riskDistricts.length} />
          </Card>
          <Card title="高德天气预报" className={style.card}>
            {amapData?.city.forecast?.casts.length ? (
              <div className={style.forecastList}>
                {amapData.city.forecast.casts.slice(0, 4).map(item => (
                  <div key={item.date} className={style.forecastItem}>
                    <div>
                      <strong>{item.date}</strong>
                      <span>周{item.week}</span>
                    </div>
                    <b>{getCastTempText(item.daytemp, item.nighttemp)}</b>
                    <em>
                      {item.dayweather} / {item.nightweather}
                    </em>
                    <small>
                      {item.daywind}风 {item.daypower}级
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无高德预报" />
            )}
          </Card>
          <Card title="区级实况明细" className={style.card}>
            <div className={style.districtGrid}>
              {riskDistricts.map(item => (
                <div key={item.adcode} className={style.districtCard}>
                  <strong>{item.district}</strong>
                  <Tag color={riskColor(item.risk)}>{item.risk} 分</Tag>
                  <span>{item.weather}</span>
                  <b>{item.temperature}°C</b>
                  <em>
                    {item.winddirection}风 {item.windpower}级 · 湿度 {item.humidity}%
                  </em>
                </div>
              ))}
            </div>
          </Card>
          {/* <Card title="接口联动" className={style.card}>
            <div className={style.sourceList}>
              <Tag color={amapData?.summary.failed ? 'orange' : 'green'}>高德实况 {districts.length} 区</Tag>
              <Tag color={riskColor(amapData?.summary.maxRiskDistrict?.risk || 0)}>
                最高风险 {amapData?.summary.maxRiskDistrict?.district || '--'}
              </Tag>
              {(amapData?.sourceApis || []).map(item => <Tag key={item}>{item}</Tag>)}
              <Tag icon={<CloudOutlined />}>/api/rain/monitor</Tag>
              <Tag icon={<AlertOutlined />}>/api/warnings</Tag>
            </div>
          </Card> */}
        </div>
      ),
    },
  ]

  return (
    <div className={style.page}>
      <div className={style.header}>
        <div>
          <Title level={2}>综合看板</Title>
          <Text type="secondary">汇聚高德实况、降水监测和预警发布数据，形成全市气象风险态势。</Text>
        </div>
        <Space>
          <Text type="secondary">
            {amapData ? `高德更新 ${formatTime(amapData.generatedAt)}` : '等待高德数据'}
          </Text>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={refreshing}
            onClick={() => void loadData(true)}
          >
            刷新
          </Button>
        </Space>
      </div>

      <div className={style.metricGrid}>
        <Card className={style.metricCard}>
          <Statistic
            title="区级实况"
            value={amapData?.summary.districtCount ?? 0}
            suffix="区"
            prefix={<EnvironmentOutlined className={style.metricIcon} />}
          />
          <Text type="secondary">{amapData?.source || '高德开放平台'}</Text>
        </Card>
        <Card className={style.metricCard}>
          <Statistic
            title="平均温度"
            value={amapData?.summary.avgTemperature ?? 0}
            suffix="°C"
            prefix={<DashboardOutlined className={style.metricIcon} />}
          />
          <Text type="secondary">
            最高 {hottestDistrict?.district || '--'} {hottestDistrict?.temperature ?? '--'}°C
          </Text>
        </Card>
        <Card className={style.metricCard}>
          <Statistic
            title="最大风力"
            value={amapData?.summary.maxWindDistrict?.windLevel ?? 0}
            suffix="级"
            prefix={<ThunderboltOutlined className={style.metricIcon} />}
          />
          <Text type="secondary">{amapData?.summary.maxWindDistrict?.district || '--'}</Text>
        </Card>
        <Card className={style.metricCard}>
          <Statistic
            title="活跃预警"
            value={activeWarnings.length}
            suffix="条"
            prefix={<AlertOutlined className={style.metricIcon} />}
          />
          <Text type="secondary">预警总数 {warningTotal} 条</Text>
        </Card>
        <Card className={style.metricCard}>
          <Statistic
            title="监测站点"
            value={rainData?.stationCount ?? 0}
            suffix="个"
            prefix={<CloudOutlined className={style.metricIcon} />}
          />
          <Text type="secondary">最大雨量 {rainData?.maxPrecip ?? '--'} mm</Text>
        </Card>
      </div>

      <Card className={style.tabsCard}>
        <Tabs defaultActiveKey="weather" destroyOnHidden items={tabItems} />
      </Card>
    </div>
  )
}

export default DashBoard
