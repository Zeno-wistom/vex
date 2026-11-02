import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testIgnore:[],testMatch:'**/soak.spec.ts',timeout:660000});
