import { createBrowserRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import Login from '@/pages/Login'
import Register from '@/pages/Register/index'
import DashBoard from '@/pages/DashBoard'
import MapComponent from '@/pages/MapPage/index.tsx'
import { Navigate } from 'react-router-dom'
import Layout from '@/layout'
import { isAuthenticated } from '@/utils/auth'
import EmergencyDetail from '@/pages/EmergencyDetail'
import RainMonitor from '@/pages/RainMonitor'
const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return children
}

const GuestOnlyRoute = ({ children }: { children: ReactElement }) => {
  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

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
        path: '/monitor/rain',
        element: <RainMonitor />,
      },
      {
        path: '/emergency-detail/:id',
        element: <EmergencyDetail />,
      },
    ],
  },
])

export default router
