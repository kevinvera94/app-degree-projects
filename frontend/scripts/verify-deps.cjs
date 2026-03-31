/**
 * Script de verificación de dependencias.
 *
 * Verifica que la versión instalada de axios coincide con la fijada en
 * package.json y que no está presente ninguna versión maliciosa
 * (como 1.14.1, confirmada como malware en el GitHub Advisory Database).
 *
 * Uso:
 *   npm run verify:deps
 *
 * Códigos de salida:
 *   0 — todo OK
 *   1 — versión inesperada o módulo no encontrado
 *   2 — versión maliciosa detectada (requiere acción inmediata)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Versiones con vulnerabilidades conocidas o confirmadas como malware
const MALICIOUS_VERSIONS = ['1.14.1'];

const ROOT = path.join(__dirname, '..');
const PROJECT_PKG_PATH = path.join(ROOT, 'package.json');
const AXIOS_PKG_PATH = path.join(ROOT, 'node_modules', 'axios', 'package.json');

// ─── Leer versión esperada desde package.json (fuente de verdad única) ───────

let expectedVersion;
try {
  const projectPkg = JSON.parse(fs.readFileSync(PROJECT_PKG_PATH, 'utf8'));
  const axiosSpec = projectPkg.dependencies && projectPkg.dependencies.axios;
  if (!axiosSpec) {
    console.error('❌  axios no está listado en dependencies de package.json.');
    process.exit(1);
  }
  // La especificación debe ser una versión exacta (sin ^, ~, etc.)
  expectedVersion = axiosSpec.replace(/^[\^~>=<]+/, '');
} catch (err) {
  console.error(`❌  No se pudo leer package.json: ${err.message}`);
  process.exit(1);
}

// ─── Verificar que node_modules está instalado ───────────────────────────────

if (!fs.existsSync(AXIOS_PKG_PATH)) {
  console.error('❌  node_modules/axios no encontrado.');
  console.error('    Ejecuta: npm install');
  process.exit(1);
}

// ─── Leer versión instalada ───────────────────────────────────────────────────

let installed;
try {
  const axiosPkg = JSON.parse(fs.readFileSync(AXIOS_PKG_PATH, 'utf8'));
  installed = axiosPkg.version;
} catch (err) {
  console.error(`❌  No se pudo leer node_modules/axios/package.json: ${err.message}`);
  process.exit(1);
}

// ─── Detectar versiones maliciosas ───────────────────────────────────────────

if (MALICIOUS_VERSIONS.includes(installed)) {
  console.error(`🚨  ALERTA DE SEGURIDAD: axios@${installed} detectado.`);
  console.error(`    Esta versión está confirmada como malware (GitHub Advisory Database).`);
  console.error(`    Acción requerida:`);
  console.error(`      1. rm -rf node_modules package-lock.json`);
  console.error(`      2. npm install`);
  console.error(`      3. npm run verify:deps`);
  process.exit(2);
}

// ─── Verificar que coincide con la versión esperada ──────────────────────────

if (installed !== expectedVersion) {
  console.error(`❌  Versión inesperada de axios: ${installed}`);
  console.error(`    Se esperaba: ${expectedVersion} (según package.json)`);
  console.error(`    Ejecuta: npm ci  (para instalar exactamente lo que indica package-lock.json)`);
  process.exit(1);
}

// ─── Todo OK ─────────────────────────────────────────────────────────────────

console.log(`✅  axios@${installed} — versión verificada correctamente.`);
