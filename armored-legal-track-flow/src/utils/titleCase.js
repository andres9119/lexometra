/**
 * Convierte texto a Title Case preservando mayúsculas de sufijos legales (S.A., S.A.S, LTDA, etc.)
 * Ej: "comcel s.a." → "Comcel S.A."
 *     "empresa ltda" → "Empresa LTDA"
 */
const MINOR_WORDS = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "o", "a", "en", "con", "por", "para"]);
const LEGAL_SUFFIXES = new Set(["sa", "s.a.", "sas", "s.a.s", "ltda", "ltds", "cia", "cie", "pcs", "pj", "eu"]);

export function toTitleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word, idx) => {
      if (!word) return word;
      const clean = word.replace(/\./g, "").toLowerCase();
      
      // Si es un sufijo legal, mantener en mayúsculas
      if (LEGAL_SUFFIXES.has(clean)) {
        return word.replace(/\./g, "").toUpperCase().split("").reduce((acc, char, i, arr) => {
          if ((i + 1) % 2 === 0 && i < arr.length - 1) return acc + char + ".";
          return acc + char;
        }, "");
      }
      
      // Siempre capitalizar la primera palabra o palabras no menores
      if (idx === 0 || !MINOR_WORDS.has(clean)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");
}