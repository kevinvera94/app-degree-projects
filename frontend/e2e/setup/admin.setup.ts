/**
 * admin.setup.ts
 *
 * Se ejecuta una sola vez antes del proyecto "admin-chromium".
 * Hace login como Administrador y guarda el storageState (sesión Supabase)
 * para que los tests reutilicen la sesión sin re-autenticarse.
 */

import { test as setup, expect } from "@playwright/test";
import { ADMIN_AUTH_FILE } from "../../playwright.config";

const adminEmail =
  process.env.E2E_ADMIN_EMAIL ?? "admin@test.usc.edu.co";
const adminPassword =
  process.env.E2E_ADMIN_PASSWORD ?? "test1234";

setup("autenticar admin", async ({ page }) => {
  await page.goto("/login");

  // Esperar a que el formulario esté visible
  await expect(page.locator("h1")).toContainText("Universidad Santiago de Cali");

  await page.fill("#email", adminEmail);
  await page.fill("#password", adminPassword);
  await page.click('button[type="submit"]');

  // Esperar redirección al dashboard del Admin
  await page.waitForURL("**/admin/dashboard", { timeout: 15_000 });
  await expect(page.locator("h1, h2").first()).toBeVisible();

  // Guardar estado de autenticación (localStorage con sesión de Supabase)
  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});
