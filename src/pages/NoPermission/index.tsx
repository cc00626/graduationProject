import { Button, Result, Space } from 'antd'
import { HomeOutlined, RollbackOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'

type NoPermissionState = {
  permission?: string
}

const NoPermission = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as NoPermissionState | null

  return (
    <Result
      status="403"
      title="没有访问权限"
      subTitle={
        state?.permission
          ? `当前账号缺少 ${state.permission} 权限，请联系管理员分配后再访问。`
          : '当前账号暂无该页面的访问权限，请联系管理员处理。'
      }
      extra={
        <Space>
          <Button icon={<RollbackOutlined />} onClick={() => navigate(-1)}>
            返回上一页
          </Button>
          <Button type="primary" icon={<HomeOutlined />} onClick={() => navigate('/dashboard')}>
            返回首页
          </Button>
        </Space>
      }
    />
  )
}

export default NoPermission
