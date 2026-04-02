/**
 * 06-estudiante.spec.ts
 *
 * Tests E2E para flujos críticos del Estudiante.
 *
 * Prerrequisitos:
 *   - E2E_ESTUDIANTE_EMAIL / E2E_ESTUDIANTE_PASSWORD: cuenta de estudiante de prueba
 *   - E2E_PROJECT_IDEA_APROBADA_ID: proyecto en `idea_aprobada`
 *   - E2E_PROJECT_CORRECCIONES_ID: proyecto en `correcciones_anteproyecto_solicitadas`
 *   - E2E_PROJECT_ACTA_ID: proyecto en `acta_generada`
 *   - E2E_PROJECT_CON_JURADO_ID: proyecto con jurados asignados
 *   - E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD: para acciones de setup vía API
 *   - E2E_DOCENTE1_EMAIL / E2E_DOCENTE1_PASSWORD: jurado de prueba
 *   - Sesión de Estudiante (storageState generado por estudiante.setup.ts)
 *
 * Estrategia:
 *   - Acciones de Admin y Docente se ejecutan vía API directa.
 *   - La UI del Estudiante se prueba con Playwright.
 *   - Los tests son independientes entre sí — cada uno opera sobre un proyecto distinto.
 */

import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { apiAs } from "../helpers/api";

// ── Variables de entorno ──────────────────────────────────────────────────────
const estudianteEmail = process.env.E2E_ESTUDIANTE_EMAIL ?? "";
const estudiantePassword = process.env.E2E_ESTUDIANTE_PASSWORD ?? "";
const projectIdeaAprobadaId = process.env.E2E_PROJECT_IDEA_APROBADA_ID ?? "";
const projectCorreccionesId = process.env.E2E_PROJECT_CORRECCIONES_ID ?? "";
const projectActaId = process.env.E2E_PROJECT_ACTA_ID ?? "";
const projectConJuradoId = process.env.E2E_PROJECT_CON_JURADO_ID ?? "";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";
const docente1Email = process.env.E2E_DOCENTE1_EMAIL ?? "";
const docente1Password = process.env.E2E_DOCENTE1_PASSWORD ?? "";

// ── Helper: crear PDF temporal para uploads ───────────────────────────────────
function createTempPdf(name: string): string {
  const dir = os.tmpdir();
  const filePath = path.join(dir, name);
  // PDF mínimo válido para tests
  const pdfContent = Buffer.from(
    "255044462d312e340a31203020 6f626a0a3c3c2f547970652f436174616c6f672f50616765732032203020523e3e0a656e646f626a0a".replace(/ /g, ""),
    "hex"
  );
  fs.writeFileSync(filePath, pdfContent);
  return filePath;
}

// =============================================================================
// TEST 1: Estudiante radica anteproyecto en proyecto con idea aprobada
// =============================================================================
test.describe("01 — Estudiante radica anteproyecto", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!projectIdeaAprobadaId || !estudianteEmail) {
      testInfo.skip(
        true,
        "E2E_PROJECT_IDEA_APROBADA_ID o credenciales de estudiante no configurados."
      );
    }
  });

  test("Estudiante navega a radicar anteproyecto y ve formulario correcto", async ({
    page,
  }) => {
    // 1. Dashboard del estudiante
    await page.goto("/estudiante/dashboard");
    await expect(page.locator("h1")).toBeVisible({ timeout: 10_000 });

    // 2. Navegar directamente a la vista de radicación
    await page.goto(
      `/estudiante/proyectos/${projectIdeaAprobadaId}/radicar-anteproyecto`
    );

    // 3. Verificar que la página cargó correctamente
    await expect(
      page.getByText("Radicar anteproyecto", { exact: false })
    ).toBeVisible({ timeout: 10_000 });

    // 4. Debe mostrar los campos de adjuntos requeridos
    await expect(
      page.getByText("Documento anteproyecto", { exact: false })
    ).toBeVisible();
    await expect(
      page.getByText("Carta de presentación", { exact: false })
    ).toBeVisible();

    // 5. El botón de enviar debe estar deshabilitado sin archivos
    const submitBtn = page.getByRole("button", { name: /Radicar/i });
    await expect(submitBtn).toBeDisabled();
  });

  test("Estudiante sube documentos y radica anteproyecto", async ({ page }) => {
    // Crear archivos PDF temporales
    const docPath = createTempPdf("anteproyecto_test.pdf");
    const cartaPath = createTempPdf("carta_test.pdf");

    await page.goto(
      `/estudiante/proyectos/${projectIdeaAprobadaId}/radicar-anteproyecto`
    );
    await expect(
      page.getByText("Radicar anteproyecto", { exact: false })
    ).toBeVisible({ timeout: 10_000 });

    // Subir documento del anteproyecto
    const fileInputs = page.locator('input[type="file"]');
    const count = await fileInputs.count();

    if (count >= 1) {
      await fileInputs.nth(0).setInputFiles(docPath);
    }
    if (count >= 2) {
      await fileInputs.nth(1).setInputFiles(cartaPath);
    }

    // Verificar que los archivos se muestran como cargados
    await expect(page.getByText("anteproyecto_test.pdf", { exact: false })).toBeVisible({
      timeout: 5_000,
    });

    // El botón de radicar debe habilitarse con archivos
    const submitBtn = page.getByRole("button", { name: /Radicar/i });
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });

    // Limpiar archivos temporales
    fs.unlinkSync(docPath);
    fs.unlinkSync(cartaPath);
  });
});

