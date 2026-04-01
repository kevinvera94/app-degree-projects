import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Variables de entorno para E2E.
 * Copiar `e2e/.env.e2e.example` → `e2e/.env.e2e` y completar antes de ejecutar.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";

/** Ruta donde se almacena el estado de autenticación del Admin (generado por admin.setup.ts) */
export const ADMIN_AUTH_FILE = path.join(
  __dirname,
  "playwright/.auth/admin.json"
);

export default defineConfig({
  testDir: "./e2e",
  /* No ejecutar en paralelo — los tests comparten estado del servidor */
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    /* Tiempo máximo por acción (click, fill, etc.) */
    actionTimeout: 10_000,
    /* Tiempo máximo para navegaciones */
    navigationTimeout: 15_000,
  },

  projects: [
    /* ── Proyecto de setup: login como Admin y guardar estado ── */
    {
      name: "setup-admin",
      testMatch: "**/setup/admin.setup.ts",
    },

    /* ── Tests del Administrador (dependen del setup) ── */
    {
      name: "admin-chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ADMIN_AUTH_FILE,
      },
      dependencies: ["setup-admin"],
      testMatch: "**/specs/**/*.spec.ts",
    },
  ],

  /* Levantar el servidor de desarrollo antes de correr los tests */
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
