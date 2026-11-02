import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',testIgnore:'**/soak.spec.ts',timeout:120000,workers:1,use:{baseURL:'http://127.0.0.1:4173',channel:'chrome',viewport:{width:1920,height:1080},trace:'retain-on-failure'},webServer:{command:'npm run preview',url:'http://127.0.0.1:4173',reuseExistingServer:true}});
