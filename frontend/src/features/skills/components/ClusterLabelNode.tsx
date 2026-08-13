// Non-interactive cluster caption placed inside the canvas so it pans and zooms
// with the tree. Purely decorative — it carries no skill and takes no clicks, so
// a player can never "select" a label.
import { memo } from "react";

export interface ClusterLabelData {
  label: string;
  color?: string;
  [key: string]: unknown;
}

function ClusterLabelNodeImpl({ data }: { data: ClusterLabelData }) {
  return (
    <div
      className="skt-cluster-label"
      style={{ ["--cl-color" as string]: data.color ?? "var(--skill-energy)" }}
      aria-hidden="true"
    >
      <span className="skt-cluster-rule" />
      <span className="skt-cluster-text">{data.label}</span>
      <span className="skt-cluster-rule" />
    </div>
  );
}

export const ClusterLabelNode = memo(ClusterLabelNodeImpl);
