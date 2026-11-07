import { ChangeDetectorRef, DestroyRef, Injectable, inject } from '@angular/core';

/**
 * POR QUÉ EXISTE ESTE ARCHIVO (la causa real de la "lentitud"):
 *
 * Angular 22 funciona "sin zone.js" (zoneless). En ese modo la pantalla solo se vuelve a dibujar
 * cuando hay un clic/tecla en la plantilla o cuando cambia un signal. Cuando la respuesta de la API
 * llegaba (en milisegundos), los datos quedaban guardados en el componente pero la pantalla NO se
 * actualizaba hasta que el usuario hacía otra cosa. Por eso todo "se demoraba demasiado".
 *
 * Solución: cada página se registra con useAutoRefresh() y este servicio le pide a Angular que la
 * vuelva a pintar cuando llega una respuesta HTTP (lo hace el interceptor), cuando corre un
 * temporizador o cuando termina una promesa (GPS, mapa, búsqueda de direcciones).
 */
@Injectable({ providedIn: 'root' })
export class UiRefresh {
  private views = new Set<ChangeDetectorRef>();

  register(cdr: ChangeDetectorRef): void {
    this.views.add(cdr);
  }

  unregister(cdr: ChangeDetectorRef): void {
    this.views.delete(cdr);
  }

  /** Pide a Angular que vuelva a pintar las páginas abiertas (Angular agrupa todo en un solo repintado). */
  request(): void {
    this.views.forEach((cdr) => cdr.markForCheck());
  }

  /** setInterval que repinta la vista en cada vuelta. */
  interval(fn: () => void, ms: number): ReturnType<typeof setInterval> {
    return setInterval(() => {
      fn();
      this.request();
    }, ms);
  }

  /** setTimeout que repinta la vista al ejecutarse. */
  timeout(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      fn();
      this.request();
    }, ms);
  }
}

/**
 * Úsalo como campo en cada página:  private ui = useAutoRefresh();
 * Registra la página para que se actualice sola con las respuestas de la API.
 */
export function useAutoRefresh(): UiRefresh {
  const ui = inject(UiRefresh);
  const cdr = inject(ChangeDetectorRef);
  ui.register(cdr);
  inject(DestroyRef).onDestroy(() => ui.unregister(cdr));
  return ui;
}
