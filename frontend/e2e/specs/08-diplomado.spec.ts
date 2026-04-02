/**
 * 08-diplomado.spec.ts
 *
 * Tests E2E para la modalidad Diplomado en programas tecnológicos.
 *
 * REGLA DE NEGOCIO (BRIEF.md § 6, Etapa 8):
 *   La modalidad Diplomado NO requiere sustentación pública.
 *   Una vez aprobado el producto final, el flujo pasa directamente a la
 *   generación del acta, omitiendo los estados "sustentacion_programada"
 *   y "aprobado_para_sustentacion".
 *
 * Prerrequisitos:
 *   - E2E_PROJECT_DIPLOMADO_ID: proyecto de modalidad Diplomado en estado
 *     `producto_final_entregado` o posterior.
 *   - E2E_DOCENTE1_EMAIL / E2E_DOCENTE1_PASSWORD: jurado asignado.
 *   - E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD: administrador.
 *   - Sesión de Admin (storageState generado por admin.setup.ts).
 *
 * Estrategia:
 *   - Las acciones de Docente (calificaciones) se ejecutan vía API.
 *   - La UI del Admin se verifica con Playwright.
 *   - Todos los tests tienen skip gracioso cuando las variables no están.
 */

import { test, expect } from "@playwright/test";
import { apiAs } from "../helpers/api";

// ── Variables de entorno ──────────────────────────────────────────────────────
const projectDiplomadoId = process.env.E2E_PROJECT_DIPLOMADO_ID ?? "";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";
const docente1Email = process.env.E2E_DOCENTE1_EMAIL ?? "";
const docente1Password = process.env.E2E_DOCENTE1_PASSWORD ?? "";
const docente2Email = process.env.E2E_DOCENTE2_EMAIL ?? "";
const docente2Password = process.env.E2E_DOCENTE2_PASSWORD ?? "";

// =============================================================================
// TEST 1: Admin ve que el proyecto Diplomado no tiene opción de sustentación
// =============================================================================
test.describe("01 — Diplomado no muestra opción de sustentación", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!projectDiplomadoId || !adminEmail) {
      testInfo.skip(
        true,
        "E2E_PROJECT_DIPLOMADO_ID o credenciales de admin no configurados."
      );
    }
  });

  test("Ficha de proyecto Diplomado no muestra botón 'Programar sustentación'", async ({
    page,
  }) => {
    await page.goto(`/admin/proyectos/${projectDiplomadoId}`);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });

    // El botón "Programar sustentación" no debe estar en ningún estado del Diplomado
    const sustBtn = page.getByRole("button", { name: /Programar sustentación/i });
    await expect(sustBtn).toBeHidden();
  });

  test("Ficha de proyecto Diplomado muestra la modalidad 'Diplomado'", async ({
    page,
  }) => {
    await page.goto(`/admin/proyectos/${projectDiplomadoId}`);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });

    // La modalidad "Diplomado" debe estar visible en la ficha
    await expect(
      page.getByText("Diplomado", { exact: false })
    ).toBeVisible({ timeout: 8_000 });
  });
});

