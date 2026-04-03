import type { BoardState, PlacedComponent, ComponentTemplate, Wire, BoardSide } from '../types';
import { HOLE_SPACING, HOLE_RADIUS, BOARD_PAD } from './constants';
import {
  getEffectiveDims,
  getComponentPinPositions,
  getComponentAtHole,
  getConnectedHoles,
} from './board';
import { roundRect } from './canvas';

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.save();
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const textY = y - HOLE_RADIUS - 2;
  const metrics = ctx.measureText(text);
  const tw = metrics.width + 4;
  const th = 10;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - tw / 2, textY - th, tw, th);
  ctx.fillStyle = '#ffd93d';
  ctx.fillText(text, x, textY);
  ctx.restore();
}

function drawWire(ctx: CanvasRenderingContext2D, wire: Wire) {
  const [r1, c1] = wire.from;
  const [r2, c2] = wire.to;
  const x1 = BOARD_PAD + c1 * HOLE_SPACING + HOLE_SPACING / 2;
  const y1 = BOARD_PAD + r1 * HOLE_SPACING + HOLE_SPACING / 2;
  const x2 = BOARD_PAD + c2 * HOLE_SPACING + HOLE_SPACING / 2;
  const y2 = BOARD_PAD + r2 * HOLE_SPACING + HOLE_SPACING / 2;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = wire.color || '#ff6b6b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  for (const [x, y] of [[x1, y1], [x2, y2]]) {
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = wire.color || '#ff6b6b';
    ctx.fill();
  }
}

function drawComponent(
  ctx: CanvasRenderingContext2D,
  comp: PlacedComponent,
  tpl: ComponentTemplate,
  isSelected: boolean,
  state: BoardState,
  mirrored = false,
) {
  const rotation = comp.rotation || 0;
  const dims = getEffectiveDims(tpl, rotation);
  const x = BOARD_PAD + comp.col * HOLE_SPACING + HOLE_SPACING / 2;
  const y = BOARD_PAD + comp.row * HOLE_SPACING + HOLE_SPACING / 2;
  const w = dims.w * HOLE_SPACING;
  const h = dims.h * HOLE_SPACING;

  const rx = x - HOLE_SPACING / 2 + 2;
  const ry = y - HOLE_SPACING / 2 + 2;
  const rw = w - 4;
  const rh = h - 4;

  ctx.fillStyle = tpl.color + '88';
  ctx.strokeStyle = tpl.color;
  ctx.lineWidth = 1.5;
  roundRect(ctx, rx, ry, rw, rh, 4);
  ctx.fill();
  ctx.stroke();

  // Pin 1 notch for DIP
  if (tpl.w >= 2 && tpl.h >= 4) {
    const pin1 = getComponentPinPositions(comp, tpl)[0];
    if (pin1) {
      const nx = BOARD_PAD + pin1[1] * HOLE_SPACING + HOLE_SPACING / 2;
      const ny = BOARD_PAD + pin1[0] * HOLE_SPACING + HOLE_SPACING / 2;
      ctx.beginPath();
      ctx.arc(nx + 6, ny, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();
    }
  }

  if (isSelected) {
    ctx.strokeStyle = '#ffd93d';
    ctx.lineWidth = 2;
    roundRect(ctx, rx - 2, ry - 2, rw + 4, rh + 4, 6);
    ctx.stroke();
  }

  // Name (counter-flip when mirrored so text is readable)
  ctx.save();
  ctx.font = 'bold 9px sans-serif';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = x + (dims.w - 1) * HOLE_SPACING / 2;
  const cy = y + (dims.h - 1) * HOLE_SPACING / 2;
  if (mirrored) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.fillText(comp.name || tpl.name, 0, 0);
    if (rotation !== 0) {
      ctx.font = '7px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`${rotation}°`, 0, 10);
    }
    ctx.restore();
  } else {
    ctx.fillText(comp.name || tpl.name, cx, cy);
    if (rotation !== 0) {
      ctx.font = '7px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`${rotation}°`, cx, cy + 10);
    }
  }
  ctx.restore();

  // Set pin labels
  if (tpl.pins?.length > 0) {
    const positions = getComponentPinPositions(comp, tpl);
    for (let i = 0; i < positions.length && i < tpl.pins.length; i++) {
      const [pr, pc] = positions[i];
      const key = `${pr},${pc}`;
      if (!state.holes[key]) state.holes[key] = { label: '' };
      if (!state.holes[key]._manual) {
        state.holes[key].label = tpl.pins[i];
      }
    }
  }
}

