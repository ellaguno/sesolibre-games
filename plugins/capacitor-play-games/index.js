// Este paquete solo aporta el código NATIVO (Android) del plugin: lo instala
// `npx cap sync` al descubrirlo entre las dependencias.
//
// La cara JavaScript vive en la app (src/core/playGames/plugin.ts), escrita en
// TypeScript con `registerPlugin('PlayGames')`, para no duplicar los tipos.
export {};
