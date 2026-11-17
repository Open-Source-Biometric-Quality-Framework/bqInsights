// hoverUtils.ts - Hover detection and threshold calculation

export function findNearestIndex(
  x: number,
  y: number,
  xCol: Float32Array,
  yCol: Float32Array
): { index: number; dist2: number } {
  let bestIdx = -1;
  let bestD2 = Infinity;

  for (let i = 0; i < xCol.length; i++) {
    const dx = xCol[i] - x;
    const dy = yCol[i] - y;
    const d2 = dx * dx + dy * dy;

    if (d2 < bestD2) {
      bestD2 = d2;
      bestIdx = i;
    }
  }

  return { index: bestIdx, dist2: bestD2 };
}

export function makeHoverThreshold2(
  xCol: Float32Array,
  yCol: Float32Array
): number {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (let i = 0; i < xCol.length; i++) {
    const x = xCol[i], y = yCol[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const dx = Math.max(maxX - minX, 1e-9);
  const dy = Math.max(maxY - minY, 1e-9);

  // Radius is a small fraction of the smaller axis
  const r = 0.02 * Math.min(dx, dy);
  return r * r; // Squared threshold
}