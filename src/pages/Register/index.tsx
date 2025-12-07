import { useState } from 'react'
import { Form, Input, Button, Typography, Space } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import style from './index.module.scss'
const { Title } = Typography

const Register = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // 表单检验规则
  const rules = {
    username: [{ required: true, message: '请输入用户名' }],
    password: [{ required: true, message: '请输入密码' }],
  }

  //登录事件
  const onFinish = () => {
    //跳转到首页
    navigate('/')
  }

  //注册事件
  const onLogin = () => {
    //跳转到注册页面
    navigate('/login')
  }

  return (
    <div className={style.registerContainer}>
      <div className={style.registerBox}>
        {/* 标题 */}
        <Title>注册</Title>
        {/* 表单 */}
        <Form labelCol={{ span: 6 }} onFinish={onFinish}>
          <Form.Item label="用户名" name="username" rules={rules.username}>
            <Input prefix={<UserOutlined />} placeholder="请输入用户名" size="large" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={rules.password}>
            <Input prefix={<LockOutlined />} placeholder="请输入密码" size="large"></Input>
          </Form.Item>
          <Form.Item className={style.registerBtn}>
            <Space align="center" size="large">
              <Button type="primary" htmlType="submit" size="middle">
                注册
              </Button>
              <Button type="primary" size="middle" onClick={onLogin}>
                已有账号？去登录
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

export default Register