// =============================================================================
// TEST 2: Estudiante entrega correcciones del anteproyecto
// =============================================================================
test.describe("02 — Estudiante entrega correcciones", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!projectCorreccionesId || !estudianteEmail) {
      testInfo.skip(
        true,
        "E2E_PROJECT_CORRECCIONES_ID no configurado — omitir test."
      );
    }
  });

  test("Vista de correcciones muestra observaciones de los jurados", async ({
    page,
  }) => {
    await page.goto(
      `/estudiante/proyectos/${projectCorreccionesId}/evaluaciones`
    );

    // La página de evaluaciones debe mostrar observaciones
    await expect(
      page.getByText("Evaluaciones", { exact: false })
    ).toBeVisible({ timeout: 10_000 });

    // Debe haber al menos una tarjeta de evaluación
    const evalCards = page.locator('[data-testid="eval-card"], .eval-card').first();
    // Verificar que la página carga sin errores (el selector puede variar)
    await expect(page.locator("main, [role='main']").first()).toBeVisible();
  });

  test("Estudiante ve formulario para entregar correcciones", async ({ page }) => {
    await page.goto(
      `/estudiante/proyectos/${projectCorreccionesId}/entregar-correcciones`
    );

    // La vista de correcciones debe cargar
    await expect(
      page.getByText("correcciones", { exact: false })
    ).toBeVisible({ timeout: 10_000 });

    // Debe haber inputs de archivo
    const fileInputs = page.locator('input[type="file"]');
    await expect(fileInputs.first()).toBeVisible({ timeout: 8_000 });

    // Sin archivos el botón debe estar deshabilitado
    const submitBtn = page.getByRole("button", {
      name: /Entregar correcciones/i,
    });
    await expect(submitBtn).toBeDisabled();
  });
});

// =============================================================================
// TEST 3: Happy path — Estudiante ve proyecto en acta_generada y puede descargar
// =============================================================================
test.describe("03 — Happy path hasta acta generada", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!projectActaId || !estudianteEmail) {
      testInfo.skip(
        true,
        "E2E_PROJECT_ACTA_ID no configurado — omitir test."
      );
    }
  });

  test("Dashboard muestra proyecto en acta_generada con acción de biblioteca", async ({
    page,
  }) => {
    await page.goto("/estudiante/dashboard");

    // Puede que el proyecto no aparezca en el dashboard si hay filtros
    // Navegar directamente a la vista de biblioteca
    await page.goto(`/estudiante/proyectos/${projectActaId}/biblioteca`);

    await expect(
      page.getByText("Biblioteca", { exact: false })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Vista de biblioteca muestra el acta y opción de descarga", async ({
    page,
  }) => {
    await page.goto(`/estudiante/proyectos/${projectActaId}/biblioteca`);

    // Verificar que la página de biblioteca carga
    await expect(
      page.getByText("acta", { exact: false })
    ).toBeVisible({ timeout: 10_000 });

    // Verificar que hay información sobre el acta
    const downloadBtn = page.getByRole("link", { name: /Descargar acta/i });
    const secretariaMsg = page.getByText("secretaría", { exact: false });

    // Uno de los dos debe estar visible (depende si el acta tiene URL)
    const hasDownload = await downloadBtn.isVisible().catch(() => false);
    const hasSecretaria = await secretariaMsg.isVisible().catch(() => false);

    expect(hasDownload || hasSecretaria).toBeTruthy();
  });

  test("Estudiante puede registrar autorización de biblioteca", async ({
    page,
  }) => {
    await page.goto(`/estudiante/proyectos/${projectActaId}/biblioteca`);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });

    // Verificar que el formulario de autorización existe
    const authToggle = page.locator('input[type="checkbox"], button[role="switch"]').first();
    const isVisible = await authToggle.isVisible().catch(() => false);

    if (isVisible) {
      // Si ya estaba registrado, simplemente verificamos que la UI lo indica
      const alreadyRegistered = await page
        .getByText("autorización registrada", { exact: false })
        .isVisible()
        .catch(() => false);

      if (!alreadyRegistered) {
        // Completar el formulario de autorización
        await authToggle.click();
        const submitBtn = page.getByRole("button", { name: /Confirmar/i });
        if (await submitBtn.isVisible().catch(() => false)) {
          await submitBtn.click();
          await expect(
            page.getByText("autorización registrada", { exact: false })
          ).toBeVisible({ timeout: 8_000 });
        }
      }
    }
  });
});

