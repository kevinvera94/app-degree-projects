/**
 * docente.setup.ts
 *
 * Se ejecuta una sola vez antes del proyecto "docente-chromium".
 * Hace login como Docente Jurado y guarda el storageState.
 */

import { test as setup, expect } from "@playwright/test";
import { DOCENTE_AUTH_FILE } from "../../playwright.config";

const email = process.env.E2E_DOCENTE1_EMAIL ?? "docente1@test.usc.edu.co";
const password = process.env.E2E_DOCENTE1_PASSWORD ?? "test1234";

setup("autenticar docente", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("h1")).toContainText("Universidad Santiago de Cali");

  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');

  await page.waitForURL("**/docente/dashboard", { timeout: 15_000 });
  await expect(page.locator("h1")).toBeVisible();

  await page.context().storageState({ path: DOCENTE_AUTH_FILE });
});
