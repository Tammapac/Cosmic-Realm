import styles from "./GuideLines.module.css";

export type GuideLine = { axis: "x" | "y"; position: number };

type GuideLinesProps = {
  width: number;
  height: number;
  lines: GuideLine[];
};

/** Transient snap-guide lines, shown only while dragging/resizing when an
 * edge aligns with another element or the canvas center. Driven by
 * react-moveable's snappable elementGuidelines feature in EditorCanvas. */
export function GuideLines({ width, height, lines }: GuideLinesProps) {
  if (lines.length === 0) return null;
  return (
    <svg className={styles.overlay} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {lines.map((line, i) =>
        line.axis === "x" ? (
          <line key={i} x1={line.position} y1={0} x2={line.position} y2={height} className={styles.guide} />
        ) : (
          <line key={i} x1={0} y1={line.position} x2={width} y2={line.position} className={styles.guide} />
        )
      )}
    </svg>
  );
}