export interface DragPreview {
  comp: PlacedComponent;
  tpl: ComponentTemplate;
  targetRow: number;
  targetCol: number;
}

export interface DrawOptions {
  hoveredHole: [number, number] | null;
  wireStart: [number, number] | null;
  wireColor: string;
  selectedComponentId: string | null;
  currentTool: string;
  dragPreview?: DragPreview | null;
  side: BoardSide;
}

export function drawBoard(
  canvas: HTMLCanvasElement,
  state: BoardState,
  opts: DrawOptions,
) {
  const ctx = canvas.getContext('2d')!;
  const w = BOARD_PAD * 2 + state.cols * HOLE_SPACING;
  const h = BOARD_PAD * 2 + state.rows * HOLE_SPACING;
  canvas.width = w;
  canvas.height = h;

  const isBack = opts.side === 'back';

  // Background
  ctx.fillStyle = '#1b5e20';
  ctx.fillRect(0, 0, w, h);

  // Apply mirror transform for back side
  if (isBack) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const x = BOARD_PAD + c * HOLE_SPACING + HOLE_SPACING / 2;
      const y = BOARD_PAD + r * HOLE_SPACING + HOLE_SPACING / 2;
      ctx.beginPath();
      ctx.rect(x - HOLE_SPACING / 2, y - HOLE_SPACING / 2, HOLE_SPACING, HOLE_SPACING);
      ctx.stroke();
    }
  }

  // Build pin position set for quick lookup (all sides - pins are shared)
  const pinHoles = new Set<string>();
  for (const comp of state.components) {
    const tpl = state.templates.find(t => t.id === comp.templateId);
    if (!tpl || !tpl.pins?.length) continue;
    const positions = getComponentPinPositions(comp, tpl);
    for (let i = 0; i < positions.length && i < tpl.pins.length; i++) {
      pinHoles.add(`${positions[i][0]},${positions[i][1]}`);
    }
  }

  // Build wired-hole color map
  const wiredHoleColor = new Map<string, string>();
  for (const wire of state.wires) {
    const color = wire.color || '#ff6b6b';
    for (const [r, c] of [wire.from, wire.to]) {
      wiredHoleColor.set(`${r},${c}`, color);
    }
  }

  // Helper: draw text that's readable regardless of mirror
  const drawText = (text: string, x: number, y: number) => {
    if (isBack) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(text, x, y);
    }
  };

  // --- Draw inactive side (dimmed) ---
  const inactiveSide: BoardSide = isBack ? 'front' : 'back';
  const inactiveComps = state.components.filter(c => (c.side || 'front') === inactiveSide);
  const inactiveWires = state.wires.filter(w => (w.side || 'front') === inactiveSide);

  if (inactiveComps.length > 0 || inactiveWires.length > 0) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    for (const wire of inactiveWires) drawWire(ctx, wire);
    for (const comp of inactiveComps) {
      const tpl = state.templates.find(t => t.id === comp.templateId);
      if (tpl) drawComponent(ctx, comp, tpl, false, state, isBack);
    }
    ctx.restore();
  }

  // --- Draw active side ---
  const activeComps = state.components.filter(c => (c.side || 'front') === opts.side);
  const activeWires = state.wires.filter(w => (w.side || 'front') === opts.side);

  for (const wire of activeWires) drawWire(ctx, wire);
  for (const comp of activeComps) {
    const tpl = state.templates.find(t => t.id === comp.templateId);
    if (!tpl) continue;
    const isSel = opts.selectedComponentId === comp.id;
    drawComponent(ctx, comp, tpl, isSel, state, isBack);
  }

  // Holes (shared between sides)
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const x = BOARD_PAD + c * HOLE_SPACING + HOLE_SPACING / 2;
      const y = BOARD_PAD + r * HOLE_SPACING + HOLE_SPACING / 2;
      const key = `${r},${c}`;
      const isPin = pinHoles.has(key);
      const compAt = getComponentAtHole(r, c, state.components, state.templates);

      // 部品領域内でピンでないマスはホールを描画しない
      if (compAt && !isPin) continue;

      const wireColor = wiredHoleColor.get(key);

      ctx.beginPath();
      ctx.arc(x, y, HOLE_RADIUS, 0, Math.PI * 2);
      if (wireColor) {
        ctx.fillStyle = wireColor;
      } else if (isPin) {
        ctx.fillStyle = '#c0c0c0';
      } else {
        ctx.fillStyle = '#2a2a2a';
      }
      ctx.fill();
      ctx.strokeStyle = wireColor ? wireColor : isPin ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = wireColor ? 1.5 : isPin ? 1 : 0.5;
      ctx.stroke();

      if (opts.hoveredHole?.[0] === r && opts.hoveredHole?.[1] === c) {
        ctx.beginPath();
        ctx.arc(x, y, HOLE_RADIUS + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (opts.wireStart?.[0] === r && opts.wireStart?.[1] === c) {
        ctx.beginPath();
        ctx.arc(x, y, HOLE_RADIUS + 4, 0, Math.PI * 2);
        ctx.strokeStyle = opts.wireColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // Labels (shared, on top of holes) - need counter-flip for readability
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const hole = state.holes[`${r},${c}`];
      if (hole?.label) {
        const x = BOARD_PAD + c * HOLE_SPACING + HOLE_SPACING / 2;
        const y = BOARD_PAD + r * HOLE_SPACING + HOLE_SPACING / 2;
        if (isBack) {
          // Counter-flip for label readability
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(-1, 1);
          drawLabel(ctx, hole.label, 0, 0);
          ctx.restore();
        } else {
          drawLabel(ctx, hole.label, x, y);
        }
      }
    }
  }

  // Drag preview (ghost)
  if (opts.dragPreview) {
    const { comp, tpl, targetRow, targetCol } = opts.dragPreview;
    const rotation = comp.rotation || 0;
    const dims = getEffectiveDims(tpl, rotation);
    const gx = BOARD_PAD + targetCol * HOLE_SPACING + HOLE_SPACING / 2;
    const gy = BOARD_PAD + targetRow * HOLE_SPACING + HOLE_SPACING / 2;
    const gw = dims.w * HOLE_SPACING;
    const gh = dims.h * HOLE_SPACING;
    const grx = gx - HOLE_SPACING / 2 + 2;
    const gry = gy - HOLE_SPACING / 2 + 2;

    const inBounds = targetRow >= 0 && targetCol >= 0 &&
      targetRow + dims.h <= state.rows && targetCol + dims.w <= state.cols;

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = inBounds ? tpl.color + '88' : '#ff000044';
    ctx.strokeStyle = inBounds ? tpl.color : '#ff0000';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    roundRect(ctx, grx, gry, gw - 4, gh - 4, 4);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const gcx = gx + (dims.w - 1) * HOLE_SPACING / 2;
    const gcy = gy + (dims.h - 1) * HOLE_SPACING / 2;
    drawText(comp.name || tpl.name, gcx, gcy);
    ctx.restore();
  }

  // Connected holes highlight
  if (opts.hoveredHole && opts.currentTool === 'select') {
    const connected = getConnectedHoles(opts.hoveredHole[0], opts.hoveredHole[1], state.wires);
    if (connected.length > 1) {
      for (const [cr, cc] of connected) {
        const x = BOARD_PAD + cc * HOLE_SPACING + HOLE_SPACING / 2;
        const y = BOARD_PAD + cr * HOLE_SPACING + HOLE_SPACING / 2;
        ctx.beginPath();
        ctx.arc(x, y, HOLE_RADIUS + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,215,0,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  // Restore mirror transform
  if (isBack) {
    ctx.restore();
  }
}
