import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'), // @ 指向 src 目录
    },
  },
  devServer: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // 代理到后端服务器地址
        changeOrigin: true, // 是否改变请求头中的 origin 字段
      },
    },
  },
})
