import { useState, useRef, useCallback } from "react";
import {
  Button,
  FormControl,
  Input,
  Select,
  Base,
  Heading,
  Text,
  Stack,
  Cluster,
  ControlledActionDialog,
  Fieldset,
} from "smarthr-ui";
import type { BoardState, ToolType, ComponentTemplate } from "../types";
import { WIRE_COLORS } from "../utils/constants";
import { getComponentPinPositions, getAllNets } from "../utils/board";
import styles from "./Sidebar.module.css";

type ConfirmDialog = {
  open: boolean;
  title: string;
  message: string;
  action: () => void;
};

interface Props {
  state: BoardState;
  currentTool: ToolType;
  selectedComponentId: string | null;
  wireColor: string;
  selectedTemplateId: string;
  placementRotation: number;
  onSelectTool: (tool: ToolType) => void;
  onResizeBoard: (cols: number, rows: number) => void;
  onSetWireColor: (color: string) => void;
  onSelectTemplate: (id: string) => void;
  onSetPlacementRotation: (r: number) => void;
  onSelectComponent: (id: string) => void;
  onRotateComponent: (id: string) => void;
  onRemoveComponent: (id: string) => void;
  onRenameComponent: (id: string, name: string) => void;
  onOpenTemplateEditor: (tpl?: ComponentTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onResetBoard: () => void;
  onSave: () => void;
  onLoad: (json: string) => void;
  onExportImage: () => void;
  onExportTemplates: () => void;
  onImportTemplates: (json: string) => void;
  projectName: string;
  projectMemo: string;
  onSetProjectName: (name: string) => void;
  onSetProjectMemo: (memo: string) => void;
}

export default function Sidebar(props: Props) {
  const {
    state,
    currentTool,
    selectedComponentId,
    wireColor,
    selectedTemplateId,
    placementRotation,
  } = props;

  const [cols, setCols] = useState(state.cols);
  const [rows, setRows] = useState(state.rows);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateFileInputRef = useRef<HTMLInputElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    open: false,
    title: "",
    message: "",
    action: () => {},
  });

  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const selectedTpl = state.templates.find((t) => t.id === selectedTemplateId);

  const { onLoad, onImportTemplates } = props;
  const handleLoad = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) onLoad(ev.target.result as string);
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [onLoad],
  );

  const handleImportTemplates = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) onImportTemplates(ev.target.result as string);
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [onImportTemplates],
  );

  const templateOptions = [
    { value: "", label: "-- 選択 --" },
    ...state.templates.map((t) => ({
      value: t.id,
      label: `${t.name} (${t.w}×${t.h})`,
    })),
  ];

  return (
    <div className={styles.sidebar}>
      <Stack gap={0.25}>
        <Heading type="sectionTitle" className={styles.title}>
          Universal Board Editor
        </Heading>
      </Stack>

      {/* Project Info */}
      <Base padding={1} overflow="visible" className={styles.panel}>
        <Stack gap={0.5}>
          <FormControl label="プロジェクト名">
            <Input
              value={props.projectName}
              placeholder="無題のプロジェクト"
              width="100%"
              onChange={(e) => props.onSetProjectName(e.target.value)}
            />
          </FormControl>
          <FormControl label="メモ">
            <textarea
              className={styles.memoTextarea}
              value={props.projectMemo}
              placeholder="メモを入力..."
              rows={3}
              onChange={(e) => props.onSetProjectMemo(e.target.value)}
            />
          </FormControl>
        </Stack>
      </Base>

      {/* Board Size */}
      <Base padding={1} overflow="visible" className={styles.panel}>
        <Stack gap={0.5}>
          <Fieldset legend="基板サイズ" className={styles.fieldset}>
              <FormControl label="横 (列数)">
                <Input
                  type="number"
                  value={cols}
                  min={5}
                  max={100}
                  width="100%"
                  onChange={(e) => setCols(Number(e.target.value))}
                />
              </FormControl>
              <FormControl label="縦 (行数)">
                <Input
                  type="number"
                  value={rows}
                  min={5}
                  max={100}
                  width="100%"
                  onChange={(e) => setRows(Number(e.target.value))}
                />
              </FormControl>
          </Fieldset>
          <Button size="s" onClick={() => props.onResizeBoard(cols, rows)} wide>
            サイズ変更
          </Button>
        </Stack>
      </Base>

      {/* Component Panel */}
      {currentTool === "component" && (
        <Base padding={1} overflow="visible" className={styles.panel}>
          <Stack gap={0.5}>
            <Heading type="blockTitle">部品テンプレート</Heading>
            <FormControl label="テンプレート">
              <Select
                options={templateOptions}
                value={selectedTemplateId}
                onChange={(e) => props.onSelectTemplate(e.target.value)}
              />
            </FormControl>

            {selectedTpl && (
              <Base padding={0.75} className={styles.templateDetail}>
                <Stack gap={0.25}>
                  <Text size="S">
                    <strong>{selectedTpl.name}</strong> ({selectedTpl.w}×
                    {selectedTpl.h})
                  </Text>
                  <Cluster gap={0.5} align="center">
                    <Text size="S">配置角度: {placementRotation}°</Text>
                    <Button
                      size="s"
                      variant="secondary"
                      onClick={() =>
                        props.onSetPlacementRotation(
                          (placementRotation + 90) % 360,
                        )
                      }
                    >
                      R 回転
                    </Button>
                  </Cluster>
                  <Text size="S" color="TEXT_GREY">
                    基板上のホールをクリックして配置
                  </Text>
                </Stack>
              </Base>
            )}

            <hr className={styles.divider} />
            <Stack gap={0.25}>
              <Button
                size="s"
                onClick={() => props.onOpenTemplateEditor()}
                wide
              >
                テンプレートを作成
              </Button>
              <Cluster gap={0.25}>
                <Button
                  size="s"
                  variant="secondary"
                  onClick={() => {
                    if (selectedTpl) props.onOpenTemplateEditor(selectedTpl);
                  }}
                  disabled={!selectedTpl}
                >
                  編集
                </Button>
                <Button
                  size="s"
                  variant="danger"
                  onClick={() => {
                    if (selectedTpl)
                      setConfirmDialog({
                        open: true,
                        title: "テンプレートの削除",
                        message: `「${selectedTpl.name}」を削除しますか？`,
                        action: () => props.onDeleteTemplate(selectedTpl.id),
                      });
                  }}
                  disabled={!selectedTpl}
                >
                  削除
                </Button>
              </Cluster>
              <Cluster gap={0.25}>
                <Button
                  size="s"
                  variant="secondary"
                  onClick={props.onExportTemplates}
                >
                  エクスポート
                </Button>
                <Button
                  size="s"
                  variant="secondary"
                  onClick={() => templateFileInputRef.current?.click()}
                >
                  インポート
                </Button>
              </Cluster>
            </Stack>
          </Stack>
        </Base>
      )}

      {/* Wire Panel */}
      {currentTool === "wire" && (
        <Base padding={1} overflow="visible" className={styles.panel}>
          <Stack gap={0.5}>
            <FormControl label="配線の色">
              <Cluster gap={0.25}>
                {WIRE_COLORS.map((c) => (
                  <div
                    key={c}
                    className={`${styles.wireColorBtn} ${c === wireColor ? styles.wireColorActive : ""}`}
                    style={{ background: c }}
                    onClick={() => props.onSetWireColor(c)}
                  />
                ))}
              </Cluster>
            </FormControl>
          </Stack>
        </Base>
      )}

      {/* Placed Components */}
      <Base padding={1} overflow="visible" className={styles.panel}>
        <Stack gap={0.5}>
          <Heading type="blockTitle">配置済み部品</Heading>
          {state.components.length === 0 ? (
            <Text size="S" color="TEXT_GREY">
              部品なし
            </Text>
          ) : (
            <Stack gap={0.25}>
              {state.components.map((comp) => {
                const tpl = state.templates.find(
                  (t) => t.id === comp.templateId,
                );
                const color = tpl?.color || "#888";
                const isSelected = selectedComponentId === comp.id;
                const rot = comp.rotation ? ` ${comp.rotation}°` : "";
                const isEditing = editingCompId === comp.id;
                return (
                  <div
                    key={comp.id}
                    className={`${styles.componentItem} ${isSelected ? styles.componentItemSelected : ""}`}
                    onClick={() => props.onSelectComponent(comp.id)}
                  >
                    <span
                      className={styles.colorDot}
                      style={{ background: color }}
                    />
                    {isEditing ? (
                      <input
                        className={styles.renameInput}
                        value={editingName}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => {
                          if (editingName.trim()) props.onRenameComponent(comp.id, editingName.trim());
                          setEditingCompId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (editingName.trim()) props.onRenameComponent(comp.id, editingName.trim());
                            setEditingCompId(null);
                          } else if (e.key === "Escape") {
                            setEditingCompId(null);
                          }
                        }}
                      />
                    ) : (
                      <Text
                        size="S"
                        className={styles.compName}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingCompId(comp.id);
                          setEditingName(comp.name);
                        }}
                      >
                        {comp.name} ({comp.row + 1},{comp.col + 1}){rot}
                      </Text>
                    )}
                    <Cluster gap={0} align="center">
                      <button
                        className={styles.actBtn}
                        title="名前変更"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCompId(comp.id);
                          setEditingName(comp.name);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        className={styles.actBtn}
                        title="回転"
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onRotateComponent(comp.id);
                        }}
                      >
                        ↻
                      </button>
                      <button
                        className={styles.actBtn}
                        title="削除"
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onRemoveComponent(comp.id);
                        }}
                      >
                        ×
                      </button>
                    </Cluster>
                  </div>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Base>

      {/* Wire List (grouped by net) */}
      <Base padding={1} overflow="visible" className={styles.panel}>
        <Stack gap={0.5}>
          <Heading type="blockTitle">配線</Heading>
          {state.wires.length === 0 ? (
            <Text size="S" color="TEXT_GREY">配線なし</Text>
          ) : (
            (() => {
              // Build pin position map: "r,c" -> "CompName:PinLabel"
              const pinMap = new Map<string, string>();
              for (const comp of state.components) {
                const tpl = state.templates.find(t => t.id === comp.templateId);
                if (!tpl || !tpl.pins?.length) continue;
                const positions = getComponentPinPositions(comp, tpl);
                for (let i = 0; i < positions.length && i < tpl.pins.length; i++) {
                  pinMap.set(`${positions[i][0]},${positions[i][1]}`, `${comp.name}:${tpl.pins[i]}`);
                }
              }
              const nets = getAllNets(state.wires);
              return (
                <div className={styles.wireList}>
                  {nets.map((net, i) => {
                    // Find component pins in this net
                    const pins: string[] = [];
                    const otherHoles: string[] = [];
                    for (const [r, c] of net) {
                      const pinDesc = pinMap.get(`${r},${c}`);
                      if (pinDesc) {
                        pins.push(pinDesc);
                      } else {
                        otherHoles.push(`(${r + 1},${c + 1})`);
                      }
                    }
                    const parts = [...pins, ...otherHoles];
                    if (parts.length === 0) return null;
                    return (
                      <div key={i} className={styles.wireItem}>
                        <Text size="S" className={styles.wireDesc}>
                          {pins.length >= 2
                            ? pins.join(' ↔ ')
                            : parts.join(' ↔ ')}
                        </Text>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </Stack>
      </Base>

      {/* File */}
      <Base padding={1} overflow="visible" className={styles.panel}>
        <Stack gap={0.5}>
          <Heading type="blockTitle">ファイル</Heading>
          <Cluster gap={0.25}>
            <Button size="s" onClick={props.onSave}>
              保存
            </Button>
            <Button
              size="s"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              読込
            </Button>
            <Button size="s" variant="secondary" onClick={props.onExportImage}>
              画像出力
            </Button>
          </Cluster>
          <Button
            size="s"
            variant="danger"
            wide
            onClick={() =>
              setConfirmDialog({
                open: true,
                title: "基板の初期化",
                message:
                  "配置済みの部品・配線・ラベルがすべて削除されます。初期化しますか？",
                action: () => props.onResetBoard(),
              })
            }
          >
            基板を初期化
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleLoad}
          />
          <input
            ref={templateFileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleImportTemplates}
          />
        </Stack>
      </Base>
      <ControlledActionDialog
        isOpen={confirmDialog.open}
        heading={confirmDialog.title}
        actionText="削除する"
        actionTheme="danger"
        onClickAction={() => {
          confirmDialog.action();
          setConfirmDialog((s) => ({ ...s, open: false }));
        }}
        onClickClose={() => setConfirmDialog((s) => ({ ...s, open: false }))}
        onClickOverlay={() => setConfirmDialog((s) => ({ ...s, open: false }))}
        onPressEscape={() => setConfirmDialog((s) => ({ ...s, open: false }))}
      >
        <Text>{confirmDialog.message}</Text>
      </ControlledActionDialog>
    </div>
  );
}
