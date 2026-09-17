import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type {Plugin} from 'vite';
import {defineConfig} from 'vite';

/**
 * 将产物 HTML 中的 "./assets/xxx" 改写为 "assets/xxx"（去掉 ./ 前缀），
 * 便于小程序 WebView 等环境直接以相对路径引用资源。
 */
function stripDotSlashInHtml(): Plugin {
  return {
    name: 'strip-dot-slash-in-html',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(/((?:src|href)=")\.\//g, '$1');
      },
    },
  };
}

export default defineConfig(() => {
  return {
    // 使用相对路径引用资源，便于在小程序 WebView 等非根路径环境下加载
    base: './',
    plugins: [react(), tailwindcss(), stripDotSlashInHtml()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
