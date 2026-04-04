import { useState, useRef, useCallback } from "react";
import {
  Button,
  FormControl,
  Input,
  Base,
  Heading,
  Text,
  Stack,
  Cluster,
  ControlledActionDialog,
  FaPencilIcon,
  FaArrowRotateRightIcon,
  FaTrashCanIcon,
  FaAnglesLeftIcon,
  FaAnglesRightIcon,
} from "smarthr-ui";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BoardState, ComponentTemplate, PlacedComponent } from "../types";
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
  selectedComponentId: string | null;
  onSelectComponent: (id: string | null) => void;
  onRotateComponent: (id: string) => void;
  onRemoveComponent: (id: string) => void;
  onRenameComponent: (id: string, name: string) => void;
  onReorderComponents: (ids: string[]) => void;
  onResetBoard: () => void;
  onSave: () => void;
  onLoad: (json: string) => void;
  onExportImage: () => void;
  projectName: string;
  projectMemo: string;
  onSetProjectName: (name: string) => void;
  onSetProjectMemo: (memo: string) => void;
  highlightedNet: [number, number][] | null;
  onHighlightNet: (net: [number, number][] | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}

function SortableCompItem({ comp, tpl, onMoveUp, onMoveDown, isFirst, isLast }: {
  comp: PlacedComponent;
  tpl: ComponentTemplate | undefined;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: comp.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const color = tpl?.color || "#888";
  return (
    <div ref={setNodeRef} style={style} className={styles.componentItem} {...attributes} {...listeners}>
      <span className={styles.colorDot} style={{ background: color }} />
      <Text size="S" className={styles.compName}>
        {comp.name}
      </Text>
      <Cluster gap={0} align="center">
        <button className={styles.actBtn} title="上へ" disabled={isFirst} onClick={(e) => { e.stopPropagation(); onMoveUp(); }}>↑</button>
        <button className={styles.actBtn} title="下へ" disabled={isLast} onClick={(e) => { e.stopPropagation(); onMoveDown(); }}>↓</button>
      </Cluster>
    </div>
  );
}

function ReorderableComponentList({ components, templates, onReorder }: {
  components: PlacedComponent[];
  templates: ComponentTemplate[];
  onReorder: (ids: string[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const ids = components.map(c => c.id);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }, [ids, onReorder]);

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    onReorder(arrayMove(ids, index, index - 1));
  }, [ids, onReorder]);

  const handleMoveDown = useCallback((index: number) => {
    if (index >= ids.length - 1) return;
    onReorder(arrayMove(ids, index, index + 1));
  }, [ids, onReorder]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <Stack gap={0.25}>
          {components.map((comp, i) => (
            <SortableCompItem
              key={comp.id}
              comp={comp}
              tpl={templates.find(t => t.id === comp.templateId)}
              onMoveUp={() => handleMoveUp(i)}
              onMoveDown={() => handleMoveDown(i)}
              isFirst={i === 0}
              isLast={i === components.length - 1}
            />
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  );
}

export default function Sidebar(props: Props) {
  const {
    state,
    selectedComponentId,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    open: false,
    title: "",
    message: "",
    action: () => {},
  });

  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [reorderMode, setReorderMode] = useState(false);

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

  if (!props.isOpen) {
    return (
      <div className={styles.sidebarClosed}>
        <button className={styles.toggleBtn} onClick={props.onToggle} title="サイドバーを開く">
          <FaAnglesRightIcon alt="開く" />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.sidebar}>
      <Stack gap={0.25}>
        <Cluster justify="space-between" align="center">
          <Heading type="sectionTitle" className={styles.title}>
            Universal Board Editor
          </Heading>
        </Cluster>
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

      {/* Placed Components */}
      <Base padding={1} overflow="visible" className={styles.panel}>
        <Stack gap={0.5}>
          <Cluster justify="space-between" align="center">
            <Heading type="blockTitle">配置済み部品リスト</Heading>
          </Cluster>
          {state.components.length === 0 ? (
            <Text size="S" color="TEXT_GREY">
              部品なし
            </Text>
          ) : reorderMode ? (
            <ReorderableComponentList
              components={state.components}
              templates={state.templates}
              onReorder={props.onReorderComponents}
            />
          ) : (
            <Stack gap={0.25}>
              {state.components.map((comp) => {
                const tpl = state.templates.find(
                  (t) => t.id === comp.templateId,
                );
                const color = tpl?.color || "#888";
                const isSelected = selectedComponentId === comp.id;
                const isEditing = editingCompId === comp.id;
                return (
                  <div
                    key={comp.id}
                    className={`${styles.componentItem} ${isSelected ? styles.componentItemSelected : ""}`}
                    onClick={() => props.onSelectComponent(isSelected ? null : comp.id)}
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
                      <Text size="S" className={styles.compName}>
                        {comp.name} ({comp.row + 1},{comp.col + 1})
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
                         <FaPencilIcon alt="名前変更" />
                      </button>
                      <button
                        className={styles.actBtn}
                        title="回転"
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onRotateComponent(comp.id);
                        }}
                      >
                        <FaArrowRotateRightIcon alt="回転" />
                      </button>
                      <button
                        className={styles.actBtn}
                        title="削除"
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onRemoveComponent(comp.id);
                        }}
                      >
                        <FaTrashCanIcon alt="削除" />
                      </button>
                    </Cluster>
                  </div>
                );
              })}
            </Stack>
          )}
                      {state.components.length > 1 && (
              <Button
                size="s"
                variant={reorderMode ? "primary" : "secondary"}
                onClick={() => setReorderMode(!reorderMode)}
              >
                {reorderMode ? "完了" : "並び替え"}
              </Button>
            )}
        </Stack>
      </Base>

      {/* Wire List (grouped by net) */}
      <Base padding={1} overflow="visible" className={styles.panel}>
        <Stack gap={0.5}>
          <Heading type="blockTitle">配線リスト</Heading>
          {state.wires.length === 0 ? (
            <Text size="S" color="TEXT_GREY">配線なし</Text>
          ) : (
            (() => {
              // Build pin position map: "r,c" -> { label, compIndex }
              const pinMap = new Map<string, { label: string; compIndex: number }>();
              for (let ci = 0; ci < state.components.length; ci++) {
                const comp = state.components[ci];
                const tpl = state.templates.find(t => t.id === comp.templateId);
                if (!tpl || !tpl.pins?.length) continue;
                const positions = getComponentPinPositions(comp, tpl);
                for (let i = 0; i < positions.length && i < tpl.pins.length; i++) {
                  pinMap.set(`${positions[i][0]},${positions[i][1]}`, { label: `${comp.name}:${tpl.pins[i]}`, compIndex: ci });
                }
              }
              const nets = getAllNets(state.wires);
              return (
                <div className={styles.wireList}>
                  {nets.map((net, i) => {
                    // Collect entries with sort keys (component index order, then labels, then bare holes)
                    const entries: { text: string; sortKey: number; named: boolean }[] = [];
                    for (const [r, c] of net) {
                      const pin = pinMap.get(`${r},${c}`);
                      if (pin) {
                        entries.push({ text: pin.label, sortKey: pin.compIndex, named: true });
                      } else {
                        const holeLabel = state.holes[`${r},${c}`]?.label;
                        if (holeLabel) {
                          entries.push({ text: `[${holeLabel}]`, sortKey: state.components.length, named: true });
                        } else {
                          entries.push({ text: `(${r + 1},${c + 1})`, sortKey: state.components.length + 1, named: false });
                        }
                      }
                    }
                    entries.sort((a, b) => a.sortKey - b.sortKey);
                    const namedParts = entries.filter(e => e.named).map(e => e.text);
                    const allParts = entries.map(e => e.text);
                    if (allParts.length === 0) return null;
                    const pinOnly = net.filter(([r, c]) => pinMap.has(`${r},${c}`));
                    const isActive = props.highlightedNet != null &&
                      pinOnly.length === props.highlightedNet.length &&
                      pinOnly.every(([r, c]) => props.highlightedNet!.some(([hr, hc]) => hr === r && hc === c));
                    return (
                      <div
                        key={i}
                        className={`${styles.wireItem} ${isActive ? styles.wireItemSelected : ""}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => props.onHighlightNet(isActive ? null : (pinOnly.length > 0 ? pinOnly : null))}
                      >
                        <Text size="S" className={styles.wireDesc}>
                          {namedParts.length >= 2
                            ? namedParts.join(' ↔ ')
                            : allParts.join(' ↔ ')}
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
        </Stack>
      </Base>
      <div className={styles.toggleBtnWrapper}>
        <button className={styles.toggleBtn} onClick={props.onToggle} title="サイドバーを閉じる">
          <FaAnglesLeftIcon alt="閉じる" />
        </button>
      </div>

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
