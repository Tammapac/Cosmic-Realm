/// <reference types="vite/client" />

// Second module instance of the ship layer (Vite treats a query-suffixed
// import as a distinct module). Used to render ENEMY ships into an offscreen
// canvas that Pixi composites BELOW names/health bars/projectiles — same
// technique as the station layer — while the plain import keeps rendering the
// player + other players on the top DOM canvas.
declare module "*three-ship-layer?instance=enemy" {
  export * from "./game/three-ship-layer";
}
