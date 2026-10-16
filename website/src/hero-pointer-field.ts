type CharacterCell = { x: number; y: number; born: number; strength: number };

export type ClearArea = { left: number; right: number; top: number; bottom: number };

const cellWidth = 14;
const cellHeight = 17;
const lifetime = 1900;
const maximumCells = 850;

export const createPointerField = () => {
  const cells = new Map<string, CharacterCell>();
  const add = (
    x: number,
    y: number,
    now: number,
    width: number,
    height: number,
    areas: readonly ClearArea[],
  ): void => {
    const column = Math.round(x / cellWidth);
    const row = Math.round(y / cellHeight);
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -10; dx <= 10; dx++) {
        const px = (column + dx) * cellWidth;
        const py = (row + dy) * cellHeight;
        const distance = Math.hypot((px - x) / 140, (py - y) / 102);
        const ripple = Math.sin(px * 0.044 + py * 0.063 + now * 0.001);
        if (distance > 1 || ripple < -0.65 || px < 0 || px > width || py < 0 || py > height)
          continue;
        if (
          areas.some(
            (area) => px > area.left && px < area.right && py > area.top && py < area.bottom,
          )
        )
          continue;
        const key = String(column + dx) + ":" + String(row + dy);
        cells.delete(key);
        cells.set(key, { x: px, y: py, born: now, strength: 0.9 * (1 - distance * 0.45) });
      }
    }
    while (cells.size > maximumCells) {
      const oldest = cells.keys().next().value;
      if (oldest === undefined) break;
      cells.delete(oldest);
    }
  };
  const paint = (context: CanvasRenderingContext2D, time: number): void => {
    context.font = "13px ui-monospace, SFMono-Regular, Consolas, monospace";
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (const [key, cell] of cells) {
      const age = time - cell.born;
      if (age >= lifetime) {
        cells.delete(key);
        continue;
      }
      const wave = Math.sin(cell.x * 0.035 + cell.y * 0.026 - age * 0.004);
      const glyph = wave > 0.45 ? "o" : wave > -0.5 ? ">" : "-";
      const reveal = Math.min(age / 90, 1);
      context.globalAlpha = cell.strength * reveal * (1 - age / lifetime) ** 1.4;
      context.fillText(glyph, cell.x, cell.y);
    }
    context.globalAlpha = 1;
  };
  return { add, paint, clear: () => cells.clear(), active: () => cells.size > 0 };
};
