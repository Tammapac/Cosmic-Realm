// Isolated visual test harness for the HangarDoorController (Milestone 3).
// Open with ?door-test. Loads cosmic_station.glb and lets you open/close the
// hangar door with buttons. Completely separate from the game.

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { HangarDoorController } from "../game/scene/HangarDoorController";

export default function DoorTest() {
  const mountRef = useRef<HTMLDivElement>(null);
  const doorRef = useRef<HangarDoorController | null>(null);
  const [status, setStatus] = useState("loading model…");
  const [mode, setMode] = useState("—");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const mount = mountRef.current!;
    const w = mount.clientWidth, h = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // AgX + low exposure so the station's bright emissive glow bands (strength
    // up to ~9) don't blow the whole model out to white. This is a lighting
    // choice for the test view only — it has nothing to do with the door logic.
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 0.5;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1a);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;
    scene.environmentIntensity = 0.15;
    scene.add(new THREE.AmbientLight(0x8090a0, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(2, 4, 3);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
    camera.position.set(0, 0.5, 1.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.2, 0);
    controls.update();

    let raf = 0;
    const clock = new THREE.Clock();
    let disposed = false;

    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.load(
      "/models/stations/cosmic_station.glb",
      (gltf) => {
        if (disposed) return;
        scene.add(gltf.scene);
        // Frame the model
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        controls.target.copy(center);
        camera.position.set(center.x, center.y + maxDim * 0.3, center.z + maxDim * 1.6);
        controls.update();

        const door = new HangarDoorController({ root: gltf.scene, clips: gltf.animations });
        doorRef.current = door;
        door.setImmediate(false);
        setMode(door.doorMode);
        setStatus(door.ready ? "ready — drag to orbit, use buttons" : "NO DOOR FOUND (see console)");
      },
      undefined,
      (err) => setStatus("GLB load failed: " + (err as Error).message),
    );

    const loop = () => {
      const dt = clock.getDelta();
      doorRef.current?.update(dt);
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onResize = () => {
      const ww = mount.clientWidth, hh = mount.clientHeight;
      renderer.setSize(ww, hh);
      camera.aspect = ww / hh;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      doorRef.current?.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  const doOpen = async () => { setBusy(true); await doorRef.current?.open(); setBusy(false); };
  const doClose = async () => { setBusy(true); await doorRef.current?.close(); setBusy(false); };
  const snap = (o: boolean) => doorRef.current?.setImmediate(o);

  const btn: React.CSSProperties = {
    padding: "10px 18px", fontSize: 14, letterSpacing: 2, cursor: "pointer",
    background: "#132033", color: "#6fd4ff", border: "1px solid #2a4763", borderRadius: 6,
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0e1a", color: "#dfe6f0", fontFamily: "system-ui, sans-serif" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 2 }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>Hangar Door Test (M3)</div>
        <div style={{ fontSize: 13, color: "#8595ad", marginTop: 4 }}>
          model: cosmic_station.glb &nbsp;·&nbsp; doorMode: <b style={{ color: "#6fd4ff" }}>{mode}</b>
        </div>
        <div style={{ fontSize: 13, color: "#8595ad", marginTop: 2 }}>{status}</div>
      </div>
      <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 12, zIndex: 2 }}>
        <button style={btn} disabled={busy} onClick={doOpen}>▲ OPEN</button>
        <button style={btn} disabled={busy} onClick={doClose}>▼ CLOSE</button>
        <button style={btn} onClick={() => snap(true)}>snap open</button>
        <button style={btn} onClick={() => snap(false)}>snap closed</button>
      </div>
    </div>
  );
}
