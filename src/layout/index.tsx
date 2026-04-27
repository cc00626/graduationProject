import { useState } from 'react'
import { Layout, Menu, theme, Avatar } from 'antd'
import { AppstoreOutlined, GlobalOutlined, UserOutlined } from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import SiderBar from './components/SiderBar'
const { Header, Content } = Layout

const AppLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  // 菜单配置
  const menuItems = [
    {
      key: '/monitor',
      icon: <GlobalOutlined />,
      label: '实时态势', // 一级菜单：体现业务大类
      children: [
        {
          key: '/monitor/rain',
          label: '降水监测', // 对应底层：色斑图/热力图
        },
        {
          key: '/monitor/typhoon',
          label: '台风路径', // 对应中层：矢量点线
        },
        {
          key: '/monitor/warning',
          label: '预警发布', // 对应顶层：闪烁图标
        },
      ],
    },
    {
      key: '/history',
      icon: <AppstoreOutlined />,
      label: '历史回溯',
    },
    {
      key: '/setting',
      icon: <UserOutlined />,
      label: '系统配置',
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <SiderBar
        collapsed={collapsed}
        onCollapse={setCollapsed}
        items={menuItems}
        onMenuClick={item => {
          navigate(item.key)
        }}
      ></SiderBar>

      <Layout>
        {/* 顶部 Header */}
        <Header style={{ background: colorBgContainer, padding: '0 24px', textAlign: 'right' }}>
          <Avatar icon={<UserOutlined />} />
          <span style={{ marginLeft: 8 }}>管理员</span>
        </Header>

        {/* 页面内容容器 */}
        <Content style={{ margin: '16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: '100%',
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            {/* 嵌套路由出口 */}
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
