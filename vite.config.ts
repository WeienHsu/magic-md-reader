import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 部署於 https://<user>.github.io/magic-md-reader/
// 因此需設定 base 為 repo 名稱
export default defineConfig({
  plugins: [react()],
  base: '/magic-md-reader/',
})