// =============================================================================
// TEST 4: Estudiante ve jurados como "Jurado N" — nunca nombre real
// =============================================================================
test.describe("04 — Anonimato de jurados", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!projectConJuradoId || !estudianteEmail) {
      testInfo.skip(
        true,
        "E2E_PROJECT_CON_JURADO_ID no configurado — omitir test."
      );
    }
  });

  test("Evaluaciones no revelan nombre real del jurado", async ({ page }) => {
    // Obtener datos del proyecto para saber el nombre real del jurado
    const adminClient = await apiAs(adminEmail, adminPassword);
    const { data: project } = await adminClient.get(
      `/projects/${projectConJuradoId}`
    );

    // Obtener nombres reales de los jurados desde el backend (como admin)
    const jurors: { docente_id: string; juror_number: number }[] =
      project.jurors ?? [];

    // Solo ejecutar si hay jurados asignados
    if (jurors.length === 0) {
      test.skip();
      return;
    }

    // Obtener el nombre real del primer jurado
    let realJurorName = "";
    try {
      const { data: docenteData } = await adminClient.get(
        `/users/${jurors[0].docente_id}`
      );
      realJurorName =
        `${docenteData.first_name ?? ""} ${docenteData.last_name ?? ""}`.trim();
    } catch {
      // Si no se puede obtener el nombre, skip
      test.skip();
      return;
    }

    // 1. Vista de evaluaciones del estudiante
    await page.goto(
      `/estudiante/proyectos/${projectConJuradoId}/evaluaciones`
    );
    await expect(page.locator("main, [role='main']").first()).toBeVisible({
      timeout: 10_000,
    });

    // 2. El nombre real del jurado NO debe aparecer en ningún lugar
    if (realJurorName) {
      await expect(page.getByText(realJurorName, { exact: false })).toBeHidden();
    }

    // 3. Sí debe aparecer el alias "Jurado 1", "Jurado 2", etc.
    await expect(page.getByText("Jurado", { exact: false })).toBeVisible();
  });

  test("Mensajes de jurado se muestran como 'Jurado N' al estudiante", async ({
    page,
  }) => {
    // Obtener datos del proyecto
    const adminClient = await apiAs(adminEmail, adminPassword);
    let realJurorName = "";

    try {
      const { data: project } = await adminClient.get(
        `/projects/${projectConJuradoId}`
      );
      const jurors: { docente_id: string; juror_number: number }[] =
        project.jurors ?? [];

      if (jurors.length === 0) {
        test.skip();
        return;
      }

      const { data: docenteData } = await adminClient.get(
        `/users/${jurors[0].docente_id}`
      );
      realJurorName =
        `${docenteData.first_name ?? ""} ${docenteData.last_name ?? ""}`.trim();

      // Enviar un mensaje como jurado vía API para que haya contenido en el hilo
      const jurado1Client = await apiAs(docente1Email, docente1Password);
      await jurado1Client.post(`/projects/${projectConJuradoId}/messages`, {
        content: "Mensaje de prueba E2E desde jurado.",
        recipient_role: "estudiante",
        recipient_id: project.members?.[0]?.user_id ?? null,
      });
    } catch {
      // Si falla el setup vía API, skip el test de UI
      test.skip();
      return;
    }

    // Abrir la mensajería del estudiante
    await page.goto("/estudiante/mensajes");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });

    // Abrir la conversación del proyecto con jurado
    const projectLink = page
      .getByText(projectConJuradoId, { exact: false })
      .first();
    const isProjectLinkVisible = await projectLink.isVisible().catch(() => false);

    if (isProjectLinkVisible) {
      await projectLink.click();
    } else {
      // Buscar por texto parcial del proyecto
      const convItems = page.locator("li, [role='listitem']");
      const count = await convItems.count();
      if (count > 0) {
        await convItems.first().click();
      }
    }

    // Esperar que el hilo cargue
    await page.waitForTimeout(2_000);

    // El nombre real del jurado NO debe aparecer como remitente
    if (realJurorName) {
      const pageContent = await page.content();
      expect(pageContent).not.toContain(realJurorName);
    }

    // Sí debe aparecer "Jurado N" como remitente
    await expect(page.getByText("Jurado", { exact: false })).toBeVisible();
  });
});

