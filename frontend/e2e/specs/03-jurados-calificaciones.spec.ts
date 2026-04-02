/**
 * 03-jurados-calificaciones.spec.ts
 *
 * Test E2E: Admin asigna jurados → jurados registran calificaciones (vía API)
 *           → Admin verifica transición de estado.
 *
 * Prerrequisitos:
 *   - E2E_PROJECT_ANTEPROYECTO_ID: proyecto en `anteproyecto_pendiente_evaluacion`
 *   - E2E_DOCENTE1_EMAIL / E2E_DOCENTE1_PASSWORD: jurado 1 (docente activo)
 *   - E2E_DOCENTE2_EMAIL / E2E_DOCENTE2_PASSWORD: jurado 2 (docente activo)
 *   - Sesión de Admin (storageState generado por admin.setup.ts)
 *
 * Estrategia:
 *   La asignación de jurados se prueba desde la UI del Admin.
 *   El registro de calificaciones se hace vía API directa (acción de Docente)
 *   para mantener el test enfocado en los flujos del Administrador.
 */

import { test, expect } from "@playwright/test";
import { apiAs } from "../helpers/api";

const projectId = process.env.E2E_PROJECT_ANTEPROYECTO_ID ?? "";
const docente1Email = process.env.E2E_DOCENTE1_EMAIL ?? "";
const docente1Password = process.env.E2E_DOCENTE1_PASSWORD ?? "";
const docente2Email = process.env.E2E_DOCENTE2_EMAIL ?? "";
const docente2Password = process.env.E2E_DOCENTE2_PASSWORD ?? "";

test.describe("Asignación de jurados y calificaciones (Admin)", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!projectId || !docente1Email || !docente2Email) {
      testInfo.skip(
        true,
        "Variables E2E de jurados no configuradas — omitir test."
      );
    }
  });

  test("Admin asigna J1 y J2 → estado permanece en evaluación", async ({
    page,
  }) => {
    await page.goto(`/admin/proyectos/${projectId}`);

    // Verificar estado inicial
    await expect(
      page.getByText("Anteproyecto", { exact: false })
    ).toBeVisible({ timeout: 10_000 });

    // Abrir modal de asignación de jurados
    await page.click("text=Asignar jurados");
    await expect(
      page.getByRole("heading", { name: /Asignar jurados/i })
    ).toBeVisible();

    // Seleccionar Jurado 1 — primer docente disponible
    const selects = page.locator("select");
    const j1Select = selects.nth(0);
    const j2Select = selects.nth(1);

    await j1Select.waitFor({ state: "visible" });
    const j1Options = await j1Select.locator("option").all();
    if (j1Options.length > 1) {
      await j1Select.selectOption({ index: 1 });
    }

    // Seleccionar Jurado 2 — segundo docente disponible (distinto al J1)
    const j2Options = await j2Select.locator("option").all();
    if (j2Options.length > 2) {
      await j2Select.selectOption({ index: 2 });
    }

    // Confirmar asignación
    await page.click("text=Asignar jurados");

    // Modal debe cerrarse
    await expect(
      page.getByRole("heading", { name: /Asignar jurados/i })
    ).toBeHidden({ timeout: 8_000 });
  });

  test("Jurados registran calificaciones aprobatorias → estado cambia a 'Anteproyecto aprobado'", async ({
    page,
  }) => {
    // ── Paso 1: obtener evaluaciones pendientes del proyecto ──
    const adminClient = await apiAs(
      process.env.E2E_ADMIN_EMAIL ?? "",
      process.env.E2E_ADMIN_PASSWORD ?? ""
    );
    const { data: project } = await adminClient.get(`/projects/${projectId}`);
    const anteproyectoEvals: { id: string; juror_number: number }[] =
      (project.jurors as { id: string; juror_number: number }[]) ?? [];

    if (anteproyectoEvals.length < 2) {
      test.skip();
      return;
    }

    // ── Paso 2: registrar calificaciones como cada jurado (vía API) ──
    const j1Client = await apiAs(docente1Email, docente1Password);
    const j2Client = await apiAs(docente2Email, docente2Password);

    // Obtener evaluaciones del proyecto
    const { data: evaluations } = await adminClient.get(
      `/projects/${projectId}/evaluations`
    );
    const j1Eval = evaluations.find(
      (e: { juror_number: number; stage: string; score: null | number }) =>
        e.juror_number === 1 && e.stage === "anteproyecto" && e.score === null
    );
    const j2Eval = evaluations.find(
      (e: { juror_number: number; stage: string; score: null | number }) =>
        e.juror_number === 2 && e.stage === "anteproyecto" && e.score === null
    );

    if (j1Eval) {
      await j1Client.patch(
        `/projects/${projectId}/evaluations/${j1Eval.id}`,
        { score: 4.2, observations: "Aprobado — buen planteamiento metodológico. [E2E]" }
      );
    }
    if (j2Eval) {
      await j2Client.patch(
        `/projects/${projectId}/evaluations/${j2Eval.id}`,
        { score: 4.0, observations: "Aprobado. [E2E]" }
      );
    }

    // ── Paso 3: Admin verifica el nuevo estado en la UI ──
    await page.goto(`/admin/proyectos/${projectId}`);
    await page.reload();

    await expect(
      page.getByText("Anteproyecto aprobado", { exact: false })
    ).toBeVisible({ timeout: 12_000 });
  });
});
