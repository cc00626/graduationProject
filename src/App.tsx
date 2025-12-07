import { type FC } from 'react'
import { RouterProvider } from 'react-router-dom'
import router from '@/router'
const App: FC = () => {
  return (
    <div>
      <RouterProvider router={router}></RouterProvider>
    </div>
  )
}

export default App
