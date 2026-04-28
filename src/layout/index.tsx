import { useEffect, useMemo, useState } from 'react'
import { Layout, theme, Avatar, Dropdown, Space, message } from 'antd'
import type { MenuProps } from 'antd'
import {
  AppstoreOutlined,
  DownOutlined,
  GlobalOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import SiderBar from './components/SiderBar'
import { UserLogout } from '@/services/user'
import { ROLE_LABELS, clearAuth, getAuthUser, getUserRole, hasPermission } from '@/utils/auth'

const { Header, Content } = Layout

const AppLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [authUser, setAuthUser] = useState(getAuthUser())

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const menuItems = [
    {
      key: '/monitor',
      icon: <GlobalOutlined />,
      label: '实时态势',
      children: [
        ...(hasPermission('page:monitor:rain', authUser)
          ? [
              {
                key: '/monitor/rain',
                label: '降水监测',
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
        ...(hasPermission('page:monitor:warning', authUser)
          ? [
              {
                key: '/monitor/warning',
                label: '预警发布',
              },
            ]
          : []),
        ...(hasPermission('page:monitor:warning-list', authUser)
          ? [
              {
                key: '/monitor/warning-list',
                label: '预警列表',
              },
            ]
          : []),
      ],
    },
    {
      key: '/history',
      icon: <AppstoreOutlined />,
      label: '历史回溯',
    },
    ...(hasPermission('page:setting', authUser)
      ? [
          {
            key: '/setting',
            icon: <SettingOutlined />,
            label: '系统配置',
          },
        ]
      : []),
    ...(hasPermission('page:permission', authUser)
      ? [
          {
            key: '/permission',
            icon: <SafetyCertificateOutlined />,
            label: '权限管理',
          },
        ]
      : []),
    ...(hasPermission('page:role', authUser)
      ? [
          {
            key: '/role',
            icon: <TeamOutlined />,
            label: '角色管理',
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

  const selectedKeys = useMemo(() => {
    if (location.pathname.startsWith('/monitor')) return [location.pathname]
    if (location.pathname.startsWith('/setting')) return ['/setting']
    if (location.pathname.startsWith('/permission')) return ['/permission']
    if (location.pathname.startsWith('/role')) return ['/role']
    return [location.pathname]
  }, [location.pathname])

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
    <Layout style={{ minHeight: '100vh' }}>
      <SiderBar
        collapsed={collapsed}
        onCollapse={setCollapsed}
        items={menuItems}
        selectedKeys={selectedKeys}
        onMenuClick={item => {
          navigate(item.key)
        }}
      />

      <Layout>
        <Header style={{ background: colorBgContainer, padding: '0 24px', textAlign: 'right' }}>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar src={authUser?.avatar} icon={<UserOutlined />} />
              <span>{authUser?.account || '管理员'}</span>
              <span style={{ color: '#64748b', fontSize: 12 }}>
                {ROLE_LABELS[getUserRole(authUser)]}
              </span>
              <DownOutlined />
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ margin: '16px' }}>
          <div
            key={location.pathname}
            style={{
              padding: 24,
              minHeight: '100%',
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
