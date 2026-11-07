// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // '/api' pasa por el proxy de desarrollo (proxy.conf.json):
  //   npm start / ionic serve  -> backend local  (http://localhost:8000)
  //   npm run clase            -> servidor del profesor (proxy.clase.json)
  // Así el navegador no hace la petición previa OPTIONS (CORS) en cada llamada y todo responde más rápido.
  apiUrl: '/api',
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
