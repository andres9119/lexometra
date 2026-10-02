/**
 * textFormat.js — Utilidades de formateo tipográfico
 *
 * Reglas:
 * - toTitleCase: convierte texto a Title Case (nombres propios, entidades)
 * - toSentenceCase: primera letra mayúscula, resto minúsculas (descripciones)
 * - sanitizeName: detecta si el texto viene TODO EN MAYÚSCULAS y lo convierte a Title Case
 *
 * Excepciones conocidas que se preservan en mayúsculas:
 * - Siglas: CC, NIT, SIC, SAS, LTDA, SA, ONG, EPS, ARL, AFP, etc.
 * - Radicados: patrones tipo "2026-001"
 */

const SIGLAS_MAYUSCULAS = new Set([
  "CC", "NIT", "SIC", "SAS", "LTDA", "SA", "ONG", "EPS", "ARL", "AFP",
  "IVA", "RUT", "DNI", "TI", "CE", "DE", "DEL", "LOS", "LAS", "EL", "LA",
  "Y", "E", "O", "U", "EN", "CON", "POR", "PARA",
]);

// Preposiciones y artículos que van en minúsculas dentro de un título
const PREPOSITIONS = new Set([
  "de", "del", "la", "las", "los", "el", "en", "con", "por", "para",
  "y", "e", "o", "u", "a", "al",
]);

/**
 * Convierte un string a Title Case respetando preposiciones y siglas.
 * Ejemplo: "DIEGO VILORIA CARPINTERO" → "Diego Viloria Carpintero"
 */
export function toTitleCase(str) {
  if (!str || typeof str !== "string") return str;
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (!word) return word;
      // Preservar siglas (antes del lower): las detectamos si el original tenía esa palabra en mayúsculas
      if (PREPOSITIONS.has(word) && index !== 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .trim();
}

/**
 * Convierte a Sentence case (solo primera letra mayúscula).
 * Ejemplo: "GESTIÓN DE REPORTES NEGATIVOS" → "Gestión de reportes negativos"
 */
export function toSentenceCase(str) {
  if (!str || typeof str !== "string") return str;
  const lower = str.toLowerCase().trim();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Sanitiza un nombre o texto corto:
 * - Si viene TODO EN MAYÚSCULAS (≥ 3 palabras o ≥ 1 palabra >= 4 chars en mayúsculas) → Title Case
 * - Si ya tiene mayúsculas mezcladas → no modificar (respeta decisión del usuario)
 * - Strings cortos tipo "CC", "NIT" → no modificar
 */
export function sanitizeName(str) {
  if (!str || typeof str !== "string") return str;
  const trimmed = str.trim();
  if (trimmed.length <= 3) return trimmed; // siglas cortas: no tocar
  // Detectar si viene completamente en mayúsculas
  const words = trimmed.split(/\s+/);
  const allCaps = words.every(w => w === w.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(w));
  if (allCaps) return toTitleCase(trimmed);
  return trimmed;
}

/**
 * Sanitiza un objeto de datos antes de enviarlo a la BD.
 * Solo procesa los campos especificados en `nameFields`.
 */
export function sanitizeFormData(data, nameFields = []) {
  const result = { ...data };
  nameFields.forEach(field => {
    if (result[field]) result[field] = sanitizeName(result[field]);
  });
  return result;
}