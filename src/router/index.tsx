import { createBrowserRouter } from 'react-router-dom'
import Login from '@/pages/Login'
import Register from '@/pages/Register/index'
import DashBoard from '@/pages/DashBoard'
import MapComponent from '@/pages/MapPage'
// import { Navigate } from 'react-router-dom'
import Layout from '@/layout'
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
    element: <Layout />,
    children: [
      {
        path: '/dashboard',
        element: <DashBoard />,
      },
      {
        path: '/map',
        element: <MapComponent />,
      },
    ],
  },
])

export default router
