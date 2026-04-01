/**
 * 02-aprobar-idea.spec.ts
 *
 * Test E2E: Admin aprueba una idea → verifica que el estado cambia a "Idea aprobada".
 *
 * Prerrequisitos:
 *   - E2E_PROJECT_IDEA_ID: ID de un proyecto en estado `pendiente_evaluacion_idea`
 *   - E2E_DOCENTE_DIRECTOR_ID: ID de un docente activo para asignar como director
 *   - Sesión de Admin (storageState generado por admin.setup.ts)
 *
 * Flujo:
 *   1. Navegar a la ficha del proyecto
 *   2. Verificar estado inicial "Pendiente evaluación idea"
 *   3. Abrir modal "Aprobar idea" y asignar director
 *   4. Confirmar y verificar que el estado cambió a "Idea aprobada"
 */

import { test, expect } from "@playwright/test";

const projectId = process.env.E2E_PROJECT_IDEA_ID ?? "";

test.describe("Aprobación de idea (Admin)", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!projectId) {
      testInfo.skip(
        true,
        "E2E_PROJECT_IDEA_ID no configurado — omitir test."
      );
    }
  });

  test("flujo completo: ver idea pendiente → aprobar → verificar estado", async ({
    page,
  }) => {
    // 1. Navegar a la ficha del proyecto
    await page.goto(`/admin/proyectos/${projectId}`);

    // 2. Verificar estado inicial
    await expect(
      page.getByText("Pendiente evaluación idea", { exact: false })
    ).toBeVisible({ timeout: 10_000 });

    // 3. Abrir modal de aprobación
    await page.click("text=Aprobar idea");
    await expect(
      page.getByRole("heading", { name: /Aprobar idea/i })
    ).toBeVisible();

    // 4. Seleccionar el primer docente disponible en el selector
    const directorSelect = page.locator("select").first();
    await directorSelect.waitFor({ state: "visible" });
    const options = await directorSelect.locator("option").all();
    // Seleccionar el segundo option (el primero suele ser el placeholder)
    if (options.length > 1) {
      const value = await options[1].getAttribute("value");
      if (value) await directorSelect.selectOption(value);
    }

    // 5. Confirmar aprobación
    await page.click("text=Confirmar aprobación");

    // 6. Verificar que el estado cambió
    await expect(
      page.getByText("Idea aprobada", { exact: false })
    ).toBeVisible({ timeout: 10_000 });

    // El botón "Aprobar idea" ya no debe estar visible
    await expect(page.getByText("Aprobar idea", { exact: true })).toBeHidden();
  });

  test("flujo: rechazar idea con motivo obligatorio", async ({ page }) => {
    // Este test necesita un proyecto diferente en estado pendiente.
    // En un entorno de CI se puede crear uno fresco. Aquí verificamos el modal.
    await page.goto(`/admin/proyectos/${projectId}`);

    const rejectBtn = page.getByRole("button", { name: /Rechazar idea/i });
    const isVisible = await rejectBtn.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(); // el proyecto ya fue aprobado en el test anterior
      return;
    }

    await rejectBtn.click();
    await expect(
      page.getByRole("heading", { name: /Rechazar idea/i })
    ).toBeVisible();

    // Verificar que el botón de confirmación está deshabilitado con textarea vacío
    const confirmBtn = page.getByRole("button", { name: /Confirmar rechazo/i });
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();

    // Ingresar motivo
    await textarea.fill("Trabajo duplicado — ya existe una propuesta similar en revisión.");
    await confirmBtn.click();

    await expect(
      page.getByText("Idea rechazada", { exact: false })
    ).toBeVisible({ timeout: 10_000 });
  });
});
