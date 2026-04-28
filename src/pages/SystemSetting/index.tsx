import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Slider,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import type { UploadProps } from 'antd'
import {
  BellOutlined,
  CloudOutlined,
  LockOutlined,
  ReloadOutlined,
  SaveOutlined,
  UploadOutlined,
  UserSwitchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  GetCurrentUser,
  GetUsers,
  UpdatePassword,
  UpdateProfile,
  UpdateUserRole,
  type PasswordPayload,
  type ProfilePayload,
} from '@/services/user'
import {
  DEFAULT_USER_PREFERENCES,
  ROLE_LABELS,
  canManageRoles,
  clearAuth,
  getAuthUser,
  saveAuth,
  saveAuthUser,
  type AuthUser,
  type UserRole,
} from '@/utils/auth'
import styles from './index.module.scss'

const { Title, Text } = Typography

const districtOptions = [
  '全市',
  '荔湾区',
  '越秀区',
  '海珠区',
  '天河区',
  '白云区',
  '黄埔区',
  '番禺区',
  '花都区',
  '南沙区',
  '从化区',
  '增城区',
].map(value => ({ label: value, value }))

const defaultPreferences: ProfilePayload['preferences'] = DEFAULT_USER_PREFERENCES

type ProfileFormValues = ProfilePayload

type PasswordFormValues = PasswordPayload & {
  confirmPassword: string
}

const normalizeUser = (user: AuthUser | null): AuthUser => ({
  id: user?.id || '',
  account: user?.account || 'admin',
  role: user?.role || (user?.account === 'admin' ? 'super_admin' : 'user'),
  avatar: user?.avatar || '',
  preferences: {
    ...defaultPreferences,
    ...(user?.preferences || {}),
  },
})