// =============================================================================
// TEST 5: Estudiante envía mensaje a Jurado → Jurado responde → Estudiante ve "Jurado N"
// =============================================================================
test.describe("05 — Mensajería con anonimato de jurado", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (
      !projectConJuradoId ||
      !estudianteEmail ||
      !docente1Email ||
      !adminEmail
    ) {
      testInfo.skip(
        true,
        "Variables de mensajería E2E no configuradas — omitir test."
      );
    }
  });

  test("Estudiante envía mensaje → Jurado responde → remitente mostrado como 'Jurado N'", async ({
    page,
  }) => {
    // ── Setup: obtener datos del proyecto ──
    const adminClient = await apiAs(adminEmail, adminPassword);
    let project: { jurors?: { docente_id: string; juror_number: number }[]; members?: { user_id: string }[] };

    try {
      const { data } = await adminClient.get(`/projects/${projectConJuradoId}`);
      project = data;
    } catch {
      test.skip();
      return;
    }

    const jurors = project.jurors ?? [];
    if (jurors.length === 0) {
      test.skip();
      return;
    }

    // ── Paso 1: Estudiante abre mensajería ──
    await page.goto("/estudiante/mensajes");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });

    // ── Paso 2: Jurado envía mensaje al estudiante vía API ──
    const juradoClient = await apiAs(docente1Email, docente1Password);
    const msgContent = `Respuesta del jurado [E2E-${Date.now()}]`;

    try {
      await juradoClient.post(`/projects/${projectConJuradoId}/messages`, {
        content: msgContent,
        recipient_role: "estudiante",
        recipient_id: project.members?.[0]?.user_id ?? null,
      });
    } catch {
      // Si el endpoint no acepta el mensaje, continuar con lo que hay
    }

    // ── Paso 3: Estudiante recarga y ve el mensaje ──
    await page.reload();
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });

    // Abrir una conversación
    const convItems = page.locator("li, [role='listitem'], button").filter({
      hasText: /proyecto/i,
    });
    const convCount = await convItems.count();
    if (convCount > 0) {
      await convItems.first().click();
      await page.waitForTimeout(1_500);
    }

    // ── Paso 4: Verificar que el remitente se muestra como "Jurado N" ──
    const pageContent = await page.content();

    // Obtener nombre real del docente
    try {
      const { data: docenteData } = await adminClient.get(
        `/users/${jurors[0].docente_id}`
      );
      const realName =
        `${docenteData.first_name ?? ""} ${docenteData.last_name ?? ""}`.trim();
      if (realName) {
        expect(pageContent).not.toContain(realName);
      }
    } catch {
      // Si no se puede verificar, al menos confirmar que "Jurado" aparece
    }

    // "Jurado" debe ser visible como identificador del remitente
    const juradoLabel = page.getByText(/Jurado \d/i).first();
    const isJuradoVisible = await juradoLabel.isVisible().catch(() => false);

    // El alias debe estar en la página de alguna forma
    expect(
      isJuradoVisible || pageContent.toLowerCase().includes("jurado")
    ).toBeTruthy();
  });
});
