import type { ComponentTemplate, PlacedComponent, Wire, BoardSide } from '../types';

export function getEffectiveDims(tpl: ComponentTemplate, rotation: number) {
  if (rotation === 90 || rotation === 270) {
    return { w: tpl.h, h: tpl.w };
  }
  return { w: tpl.w, h: tpl.h };
}

export function rotatePinOffset(
  dr: number, dc: number,
  tplW: number, tplH: number,
  rotation: number,
): [number, number] {
  switch (rotation) {
    case 90:  return [dc, tplH - 1 - dr];
    case 180: return [tplH - 1 - dr, tplW - 1 - dc];
    case 270: return [tplW - 1 - dc, dr];
    default:  return [dr, dc];
  }
}

export function getBasePinOffsets(tpl: ComponentTemplate): [number, number][] {
  if (tpl.pinOffsets) return tpl.pinOffsets;

  const offsets: [number, number][] = [];
  if (tpl.w === 1) {
    for (let r = 0; r < tpl.h; r++) offsets.push([r, 0]);
  } else if (tpl.w === 2) {
    for (let r = 0; r < tpl.h; r++) offsets.push([r, 0]);
    for (let r = tpl.h - 1; r >= 0; r--) offsets.push([r, 1]);
  } else {
    for (let r = 0; r < tpl.h; r++) offsets.push([r, 0]);
    for (let c = 1; c < tpl.w; c++) offsets.push([tpl.h - 1, c]);
    for (let r = tpl.h - 2; r >= 0; r--) offsets.push([r, tpl.w - 1]);
    for (let c = tpl.w - 2; c > 0; c--) offsets.push([0, c]);
  }
  return offsets;
}

export function getComponentPinPositions(
  comp: PlacedComponent,
  tpl: ComponentTemplate,
): [number, number][] {
  const baseOffsets = getBasePinOffsets(tpl);
  const isBack = (comp.side || 'front') === 'back';
  return baseOffsets.map(([dr, dc]) => {
    // 裏面の部品はピン列を水平反転（部品を裏返した状態）
    const mdc = isBack ? tpl.w - 1 - dc : dc;
    const [rdr, rdc] = rotatePinOffset(dr, mdc, tpl.w, tpl.h, comp.rotation);
    return [comp.row + rdr, comp.col + rdc];
  });
}

export function getComponentAtHole(
  r: number, c: number,
  components: PlacedComponent[],
  templates: ComponentTemplate[],
  side?: BoardSide,
): PlacedComponent | null {
  for (const comp of components) {
    if (side && (comp.side || 'front') !== side) continue;
    const tpl = templates.find(t => t.id === comp.templateId);
    if (!tpl) continue;
    const dims = getEffectiveDims(tpl, comp.rotation);
    if (r >= comp.row && r < comp.row + dims.h &&
        c >= comp.col && c < comp.col + dims.w) {
      return comp;
    }
  }
  return null;
}

export function getConnectedHoles(r: number, c: number, wires: Wire[]): [number, number][] {
  const visited = new Set<string>();
  const queue = [`${r},${c}`];
  visited.add(`${r},${c}`);
  while (queue.length > 0) {
    const current = queue.shift()!;
    const [cr, cc] = current.split(',').map(Number);
    for (const wire of wires) {
      let other: [number, number] | null = null;
      if (wire.from[0] === cr && wire.from[1] === cc) other = wire.to;
      else if (wire.to[0] === cr && wire.to[1] === cc) other = wire.from;
      if (other) {
        const key = `${other[0]},${other[1]}`;
        if (!visited.has(key)) { visited.add(key); queue.push(key); }
      }
    }
  }
  return [...visited].map(k => {
    const [a, b] = k.split(',').map(Number);
    return [a, b] as [number, number];
  });
}

/** 配線の線分上にあるホールを t 順に列挙（端点含む） */
export function getHolesOnWire(w: Wire): [number, number][] {
  const [r1, c1] = w.from;
  const [r2, c2] = w.to;
  const dr = r2 - r1, dc = c2 - c1;
  const len2 = dr * dr + dc * dc;
  if (len2 === 0) return [w.from];

  const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
  const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);

  const holes: { t: number; pos: [number, number] }[] = [];
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const t = ((r - r1) * dr + (c - c1) * dc) / len2;
      if (t < 0 || t > 1) continue;
      const pr = r1 + t * dr, pc = c1 + t * dc;
      const dist = Math.sqrt((r - pr) ** 2 + (c - pc) ** 2);
      if (dist < 0.5) holes.push({ t, pos: [r, c] });
    }
  }
  holes.sort((a, b) => a.t - b.t);
  return holes.map(h => h.pos);
}

/** ホール (r,c) が配線の線分上にあるか（端点は除く） */
export function isPointOnWire(r: number, c: number, w: Wire): boolean {
  const [r1, c1] = w.from;
  const [r2, c2] = w.to;
  if ((r === r1 && c === c1) || (r === r2 && c === c2)) return false;
  const dr = r2 - r1, dc = c2 - c1;
  const len2 = dr * dr + dc * dc;
  if (len2 === 0) return false;
  const t = ((r - r1) * dr + (c - c1) * dc) / len2;
  if (t <= 0 || t >= 1) return false;
  const pr = r1 + t * dr, pc = c1 + t * dc;
  const dist = Math.sqrt((r - pr) ** 2 + (c - pc) ** 2);
  return dist < 0.5;
}

export function holeFromMouse(
  e: React.MouseEvent<HTMLCanvasElement> | MouseEvent,
  canvas: HTMLCanvasElement,
  rows: number,
  cols: number,
  spacing: number,
  pad: number,
): [number, number] | null {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const c = Math.floor((mx - pad) / spacing);
  const r = Math.floor((my - pad) / spacing);
  if (r >= 0 && r < rows && c >= 0 && c < cols) {
    const hx = pad + c * spacing + spacing / 2;
    const hy = pad + r * spacing + spacing / 2;
    const dist = Math.sqrt((mx - hx) ** 2 + (my - hy) ** 2);
    if (dist < spacing / 2) return [r, c];
  }
  return null;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