const SystemSetting = () => {
  const [profileForm] = Form.useForm<ProfileFormValues>()
  const [passwordForm] = Form.useForm<PasswordFormValues>()
  const [user, setUser] = useState<AuthUser>(() => normalizeUser(getAuthUser()))
  const [avatar, setAvatar] = useState(user.avatar || '')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [roleUsers, setRoleUsers] = useState<AuthUser[]>([])
  const [roleLoading, setRoleLoading] = useState(false)

  const preferences = Form.useWatch('preferences', profileForm) || defaultPreferences
  const canAssignRoles = canManageRoles(user)

  const enabledLayerText = useMemo(() => {
    const layerNameMap: Record<string, string> = {
      rain: '降水图层',
      wind: '风场图层',
      warning: '预警标注',
      typhoon: '台风路径',
      risk: '风险点',
    }
    return (preferences.enabledLayers || []).map(layer => layerNameMap[layer] || layer)
  }, [preferences.enabledLayers])

  const loadRoleUsers = async () => {
    setRoleLoading(true)
    try {
      const res = await GetUsers()
      if (res.code === 0) {
        setRoleUsers(res.data.map(item => normalizeUser(item)))
      } else {
        message.error(res.message)
      }
    } catch {
      message.error('用户角色列表加载失败')
    } finally {
      setRoleLoading(false)
    }
  }

  const handleRoleChange = async (targetUser: AuthUser, role: UserRole) => {
    setRoleLoading(true)
    try {
      const res = await UpdateUserRole(targetUser.id, role)
      if (res.code !== 0) {
        message.error(res.message)
        return
      }

      message.success(res.message || '角色分配成功')
      await loadRoleUsers()
    } catch {
      message.error('角色分配失败')
    } finally {
      setRoleLoading(false)
    }
  }

  useEffect(() => {
    const nextUser = normalizeUser(user)
    profileForm.setFieldsValue({
      account: nextUser.account,
      avatar: nextUser.avatar,
      preferences: nextUser.preferences || defaultPreferences,
    })
    setAvatar(nextUser.avatar || '')
  }, [profileForm, user])

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true)
      try {
        const res = await GetCurrentUser()
        if (res.code === 0) {
          const nextUser = normalizeUser(res.data)
          setUser(nextUser)
          saveAuthUser(nextUser)
          if (nextUser.role === 'super_admin') {
            void loadRoleUsers()
          }
        }
      } catch {
        message.warning('用户信息读取失败，已使用本地缓存')
      } finally {
        setLoading(false)
      }
    }

    void loadUser()
  }, [])

  const uploadProps: UploadProps = {
    accept: 'image/png,image/jpeg,image/webp',
    showUploadList: false,
    beforeUpload: file => {
      if (file.size > 500 * 1024) {
        message.error('头像图片不能超过 500KB')
        return Upload.LIST_IGNORE
      }

      const reader = new FileReader()
      reader.onload = event => {
        const nextAvatar = String(event.target?.result || '')
        setAvatar(nextAvatar)
        profileForm.setFieldValue('avatar', nextAvatar)
      }
      reader.readAsDataURL(file)
      return false
    },
  }

  const handleSaveProfile = async () => {
    const values = await profileForm.validateFields()
    setSaving(true)
    try {
      const res = await UpdateProfile({
        ...values,
        avatar,
        preferences: {
          ...defaultPreferences,
          ...values.preferences,
        },
      })

      if (res.code !== 0) {
        message.error(res.message)
        return
      }

      saveAuth(res.data.token, res.data.user)
      setUser(normalizeUser(res.data.user))
      window.dispatchEvent(new Event('auth-user-updated'))
      message.success(res.message || '系统配置保存成功')
    } catch {
      message.error('系统配置保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    const values = await passwordForm.validateFields()
    setChangingPassword(true)
    try {
      const res = await UpdatePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      })

      if (res.code !== 0) {
        message.error(res.message)
        return
      }

      message.success(res.message)
      passwordForm.resetFields()
      clearAuth()
      window.location.href = '/login'
    } catch {
      message.error('密码修改失败')
    } finally {
      setChangingPassword(false)
    }
  }

  const resetPreferences = () => {
    profileForm.setFieldValue('preferences', defaultPreferences)
    message.success('已恢复默认业务偏好')
  }

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div>
          <Title level={2}>系统配置</Title>
          <Text>维护个人资料、安全密码，以及广州气象监测业务的常用偏好。</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={resetPreferences}>
          恢复业务默认值
        </Button>
      </section>

      <Form form={profileForm} layout="vertical">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={10}>
            <Card loading={loading} className={styles.card} title="个人资料">
              <div className={styles.profileTop}>
                <Avatar size={96} src={avatar} icon={<UserOutlined />} />
                <Space direction="vertical" size={8}>
                  <Upload {...uploadProps}>
                    <Button icon={<UploadOutlined />}>上传头像</Button>
                  </Upload>
                  <Text type="secondary">支持 JPG、PNG、WebP，建议小于 500KB。</Text>
                </Space>
              </div>

              <Form.Item name="avatar" hidden>
                <Input />
              </Form.Item>

              <Form.Item
                label="用户名"
                name="account"
                rules={[
                  { required: true, message: '请输入用户名' },
                  {
                    pattern: /^[a-zA-Z][a-zA-Z0-9_]{3,19}$/,
                    message: '4-20 位，字母开头，仅支持字母、数字和下划线',
                  },
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
              </Form.Item>

              <Alert
                type="info"
                showIcon
                message="用户名会用于登录；保存后顶部导航会同步显示新的头像和用户名。"
              />
            </Card>
          </Col>

          <Col xs={24} lg={14}>
            <Card className={styles.card} title="密码安全">
              <Form form={passwordForm} layout="vertical">
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="原密码"
                      name="oldPassword"
                      rules={[{ required: true, message: '请输入原密码' }]}
                    >
                      <Input.Password prefix={<LockOutlined />} placeholder="原密码" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="新密码"
                      name="newPassword"
                      rules={[
                        { required: true, message: '请输入新密码' },
                        { min: 6, max: 32, message: '密码长度需为 6-32 位' },
                      ]}
                    >
                      <Input.Password prefix={<LockOutlined />} placeholder="新密码" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="确认新密码"
                      name="confirmPassword"
                      dependencies={['newPassword']}
                      rules={[
                        { required: true, message: '请再次输入新密码' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue('newPassword') === value) {
                              return Promise.resolve()
                            }
                            return Promise.reject(new Error('两次输入的新密码不一致'))
                          },
                        }),
                      ]}
                    >
                      <Input.Password prefix={<LockOutlined />} placeholder="确认新密码" />
                    </Form.Item>
                  </Col>
                </Row>
                <Button
                  danger
                  type="primary"
                  loading={changingPassword}
                  onClick={() => void handleChangePassword()}
                >
                  修改密码
                </Button>
              </Form>
            </Card>
          </Col>

          <Col xs={24} lg={15}>
            <Card className={styles.card} title="业务偏好">
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="默认关注区县" name={['preferences', 'defaultDistrict']}>
                    <Select options={districtOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="预警展示范围" name={['preferences', 'warningLevel']}>
                    <Select
                      options={[
                        { label: '全部预警', value: 'all' },
                        { label: '中高风险', value: 'medium' },
                        { label: '仅高风险', value: 'high' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="监测数据刷新间隔（分钟）" name={['preferences', 'refreshInterval']}>
                <Slider min={1} max={60} marks={{ 1: '1', 5: '5', 15: '15', 30: '30', 60: '60' }} />
              </Form.Item>

              <Form.Item label="默认加载图层" name={['preferences', 'enabledLayers']}>
                <Checkbox.Group className={styles.layerGroup}>
                  <Checkbox value="rain">降水图层</Checkbox>
                  <Checkbox value="wind">风场图层</Checkbox>
                  <Checkbox value="warning">预警标注</Checkbox>
                  <Checkbox value="typhoon">台风路径</Checkbox>
                  <Checkbox value="risk">风险点</Checkbox>
                </Checkbox.Group>
              </Form.Item>

              <Form.Item
                label="进入系统后自动展开预警面板"
                name={['preferences', 'autoOpenWarningPanel']}
                valuePropName="checked"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={9}>
            <Card className={styles.card} title="配置预览">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="当前角色">
                  <Tag color={user.role === 'super_admin' ? 'red' : user.role === 'admin' ? 'blue' : 'default'}>
                    {ROLE_LABELS[user.role || 'user']}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="当前用户">{user.account}</Descriptions.Item>
                <Descriptions.Item label="默认区县">
                  {preferences.defaultDistrict || '全市'}
                </Descriptions.Item>
                <Descriptions.Item label="刷新间隔">
                  {preferences.refreshInterval || defaultPreferences.refreshInterval} 分钟
                </Descriptions.Item>
                <Descriptions.Item label="图层">
                  <Space wrap>
                    {enabledLayerText.map(item => (
                      <Tag key={item} icon={<CloudOutlined />}>
                        {item}
                      </Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="预警面板">
                  <Tag color={preferences.autoOpenWarningPanel ? 'green' : 'default'}>
                    {preferences.autoOpenWarningPanel ? '自动展开' : '手动打开'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
              <Divider />
              <Alert
                type="warning"
                showIcon
                icon={<BellOutlined />}
                message="这些偏好会为降水、风场、台风路径和预警业务提供默认工作区，后续页面可以继续读取该配置做个性化加载。"
              />
            </Card>
          </Col>
          {canAssignRoles && (
            <Col xs={24}>
              <Card
                className={styles.card}
                title={
                  <Space>
                    <UserSwitchOutlined />
                    权限管理
                  </Space>
                }
              >
                <Alert
                  type="info"
                  showIcon
                  message="超级管理员拥有全部权限；管理员可以维护预警但不能分配角色；用户只能查看监测与预警信息，不能设置预警。"
                  style={{ marginBottom: 16 }}
                />
                <Table<AuthUser>
                  rowKey="id"
                  loading={roleLoading}
                  dataSource={roleUsers}
                  pagination={false}
                  columns={[
                    {
                      title: '用户名',
                      dataIndex: 'account',
                    },
                    {
                      title: '当前角色',
                      dataIndex: 'role',
                      render: (role: UserRole) => (
                        <Tag
                          color={
                            role === 'super_admin' ? 'red' : role === 'admin' ? 'blue' : 'default'
                          }
                        >
                          {ROLE_LABELS[role || 'user']}
                        </Tag>
                      ),
                    },
                    {
                      title: '分配角色',
                      width: 260,
                      render: (_, record) => (
                        <Select<UserRole>
                          value={record.role || 'user'}
                          style={{ width: 180 }}
                          disabled={record.id === user.id}
                          options={[
                            { label: '超级管理员', value: 'super_admin' },
                            { label: '管理员', value: 'admin' },
                            { label: '用户', value: 'user' },
                          ]}
                          onChange={role => void handleRoleChange(record, role)}
                        />
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
          )}
        </Row>

        <div className={styles.footerBar}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={() => void handleSaveProfile()}
          >
            保存系统配置
          </Button>
        </div>
      </Form>
    </div>
  )
}

export default SystemSetting
