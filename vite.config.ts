import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

function git(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

// 版本＝package.json 的版本號＋建置當下的 commit 代碼（有未提交變更會加 +），方便分辨是不是新版
const commit = (git('git rev-parse --short HEAD') || 'nogit') + (git('git status --porcelain') ? '+' : '');
const builtAt = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });

export default defineConfig({
  plugins: [
    react(),
    {
      // 瀏覽器分頁標題也帶上版本（不必等 JavaScript 載入）
      name: 'html-title-version',
      transformIndexHtml: (html) => html.replace('<title>連擊大師</title>', `<title>連擊大師 v${pkg.version}</title>`),
    },
  ],
  // 相對路徑：同一份建置可放在網域根目錄或 GitHub Pages 的子路徑（/repo-name/）
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_BUILT_AT__: JSON.stringify(builtAt),
  },
  test: { include: ['tests/**/*.test.ts'] },
});
