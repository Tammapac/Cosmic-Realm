import * as THREE from "three";

// Simple 2-layer noise function (cheap hash-based noise)
const NOISE_GLSL = `
  // Hash function for pseudo-random values
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // Simple 2D noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // smoothstep

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
`;

const VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform vec2 uOffset;
  uniform vec2 uScale;
  uniform float uTime;
  uniform float uAlpha;
  uniform float uIntensity;
  uniform float uPixelSize;
  uniform vec2 uResolution;

  varying vec2 vUv;

  ${NOISE_GLSL}

  void main() {
    // Apply pixel-art effect (step quantization)
    vec2 pixelUv = floor(vUv * uResolution / uPixelSize) * uPixelSize / uResolution;

    // Layer 1: Slow large nebula clouds
    vec2 uv1 = (pixelUv + uOffset * 0.0003) * uScale.x;
    float n1 = noise(uv1 + uTime * 0.00008);
    n1 = pow(n1, 2.0); // Darker, more contrast

    // Layer 2: Faster smaller detail
    vec2 uv2 = (pixelUv + uOffset * 0.0005) * uScale.y;
    float n2 = noise(uv2 * 2.0 + uTime * 0.00015);
    n2 = pow(n2, 3.0); // Even darker, sparse highlights

    // Combine layers - less dense for brighter look
    float nebula = n1 * 0.5 + n2 * 0.3;
    nebula = clamp(nebula * uIntensity, 0.0, 1.0);

    // Color palette: bright vibrant space colors
    vec3 colorDark = vec3(0.3, 0.4, 0.6);      // Bright blue base
    vec3 colorMid = vec3(0.4, 0.65, 0.85);     // Vivid cyan
    vec3 colorBright = vec3(0.7, 0.5, 0.9);    // Bright purple/magenta

    vec3 color = mix(colorDark, colorMid, nebula);
    color = mix(color, colorBright, pow(nebula, 3.0) * 0.4); // More purple highlights

    // Apply banding/stepping for pixel-art look
    color = floor(color * 16.0) / 16.0;

    gl_FragColor = vec4(color, uAlpha);
  }
`;

export interface ThreeNebulaConfig {
  enabled: boolean;
  renderScale: number;  // Internal render resolution scale (0.5 = half-res)
  pixelSize: number;    // Pixel grid size for chunky look
  alpha: number;        // Overall opacity
  intensity: number;    // Brightness multiplier
  speedA: number;       // Layer 1 animation speed
  speedB: number;       // Layer 2 animation speed
  scaleA: number;       // Layer 1 noise scale
  scaleB: number;       // Layer 2 noise scale
}

export class ThreeNebulaBackground {
  private plane: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private startTime: number = 0;
  private config: ThreeNebulaConfig;

  constructor(config: ThreeNebulaConfig) {
    this.config = config;
  }

  init(scene: THREE.Scene, camera: THREE.OrthographicCamera, renderer: THREE.WebGLRenderer): void {
    if (!this.config.enabled) return;

    this.scene = scene;
    this.camera = camera;
    this.startTime = performance.now();

    // Create fullscreen quad sized to camera frustum
    const width = camera.right - camera.left;
    const height = camera.top - camera.bottom;
    const geometry = new THREE.PlaneGeometry(width, height);

    // Create shader material
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uOffset: { value: new THREE.Vector2(0, 0) },
        uScale: { value: new THREE.Vector2(this.config.scaleA, this.config.scaleB) },
        uTime: { value: 0 },
        uAlpha: { value: this.config.alpha },
        uIntensity: { value: this.config.intensity },
        uPixelSize: { value: this.config.pixelSize },
        uResolution: { value: new THREE.Vector2(window.innerWidth * this.config.renderScale, window.innerHeight * this.config.renderScale) }
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    // Create mesh
    this.plane = new THREE.Mesh(geometry, this.material);
    this.plane.renderOrder = -1000; // Render first (behind everything)
    this.plane.position.set(0, -500, 0); // Far behind ships (below camera at Y=500)
    this.plane.rotation.x = -Math.PI / 2; // Rotate to face up toward camera

    scene.add(this.plane);
    console.log("[ThreeNebula] Initialized - size:", width.toFixed(0), "x", height.toFixed(0), "pixelSize:", this.config.pixelSize);
  }

  update(cameraPos: { x: number; y: number }, time: number): void {
    if (!this.config.enabled || !this.material) return;

    const elapsed = (performance.now() - this.startTime) * 0.001; // seconds

    // Update uniforms (parallax camera offset)
    this.material.uniforms.uOffset.value.set(
      cameraPos.x * this.config.speedA,
      cameraPos.y * this.config.speedA
    );
    this.material.uniforms.uTime.value = elapsed;
    this.material.uniforms.uAlpha.value = this.config.alpha;
    this.material.uniforms.uIntensity.value = this.config.intensity;
    this.material.uniforms.uPixelSize.value = this.config.pixelSize;
  }

  resize(width: number, height: number): void {
    if (!this.config.enabled || !this.material || !this.plane || !this.camera) return;

    // Update shader resolution
    this.material.uniforms.uResolution.value.set(
      width * this.config.renderScale,
      height * this.config.renderScale
    );

    // Resize plane geometry to match camera frustum
    const planeWidth = this.camera.right - this.camera.left;
    const planeHeight = this.camera.top - this.camera.bottom;
    this.plane.geometry.dispose();
    this.plane.geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
  }

  destroy(): void {
    if (this.plane && this.scene) {
      this.scene.remove(this.plane);
      this.plane.geometry.dispose();
      if (this.material) {
        this.material.dispose();
      }
      this.plane = null;
      this.material = null;
      this.scene = null;
      this.camera = null;
    }
  }

  updateConfig(config: Partial<ThreeNebulaConfig>): void {
    Object.assign(this.config, config);

    if (this.material) {
      this.material.uniforms.uScale.value.set(this.config.scaleA, this.config.scaleB);
      this.material.uniforms.uAlpha.value = this.config.alpha;
      this.material.uniforms.uIntensity.value = this.config.intensity;
      this.material.uniforms.uPixelSize.value = this.config.pixelSize;
      this.material.uniforms.uResolution.value.set(
        window.innerWidth * this.config.renderScale,
        window.innerHeight * this.config.renderScale
      );
    }
  }
}
