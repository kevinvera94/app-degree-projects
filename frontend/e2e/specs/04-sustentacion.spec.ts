/**
 * 04-sustentacion.spec.ts
 *
 * Test E2E: Admin programa sustentación → jurados registran calificaciones (API)
 *           → Admin verifica estado `trabajo_aprobado`.
 *
 * Prerrequisitos:
 *   - E2E_PROJECT_SUSTENTACION_ID: proyecto en `aprobado_para_sustentacion`
 *   - E2E_DOCENTE1_EMAIL / E2E_DOCENTE1_PASSWORD: jurado de sustentación
 *   - E2E_DOCENTE2_EMAIL / E2E_DOCENTE2_PASSWORD: jurado de sustentación
 *   - Sesión de Admin (storageState generado por admin.setup.ts)
 */

import { test, expect } from "@playwright/test";
import { apiAs } from "../helpers/api";

const projectId = process.env.E2E_PROJECT_SUSTENTACION_ID ?? "";
const docente1Email = process.env.E2E_DOCENTE1_EMAIL ?? "";
const docente1Password = process.env.E2E_DOCENTE1_PASSWORD ?? "";
const docente2Email = process.env.E2E_DOCENTE2_EMAIL ?? "";
const docente2Password = process.env.E2E_DOCENTE2_PASSWORD ?? "";

test.describe("Programar sustentación y verificar trabajo_aprobado (Admin)", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!projectId || !docente1Email || !docente2Email) {
      testInfo.skip(
        true,
        "Variables E2E de sustentación no configuradas — omitir test."
      );
    }
  });

  test("Admin programa sustentación → estado cambia a 'Sustentación programada'", async ({
    page,
  }) => {
    await page.goto(`/admin/proyectos/${projectId}`);

    await expect(
      page.getByText("Aprobado para sustentación", { exact: false })
    ).toBeVisible({ timeout: 10_000 });

    // Abrir modal de programación de sustentación
    await page.click("text=Programar sustentación");
    await expect(
      page.getByRole("heading", { name: /sustentación/i })
    ).toBeVisible();

    // Nota informativa visible
    await expect(
      page.getByText("La sustentación no cuenta con Jurado 3", { exact: false })
    ).toBeVisible();

    // Seleccionar jurados de sustentación
    const selects = page.locator("select");
    const j1Select = selects.nth(0);
    const j2Select = selects.nth(1);
    await j1Select.waitFor({ state: "visible" });

    const j1Options = await j1Select.locator("option").all();
    if (j1Options.length > 1) await j1Select.selectOption({ index: 1 });
    const j2Options = await j2Select.locator("option").all();
    if (j2Options.length > 2) await j2Select.selectOption({ index: 2 });

    // Fecha y hora de sustentación
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    const dateStr = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD
    await page.locator('input[type="date"]').fill(dateStr);
    await page.locator('input[type="time"]').fill("14:00");
    await page.locator('input[type="text"], input[placeholder*="lugar" i]').fill("Sala de Juntas — Edificio C, piso 3");

    // Confirmar
    await page.click("text=Programar sustentación");

    await expect(
      page.getByText("Sustentación programada", { exact: false })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Jurados registran calificaciones aprobatorias → estado cambia a 'Trabajo aprobado'", async ({
    page,
  }) => {
    // ── Registrar calificaciones de sustentación vía API ──
    const adminClient = await apiAs(
      process.env.E2E_ADMIN_EMAIL ?? "",
      process.env.E2E_ADMIN_PASSWORD ?? ""
    );

    // Obtener jurados de sustentación
    const { data: projectDetail } = await adminClient.get(
      `/projects/${projectId}`
    );
    const sustJurors = (
      projectDetail.jurors as {
        id: string;
        docente_id: string;
        stage: string;
        juror_number: number;
        is_active: boolean;
      }[]
    ).filter((j) => j.stage === "sustentacion" && j.is_active);

    if (sustJurors.length < 2) {
      test.skip();
      return;
    }

    const j1Client = await apiAs(docente1Email, docente1Password);
    const j2Client = await apiAs(docente2Email, docente2Password);

    // Registrar calificaciones aprobatorias (≥ 4.0 para aprobar)
    await j1Client.patch(
      `/projects/${projectId}/sustentation/grades/${sustJurors[0].id}`,
      { score: 4.5 }
    );
    await j2Client.patch(
      `/projects/${projectId}/sustentation/grades/${sustJurors[1].id}`,
      { score: 4.3 }
    );

    // ── Admin verifica el estado final en la UI ──
    await page.goto(`/admin/proyectos/${projectId}`);
    await page.reload();

    await expect(
      page.getByText("Trabajo aprobado", { exact: false })
    ).toBeVisible({ timeout: 12_000 });

    // El botón "Emitir acta" debe aparecer
    await expect(
      page.getByRole("button", { name: /Emitir acta/i })
    ).toBeVisible();
  });
});
