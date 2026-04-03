import { useState, useCallback, useRef, useEffect } from "react";
import {
  Button,
  Text,
  Cluster,
  NotificationBar,
  SegmentedControl,
} from "smarthr-ui";
import type { ToolType, BoardSide } from "./types";
import type { ComponentTemplate } from "./types";
import { useBoardState } from "./hooks/useBoardState";
import { getComponentAtHole } from "./utils/board";
import BoardCanvas from "./components/BoardCanvas";
import Sidebar from "./components/Sidebar";
import LabelEditor from "./components/LabelEditor";
import TemplateEditor from "./components/TemplateEditor";
import "./App.css";

export default function App() {
  const board = useBoardState();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredHole, setHoveredHole] = useState<[number, number] | null>(null);
  const [zoom, setZoom] = useState(1);

  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 3;
  const ZOOM_STEP = 0.15;

  const handleZoom = useCallback((delta: number) => {
    setZoom((z) =>
      Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta * ZOOM_STEP)),
    );
  }, []);

  // Label editor state
  const [labelEditor, setLabelEditor] = useState<{
    visible: boolean;
    r: number;
    c: number;
    x: number;
    y: number;
    label: string;
  }>({ visible: false, r: 0, c: 0, x: 0, y: 0, label: "" });

  // Template editor state
  const [templateEditor, setTemplateEditor] = useState<{
    visible: boolean;
    tpl: ComponentTemplate | null;
  }>({ visible: false, tpl: null });

  const handleClickHole = useCallback(
    (r: number, c: number, e: React.MouseEvent) => {
      switch (board.currentTool) {
        case "select": {
          const comp = getComponentAtHole(
            r,
            c,
            board.state.components,
            board.state.templates,
            board.currentSide,
          );
          board.setSelectedComponentId(comp?.id || null);
          break;
        }
        case "component":
          board.placeComponent(r, c);
          break;
        case "wire":
          if (!board.wireStart) {
            board.setWireStart([r, c]);
            board.setStatusMessage(
              `配線開始: 行${r + 1} 列${c + 1} → 終点をクリック`,
            );
          } else {
            if (board.wireStart[0] !== r || board.wireStart[1] !== c) {
              board.addWire(board.wireStart, [r, c]);
            }
            board.setWireStart(null);
          }
          break;
        case "label": {
          const key = `${r},${c}`;
          const existing = board.state.holes[key]?.label || "";
          setLabelEditor({
            visible: true,
            r,
            c,
            x: e.clientX,
            y: e.clientY,
            label: existing,
          });
          break;
        }
        case "erase":
          board.eraseAt(r, c);
          break;
      }
    },
    [board],
  );

  const handleRightClick = useCallback(() => {
    board.setWireStart(null);
  }, [board]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case "1":
          board.selectTool("select");
          break;
        case "2":
          board.selectTool("component");
          break;
        case "3":
          board.selectTool("wire");
          break;
        case "4":
          board.selectTool("label");
          break;
        case "5":
          board.selectTool("erase");
          break;
        case "Escape":
          board.setWireStart(null);
          setLabelEditor((s) => ({ ...s, visible: false }));
          setTemplateEditor({ visible: false, tpl: null });
          break;
        case "Delete":
        case "Backspace":
          if (board.selectedComponentId)
            board.removeComponent(board.selectedComponentId);
          break;
        case "r":
        case "R":
          if (board.currentTool === "component") {
            board.setPlacementRotation((board.placementRotation + 90) % 360);
          } else if (board.selectedComponentId) {
            board.rotateComponent(board.selectedComponentId);
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);

    // Ctrl/Cmd+wheel によるブラウザズームをページ全体で無効化
    const wheelHandler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    window.addEventListener("wheel", wheelHandler, { passive: false });

    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("wheel", wheelHandler);
    };
  }, [board]);

  // NotificationBar の自動消去
  const { notification, setNotification } = board;
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [notification, setNotification]);

  const handleSaveTemplate = useCallback(
    (tpl: ComponentTemplate) => {
      const existing = board.state.templates.find((t) => t.id === tpl.id);
      if (existing) {
        board.updateTemplate(tpl);
      } else {
        board.addTemplate(tpl);
      }
    },
    [board],
  );

  const hoverLabel = hoveredHole
    ? board.state.holes[`${hoveredHole[0]},${hoveredHole[1]}`]?.label || ""
    : "";
  const hoverText = hoveredHole
    ? `行${hoveredHole[0] + 1} 列${hoveredHole[1] + 1}${hoverLabel ? ` [${hoverLabel}]` : ""}`
    : "-";

  return (
    <>
      <div className="app">
          <Sidebar
           state={board.state}
          currentTool={board.currentTool}
            selectedComponentId={board.selectedComponentId}
          wireColor={board.wireColor}
          selectedTemplateId={board.selectedTemplateId}
          placementRotation={board.placementRotation}
          onSelectTool={board.selectTool}
          onResizeBoard={board.resizeBoard}
          onSetWireColor={board.setWireColor}
          onSelectTemplate={(id) => {
            board.setSelectedTemplateId(id);
            board.setPlacementRotation(0);
          }}
          onSetPlacementRotation={board.setPlacementRotation}
          onSelectComponent={board.setSelectedComponentId}
          onRotateComponent={board.rotateComponent}
          onRemoveComponent={board.removeComponent}
          onOpenTemplateEditor={(tpl) =>
            setTemplateEditor({ visible: true, tpl: tpl || null })
          }
          onDeleteTemplate={board.deleteTemplate}
          onResetBoard={board.resetBoard}
          onSave={board.saveProject}
          onLoad={board.loadProject}
          onExportImage={() =>
            canvasRef.current && board.exportImage(canvasRef.current)
          }
        />
        <div className="main">
          <div className="board-header">
            <Text size="S">
              {board.state.cols} × {board.state.rows}
            </Text>
            <Text size="S">{hoverText}</Text>
            <Cluster gap={0.25} align="center" className="zoom-controls">
              <Button
                size="s"
                variant="secondary"
                onClick={() => handleZoom(-1)}
              >
                -
              </Button>
              <Text size="S" className="zoom-label">
                {Math.round(zoom * 100)}%
              </Text>
              <Button
                size="s"
                variant="secondary"
                onClick={() => handleZoom(1)}
              >
                +
              </Button>
              <Button size="s" variant="secondary" onClick={() => setZoom(1)}>
                1:1
              </Button>
            </Cluster>
          </div>
          <div className="board-area">
            <div className="toolbar-overlay">
              <SegmentedControl
                options={[
                  { value: "select", content: "選択" },
                  { value: "component", content: "部品" },
                  { value: "wire", content: "配線" },
                  { value: "label", content: "ラベル" },
                  { value: "erase", content: "消去" },
                ]}
                value={board.currentTool}
                onClickOption={(v) => board.selectTool(v as ToolType)}
              />
            </div>
            <div className="side-toggle-overlay">
              <SegmentedControl
                options={[
                  { value: "front", content: "表面" },
                  { value: "back", content: "裏面" },
                ]}
                value={board.currentSide}
                onClickOption={(v) => board.setCurrentSide(v as BoardSide)}
              />
            </div>
            {board.notification && (
              <div className="notification-overlay">
                <NotificationBar
                  type={board.notification.type}
                  base={"base"}
                  onClose={() => board.setNotification(null)}
                  animate
                >
                  {board.notification.message}
                </NotificationBar>
              </div>
            )}
            <BoardCanvas
              state={board.state}
              currentTool={board.currentTool}
              selectedComponentId={board.selectedComponentId}
              selectedTemplateId={board.selectedTemplateId}
              placementRotation={board.placementRotation}
              wireStart={board.wireStart}
              wireColor={board.wireColor}
              currentSide={board.currentSide}
              hoveredHole={hoveredHole}
              zoom={zoom}
              onHoverHole={setHoveredHole}
              onClickHole={handleClickHole}
              onRightClick={handleRightClick}
              onZoom={handleZoom}
              onMoveComponent={board.moveComponent}
              canvasRef={canvasRef}
            />
          </div>
          <div className="status-bar">{board.statusMessage}</div>
        </div>

        <LabelEditor
          key={`${labelEditor.r},${labelEditor.c},${labelEditor.visible}`}
          visible={labelEditor.visible}
          x={labelEditor.x}
          y={labelEditor.y}
          initialLabel={labelEditor.label}
          onApply={(label) => {
            board.setHoleLabel(labelEditor.r, labelEditor.c, label);
            setLabelEditor((s) => ({ ...s, visible: false }));
          }}
          onClose={() => setLabelEditor((s) => ({ ...s, visible: false }))}
        />

        <TemplateEditor
          visible={templateEditor.visible}
          editingTemplate={templateEditor.tpl}
          onSave={handleSaveTemplate}
          onClose={() => setTemplateEditor({ visible: false, tpl: null })}
        />
      </div>
    </>
  );
}
