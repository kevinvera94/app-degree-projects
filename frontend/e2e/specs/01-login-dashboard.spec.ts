/**
 * 01-login-dashboard.spec.ts
 *
 * Test E2E: login como Admin → ver dashboard → verificar métricas clave.
 *
 * Prerrequisitos:
 *   - La aplicación corre en E2E_BASE_URL (default: http://localhost:5173)
 *   - E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD configurados en el entorno
 *
 * NOTA: este test NO reutiliza storageState — verifica el flujo completo de login.
 */

import { test, expect } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@test.usc.edu.co";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "test1234";

test.use({ storageState: { cookies: [], origins: [] } }); // sesión limpia

test.describe("Login y Dashboard del Administrador", () => {
  test("redirige a /login cuando no hay sesión", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForURL("**/login");
    await expect(page.locator("#email")).toBeVisible();
  });

  test("login exitoso → redirige al dashboard", async ({ page }) => {
    await page.goto("/login");

    await page.fill("#email", adminEmail);
    await page.fill("#password", adminPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL("**/admin/dashboard", { timeout: 15_000 });

    // Sidebar visible con el nombre del rol
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.locator("aside")).toContainText("Mensajes");
  });

  test("dashboard muestra tarjetas de resumen", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", adminEmail);
    await page.fill("#password", adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin/dashboard");

    // Las tarjetas de resumen deben estar presentes
    await expect(page.getByText("Proyectos activos")).toBeVisible();
    await expect(page.getByText("Pendientes de evaluación")).toBeVisible();
  });

  test("credenciales inválidas muestran mensaje de error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "no-existe@usc.edu.co");
    await page.fill("#password", "wrongpass");
    await page.click('button[type="submit"]');

    await expect(
      page.getByText("Credenciales inválidas", { exact: false })
    ).toBeVisible({ timeout: 8_000 });
  });

  test("logout redirige a /login", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill("#email", adminEmail);
    await page.fill("#password", adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin/dashboard");

    // Logout desde el sidebar
    await page.click("text=Cerrar sesión");
    await page.waitForURL("**/login");
    await expect(page.locator("#email")).toBeVisible();
  });
});
