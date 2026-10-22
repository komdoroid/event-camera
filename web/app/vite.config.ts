import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', '');
  // 本番ビルドで API の向き先が未設定のまま出荷しない
  if (command === 'build' && !env.VITE_API_BASE && env.VITE_USE_MOCK_API !== '1') {
    throw new Error('VITE_API_BASE が未設定です。例: VITE_API_BASE=https://xxx.workers.dev npm run build（モックなら VITE_USE_MOCK_API=1）');
  }
  return { plugins: [react()], server: { port: 5173 } };
});
