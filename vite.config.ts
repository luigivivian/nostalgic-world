/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // .claude/skills ships a starter game with its own @playwright/test specs;
    // vitest's default glob picks them up and fails on the missing package.
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
})
