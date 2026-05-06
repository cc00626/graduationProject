import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  Form,
  Input,
  Select,
  Slider,
  Switch,
  Table,
  Tag,
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
  SettingOutlined,
  UploadOutlined,
  UserOutlined,
  UserSwitchOutlined,
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
      <div className={styles.pageHeader}>
        <div>
          <h2>系统配置</h2>
          <p>管理账号、安全和业务默认项。参考 Ant Design Pro 与 Grafana 的设置页结构，保持清晰、稳定、可扫描。</p>
        </div>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void handleSaveProfile()}>
          保存配置
        </Button>
      </div>

      <Form form={profileForm} layout="vertical">
        <div className={styles.settingsLayout}>
          <aside className={styles.rail}>
            <div className={styles.userCard}>
              <Avatar size={72} src={avatar} icon={<UserOutlined />} />
              <strong>{user.account}</strong>
              <Tag color={user.role === 'super_admin' ? 'red' : user.role === 'admin' ? 'blue' : 'default'}>
                {ROLE_LABELS[user.role || 'user']}
              </Tag>
            </div>

            <nav className={styles.navList}>
              <a href="#profile">
                <UserOutlined />
                账号资料
              </a>
              <a href="#security">
                <LockOutlined />
                密码安全
              </a>
              <a href="#preferences">
                <SettingOutlined />
                业务偏好
              </a>
              <a href="#preview">
                <BellOutlined />
                配置预览
              </a>
              {canAssignRoles && (
                <a href="#roles">
                  <UserSwitchOutlined />
                  角色分配
                </a>
              )}
            </nav>
          </aside>

          <main className={styles.main}>
            <section id="profile" className={styles.section}>
              <div className={styles.sectionHead}>
                <div>
                  <h3>账号资料</h3>
                  <p>用于登录身份和顶部导航展示。</p>
                </div>
              </div>

              <div className={styles.profileRow}>
                <Avatar size={88} src={avatar} icon={<UserOutlined />} />
                <div>
                  <Upload {...uploadProps}>
                    <Button loading={loading} icon={<UploadOutlined />}>
                      上传头像
                    </Button>
                  </Upload>
                  <span>支持 JPG、PNG、WebP，建议小于 500KB。</span>
                </div>
              </div>

              <Form.Item name="avatar" hidden>
                <Input />
              </Form.Item>

              <div className={styles.formGrid}>
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
                  <Input size="large" prefix={<UserOutlined />} placeholder="请输入用户名" />
                </Form.Item>
              </div>
            </section>

            <section id="security" className={styles.section}>
              <div className={styles.sectionHead}>
                <div>
                  <h3>密码安全</h3>
                  <p>修改后会重新登录，避免旧会话继续使用。</p>
                </div>
              </div>

              <Form form={passwordForm} layout="vertical">
                <div className={styles.formGridThree}>
                  <Form.Item
                    label="原密码"
                    name="oldPassword"
                    rules={[{ required: true, message: '请输入原密码' }]}
                  >
                    <Input.Password size="large" prefix={<LockOutlined />} placeholder="原密码" />
                  </Form.Item>

                  <Form.Item
                    label="新密码"
                    name="newPassword"
                    rules={[
                      { required: true, message: '请输入新密码' },
                      { min: 6, max: 32, message: '密码长度需为 6-32 位' },
                    ]}
                  >
                    <Input.Password size="large" prefix={<LockOutlined />} placeholder="新密码" />
                  </Form.Item>

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
                    <Input.Password size="large" prefix={<LockOutlined />} placeholder="确认新密码" />
                  </Form.Item>
                </div>

                <Button danger loading={changingPassword} onClick={() => void handleChangePassword()}>
                  修改密码
                </Button>
              </Form>
            </section>

            <section id="preferences" className={styles.section}>
              <div className={styles.sectionHead}>
                <div>
                  <h3>业务偏好</h3>
                  <p>控制监测页面的默认范围、刷新节奏和图层加载。</p>
                </div>
                <Button icon={<ReloadOutlined />} onClick={resetPreferences}>
                  恢复默认
                </Button>
              </div>

              <div className={styles.formGrid}>
                <Form.Item label="默认关注区县" name={['preferences', 'defaultDistrict']}>
                  <Select size="large" options={districtOptions} />
                </Form.Item>

                <Form.Item label="预警展示范围" name={['preferences', 'warningLevel']}>
                  <Select
                    size="large"
                    options={[
                      { label: '全部预警', value: 'all' },
                      { label: '中高风险', value: 'medium' },
                      { label: '仅高风险', value: 'high' },
                    ]}
                  />
                </Form.Item>
              </div>

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

              <div className={styles.switchRow}>
                <div>
                  <strong>自动展开预警面板</strong>
                  <span>进入系统后自动显示预警信息，提高值班响应速度。</span>
                </div>
                <Form.Item name={['preferences', 'autoOpenWarningPanel']} valuePropName="checked" noStyle>
                  <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                </Form.Item>
              </div>
            </section>

            <section id="preview" className={styles.section}>
              <div className={styles.sectionHead}>
                <div>
                  <h3>配置预览</h3>
                  <p>保存前快速核对当前业务默认项。</p>
                </div>
              </div>

              <div className={styles.previewGrid}>
                <div>
                  <span>默认区县</span>
                  <strong>{preferences.defaultDistrict || '全市'}</strong>
                </div>
                <div>
                  <span>刷新间隔</span>
                  <strong>{preferences.refreshInterval || defaultPreferences.refreshInterval} 分钟</strong>
                </div>
                <div>
                  <span>预警面板</span>
                  <strong>{preferences.autoOpenWarningPanel ? '自动展开' : '手动打开'}</strong>
                </div>
                <div className={styles.previewWide}>
                  <span>默认图层</span>
                  <div className={styles.tagCloud}>
                    {enabledLayerText.map(item => (
                      <Tag key={item} icon={<CloudOutlined />}>
                        {item}
                      </Tag>
                    ))}
                  </div>
                </div>
              </div>

              <Alert type="info" showIcon message="这些偏好会被降水、风场、台风路径和预警业务读取。" />
            </section>

            {canAssignRoles && (
              <section id="roles" className={styles.section}>
                <div className={styles.sectionHead}>
                  <div>
                    <h3>角色分配</h3>
                    <p>控制用户可进入的页面和可执行的预警操作。</p>
                  </div>
                </div>

                <Alert
                  className={styles.roleNotice}
                  type="info"
                  showIcon
                  message="超级管理员拥有全部权限；管理员可维护预警业务；普通用户仅可查看监测与预警信息。"
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
                        <Tag color={role === 'super_admin' ? 'red' : role === 'admin' ? 'blue' : 'default'}>
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
              </section>
            )}
          </main>
        </div>
      </Form>
    </div>
  )
}

export default SystemSetting
