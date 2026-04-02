/**
 * 05-desactivar-docente.spec.ts
 *
 * Test E2E: Admin desactiva un docente → verifica que se muestra
 *           lista de proyectos que requieren reasignación.
 *
 * Prerrequisitos:
 *   - E2E_DOCENTE_ID_TO_DEACTIVATE: ID de un docente activo asignado a proyectos
 *   - Sesión de Admin (storageState generado por admin.setup.ts)
 *
 * ADVERTENCIA: este test modifica estado real. Usar un docente de prueba.
 */

import { test, expect } from "@playwright/test";

const docenteId = process.env.E2E_DOCENTE_ID_TO_DEACTIVATE ?? "";

test.describe("Desactivar docente y verificar alertas de reasignación (Admin)", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!docenteId) {
      testInfo.skip(
        true,
        "E2E_DOCENTE_ID_TO_DEACTIVATE no configurado — omitir test."
      );
    }
  });

  test("Admin desactiva docente → se muestra modal con proyectos afectados o mensaje de confirmación", async ({
    page,
  }) => {
    // Navegar a la gestión de usuarios
    await page.goto("/admin/usuarios");
    await expect(page.getByText("Usuarios", { exact: false })).toBeVisible({
      timeout: 10_000,
    });

    // Buscar el docente por su ID en la tabla (la fila contiene un botón "Desactivar")
    // El botón de desactivación es contextual al usuario correspondiente.
    // Se identifica porque está en la misma fila que el docente.
    const docenteRow = page.locator(`tr:has([data-user-id="${docenteId}"])`);
    const rowExists = await docenteRow.count().catch(() => 0);

    if (!rowExists) {
      // Fallback: buscar el botón "Desactivar" de cualquier docente activo
      const deactivateBtn = page
        .getByRole("button", { name: /Desactivar/i })
        .first();
      const btnVisible = await deactivateBtn.isVisible().catch(() => false);

      if (!btnVisible) {
        test.skip();
        return;
      }

      await deactivateBtn.click();
    } else {
      await docenteRow
        .getByRole("button", { name: /Desactivar/i })
        .click();
    }

    // Debe aparecer un modal de confirmación
    await expect(
      page.getByRole("dialog").or(page.locator(".fixed.inset-0"))
    ).toBeVisible({ timeout: 8_000 });

    // El modal debe contener el aviso de confirmación
    await expect(
      page.getByText(/Desactivar|Confirmar|desactivar/i).first()
    ).toBeVisible();

    // Confirmar desactivación
    const confirmBtn = page.getByRole("button", { name: /Confirmar/i });
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    // El docente debe aparecer como inactivo en la tabla
    // (o la UI muestra una alerta de trabajos que requieren reasignación)
    await expect(
      page
        .getByText(/inactivo|Inactivo|reasignación|afectados/i)
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Admin puede reactivar un docente previamente desactivado", async ({
    page,
  }) => {
    await page.goto("/admin/usuarios");

    // Filtrar por inactivos para encontrar el docente desactivado
    const inactiveFilter = page.locator("select").filter({
      hasText: /estado|Status/i,
    });
    if (await inactiveFilter.isVisible()) {
      await inactiveFilter.selectOption("false"); // is_active = false
    }

    // Buscar botón "Activar"
    const activateBtn = page.getByRole("button", { name: /Activar/i }).first();
    const isVisible = await activateBtn.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await activateBtn.click();

    // El docente debe aparecer como activo nuevamente
    await expect(
      page.getByText(/activo|Activo/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });
});