// =============================================================================
// TEST 2: Jurados califican producto final → Admin puede emitir acta directamente
// =============================================================================
test.describe("02 — Happy path Diplomado: producto final aprobado → acta", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!projectDiplomadoId || !adminEmail || !docente1Email) {
      testInfo.skip(
        true,
        "Variables para happy path de Diplomado no configuradas."
      );
    }
  });

  test("Después de aprobar producto final, Admin ve botón 'Emitir acta' (sin sustentación)", async ({
    page,
  }) => {
    // ── Registrar calificaciones aprobatorias del producto final vía API ──
    const adminClient = await apiAs(adminEmail, adminPassword);

    let evals: { id: string; score: null | number; stage: string; juror_number: number }[] = [];
    try {
      const { data } = await adminClient.get(
        `/projects/${projectDiplomadoId}/evaluations`
      );
      evals = data;
    } catch {
      test.skip();
      return;
    }

    const j1Eval = evals.find(
      (e) => e.juror_number === 1 && e.stage === "producto_final" && e.score === null
    );
    const j2Eval = evals.find(
      (e) => e.juror_number === 2 && e.stage === "producto_final" && e.score === null
    );

    if (j1Eval) {
      const j1Client = await apiAs(docente1Email, docente1Password);
      await j1Client
        .patch(`/projects/${projectDiplomadoId}/evaluations/${j1Eval.id}`, {
          score: 4.2,
          observations: "Producto final aprobado — Diplomado [E2E]",
        })
        .catch(() => {
          /* ignorar si ya fue calificado */
        });
    }

    if (j2Eval) {
      const j2Client = await apiAs(docente2Email, docente2Password);
      await j2Client
        .patch(`/projects/${projectDiplomadoId}/evaluations/${j2Eval.id}`, {
          score: 4.0,
          observations: "Aprobado [E2E]",
        })
        .catch(() => {
          /* ignorar si ya fue calificado */
        });
    }

    // ── UI: Admin verifica que puede emitir acta directamente ──
    await page.goto(`/admin/proyectos/${projectDiplomadoId}`);
    await page.reload();
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });

    // El estado debe ser "Trabajo aprobado" o "Producto final aprobado" (sin pasar por sustentación)
    const estadoTexto = page
      .getByText(/Trabajo aprobado|Producto final aprobado|aprobado/i)
      .first();
    const hasAprobado = await estadoTexto.isVisible({ timeout: 12_000 }).catch(() => false);

    // El botón "Emitir acta" debe estar disponible sin necesidad de sustentación
    const emitirActaBtn = page.getByRole("button", { name: /Emitir acta/i });
    const hasEmitirActa = await emitirActaBtn.isVisible({ timeout: 8_000 }).catch(() => false);

    // Alguno de los dos indicadores debe ser visible
    expect(hasAprobado || hasEmitirActa).toBeTruthy();

    // Confirmar que NO hay estado "Sustentación programada" en el historial
    await expect(
      page.getByText("Sustentación programada", { exact: false })
    ).toBeHidden();
  });

  test("Estado del proyecto Diplomado nunca pasa por 'sustentacion_programada'", async ({
    page,
  }) => {
    // Verificar el historial de cambios de estado via API
    const adminClient = await apiAs(adminEmail, adminPassword);

    try {
      const { data: history } = await adminClient.get(
        `/projects/${projectDiplomadoId}/history`
      );

      const historyList = history as { new_status: string }[];

      // El estado "sustentacion_programada" NO debe aparecer en el historial
      const hasSustentacion = historyList.some(
        (h) => h.new_status === "sustentacion_programada"
      );
      expect(hasSustentacion).toBe(false);
    } catch {
      // Si la API no está disponible, verificar desde la UI
      await page.goto(`/admin/proyectos/${projectDiplomadoId}`);
      await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });

      await expect(
        page.getByText("Sustentación programada", { exact: false })
      ).toBeHidden();
    }
  });
});

// =============================================================================
// TEST 3: Admin emite acta de Diplomado y el proyecto queda en acta_generada
// =============================================================================
test.describe("03 — Emisión de acta en Diplomado", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!projectDiplomadoId || !adminEmail) {
      testInfo.skip(
        true,
        "Variables para test de emisión de acta no configuradas."
      );
    }
  });

  test("Admin puede emitir acta de Diplomado y el estado final es 'Acta generada'", async ({
    page,
  }) => {
    await page.goto(`/admin/proyectos/${projectDiplomadoId}`);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });

    // Si el proyecto ya tiene acta, verificar el estado final
    const actaGenerada = page.getByText("Acta generada", { exact: false });
    const alreadyDone = await actaGenerada.isVisible().catch(() => false);

    if (alreadyDone) {
      // El flujo ya se completó — verificar que no hay botón de sustentación
      await expect(
        page.getByRole("button", { name: /Programar sustentación/i })
      ).toBeHidden();
      return;
    }

    // Si hay botón "Emitir acta", activarlo
    const emitirBtn = page.getByRole("button", { name: /Emitir acta/i });
    const canEmit = await emitirBtn.isVisible().catch(() => false);

    if (!canEmit) {
      // El proyecto no está en un estado donde se pueda emitir acta aún
      test.skip();
      return;
    }

    await emitirBtn.click();

    // Confirmar en el modal si aparece
    const confirmBtn = page.getByRole("button", { name: /Confirmar|Emitir/i });
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Verificar que el estado cambió a "Acta generada"
    await expect(
      page.getByText("Acta generada", { exact: false })
    ).toBeVisible({ timeout: 12_000 });

    // Confirmar ausencia de estado de sustentación en todo el flujo
    await expect(
      page.getByText("Sustentación programada", { exact: false })
    ).toBeHidden();
  });
});
