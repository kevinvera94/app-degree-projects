/**
 * fixtures.ts — Fixtures de autenticación por rol para Playwright.
 *
 * Exporta un `test` extendido con tres fixtures de Page:
 *
 *   - `adminPage`       → Page con sesión de Administrador cargada
 *   - `docentePage`     → Page con sesión de Docente (Jurado) cargada
 *   - `estudiantePage`  → Page con sesión de Estudiante cargada
 *
 * Los storageState se generan en la fase de setup:
 *   e2e/setup/admin.setup.ts
 *   e2e/setup/docente.setup.ts
 *   e2e/setup/estudiante.setup.ts
 *
 * Uso en un spec:
 *   import { test, expect } from "../fixtures";
 *
 *   test("admin ve dashboard", async ({ adminPage }) => {
 *     await adminPage.goto("/admin/dashboard");
 *     await expect(adminPage.locator("h1")).toBeVisible();
 *   });
 *
 * NOTA: los fixtures crean un contexto de browser aislado por test.
 * Si un test solo necesita `page` (sin auth preconfigurada), puede seguir
 * importando desde `@playwright/test` directamente.
 */

import { test as base, type Page } from "@playwright/test";
import {
  ADMIN_AUTH_FILE,
  DOCENTE_AUTH_FILE,
  ESTUDIANTE_AUTH_FILE,
} from "../playwright.config";

type AuthFixtures = {
  /** Page con sesión de Administrador lista para usar. */
  adminPage: Page;
  /** Page con sesión de Docente (Jurado 1) lista para usar. */
  docentePage: Page;
  /** Page con sesión de Estudiante lista para usar. */
  estudiantePage: Page;
};

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: ADMIN_AUTH_FILE,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  docentePage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: DOCENTE_AUTH_FILE,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  estudiantePage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: ESTUDIANTE_AUTH_FILE,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
