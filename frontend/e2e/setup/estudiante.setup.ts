/**
 * estudiante.setup.ts
 *
 * Se ejecuta una sola vez antes del proyecto "estudiante-chromium".
 * Hace login como Estudiante y guarda el storageState para reutilizar la sesión.
 */

import { test as setup, expect } from "@playwright/test";
import { ESTUDIANTE_AUTH_FILE } from "../../playwright.config";

const email = process.env.E2E_ESTUDIANTE_EMAIL ?? "estudiante@test.usc.edu.co";
const password = process.env.E2E_ESTUDIANTE_PASSWORD ?? "test1234";

setup("autenticar estudiante", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("h1")).toContainText("Universidad Santiago de Cali");

  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');

  await page.waitForURL("**/estudiante/dashboard", { timeout: 15_000 });
  await expect(page.locator("h1")).toBeVisible();

  await page.context().storageState({ path: ESTUDIANTE_AUTH_FILE });
});
