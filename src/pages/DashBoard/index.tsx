import { type FC, useEffect, useMemo, useState } from 'react'
import {
  AlertOutlined,
  CloudOutlined,
  DashboardOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Button, Card, Col, Empty, Row, Skeleton, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import OlRiskMap from './components/OlRiskMap'
import style from './index.module.scss'
import { getRainMonitor, type RainMonitorData, type RainTopStation } from '@/services/rain'
import { getWarnings, type WarningRecord } from '@/services/warning'
import { getWindHistory, type WindHistoryItem } from '@/services/wind'

type RiskLevel = 1 | 2 | 3

type ThresholdItem = {
  key: string
  name: string
  value: number
  color: string
}

const { Title, Text } = Typography

const districtRiskFallback = {
  荔湾区: 1,
  越秀区: 1,
  海珠区: 1,
  天河区: 1,
  白云区: 1,
  黄埔区: 1,
  番禺区: 1,
  花都区: 1,
  南沙区: 1,
  从化区: 1,
  增城区: 1,
} as Record<string, RiskLevel>

const getWindValue = (item?: WindHistoryItem) => {
  const maxWind = item?.maxWind
  if (typeof maxWind === 'number') return maxWind
  return maxWind?.value ?? 0
}

const getWindStation = (item?: WindHistoryItem) => {
  const maxWind = item?.maxWind
  if (typeof maxWind === 'object') return maxWind.station || '暂无站点'
  return item?.maxStation || item?.stationName || item?.station || '暂无站点'
}

const getRiskByPrecip = (value: number): RiskLevel => {
  if (value >= 50) return 3
  if (value >= 25) return 2
  return 1
}

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

const DashBoard: FC = () => {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [rainData, setRainData] = useState<RainMonitorData | null>(null)
  const [warnings, setWarnings] = useState<WarningRecord[]>([])
  const [warningTotal, setWarningTotal] = useState(0)
  const [windHistory, setWindHistory] = useState<WindHistoryItem[]>([])
  const [lastUpdated, setLastUpdated] = useState('')

  const loadData = async (silent = false) => {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const [rainRes, warningRes, windRes] = await Promise.all([
        getRainMonitor('1h', ''),
        getWarnings({ page: 1, pageSize: 6 }),
        getWindHistory({ page: 1, pageSize: 1 }),
      ])

      if (rainRes.success) {
        setRainData(rainRes.data)
      }

      if (warningRes.code === 0) {
        setWarnings(warningRes.data.items)
        setWarningTotal(warningRes.data.total)
      }

      const windSuccess =
        windRes.code === 0 || (windRes as unknown as { success?: boolean }).success === true

      if (windSuccess) {
        setWindHistory(windRes.data)
      }

      setLastUpdated(new Date().toLocaleString('zh-CN', { hour12: false }))
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
    const timer = window.setInterval(() => {
      void loadData(true)
    }, 5 * 60 * 1000)

    return () => window.clearInterval(timer)
  }, [])

  const latestWind = windHistory[0]
  const maxWindValue = getWindValue(latestWind)
  const activeWarnings = warnings.filter(item => item.status === 'published')

  const districtRisk = useMemo(() => {
    if (!rainData?.districts.length) return districtRiskFallback

    return rainData.districts.reduce<Record<string, RiskLevel>>(
      (result, item) => ({
        ...result,
        [item.district]: getRiskByPrecip(item.max),
      }),
      { ...districtRiskFallback },
    )
  }, [rainData])

  const markerValues = useMemo(
    () =>
      (rainData?.topStations || []).slice(0, 3).map(item => ({
        name: item.district,
        coord: item.coordinates,
        value: Math.round(item.precip),
      })),
    [rainData],
  )

  const thresholdItems: ThresholdItem[] = [
    { key: 'watch', name: '关注站点', value: rainData?.thresholds.watch ?? 0, color: 'gold' },
    { key: 'warning', name: '警戒站点', value: rainData?.thresholds.warning ?? 0, color: 'orange' },
    { key: 'danger', name: '高风险站点', value: rainData?.thresholds.danger ?? 0, color: 'red' },
  ]

  const rainColumns: ColumnsType<RainTopStation> = [
    {
      title: '排名',
      dataIndex: 'rank',
      width: 70,
    },
    {
      title: '站点',
      dataIndex: 'stationName',
      ellipsis: true,
    },
    {
      title: '区域',
      dataIndex: 'district',
      width: 96,
    },
    {
      title: '降雨量',
      dataIndex: 'precip',
      width: 100,
      render: value => `${value} mm`,
      sorter: (a, b) => b.precip - a.precip,
    },
    {
      title: '等级',
      dataIndex: 'level',
      width: 110,
      render: level => <Tag color={level.color}>{level.label}</Tag>,
    },
  ]

  const warningColumns: ColumnsType<WarningRecord> = [
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '地点',
      dataIndex: 'location',
      ellipsis: true,
    },
    {
      title: '等级',
      dataIndex: 'level',
      width: 96,
      render: (level: WarningRecord['level']) => (
        <Tag color={warningLevelColor[level]}>{warningLevelText[level]}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (status: WarningRecord['status']) => (
        <Tag color={statusColor[status]}>{statusText[status]}</Tag>
      ),
    },
  ]

  return (
    <div className={style.page}>
      <div className={style.header}>
        <div>
          <Title level={2}>综合看板</Title>
          <Text type="secondary">
            汇总降雨、风况、预警和风险分布，作为登录后的统一入口。
          </Text>
        </div>
        <Space>
          <Text type="secondary">{lastUpdated ? `更新于 ${lastUpdated}` : '等待数据刷新'}</Text>
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

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className={style.metricCard}>
            <Statistic
              title="雨量站点"
              value={rainData?.stationCount ?? 0}
              suffix="个"
              prefix={<CloudOutlined className={style.metricIcon} />}
            />
            <Text type="secondary">平均 {rainData?.avgPrecip ?? 0} mm</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className={style.metricCard}>
            <Statistic
              title="最大降雨"
              value={rainData?.maxPrecip ?? 0}
              suffix="mm"
              prefix={<DashboardOutlined className={style.metricIcon} />}
            />
            <Text type="secondary">{rainData?.thresholds.message || '暂无阈值风险'}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className={style.metricCard}>
            <Statistic
              title="活跃预警"
              value={activeWarnings.length}
              suffix="条"
              prefix={<AlertOutlined className={style.metricIcon} />}
            />
            <Text type="secondary">预警总数 {warningTotal} 条</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className={style.metricCard}>
            <Statistic
              title="最大风速"
              value={maxWindValue || 0}
              suffix="m/s"
              prefix={<ThunderboltOutlined className={style.metricIcon} />}
            />
            <Text type="secondary">{getWindStation(latestWind)}</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card
            title="风险分布"
            extra={<Tag color={rainData?.thresholds.danger ? 'red' : 'green'}>{rainData?.thresholds.danger ? '高风险' : '运行正常'}</Tag>}
            className={style.card}
          >
            <div className={style.mapPanel}>
              <OlRiskMap riskByDistrict={districtRisk} markers={markerValues} />
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card title="阈值触发状态" className={style.card}>
            <div className={style.thresholdGrid}>
              {thresholdItems.map(item => (
                <div key={item.key} className={style.thresholdItem}>
                  <Tag color={item.color}>{item.name}</Tag>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
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
        </Col>
      </Row>

      <Card title="雨量站排行" className={style.card}>
        <Table
          rowKey="stationCode"
          columns={rainColumns}
          dataSource={rainData?.topStations || []}
          loading={loading}
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  )
}

export default DashBoard
