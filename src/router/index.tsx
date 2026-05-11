import { Navigate, createBrowserRouter } from 'react-router-dom'
import Login from '@/pages/Login'
import Register from '@/pages/Register/index'
import Layout from '@/layout'
import DashBoard from '@/pages/DashBoard'
import EmergencyDetail from '@/pages/EmergencyDetail'
import RainMonitor from '@/pages/RainMonitor'
import TemperatureMonitor from '@/pages/TemperatureMonitor'
import TyphoonTrack from '@/pages/TyphoonTrack'
import WarningList from '@/pages/WarningList'
import WarningPublish from '@/pages/WarningPublish'
import SystemSetting from '@/pages/SystemSetting'
import PermissionManagement from '@/pages/PermissionManagement'
import RoleManagement from '@/pages/RoleManagement'
import NoPermission from '@/pages/NoPermission'
import { GuestOnlyRoute, PermissionRoute, ProtectedRoute } from './guards'

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <GuestOnlyRoute>
        <Login />
      </GuestOnlyRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <GuestOnlyRoute>
        <Register />
      </GuestOnlyRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: '/dashboard',
        element: <DashBoard />,
      },
      {
        path: '/403',
        element: <NoPermission />,
      },
      {
        path: '/monitor/rain',
        element: (
          <PermissionRoute permission="page:monitor:rain">
            <RainMonitor />
          </PermissionRoute>
        ),
      },
      {
        path: '/monitor/temperature',
        element: (
          <PermissionRoute permission="page:monitor:temperature">
            <TemperatureMonitor />
          </PermissionRoute>
        ),
      },
      {
        path: '/monitor/typhoon',
        element: (
          <PermissionRoute permission="page:monitor:typhoon">
            <TyphoonTrack />
          </PermissionRoute>
        ),
      },
      {
        path: '/monitor/warning',
        element: (
          <PermissionRoute permission="page:monitor:warning">
            <WarningPublish />
          </PermissionRoute>
        ),
      },
      {
        path: '/monitor/warning-list',
        element: (
          <PermissionRoute permission="page:monitor:warning-list">
            <WarningList />
          </PermissionRoute>
        ),
      },
      {
        path: '/history',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: '/emergency-detail/:id',
        element: <EmergencyDetail />,
      },
      {
        path: '/setting',
        element: (
          <PermissionRoute permission="page:setting">
            <SystemSetting />
          </PermissionRoute>
        ),
      },
      {
        path: '/permission',
        element: (
          <PermissionRoute permission="page:permission">
            <PermissionManagement />
          </PermissionRoute>
        ),
      },
      {
        path: '/role',
        element: (
          <PermissionRoute permission="page:role">
            <RoleManagement />
          </PermissionRoute>
        ),
      },
    ],
  },
])

export default router
