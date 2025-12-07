import { createBrowserRouter } from 'react-router-dom'
import Login from '@/pages/Login'
import Register from '@/pages/Register/index'
import DashBoard from '@/pages/DashBoard'
import { Navigate } from 'react-router-dom'
const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/',
    element: <Navigate to="/dashboard" />,
    children: [
      {
        path: '/dashboard',
        element: <DashBoard />,
      },
    ],
  },
])

export default router
