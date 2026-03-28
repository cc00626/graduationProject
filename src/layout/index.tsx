import { UserOutlined } from '@ant-design/icons'
import { Avatar, Button, Layout, Space, Typography, message, theme } from 'antd'
import { Outlet, useNavigate } from 'react-router-dom'
import { UserLogout } from '@/services/user'
import { clearAuth } from '@/utils/auth'
import SiderBar from './components/SiderBar'

const { Header, Content } = Layout
const { Title } = Typography

const AppLayout = () => {
  const navigate = useNavigate()
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()
  const [messageApi, contextHolder] = message.useMessage()

  const handleLogout = async () => {
    try {
      await UserLogout()
    } catch (error) {
      console.error('logout request failed:', error)
      // Backend uses stateless token; client-side cleanup is still required.
    } finally {
      clearAuth()
      messageApi.success('退出登录成功')
      navigate('/login')
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {contextHolder}
      <SiderBar />
      <Layout>
        <Header
          style={{
            padding: '0 16px',
            background: colorBgContainer,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            广州市气象灾害检测与预警系统
          </Title>
          <Space>
            <Avatar icon={<UserOutlined />} />
            <span>管理员：陈久祥</span>
            <Button type="link" onClick={handleLogout} style={{ paddingInline: 4 }}>
              退出登录
            </Button>
          </Space>
        </Header>

        <Content style={{ margin: '16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 'calc(100vh - 112px)',
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              position: 'relative',
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

