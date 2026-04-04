import type { BoardState, PlacedComponent, ComponentTemplate, Wire, BoardSide } from '../types';
import { HOLE_SPACING, HOLE_RADIUS, BOARD_PAD } from './constants';
import {
  getEffectiveDims,
  getComponentPinPositions,
  getComponentAtHole,
  getConnectedHoles,
  getAllNets,
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
  const sideLabel = (comp.side || 'front') === 'back' ? '裏面' : '表面';
  let infoY = 10;
  if (rotation !== 0) infoY += 10;
  if (mirrored) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.fillText(comp.name || tpl.name, 0, 0);
    ctx.font = '7px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    if (rotation !== 0) ctx.fillText(`${rotation}°`, 0, 10);
    ctx.fillText(sideLabel, 0, infoY);
    ctx.restore();
  } else {
    ctx.fillText(comp.name || tpl.name, cx, cy);
    ctx.font = '7px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    if (rotation !== 0) ctx.fillText(`${rotation}°`, cx, cy + 10);
    ctx.fillText(sideLabel, cx, cy + infoY);
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

export interface WireDragPreview {
  wireIndex: number;
  endpoint: 'from' | 'to';
  targetHole: [number, number];
}

export interface DrawOptions {
  hoveredHole: [number, number] | null;
  wireStart: [number, number] | null;
  wireColor: string;
  selectedComponentId: string | null;
  currentTool: string;
  dragPreview?: DragPreview | null;
  wireDragPreview?: WireDragPreview | null;
  showNets?: boolean;
  highlightedNet?: [number, number][] | null;
  side: BoardSide;
}

export function drawBoard(
  canvas: HTMLCanvasElement,
  state: BoardState,
  opts: DrawOptions,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // drawComponent がピンラベルを holes に書き込むため、元の state を汚染しないようコピーを使う
  const drawState = { ...state, holes: { ...state.holes } };

  const w = BOARD_PAD * 2 + drawState.cols * HOLE_SPACING;
  const h = BOARD_PAD * 2 + drawState.rows * HOLE_SPACING;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.scale(dpr, dpr);

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
  for (let r = 0; r < drawState.rows; r++) {
    for (let c = 0; c < drawState.cols; c++) {
      const x = BOARD_PAD + c * HOLE_SPACING + HOLE_SPACING / 2;
      const y = BOARD_PAD + r * HOLE_SPACING + HOLE_SPACING / 2;
      ctx.beginPath();
      ctx.rect(x - HOLE_SPACING / 2, y - HOLE_SPACING / 2, HOLE_SPACING, HOLE_SPACING);
      ctx.stroke();
    }
  }

  // Build pin position set for quick lookup (all sides - pins are shared)
  const pinHoles = new Set<string>();
  for (const comp of drawState.components) {
    const tpl = drawState.templates.find(t => t.id === comp.templateId);
    if (!tpl || !tpl.pins?.length) continue;
    const positions = getComponentPinPositions(comp, tpl);
    for (let i = 0; i < positions.length && i < tpl.pins.length; i++) {
      pinHoles.add(`${positions[i][0]},${positions[i][1]}`);
    }
  }

  // Build wired-hole color map
  const wiredHoleColor = new Map<string, string>();
  for (const wire of drawState.wires) {
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
  const inactiveComps = drawState.components.filter(c => (c.side || 'front') === inactiveSide);
  const inactiveWires = drawState.wires.filter(w => (w.side || 'front') === inactiveSide);

  if (inactiveComps.length > 0 || inactiveWires.length > 0) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    for (const wire of inactiveWires) drawWire(ctx, wire);
    for (const comp of inactiveComps) {
      const tpl = drawState.templates.find(t => t.id === comp.templateId);
      if (tpl) drawComponent(ctx, comp, tpl, false, drawState, isBack);
    }
    ctx.restore();
  }

  // --- Draw active side ---
  const activeComps = drawState.components.filter(c => (c.side || 'front') === opts.side);
  const activeWires = drawState.wires.filter(w => (w.side || 'front') === opts.side);

  for (const wire of activeWires) drawWire(ctx, wire);
  for (const comp of activeComps) {
    const tpl = drawState.templates.find(t => t.id === comp.templateId);
    if (!tpl) continue;
    const isSel = opts.selectedComponentId === comp.id;
    drawComponent(ctx, comp, tpl, isSel, drawState, isBack);
  }

  // Holes (shared between sides)
  for (let r = 0; r < drawState.rows; r++) {
    for (let c = 0; c < drawState.cols; c++) {
      const x = BOARD_PAD + c * HOLE_SPACING + HOLE_SPACING / 2;
      const y = BOARD_PAD + r * HOLE_SPACING + HOLE_SPACING / 2;
      const key = `${r},${c}`;
      const isPin = pinHoles.has(key);
      const compAt = getComponentAtHole(r, c, drawState.components, drawState.templates);

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

  // Blocked holes (screw holes)
  if (drawState.blockedHoles) {
    for (const key of drawState.blockedHoles) {
      const [br, bc] = key.split(',').map(Number);
      if (br < 0 || br >= drawState.rows || bc < 0 || bc >= drawState.cols) continue;
      const x = BOARD_PAD + bc * HOLE_SPACING + HOLE_SPACING / 2;
      const y = BOARD_PAD + br * HOLE_SPACING + HOLE_SPACING / 2;

      // Dark filled circle
      ctx.beginPath();
      ctx.arc(x, y, HOLE_RADIUS + 2, 0, Math.PI * 2);
      ctx.fillStyle = '#555';
      ctx.fill();
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      ctx.stroke();

      // × mark
      const s = HOLE_RADIUS;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s);
      ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y - s);
      ctx.lineTo(x - s, y + s);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Labels (shared, on top of holes) - need counter-flip for readability
  for (let r = 0; r < drawState.rows; r++) {
    for (let c = 0; c < drawState.cols; c++) {
      const hole = drawState.holes[`${r},${c}`];
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
      targetRow + dims.h <= drawState.rows && targetCol + dims.w <= drawState.cols;

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

    // Pin positions and labels
    const previewComp = { ...comp, row: targetRow, col: targetCol };
    const pinPositions = getComponentPinPositions(previewComp, tpl);
    for (let i = 0; i < pinPositions.length; i++) {
      const [pr, pc] = pinPositions[i];
      const px = BOARD_PAD + pc * HOLE_SPACING + HOLE_SPACING / 2;
      const py = BOARD_PAD + pr * HOLE_SPACING + HOLE_SPACING / 2;
      ctx.beginPath();
      ctx.arc(px, py, HOLE_RADIUS + 1, 0, Math.PI * 2);
      ctx.fillStyle = inBounds ? 'rgba(255,255,255,0.7)' : 'rgba(255,100,100,0.5)';
      ctx.fill();

      const label = tpl.pins?.[i];
      if (label) {
        ctx.save();
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        drawText(label, px, py - HOLE_RADIUS - 2);
        ctx.restore();
      }
    }

    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const gcx = gx + (dims.w - 1) * HOLE_SPACING / 2;
    const gcy = gy + (dims.h - 1) * HOLE_SPACING / 2;
    drawText(comp.name || tpl.name, gcx, gcy);
    ctx.restore();
  }

  // Wire drag preview
  if (opts.wireDragPreview) {
    const { wireIndex, endpoint, targetHole } = opts.wireDragPreview;
    const wire = drawState.wires[wireIndex];
    if (wire) {
      const fixedEnd = endpoint === 'from' ? wire.to : wire.from;
      const fx = BOARD_PAD + fixedEnd[1] * HOLE_SPACING + HOLE_SPACING / 2;
      const fy = BOARD_PAD + fixedEnd[0] * HOLE_SPACING + HOLE_SPACING / 2;
      const tx = BOARD_PAD + targetHole[1] * HOLE_SPACING + HOLE_SPACING / 2;
      const ty = BOARD_PAD + targetHole[0] * HOLE_SPACING + HOLE_SPACING / 2;
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = wire.color || '#ff6b6b';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(tx, ty, HOLE_RADIUS + 2, 0, Math.PI * 2);
      ctx.fillStyle = wire.color || '#ff6b6b';
      ctx.fill();
      ctx.restore();
    }
  }

  // Highlighted net (from sidebar click)
  if (opts.highlightedNet && opts.highlightedNet.length > 0) {
    for (const [cr, cc] of opts.highlightedNet) {
      const x = BOARD_PAD + cc * HOLE_SPACING + HOLE_SPACING / 2;
      const y = BOARD_PAD + cr * HOLE_SPACING + HOLE_SPACING / 2;
      ctx.beginPath();
      ctx.arc(x, y, HOLE_RADIUS + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,200,255,0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  // Connected holes highlight
  if (opts.hoveredHole && opts.currentTool === 'select') {
    const connected = getConnectedHoles(opts.hoveredHole[0], opts.hoveredHole[1], drawState.wires);
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

  // Net visualization
  if (opts.showNets) {
    const NET_COLORS = [
      '#ff6b6b', '#4ecdc4', '#ffe66d', '#a29bfe', '#fd79a8',
      '#00cec9', '#fab1a0', '#6c5ce7', '#55efc4', '#fdcb6e',
      '#e17055', '#0984e3', '#b2bec3', '#d63031', '#00b894',
    ];
    const nets = getAllNets(drawState.wires);
    for (let ni = 0; ni < nets.length; ni++) {
      const color = NET_COLORS[ni % NET_COLORS.length];
      for (const [nr, nc] of nets[ni]) {
        const x = BOARD_PAD + nc * HOLE_SPACING + HOLE_SPACING / 2;
        const y = BOARD_PAD + nr * HOLE_SPACING + HOLE_SPACING / 2;
        ctx.beginPath();
        ctx.arc(x, y, HOLE_RADIUS + 4, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // Restore mirror transform
  if (isBack) {
    ctx.restore();
  }

  // Ruler (drawn outside mirror so always readable)
  ctx.save();
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';

  for (let c = 0; c < drawState.cols; c++) {
    const x = BOARD_PAD + c * HOLE_SPACING + HOLE_SPACING / 2;
    const isHovered = opts.hoveredHole?.[1] === c;
    if (isHovered) ctx.fillStyle = '#ffd93d';
    ctx.fillText(`${c + 1}`, x, BOARD_PAD / 2);
    if (isHovered) ctx.fillStyle = 'rgba(255,255,255,0.5)';
  }

  ctx.textAlign = 'right';
  for (let r = 0; r < drawState.rows; r++) {
    const y = BOARD_PAD + r * HOLE_SPACING + HOLE_SPACING / 2;
    const isHovered = opts.hoveredHole?.[0] === r;
    if (isHovered) ctx.fillStyle = '#ffd93d';
    ctx.fillText(`${r + 1}`, BOARD_PAD - 4, y);
    if (isHovered) ctx.fillStyle = 'rgba(255,255,255,0.5)';
  }

  ctx.restore();
}
