import { useEffect, useMemo, useState } from 'react'
import { Avatar, Button, Checkbox, Form, Input, Switch, Tag, Upload, message } from 'antd'
import type { UploadProps } from 'antd'
import {
  CloudOutlined,
  LockOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  GetCurrentUser,
  UpdatePassword,
  UpdateProfile,
  type PasswordPayload,
  type ProfilePayload,
} from '@/services/user'
import {
  DEFAULT_USER_PREFERENCES,
  ROLE_LABELS,
  clearAuth,
  getAuthUser,
  saveAuth,
  saveAuthUser,
  type AuthUser,
} from '@/utils/auth'
import styles from './index.module.scss'

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

  const preferences = Form.useWatch('preferences', profileForm) || defaultPreferences

  const enabledLayerText = useMemo(() => {
    const layerNameMap: Record<string, string> = {
      rain: '降水图层',
      temp: '温度图层',
      wind: '风场图层',
      warning: '预警标注',
      typhoon: '台风路径',
      risk: '风险点',
    }
    return (preferences.enabledLayers || []).map(layer => layerNameMap[layer] || layer)
  }, [preferences.enabledLayers])

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
          <p>管理账号、安全和业务默认项。</p>
        </div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={() => void handleSaveProfile()}
        >
          保存配置
        </Button>
      </div>

      <Form form={profileForm} layout="vertical">
        <div className={styles.settingsLayout}>
          <aside className={styles.rail}>
            <div className={styles.userCard}>
              <Avatar size={72} src={avatar} icon={<UserOutlined />} />
              <strong>{user.account}</strong>
              <Tag
                color={
                  user.role === 'super_admin' ? 'red' : user.role === 'admin' ? 'blue' : 'default'
                }
              >
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
                    <Input.Password
                      size="large"
                      prefix={<LockOutlined />}
                      placeholder="确认新密码"
                    />
                  </Form.Item>
                </div>

                <Button
                  danger
                  loading={changingPassword}
                  onClick={() => void handleChangePassword()}
                >
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

              <Form.Item label="默认加载图层" name={['preferences', 'enabledLayers']}>
                <Checkbox.Group className={styles.layerGroup}>
                  <Checkbox value="rain">降水图层</Checkbox>
                  <Checkbox value="temp">温度图层</Checkbox>
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
                <Form.Item
                  name={['preferences', 'autoOpenWarningPanel']}
                  valuePropName="checked"
                  noStyle
                >
                  <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                </Form.Item>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <div>
                  <h3>当前偏好</h3>
                  <p>保存前可快速核对默认图层和关键业务选项。</p>
                </div>
              </div>

              <div className={styles.tagCloud}>
                <Tag color={preferences.autoOpenWarningPanel ? 'orange' : 'default'}>
                  预警面板：{preferences.autoOpenWarningPanel ? '自动展开' : '手动打开'}
                </Tag>
                {enabledLayerText.map(item => (
                  <Tag key={item} icon={<CloudOutlined />}>
                    {item}
                  </Tag>
                ))}
              </div>
            </section>
          </main>
        </div>
      </Form>
    </div>
  )
}

export default SystemSetting
