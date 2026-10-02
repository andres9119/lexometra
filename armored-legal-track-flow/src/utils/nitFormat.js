/**
 * Formatea un NIT con puntos cada 3 dígitos.
 * Acepta con o sin puntos, siempre devuelve formateado.
 * Ej: "900123456" → "900.123.456"
 *     "900.123.456" → "900.123.456"
 */
export function formatNIT(nit) {
  if (!nit) return "";
  // Limpiar puntos existentes
  const clean = nit.replace(/\D/g, "");
  if (clean.length === 0) return "";
  // Agregar puntos cada 3 dígitos de derecha a izquierda
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Extrae solo los dígitos del NIT formateado
 */
export function getNITDigits(nit) {
  return nit.replace(/\D/g, "");
}