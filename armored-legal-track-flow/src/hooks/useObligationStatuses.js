import { useState, useEffect } from "react";

const STORAGE_KEY = "obligation_statuses_v1";

const DEFAULT_STATUSES = [
  { value: "MORA", label: "Mora" },
  { value: "DUDOSO_RECAUDO", label: "Dudoso recaudo" },
  { value: "CARTERA_CASTIGADA", label: "Cartera castigada" },
  { value: "SALDADO", label: "Saldado" },
  { value: "INACTIVA", label: "Inactiva" },
  { value: "CAN_MAL_MANEJO", label: "Can. mal manejo" },
  { value: "PAGO_VOL", label: "Pago vol." },
  { value: "PAGO_VOL_MX", label: "Pago vol. mx-xx" },
  { value: "PAGO_JUR", label: "Pago jur." },
  { value: "LIQ_PAT", label: "Liq pat" },
  { value: "CAN_PRESCR", label: "Can prescr" },
  { value: "CAN_VOL", label: "Can vol." },
  { value: "CAN_VOL_MM", label: "Can vol. -mm-mx-xx" },
  { value: "T_EXTRAVIADA", label: "T.extraviada" },
  { value: "NO_ENTREG", label: "No entreg." },
  { value: "TARJETA_NO_RENOVADA", label: "Tarjeta no renovada" },
  { value: "T_ROBADA", label: "T. robada" },
  { value: "REESTRUCTURADA", label: "Reestructurada" },
  { value: "REFINANCIADA", label: "Refinanciada" },
  { value: "TRANSF_PRODUCTO", label: "Transf.producto" },
  { value: "NORMAL", label: "Normal" },
  { value: "COMPRADA", label: "Comprada" },
  { value: "OTRO", label: "Otro" },
];

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_STATUSES;
}

function saveToStorage(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    // Dispatch a custom event so other components on the same page re-render
    window.dispatchEvent(new CustomEvent("obligationStatusesChanged"));
  } catch {}
}

export function useObligationStatuses() {
  const [statuses, setStatuses] = useState(loadFromStorage);

  // Listen for changes made by other component instances
  useEffect(() => {
    const handler = () => setStatuses(loadFromStorage());
    window.addEventListener("obligationStatusesChanged", handler);
    return () => window.removeEventListener("obligationStatusesChanged", handler);
  }, []);

  const updateStatuses = (newList) => {
    setStatuses(newList);
    saveToStorage(newList);
  };

  // Helper: get label for a value
  const getLabel = (value) => {
    const found = statuses.find(s => s.value === value);
    return found ? found.label : value;
  };

  return { statuses, updateStatuses, getLabel };
}