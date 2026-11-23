import { defineConfig } from '@playwright/test';
import path from 'node:path';

const PGLITE_DIR = path.join(__dirname, '.pglite-e2e');

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  workers: 1,
  use: { baseURL: 'http://localhost:3200', viewport: { width: 390, height: 844 } },
  webServer: {
    command: `rm -rf "${PGLITE_DIR}" && npx next dev -p 3200`,
    url: 'http://localhost:3200/login',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ADMIN_NAME: '운영자', ADMIN_PASSWORD: 'pw1234', PGLITE_DIR },
  },
});
