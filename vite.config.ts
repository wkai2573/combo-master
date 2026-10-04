import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 相對路徑：同一份建置可放在網域根目錄或 GitHub Pages 的子路徑（/repo-name/）
  base: './',
  test: { include: ['tests/**/*.test.ts'] },
});
