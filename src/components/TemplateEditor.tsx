import { useState, useRef, useEffect, useCallback } from "react";
import {
  Button,
  FormControl,
  Input,
  Heading,
  Text,
  Stack,
  Cluster,
  Base,
  ControlledFormDialog,
  SegmentedControl,
  Fieldset,
} from "smarthr-ui";
import type { ComponentTemplate, TemplateEditorPin, BoardSide } from "../types";
import { getBasePinOffsets } from "../utils/board";
import { roundRect } from "../utils/canvas";
import styles from "./TemplateEditor.module.css";

const TE_SPACING = 36;
const TE_PAD = 24;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.15;

type ResponseStatus = { status: "error"; text: string } | undefined;

interface Props {
  visible: boolean;
  editingTemplate: ComponentTemplate | null;
  onSave: (tpl: ComponentTemplate) => void;
  onClose: () => void;
}

export default function TemplateEditor({
  visible,
  editingTemplate,
  onSave,
  onClose,
}: Props) {
  const [name, setName] = useState("");
  const [w, setW] = useState(2);
  const [h, setH] = useState(4);
  const [color, setColor] = useState("#e94560");
  const [pins, setPins] = useState<TemplateEditorPin[]>([]);
  const [hoveredHole, setHoveredHole] = useState<[number, number] | null>(null);
  const [responseStatus, setResponseStatus] =
    useState<ResponseStatus>(undefined);
  const [zoom, setZoom] = useState(1);
  const [currentSide, setCurrentSide] = useState<BoardSide>("front");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleZoom = useCallback((delta: number) => {
    setZoom((z) =>
      Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta * ZOOM_STEP)),
    );
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (editingTemplate) {
      setName(editingTemplate.name);
      setW(editingTemplate.w);
      setH(editingTemplate.h);
      setColor(editingTemplate.color);
      const offsets =
        editingTemplate.pinOffsets || getBasePinOffsets(editingTemplate);
      setPins(
        offsets.map(([r, c], i) => ({
          r,
          c,
          label: editingTemplate.pins?.[i] || "",
        })),
      );
    } else {
      setName("");
      setW(2);
      setH(4);
      setColor("#e94560");
      setPins([]);
    }
    setHoveredHole(null);
    setResponseStatus(undefined);
    setZoom(1);
    setCurrentSide("front");
  }, [visible, editingTemplate]);

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const cw = TE_PAD * 2 + w * TE_SPACING;
    const ch = TE_PAD * 2 + h * TE_SPACING;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.scale(dpr, dpr);

    const isBack = currentSide === "back";

    ctx.fillStyle = "#1b5e20";
    ctx.fillRect(0, 0, cw, ch);

    if (isBack) {
      ctx.save();
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
    }

    ctx.fillStyle = color + "55";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    roundRect(
      ctx,
      TE_PAD + 2,
      TE_PAD + 2,
      w * TE_SPACING - 4,
      h * TE_SPACING - 4,
      6,
    );
    ctx.fill();
    ctx.stroke();

    const drawText = (
      text: string,
      x: number,
      y: number,
      baseline?: CanvasTextBaseline,
    ) => {
      if (isBack) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(-1, 1);
        if (baseline) ctx.textBaseline = baseline;
        ctx.fillText(text, 0, 0);
        ctx.restore();
      } else {
        if (baseline) ctx.textBaseline = baseline;
        ctx.fillText(text, x, y);
      }
    };

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const x = TE_PAD + c * TE_SPACING + TE_SPACING / 2;
        const y = TE_PAD + r * TE_SPACING + TE_SPACING / 2;
        const pinIdx = pins.findIndex((p) => p.r === r && p.c === c);
        const isPin = pinIdx >= 0;

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = isPin ? color : "#2a2a2a";
        ctx.fill();
        ctx.strokeStyle = isPin ? "white" : "rgba(255,255,255,0.3)";
        ctx.lineWidth = isPin ? 1.5 : 0.5;
        ctx.stroke();

        if (isPin) {
          ctx.save();
          ctx.font = "bold 10px sans-serif";
          ctx.fillStyle = "white";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          drawText(String(pinIdx + 1), x, y);
          ctx.restore();

          const pin = pins[pinIdx];
          if (pin.label) {
            ctx.save();
            ctx.font = "bold 9px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            const m = ctx.measureText(pin.label);
            const tw = m.width + 4;
            ctx.fillStyle = "rgba(0,0,0,0.75)";
            ctx.fillRect(x - tw / 2, y - 20, tw, 12);
            ctx.fillStyle = "#ffd93d";
            drawText(pin.label, x, y - 9, "bottom");
            ctx.restore();
          }
        }

        if (hoveredHole?.[0] === r && hoveredHole?.[1] === c) {
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.strokeStyle = "#e94560";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    if (isBack) {
      ctx.restore();
    }

    ctx.save();
    ctx.font = "9px monospace";
    ctx.fillStyle = "#666";
    ctx.textAlign = "center";
    for (let c = 0; c < w; c++) {
      ctx.fillText(
        String(c),
        TE_PAD + c * TE_SPACING + TE_SPACING / 2,
        TE_PAD - 6,
      );
    }
    ctx.textAlign = "right";
    for (let r = 0; r < h; r++) {
      ctx.fillText(
        String(r),
        TE_PAD - 6,
        TE_PAD + r * TE_SPACING + TE_SPACING / 2 + 3,
      );
    }
    ctx.restore();
  }, [w, h, color, pins, hoveredHole, currentSide]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  const holeFromMouse = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): [number, number] | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const scaleX = canvas.width / dpr / rect.width;
      const scaleY = canvas.height / dpr / rect.height;
      let mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      if (currentSide === "back") {
        mx = canvas.width / dpr - mx;
      }
      const cc = Math.floor((mx - TE_PAD) / TE_SPACING);
      const rr = Math.floor((my - TE_PAD) / TE_SPACING);
      if (rr >= 0 && rr < h && cc >= 0 && cc < w) {
        const hx = TE_PAD + cc * TE_SPACING + TE_SPACING / 2;
        const hy = TE_PAD + rr * TE_SPACING + TE_SPACING / 2;
        if (Math.sqrt((mx - hx) ** 2 + (my - hy) ** 2) < TE_SPACING / 2)
          return [rr, cc];
      }
      return null;
    },
    [w, h, currentSide],
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const hole = holeFromMouse(e);
      if (!hole) return;
      const [r, c] = hole;
      setPins((prev) => {
        const idx = prev.findIndex((p) => p.r === r && p.c === c);
        if (idx >= 0) return prev.filter((_, i) => i !== idx);
        return [...prev, { r, c, label: "" }];
      });
      setResponseStatus(undefined);
    },
    [holeFromMouse],
  );

  const handleResize = useCallback((newW: number, newH: number) => {
    const nw = Math.max(1, Math.min(30, newW));
    const nh = Math.max(1, Math.min(30, newH));
    setW(nw);
    setH(nh);
    setPins((prev) => prev.filter((p) => p.r < nh && p.c < nw));
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleZoom(e.deltaY > 0 ? -1 : 1);
      }
    },
    [handleZoom],
  );

  const handleSubmit = useCallback(
    (_e: React.FormEvent, helpers: { close: () => void }) => {
      if (responseStatus) return;
      if (!name.trim()) {
        setResponseStatus({
          status: "error",
          text: "部品名を入力してください",
        });
        return;
      }
      if (pins.length === 0) {
        setResponseStatus({
          status: "error",
          text: "少なくとも1つのピンを配置してください",
        });
        return;
      }

      const tpl: ComponentTemplate = {
        id: editingTemplate?.id || crypto.randomUUID(),
        name: name.trim(),
        w,
        h,
        color,
        pinOffsets: pins.map((p) => [p.r, p.c]),
        pins: pins.map((p) => p.label || ""),
      };
      onSave(tpl);
      helpers.close();
    },
    [name, w, h, color, pins, editingTemplate, onSave, responseStatus],
  );

  const handleClose = useCallback(() => {
    setResponseStatus(undefined);
    onClose();
  }, [onClose]);

  const canvasW = TE_PAD * 2 + w * TE_SPACING;
  const canvasH = TE_PAD * 2 + h * TE_SPACING;

  return (
    <ControlledFormDialog
      isOpen={visible}
      heading={editingTemplate ? "テンプレート編集" : "テンプレート作成"}
      actionText="保存"
      size="XL"
      responseStatus={responseStatus}
      onSubmit={handleSubmit}
      onClickClose={handleClose}
      onClickOverlay={handleClose}
      onPressEscape={handleClose}
    >
      <div className={styles.body}>
        <div className={styles.left}>
          <Stack gap={0.75}>
            <Fieldset legend="部品情報">
              <FormControl label="部品名">
                <Input
                  value={name}
                  width="100%"
                  onChange={(e) => {
                    setName(e.target.value);
                    setResponseStatus(undefined);
                  }}
                />
              </FormControl>
                <FormControl label="幅 (列)">
                  <Input
                    type="number"
                    value={w}
                    min={1}
                    max={30}
                    width="100%"
                    onChange={(e) => handleResize(Number(e.target.value), h)}
                  />
                </FormControl>
                <FormControl label="高さ (行)">
                  <Input
                    type="number"
                    value={h}
                    min={1}
                    max={30}
                    width="100%"
                    onChange={(e) => handleResize(w, Number(e.target.value))}
                  />
                </FormControl>
              <FormControl label="色">
                <Cluster gap={0.5} align="center">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className={styles.colorInput}
                  />
                  <Text size="S" color="TEXT_GREY">
                    {color}
                  </Text>
                </Cluster>
              </FormControl>
            </Fieldset>
            <Base padding={0.5} className={styles.hintBox}>
              <Text size="S">グリッドをクリックしてピンを追加/削除</Text>
            </Base>
            <div>
              <Heading type="subBlockTitle">ピン一覧 ({pins.length}本)</Heading>
              <div className={styles.pinList}>
                {pins.length === 0 ? (
                  <Text size="S" color="TEXT_GREY">
                    ピンなし
                  </Text>
                ) : (
                  pins.map((pin, i) => (
                    <div key={i} className={styles.pinItem}>
                      <span className={styles.pinNum}>{i + 1}</span>
                      <Text
                        size="S"
                        color="TEXT_GREY"
                        className={styles.pinPos}
                      >
                        ({pin.r},{pin.c})
                      </Text>
                      <Input
                        value={pin.label}
                        width="100%"
                        aria-label={`ピン${i + 1}のラベル`}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPins((prev) =>
                            prev.map((p, j) =>
                              j === i ? { ...p, label: val } : p,
                            ),
                          );
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                      <button
                        className={styles.pinRemove}
                        onClick={() =>
                          setPins((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Stack>
        </div>

        <div className={styles.right}>
          <Cluster gap={0.5} align="center" className={styles.zoomControls}>
            <SegmentedControl
              options={[
                { value: "front", content: "表面" },
                { value: "back", content: "裏面" },
              ]}
              value={currentSide}
              onClickOption={(v) => setCurrentSide(v as BoardSide)}
            />
            <Cluster gap={0.25} align="center">
              <Button
                size="s"
                variant="secondary"
                onClick={() => handleZoom(-1)}
              >
                -
              </Button>
              <Text size="S" className={styles.zoomLabel}>
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
          </Cluster>
          <div className={styles.gridArea} onWheel={handleWheel}>
            <div
              className={styles.gridScroller}
              style={{
                width: `max(100%, ${canvasW * zoom + 40}px)`,
                height: `max(100%, ${canvasH * zoom + 40}px)`,
              }}
            >
              <div
                className={styles.gridWrapper}
                style={{
                  width: canvasW * zoom,
                  height: canvasH * zoom,
                }}
              >
                <canvas
                  ref={canvasRef}
                  className={styles.canvas}
                  style={{ transform: `scale(${zoom})` }}
                  onMouseMove={(e) => setHoveredHole(holeFromMouse(e))}
                  onMouseLeave={() => setHoveredHole(null)}
                  onClick={handleCanvasClick}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ControlledFormDialog>
  );
}
