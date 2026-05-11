import { useEffect, useMemo, useState } from 'react'
import {
  Layout,
  theme,
  Avatar,
  Badge,
  Button,
  Descriptions,
  Drawer,
  Dropdown,
  Input,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  AlertOutlined,
  BellOutlined,
  CloudOutlined,
  DashboardOutlined,
  DownOutlined,
  FireOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  GlobalOutlined,
  LogoutOutlined,
  RadarChartOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  UpOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import SiderBar from './components/SiderBar'
import { UserLogout } from '@/services/user'
import {
  getWarningNotifications,
  markWarningNotificationsRead,
  type WarningLevel,
  type WarningRecord,
  type WarningType,
} from '@/services/warning'
import { ROLE_LABELS, clearAuth, getAuthUser, getUserRole, hasPermission } from '@/utils/auth'
import styles from './index.module.scss'

const { Header, Content } = Layout
const { Paragraph } = Typography

const warningChangedEvent = 'warning-published-updated'

const warningTypeText: Record<WarningType, string> = {
  temperature: '高温',
  rain: '暴雨',
  flood: '洪水',
  typhoon: '台风',
}

const warningLevelText: Record<WarningLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
}

const warningLevelColor: Record<WarningLevel, string> = {
  low: 'green',
  medium: 'orange',
  high: 'red',
}

const formatWarningTime = (value?: string) => {
  if (!value) return '刚刚'
  return new Date(value).toLocaleString()
}

const splitAdviceText = (value: string) =>
  value
    .split(/[;；]/)
    .map(item => item.trim())
    .filter(Boolean)

const removeListMarker = (value: string) =>
  value.replace(/^(\d+[.、]|[（(]?\d+[）)]|[一二三四五六七八九十]+[.、])\s*/, '').trim()

const parseWarningDescription = (description: string) => {
  const sections = {
    summary: [] as string[],
    advice: [] as string[],
    disposal: [] as string[],
  }
  let current: keyof typeof sections = 'summary'

  description
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .forEach(line => {
      const cleanLine = line.replace(/^[-•]\s*/, '')
      const normalizedLine = removeListMarker(cleanLine)
      const [, title = '', content = ''] = cleanLine.match(/^([^:：]+)[:：]\s*(.*)$/) || []

      if (/防御建议|防范建议|防护建议/.test(title || cleanLine)) {
        current = 'advice'
        splitAdviceText(content).forEach(item => sections.advice.push(removeListMarker(item)))
        return
      }

      if (/处置建议|应急处置|响应措施|处置措施/.test(title || cleanLine)) {
        current = 'disposal'
        splitAdviceText(content).forEach(item => sections.disposal.push(removeListMarker(item)))
        return
      }

      if (current === 'summary') {
        sections.summary.push(cleanLine)
        return
      }

      splitAdviceText(normalizedLine).forEach(item => sections[current].push(item))
    })

  return sections
}

const AppLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [authUser, setAuthUser] = useState(getAuthUser())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [headerExpanded, setHeaderExpanded] = useState(false)
  const [latestWarnings, setLatestWarnings] = useState<WarningRecord[]>([])
  const [warningUnreadCount, setWarningUnreadCount] = useState(0)
  const [selectedWarning, setSelectedWarning] = useState<WarningRecord | null>(null)

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const monitorMenuItems = [
    ...(hasPermission('page:monitor:rain', authUser)
      ? [
          {
            key: '/monitor/rain',
            label: '降水监测',
          },
        ]
      : []),
    ...(hasPermission('page:monitor:temperature', authUser)
      ? [
          {
            key: '/monitor/temperature',
            label: '温度监测',
          },
        ]
      : []),
    ...(hasPermission('page:monitor:typhoon', authUser)
      ? [
          {
            key: '/monitor/typhoon',
            label: '台风路径',
          },
        ]
      : []),
  ]

  const warningMenuItems = [
    ...(hasPermission('page:monitor:warning-list', authUser)
      ? [
          {
            key: '/monitor/warning-list',
            label: '预警列表',
          },
        ]
      : []),
    ...(hasPermission('page:monitor:warning', authUser)
      ? [
          {
            key: '/monitor/warning',
            label: '预警发布',
          },
        ]
      : []),
  ]

  const systemMenuItems = [
    ...(hasPermission('page:role', authUser)
      ? [
          {
            key: '/role',
            label: '角色管理',
          },
        ]
      : []),
    ...(hasPermission('page:permission', authUser)
      ? [
          {
            key: '/permission',
            label: '权限管理',
          },
        ]
      : []),
    ...(hasPermission('page:setting', authUser)
      ? [
          {
            key: '/setting',
            label: '系统配置',
          },
        ]
      : []),
  ]

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '综合看板',
    },
    ...(monitorMenuItems.length
      ? [
          {
            key: '/monitor',
            icon: <GlobalOutlined />,
            label: '实时监测',
            children: monitorMenuItems,
          },
        ]
      : []),
    ...(warningMenuItems.length
      ? [
          {
            key: '/warning',
            icon: <AlertOutlined />,
            label: '预警管理',
            children: warningMenuItems,
          },
        ]
      : []),
    ...(systemMenuItems.length
      ? [
          {
            key: '/system',
            icon: <SettingOutlined />,
            label: '系统管理',
            children: systemMenuItems,
          },
        ]
      : []),
  ]

  useEffect(() => {
    const syncUser = () => {
      setAuthUser(getAuthUser())
    }

    window.addEventListener('storage', syncUser)
    window.addEventListener('auth-user-updated', syncUser)
    return () => {
      window.removeEventListener('storage', syncUser)
      window.removeEventListener('auth-user-updated', syncUser)
    }
  }, [])

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  useEffect(() => {
    const loadLatestWarnings = async () => {
      try {
        const res = await getWarningNotifications(5)
        if (res.code === 0) {
          setLatestWarnings(res.data.items)
          setWarningUnreadCount(res.data.unreadCount)
        }
      } catch {
        setLatestWarnings([])
        setWarningUnreadCount(0)
      }
    }

    void loadLatestWarnings()
    const timer = window.setInterval(loadLatestWarnings, 30000)
    window.addEventListener(warningChangedEvent, loadLatestWarnings)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(warningChangedEvent, loadLatestWarnings)
    }
  }, [])

  const selectedKeys = useMemo(() => {
    if (location.pathname.startsWith('/dashboard')) return ['/dashboard']
    if (location.pathname.startsWith('/monitor')) return [location.pathname]
    if (location.pathname.startsWith('/setting')) return ['/setting']
    if (location.pathname.startsWith('/permission')) return ['/permission']
    if (location.pathname.startsWith('/role')) return ['/role']
    return [location.pathname]
  }, [location.pathname])

  const currentPageTitle = useMemo(() => {
    if (location.pathname.startsWith('/dashboard')) return '综合看板'
    if (location.pathname.startsWith('/monitor/rain')) return '降水监测'
    if (location.pathname.startsWith('/monitor/temperature')) return '温度监测'
    if (location.pathname.startsWith('/monitor/typhoon')) return '台风路径'
    if (location.pathname.startsWith('/monitor/warning-list')) return '预警列表'
    if (location.pathname.startsWith('/monitor/warning')) return '预警发布'
    if (location.pathname.startsWith('/setting')) return '系统配置'
    if (location.pathname.startsWith('/permission')) return '权限管理'
    if (location.pathname.startsWith('/role')) return '角色管理'
    return '气象监测平台'
  }, [location.pathname])

  const quickLinks = useMemo(
    () =>
      [
        {
          key: '/dashboard',
          icon: <DashboardOutlined />,
          label: '看板',
          visible: true,
        },
        {
          key: '/monitor/rain',
          icon: <CloudOutlined />,
          label: '降水',
          visible: hasPermission('page:monitor:rain', authUser),
        },
        {
          key: '/monitor/temperature',
          icon: <FireOutlined />,
          label: '温度',
          visible: hasPermission('page:monitor:temperature', authUser),
        },
        {
          key: '/monitor/typhoon',
          icon: <RadarChartOutlined />,
          label: '台风',
          visible: hasPermission('page:monitor:typhoon', authUser),
        },
        {
          key: '/monitor/warning',
          icon: <AlertOutlined />,
          label: '发布',
          visible: hasPermission('page:monitor:warning', authUser),
        },
      ].filter(item => item.visible),
    [authUser],
  )

  const handleGlobalSearch = (value: string) => {
    const keyword = value.trim()
    if (!keyword) return

    const target = quickLinks.find(item => item.label.includes(keyword) || keyword.includes(item.label))
    if (target) {
      navigate(target.key)
      return
    }

    message.info('未找到匹配模块，可试试“降水、台风、发布、看板”')
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      message.warning('当前浏览器不支持全屏切换')
    }
  }

  const handleLogout = async () => {
    if (loggingOut) {
      return
    }

    setLoggingOut(true)
    try {
      const res = await UserLogout()
      if (res.code !== 0) {
        message.warning(res.message || '退出登录失败，已清除本地登录状态')
      } else {
        message.success(res.message || '退出登录成功')
      }
    } catch {
      message.warning('退出登录请求失败，已清除本地登录状态')
    } finally {
      clearAuth()
      setLoggingOut(false)
      navigate('/login', { replace: true })
    }
  }

  const selectedWarningDetail = useMemo(
    () => (selectedWarning ? parseWarningDescription(selectedWarning.description) : null),
    [selectedWarning],
  )

  const openWarningList = () => {
    setSelectedWarning(null)
    navigate('/monitor/warning-list')
  }

  const handleNotificationOpenChange = async (open: boolean) => {
    if (!open || warningUnreadCount <= 0) return

    setWarningUnreadCount(0)
    try {
      const res = await markWarningNotificationsRead()
      if (res.code !== 0) {
        void getWarningNotifications(5).then(nextRes => {
          if (nextRes.code === 0) {
            setLatestWarnings(nextRes.data.items)
            setWarningUnreadCount(nextRes.data.unreadCount)
          }
        })
      }
    } catch {
      void getWarningNotifications(5).then(res => {
        if (res.code === 0) {
          setLatestWarnings(res.data.items)
          setWarningUnreadCount(res.data.unreadCount)
        }
      })
    }
  }

  const notificationItems: MenuProps['items'] =
    latestWarnings.length > 0
      ? latestWarnings.map(warning => ({
          key: warning._id,
          label: (
            <div className={styles.noticeItem}>
              <strong>{warning.title}</strong>
              <span>
                {warningTypeText[warning.type]} / {warningLevelText[warning.level]} /{' '}
                {warning.location}
              </span>
              <span className={styles.noticeDesc}>{warning.description}</span>
              <time>{formatWarningTime(warning.publishedAt || warning.createdAt)}</time>
            </div>
          ),
          onClick: () => setSelectedWarning(warning),
        }))
      : [
          {
            key: 'empty',
            disabled: true,
            label: (
              <div className={styles.noticeItem}>
                <strong>暂无已发布预警</strong>
                <span>发布预警后会自动显示在这里</span>
              </div>
            ),
          },
        ]

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'setting',
      icon: <SettingOutlined />,
      label: '系统配置',
      onClick: () => navigate('/setting'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: loggingOut ? '退出中...' : '退出登录',
      disabled: loggingOut,
      onClick: handleLogout,
    },
  ]

  return (
    <Layout className={styles.appLayout}>
      <SiderBar
        collapsed={collapsed}
        onCollapse={setCollapsed}
        items={menuItems}
        selectedKeys={selectedKeys}
        onMenuClick={item => {
          navigate(item.key)
        }}
      />

      <Layout className={styles.mainLayout}>
        <div
          className={[styles.topDrawer, headerExpanded ? styles.topDrawerExpanded : '']
            .filter(Boolean)
            .join(' ')}
        >
          <Header className={styles.header} style={{ background: colorBgContainer }}>
            <div className={styles.headerTitle}>
              <span>{currentPageTitle}</span>
              <small>实时监测与预警工作台</small>
            </div>

            <div className={styles.headerCenter}>
              <Input.Search
                allowClear
                size="large"
                className={styles.headerSearch}
                placeholder="搜索模块：降水 / 台风 / 发布"
                prefix={<SearchOutlined />}
                onSearch={handleGlobalSearch}
              />
              <Space size={10} className={styles.quickLinks}>
                {quickLinks.map(item => (
                  <Button
                    key={item.key}
                    size="large"
                    type={location.pathname === item.key ? 'primary' : 'text'}
                    icon={item.icon}
                    onClick={() => navigate(item.key)}
                  >
                    {item.label}
                  </Button>
                ))}
              </Space>
            </div>

            <Space size={10} className={styles.headerActions}>
              <Tooltip title={headerExpanded ? '收起顶部栏' : '展开顶部栏'}>
                <Button
                  size="large"
                  type="text"
                  icon={headerExpanded ? <UpOutlined /> : <DownOutlined />}
                  onClick={() => setHeaderExpanded(value => !value)}
                />
              </Tooltip>
              <Tooltip title="刷新当前页">
                <Button size="large" type="text" icon={<ReloadOutlined />} onClick={() => window.location.reload()} />
              </Tooltip>
              <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
                <Button
                  size="large"
                  type="text"
                  icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                  onClick={() => void toggleFullscreen()}
                />
              </Tooltip>
              <Dropdown
                menu={{ items: notificationItems }}
                placement="bottomRight"
                trigger={['click']}
                onOpenChange={open => void handleNotificationOpenChange(open)}
              >
                <Badge count={warningUnreadCount} size="small">
                  <Button size="large" type="text" icon={<BellOutlined />} />
                </Badge>
              </Dropdown>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
                <Space className={styles.userEntry}>
                  <Avatar size={40} src={authUser?.avatar} icon={<UserOutlined />} />
                  <span>{authUser?.account || '管理员'}</span>
                  <span className={styles.roleText}>{ROLE_LABELS[getUserRole(authUser)]}</span>
                  <DownOutlined />
                </Space>
              </Dropdown>
            </Space>
          </Header>

        </div>

        <Content className={styles.content}>
          <div
            key={location.pathname}
            className={styles.contentShell}
            style={{ background: colorBgContainer, borderRadius: borderRadiusLG }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>

      <Drawer
        title="预警详情"
        width={520}
        open={Boolean(selectedWarning)}
        onClose={() => setSelectedWarning(null)}
        extra={
          <Button type="primary" onClick={openWarningList}>
            查看预警列表
          </Button>
        }
      >
        {selectedWarning && (
          <div className={styles.warningDetail}>
            <div className={styles.warningDetailHeader}>
              <h3>{selectedWarning.title}</h3>
              <Space>
                <Tag color="blue">{warningTypeText[selectedWarning.type]}</Tag>
                <Tag color={warningLevelColor[selectedWarning.level]}>
                  {warningLevelText[selectedWarning.level]}
                </Tag>
              </Space>
            </div>

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="预警地点">{selectedWarning.location}</Descriptions.Item>
              <Descriptions.Item label="影响范围">{selectedWarning.radius} km</Descriptions.Item>
              <Descriptions.Item label="发布人">
                {selectedWarning.publisher || '管理员'}
              </Descriptions.Item>
              <Descriptions.Item label="发布时间">
                {formatWarningTime(selectedWarning.publishedAt || selectedWarning.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="中心点">
                {selectedWarning.center?.length ? selectedWarning.center.join(', ') : '-'}
              </Descriptions.Item>
            </Descriptions>

            <section className={styles.warningRichSection}>
              <h4>预警摘要</h4>
              <Paragraph className={styles.warningDetailText}>
                {selectedWarningDetail?.summary.join('\n') || selectedWarning.description}
              </Paragraph>
            </section>

            <section className={styles.warningRichSection}>
              <h4>影响区域</h4>
              <div className={styles.warningAreaGrid}>
                <div>
                  <span>区域</span>
                  <strong>{selectedWarning.location}</strong>
                </div>
                <div>
                  <span>半径</span>
                  <strong>{selectedWarning.radius} km</strong>
                </div>
                <div>
                  <span>中心点</span>
                  <strong>
                    {selectedWarning.center?.length ? selectedWarning.center.join(', ') : '-'}
                  </strong>
                </div>
              </div>
            </section>

            {selectedWarningDetail?.advice.length ? (
              <section className={styles.warningRichSection}>
                <h4>防御建议</h4>
                <ol className={styles.warningAdviceList}>
                  {selectedWarningDetail.advice.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ol>
              </section>
            ) : null}

            {selectedWarningDetail?.disposal.length ? (
              <section className={styles.warningRichSection}>
                <h4>处置建议</h4>
                <ol className={styles.warningAdviceList}>
                  {selectedWarningDetail.disposal.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ol>
              </section>
            ) : null}

            {selectedWarning.pois?.length ? (
              <section className={styles.warningRichSection}>
                <h4>关联设施</h4>
                <div className={styles.warningPoiList}>
                  {selectedWarning.pois.slice(0, 8).map((poi, index) => (
                    <div key={`${poi.id || poi.name || index}`} className={styles.warningPoiItem}>
                      <strong>{poi.name || poi.type || '重点设施'}</strong>
                      <span>{poi.address || poi.location || poi.distance || '暂无位置信息'}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </Drawer>
    </Layout>
  )
}

export default AppLayout
