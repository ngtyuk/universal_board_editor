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
  onOpenTemplateEditor: (tpl?: ComponentTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onResetBoard: () => void;
  onSave: () => void;
  onLoad: (json: string) => void;
  onExportImage: () => void;
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
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    open: false,
    title: "",
    message: "",
    action: () => {},
  });

  const selectedTpl = state.templates.find((t) => t.id === selectedTemplateId);

  const { onLoad } = props;
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
                    <Text size="S" className={styles.compName}>
                      {comp.name} ({comp.row + 1},{comp.col + 1}){rot}
                    </Text>
                    <Cluster gap={0} align="center">
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
