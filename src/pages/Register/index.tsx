import { Form, Input, Button, Typography, Space, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import style from './index.module.scss'
import { UserRegister } from '@/services/user'
import { saveAuth } from '@/utils/auth'

const { Title, Text } = Typography

interface RegisterData {
  username: string
  password: string
}

const Register = () => {
  const navigate = useNavigate()

  const rules = {
    username: [{ required: true, message: '请输入用户名' }],
    password: [{ required: true, message: '请输入密码' }],
  }

  const onFinish = async (data: RegisterData) => {
    const { username: account, password } = data
    const res = await UserRegister({ account, password })
    const {
      code,
      data: { token, user },
      message: msg,
    } = res

    if (code === 0) {
      message.success(msg)
      saveAuth(token, user)
      navigate('/dashboard')
      return
    }

    message.error(msg)
  }

  const onLogin = () => {
    navigate('/login')
  }

  return (
    <div className={style.registerContainer}>
      <div className={style.registerBox}>
        <div className={style.heroPanel}>
          <Text className={style.badge}>Create Account</Text>
          <Title level={2} className={style.title}>
            注册新账户
          </Title>
          <Text className={style.subtitle}>完成注册后即可进入系统查看气象数据和灾害信息。</Text>
        </div>

        <div className={style.formCard}>
          <div className={style.formHeader}>
            <Title level={3} className={style.formTitle}>
              注册
            </Title>
            <Text className={style.formHint}>请填写基础账号信息，创建一个新的系统账户。</Text>
          </div>

          <Form className={style.form} layout="vertical" onFinish={onFinish}>
            <Form.Item className={style.formItem} label="用户名" name="username" rules={rules.username}>
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入用户名"
                size="large"
                className={style.input}
              />
            </Form.Item>

            <Form.Item className={style.formItem} label="密码" name="password" rules={rules.password}>
              <Input
                prefix={<LockOutlined />}
                placeholder="请输入密码"
                size="large"
                className={style.input}
              />
            </Form.Item>

            <Form.Item className={style.actionRow}>
              <Space direction="vertical" size="middle" className={style.actionGroup}>
                <Button type="primary" htmlType="submit" size="large" className={style.primaryButton}>
                  注册
                </Button>
                <Button size="large" className={style.secondaryButton} onClick={onLogin}>
                  已有账号？去登录
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  )
}

export default Register

