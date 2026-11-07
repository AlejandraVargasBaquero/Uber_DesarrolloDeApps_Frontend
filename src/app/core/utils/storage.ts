/**
 * Almacenamiento por pestaña.
 * Cada pestaña guarda su propia sesión (sessionStorage), así se pueden tener
 * abiertos pasajero y conductor en el mismo navegador sin que se pisen.
 * También se copia en localStorage para que una pestaña nueva recupere la última sesión.
 */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const appStorage = {
  getItem(key: string): string | null {
    const tab = safe(() => sessionStorage.getItem(key), null);
    if (tab !== null) return tab;
    const shared = safe(() => localStorage.getItem(key), null);
    // Al abrir una pestaña nueva, adoptar la última sesión como propia
    if (shared !== null) safe(() => sessionStorage.setItem(key, shared), undefined);
    return shared;
  },
  setItem(key: string, value: string): void {
    safe(() => sessionStorage.setItem(key, value), undefined);
    safe(() => localStorage.setItem(key, value), undefined);
  },
  removeItem(key: string): void {
    safe(() => sessionStorage.removeItem(key), undefined);
    safe(() => localStorage.removeItem(key), undefined);
  },
};
