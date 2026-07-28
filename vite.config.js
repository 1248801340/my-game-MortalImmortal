import { defineConfig } from 'vite';

export default defineConfig({
  base: './',          // 方便以后部署到子路径
  server: {
    port: 5173,
    open: true         // npm run dev 自动开浏览器
  }
});