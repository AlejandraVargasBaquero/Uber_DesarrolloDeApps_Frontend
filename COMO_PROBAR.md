# Cómo probar RideApp

## En casa (sin el servidor del profesor)

Necesitas **dos terminales**.

**Terminal 1 — backend local** (carpeta `uber-backend-local`):

```bash
cd uber-backend-local
npm start
```

Queda en `http://localhost:8000/api`, con las mismas rutas y respuestas de la API del profesor.

**Terminal 2 — la app** (esta carpeta):

```bash
npm start
```

(o `ionic serve`, funciona igual). Se abre en `http://localhost:8100`.

### Cuentas de prueba del backend local

| Rol | Correo | Clave |
|---|---|---|
| Pasajero | cliente@uber.com | cliente123 |
| Conductor (aprobado) | conductor@uber.com | conductor123 |
| Conductor (aprobado) | conductor2@uber.com | conductor123 |
| Conductor (pendiente) | andres@uber.com | conductor123 |
| Admin | admin@uber.com | admin123 |

### Probar pasajero y conductor a la vez

- Abre una pestaña normal con el pasajero y **otra ventana de incógnito** con el conductor (cada una guarda su propia sesión).
- O deja que un conductor automático haga el viaje: en una tercera terminal, `cd uber-backend-local` y `npm run bot`. Acepta tu solicitud, se mueve en el mapa hasta recogerte, inicia y finaliza el viaje.

## En clase (servidor del profesor)

```bash
npm run clase
```

Usa `proxy.clase.json`, que apunta a `http://20.20.1.42:8000`. **Si el profesor cambia la IP, solo se cambia en ese archivo.**

## ¿Por qué ahora es rápido?

1. **La causa principal:** Angular 22 funciona sin `zone.js` ("zoneless"). Cuando la API respondía, los datos llegaban pero **la pantalla no se volvía a dibujar** hasta que hacías otro clic. Ahora cada página se repinta sola al recibir la respuesta (`src/app/core/utils/ui-refresh.ts`, usado por el interceptor y las páginas).
2. **Proxy de desarrollo** (`proxy.conf.json` / `proxy.clase.json`): la app llama a `/api` en su mismo origen. Así el navegador ya no hace la petición previa `OPTIONS` (CORS) antes de cada llamada, que en el servidor de clase duplicaba el tiempo.
3. **Leaflet servido desde la app** (`src/assets/leaflet`) en vez de unpkg.com, y la fuente de Google ya no bloquea la carga: sin internet, la app abre igual.
4. **Tiempo máximo de 20 s** en todas las peticiones (antes algunas podían girar sin fin), y la tarifa activa se guarda 1 minuto para no volver a pedirla en cada pantalla.

## Otros arreglos

- Los textos salían **negros sobre fondo negro** si Windows estaba en modo claro. Ahora el tema oscuro se fuerza siempre.
- Login con la marca **RideApp** como en el mockup 1.
- Pago con **Efectivo / Tarjeta** antes de confirmar el viaje (HU-10). La API no tiene pagos, así que la elección se guarda en el dispositivo y aparece en el resumen al calificar.
- El aviso de cancelación muestra la tarifa de cancelación: **$0** (HU-13).
- Si el pasajero cancela mientras el conductor va en camino, el conductor ve "Viaje cancelado por el pasajero" y puede volver a las solicitudes (antes quedaba atascado).
- Sondeo cada 5 s en vez de 7 s: el pasajero ve antes que el conductor aceptó.
