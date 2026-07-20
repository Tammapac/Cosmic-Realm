import styles from "./GridOverlay.module.css";

type GridOverlayProps = {
  width: number;
  height: number;
  gridSize: number;
  showGrid: boolean;
  showSafeArea: boolean;
};

/** Static SVG background grid + a safe-area guide rectangle (90% inset,
 * the common broadcast-safe convention). Purely visual -- snapping logic
 * lives in EditorCanvas, this just renders the reference lines. */
export function GridOverlay({ width, height, gridSize, showGrid, showSafeArea }: GridOverlayProps) {
  const safeInsetX = width * 0.05;
  const safeInsetY = height * 0.05;

  return (
    <svg className={styles.overlay} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {showGrid && (
        <defs>
          <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              fill="none"
              stroke="rgba(120, 180, 220, 0.12)"
              strokeWidth={1}
            />
          </pattern>
        </defs>
      )}
      {showGrid && <rect width={width} height={height} fill="url(#grid)" />}
      <line x1={width / 2} y1={0} x2={width / 2} y2={height} stroke="rgba(120, 180, 220, 0.18)" strokeWidth={1} />
      <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="rgba(120, 180, 220, 0.18)" strokeWidth={1} />
      {showSafeArea && (
        <rect
          x={safeInsetX}
          y={safeInsetY}
          width={width - safeInsetX * 2}
          height={height - safeInsetY * 2}
          fill="none"
          stroke="rgba(232, 185, 77, 0.5)"
          strokeDasharray="10 6"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}
