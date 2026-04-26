export class SpatialHashGrid {
  private cellSize: number;
  private cells = new Map<string, Set<any>>();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(entity: any, x: number, y: number): void {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const k = `${cx}:${cy}`;
    if (!this.cells.has(k)) this.cells.set(k, new Set());
    this.cells.get(k)!.add(entity);
  }

  queryCircle(x: number, y: number, radius: number): any[] {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    const results = new Set<any>();
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.cells.get(`${cx}:${cy}`);
        if (!bucket) continue;
        for (const e of bucket) results.add(e);
      }
    }
    return Array.from(results);
  }
}
