import { Form, Input, Button, Typography, Space, message } from 'antd'
import { UserOutlined, LockOutlined, CloudOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import style from './index.module.scss'
import { UserRegister } from '@/services/user'
import {
  getDefaultRoute,
  normalizeAccountInput,
  saveAuth,
  validateAccountText,
  validatePasswordText,
} from '@/utils/auth'

const { Title, Text } = Typography

interface RegisterData {
  username: string
  password: string
  confirmPassword: string
}

const Register = () => {
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

  const onFinish = async (data: RegisterData) => {
    const account = normalizeAccountInput(data.username)
    const password = data.password

    setSubmitting(true)
    try {
      const res = await UserRegister({ account, password })
      if (res.code !== 0 || !res.data?.token || !res.data?.user) {
        message.error(res.message || '注册失败，请稍后重试')
        return
      }

      message.success(res.message || '注册成功')
      saveAuth(res.data.token, res.data.user)
      navigate(getDefaultRoute(res.data.user), { replace: true })
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
        '注册失败，请稍后重试'
      message.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const onLogin = () => {
    navigate('/login')
  }

  return (
    <div className={style.registerContainer}>
      <div className={style.registerBox}>
        <div className={style.heroPanel}>
          <div className={style.brandMark}>
            <CloudOutlined />
            <span>广州气象灾害监测平台</span>
          </div>
          <div>
            <Text className={style.badge}>Access Management</Text>
            <Title level={2} className={style.title}>
              创建系统账户
            </Title>
          </div>
        </div>

        <div className={style.formCard}>
          <div className={style.formHeader}>
            <Text className={style.formEyebrow}>REGISTER</Text>
            <Title level={3} className={style.formTitle}>
              注册账户
            </Title>
            <Text className={style.formHint}>
              请填写基础账号信息，账号规则会与后端认证保持一致。
            </Text>
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
                placeholder="请输入6-32位密码"
                size="large"
                className={style.input}
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item
              className={style.formItem}
              label="确认密码"
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: '请再次输入密码' },
                ({ getFieldValue }) => ({
                  validator: (_: unknown, value: string) => {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'))
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请再次输入密码"
                size="large"
                className={style.input}
                autoComplete="new-password"
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
