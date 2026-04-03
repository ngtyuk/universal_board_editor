import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { BoardState, ToolType, PlacedComponent, BoardSide } from '../types';
import { HOLE_SPACING, BOARD_PAD } from '../utils/constants';
import { getComponentAtHole } from '../utils/board';
import { drawBoard } from '../utils/draw';
import type { DragPreview } from '../utils/draw';
import styles from './BoardCanvas.module.css';

interface Props {
  state: BoardState;
  currentTool: ToolType;
  selectedComponentId: string | null;
  selectedTemplateId: string;
  placementRotation: number;
  wireStart: [number, number] | null;
  wireColor: string;
  currentSide: BoardSide;
  hoveredHole: [number, number] | null;
  zoom: number;
  onHoverHole: (hole: [number, number] | null) => void;
  onClickHole: (r: number, c: number, e: React.MouseEvent) => void;
  onRightClick: () => void;
  onZoom: (delta: number) => void;
  onMoveComponent: (id: string, row: number, col: number) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const DRAG_THRESHOLD = 4; // px before drag starts

export default function BoardCanvas({
  state, currentTool, selectedComponentId,
  selectedTemplateId, placementRotation,
  wireStart, wireColor, currentSide, hoveredHole, zoom,
  onHoverHole, onClickHole, onRightClick, onZoom, onMoveComponent, canvasRef,
}: Props) {
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    compId: string;
    offsetR: number;
    offsetC: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);

  // Placement preview when component tool is active
  const placementPreview = useMemo<DragPreview | null>(() => {
    if (currentTool !== 'component' || !hoveredHole || !selectedTemplateId) return null;
    const tpl = state.templates.find(t => t.id === selectedTemplateId);
    if (!tpl) return null;
    const fakeComp: PlacedComponent = {
      id: '__preview__',
      templateId: tpl.id,
      row: hoveredHole[0],
      col: hoveredHole[1],
      name: tpl.name,
      rotation: placementRotation,
    };
    return { comp: fakeComp, tpl, targetRow: hoveredHole[0], targetCol: hoveredHole[1] };
  }, [currentTool, hoveredHole, selectedTemplateId, placementRotation, state.templates]);

  const activePreview = dragPreview ?? placementPreview;

  useEffect(() => {
    if (!canvasRef.current) return;
    drawBoard(canvasRef.current, state, {
      hoveredHole,
      wireStart,
      wireColor,
      selectedComponentId,
      currentTool,
      dragPreview: activePreview,
      side: currentSide,
    });
  }, [state, hoveredHole, wireStart, wireColor, selectedComponentId, currentTool, canvasRef, activePreview, currentSide]);

  const logicalCoordsFromMouse = useCallback((e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
    if (!canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    // Mirror X for back side (matches the canvas transform)
    if (currentSide === 'back') {
      mx = canvas.width - mx;
    }
    return { mx, my };
  }, [canvasRef, currentSide]);

  const holeFromLogical = useCallback((mx: number, my: number): [number, number] | null => {
    const c = Math.floor((mx - BOARD_PAD) / HOLE_SPACING);
    const r = Math.floor((my - BOARD_PAD) / HOLE_SPACING);
    if (r >= 0 && r < state.rows && c >= 0 && c < state.cols) {
      const hx = BOARD_PAD + c * HOLE_SPACING + HOLE_SPACING / 2;
      const hy = BOARD_PAD + r * HOLE_SPACING + HOLE_SPACING / 2;
      const dist = Math.sqrt((mx - hx) ** 2 + (my - hy) ** 2);
      if (dist < HOLE_SPACING / 2) return [r, c];
    }
    return null;
  }, [state.rows, state.cols]);

  const adjustedHoleFromMouse = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = logicalCoordsFromMouse(e);
    if (!coords) return null;
    return holeFromLogical(coords.mx, coords.my);
  }, [logicalCoordsFromMouse, holeFromLogical]);

  // Compute the grid cell (not snapped to hole center) for smoother drag target
  const gridCellFromMouse = useCallback((e: MouseEvent): [number, number] | null => {
    const coords = logicalCoordsFromMouse(e);
    if (!coords) return null;
    const c = Math.round((coords.mx - BOARD_PAD - HOLE_SPACING / 2) / HOLE_SPACING);
    const r = Math.round((coords.my - BOARD_PAD - HOLE_SPACING / 2) / HOLE_SPACING);
    return [r, c];
  }, [logicalCoordsFromMouse]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool !== 'select' || e.button !== 0) return;
    const hole = adjustedHoleFromMouse(e);
    if (!hole) return;

    const comp = getComponentAtHole(hole[0], hole[1], state.components, state.templates, currentSide);
    if (!comp) return;

    const tpl = state.templates.find(t => t.id === comp.templateId);
    if (!tpl) return;

    dragRef.current = {
      compId: comp.id,
      offsetR: hole[0] - comp.row,
      offsetC: hole[1] - comp.col,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
    };
  }, [currentTool, state.components, state.templates, adjustedHoleFromMouse, currentSide]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (!drag.dragging) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
        drag.dragging = true;
        setIsDragging(true);
      }

      const cell = gridCellFromMouse(e);
      if (!cell) return;

      const comp = state.components.find(c => c.id === drag.compId);
      if (!comp) return;
      const tpl = state.templates.find(t => t.id === comp.templateId);
      if (!tpl) return;

      const targetRow = cell[0] - drag.offsetR;
      const targetCol = cell[1] - drag.offsetC;

      setDragPreview({ comp, tpl, targetRow, targetCol });
    };

    const handleMouseUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;

      if (drag.dragging && dragPreview) {
        onMoveComponent(drag.compId, dragPreview.targetRow, dragPreview.targetCol);
      }
      setDragPreview(null);
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [state.components, state.templates, gridCellFromMouse, onMoveComponent, dragPreview]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;
    onHoverHole(adjustedHoleFromMouse(e));
  }, [adjustedHoleFromMouse, onHoverHole, isDragging]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;
    const hole = adjustedHoleFromMouse(e);
    if (hole) onClickHole(hole[0], hole[1], e);
  }, [adjustedHoleFromMouse, onClickHole, isDragging]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onRightClick();
  }, [onRightClick]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onZoom(e.deltaY > 0 ? -1 : 1);
    }
  }, [onZoom]);

  const canvasW = BOARD_PAD * 2 + state.cols * HOLE_SPACING;
  const canvasH = BOARD_PAD * 2 + state.rows * HOLE_SPACING;

  // Change cursor when hovering over a component in select mode
  const cursorStyle = currentTool === 'select' && hoveredHole &&
    getComponentAtHole(hoveredHole[0], hoveredHole[1], state.components, state.templates, currentSide)
    ? 'grab' : undefined;

  return (
    <div className={styles.container} onWheel={handleWheel}>
      <div className={styles.scroller} style={{
        width: `max(100%, ${canvasW * zoom + 80}px)`,
        height: `max(100%, ${canvasH * zoom + 80}px)`,
      }}>
        <div className={styles.wrapper} style={{
          width: canvasW * zoom,
          height: canvasH * zoom,
        }}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            style={{
              transform: `scale(${zoom})`,
              cursor: isDragging ? 'grabbing' : cursorStyle,
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
          />
        </div>
      </div>
    </div>
  );
}
