import { Form, Input, Button, Typography, Space, message } from 'antd'
import { UserOutlined, LockOutlined, CloudOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import style from './index.module.scss'
import { UserRLogin } from '@/services/user'
import {
  getDefaultRoute,
  normalizeAccountInput,
  saveAuth,
  validateAccountText,
  validatePasswordText,
} from '@/utils/auth'
const { Title, Text } = Typography

interface LoginData {
  username: string
  password: string
}
const Login = () => {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const rules = {
    username: [
      {
        validator: (_: unknown, value: string) => {
          const error = validateAccountText(value || '')
          return error ? Promise.reject(new Error(error)) : Promise.resolve()
        },
      },
    ],
    password: [
      {
        validator: (_: unknown, value: string) => {
          const error = validatePasswordText(value || '')
          return error ? Promise.reject(new Error(error)) : Promise.resolve()
        },
      },
    ],
  }

  const onFinish = async (data: LoginData) => {
    const account = normalizeAccountInput(data.username)
    const password = data.password

    setSubmitting(true)
    try {
      const res = await UserRLogin({ account, password })
      if (res.code !== 0 || !res.data?.token || !res.data?.user) {
        message.error(res.message || '登录失败，请稍后重试')
        return
      }

      message.success(res.message || '登录成功')
      saveAuth(res.data.token, res.data.user)
      navigate(getDefaultRoute(res.data.user), { replace: true })
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
        '登录失败，请检查账号或密码'
      message.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const onRegister = () => {
    navigate('/register')
  }

  return (
    <div className={style.loginContainer}>
      <div className={style.loginBox}>
        <div className={style.heroPanel}>
          <div className={style.brandMark}>
            <CloudOutlined />
            <span>广州气象灾害监测平台</span>
          </div>
          <div>
            <Text className={style.badge}>Weather Operations</Text>
            <Title level={2} className={style.title}>
              气象灾害监测与预警平台
            </Title>
          </div>
        </div>

        <div className={style.formCard}>
          <div className={style.formHeader}>
            <Text className={style.formEyebrow}>LOGIN</Text>
            <Title level={3} className={style.formTitle}>
              欢迎回来
            </Title>
            <Text className={style.formHint}>使用系统账号登录，也可以直接选择演示身份。</Text>
          </div>

          <Form className={style.form} layout="vertical" onFinish={onFinish}>
            <Form.Item
              className={style.formItem}
              label="用户名"
              name="username"
              normalize={value => normalizeAccountInput(value || '')}
              rules={rules.username}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入4-20位用户名"
                size="large"
                className={style.input}
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              className={style.formItem}
              label="密码"
              name="password"
              rules={rules.password}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入密码"
                size="large"
                className={style.input}
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item className={style.actionRow}>
              <Space direction="vertical" size="middle" className={style.actionGroup}>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  className={style.primaryButton}
                  loading={submitting}
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
