import { Form, Input, Button, Typography, Space, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import style from './index.module.scss'
import { UserRLogin } from '@/services/user'
const { Title, Text } = Typography
interface LoginData {
  username: string
  password: string
}
const Login = () => {
  const navigate = useNavigate()

  const rules = {
    username: [{ required: true, message: '请输入用户名' }],
    password: [{ required: true, message: '请输入密码' }],
  }

  const onFinish = async (data: LoginData) => {
    const { username: account, password } = data
    const res = await UserRLogin({ account, password })
    if (res.code !== 0) {
      message.error(res.message)
      return
    }
    //提示消息
    message.success(res.message)
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    navigate('/')
  }

  const onRegister = () => {
    navigate('/register')
  }

  return (
    <div className={style.loginContainer}>
      <div className={style.loginBox}>
        <div className={style.heroPanel}>
          <Text className={style.badge}>Climate Alert</Text>
          <Title level={2} className={style.title}>
            气象灾害预警系统
          </Title>
          <Text className={style.subtitle}>
            登录后可快速查看气象预警、风场预测与地图信息，让系统入口更清晰，也更有产品感。
          </Text>
        </div>

        <div className={style.formCard}>
          <div className={style.formHeader}>
            <Title level={3} className={style.formTitle}>
              欢迎登录
            </Title>
            <Text className={style.formHint}>请输入你的账号信息继续使用系统。</Text>
          </div>

          <Form className={style.form} layout="vertical" onFinish={onFinish}>
            <Form.Item
              className={style.formItem}
              label="用户名"
              name="username"
              rules={rules.username}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入用户名"
                size="large"
                className={style.input}
              />
            </Form.Item>

            <Form.Item
              className={style.formItem}
              label="密码"
              name="password"
              rules={rules.password}
            >
              <Input
                prefix={<LockOutlined />}
                placeholder="请输入密码"
                size="large"
                className={style.input}
              />
            </Form.Item>

            <Form.Item className={style.actionRow}>
              <Space direction="vertical" size="middle" className={style.actionGroup}>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  className={style.primaryButton}
                >
                  登录
                </Button>
                <Button size="large" className={style.secondaryButton} onClick={onRegister}>
                  没有账号，去注册
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  )
}

export default Login
