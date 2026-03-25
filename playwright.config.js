import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Konfiguration
 * 
 * Diese Konfiguration definiert, wie die E2E-Tests ausgeführt werden.
 * Tests befinden sich im 'e2e/' Ordner.
 */
export default defineConfig({
  // Test-Ordner
  testDir: './e2e',
  
  // Timeout pro Test (30 Sekunden)
  timeout: 30000,
  
  // Parallele Ausführung erlauben
  fullyParallel: true,
  
  // CI-spezifisch: Erlaube kein .only() in Tests
  forbidOnly: !!process.env.CI,
  
  // CI: Retry bei Failure (vermeidet flaky tests)
  retries: process.env.CI ? 2 : 0,
  
  // CI: 4 Workers für parallele Ausführung, lokal: alle Cores
  workers: process.env.CI ? 4 : undefined,
  
  // Reporter: list überall für detaillierte Testzeilen
  reporter: process.env.CI 
    ? [
        ['html'],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        ['list']
      ]
    : 'list',
  
  // Gemeinsame Einstellungen für alle Tests
  use: {
    // Basis-URL für alle Tests
    baseURL: 'http://localhost:8000',
    
    // Tracing nur bei Retry (spart Speicher)
    trace: 'on-first-retry',
    
    // Screenshots nur bei Failure
    screenshot: 'only-on-failure',
    
    // Video nur bei Failure
    video: 'retain-on-failure',
  },

  // Browser-Konfiguration: Chromium reicht für Uni-Projekt
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Automatischer Server-Start
  webServer: {
    command: 'npx --yes http-server . -p 8000 -c-1 -s',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
