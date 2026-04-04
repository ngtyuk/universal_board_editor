import { useState, useMemo } from "react";
import {
  Button,
  FormControl,
  Input,
  Fieldset,
  Base,
  Text,
  Stack,
  Cluster,
  TabBar,
  TabItem,
  Heading,
  FaArrowRotateRightIcon,
} from "smarthr-ui";
import type {
  BoardState,
  ToolType,
  ComponentTemplate,
  TemplateCategory,
} from "../types";
import { TEMPLATE_CATEGORIES } from "../types";
import { WIRE_COLORS } from "../utils/constants";
import styles from "./ToolOptionsPanel.module.css";

interface Props {
  state: BoardState;
  currentTool: ToolType;
  selectedTemplateId: string;
  placementRotation: number;
  wireColor: string;
  onSelectTemplate: (id: string) => void;
  onSetPlacementRotation: (r: number) => void;
  onSetWireColor: (color: string) => void;
  onOpenTemplateEditor: (tpl?: ComponentTemplate) => void;
  onDuplicateTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  onReorderTemplates: (ids: string[]) => void;
  onResizeBoard: (cols: number, rows: number) => void;
}

export default function ToolOptionsPanel(props: Props) {
  const {
    state,
    currentTool,
    selectedTemplateId,
    placementRotation,
    wireColor,
  } = props;

  const [cols, setCols] = useState(state.cols);
  const [rows, setRows] = useState(state.rows);
  const [activeCategory, setActiveCategory] =
    useState<TemplateCategory>("microcontroller");
  const [reorderMode, setReorderMode] = useState(false);

  const selectedTpl = state.templates.find((t) => t.id === selectedTemplateId);

  // Templates filtered by active category
  const filteredTemplates = useMemo(
    () =>
      state.templates.filter((t) => (t.category || "other") === activeCategory),
    [state.templates, activeCategory],
  );

  if (currentTool === "block") {
    return (
      <div className={styles.container}>
        <Base padding={0.75} className={styles.panel}>
          <Fieldset legend="基板設定" className={styles.fieldset}>
            <Stack gap={0.5}>
              <Cluster>
                <FormControl label="横のホール数(列)" className="shr-flex-1">
                  <Input
                    type="number"
                    value={cols}
                    min={5}
                    max={100}
                    width="100%"
                    onChange={(e) => setCols(Number(e.target.value))}
                  />
                </FormControl>
                <FormControl label="縦のホール数(行)" className="shr-flex-1">
                  <Input
                    type="number"
                    value={rows}
                    min={5}
                    max={100}
                    width="100%"
                    onChange={(e) => setRows(Number(e.target.value))}
                  />
                </FormControl>
              </Cluster>
              <Button
                size="s"
                onClick={() => props.onResizeBoard(cols, rows)}
                wide
              >
                サイズ変更
              </Button>
              <Text size="S" color="TEXT_GREY">
                ホールをクリックして無効ホールを設定 / 解除
              </Text>
            </Stack>
          </Fieldset>
        </Base>
      </div>
    );
  }

  if (currentTool === "component") {
    const handleMoveUp = (tplId: string) => {
      const idx = filteredTemplates.findIndex((t) => t.id === tplId);
      if (idx <= 0) return;
      // Swap in full template list
      const allIds = state.templates.map((t) => t.id);
      const globalA = allIds.indexOf(filteredTemplates[idx].id);
      const globalB = allIds.indexOf(filteredTemplates[idx - 1].id);
      const newIds = [...allIds];
      [newIds[globalA], newIds[globalB]] = [newIds[globalB], newIds[globalA]];
      props.onReorderTemplates(newIds);
    };

    const handleMoveDown = (tplId: string) => {
      const idx = filteredTemplates.findIndex((t) => t.id === tplId);
      if (idx < 0 || idx >= filteredTemplates.length - 1) return;
      const allIds = state.templates.map((t) => t.id);
      const globalA = allIds.indexOf(filteredTemplates[idx].id);
      const globalB = allIds.indexOf(filteredTemplates[idx + 1].id);
      const newIds = [...allIds];
      [newIds[globalA], newIds[globalB]] = [newIds[globalB], newIds[globalA]];
      props.onReorderTemplates(newIds);
    };

    return (
      <div className={styles.container}>
        <Base padding={0.75} className={styles.panel}>
          <Stack gap={0.5}>
            <Heading type={"blockTitle"}>部品選択</Heading>
            <TabBar>
              {TEMPLATE_CATEGORIES.map((cat) => (
                <TabItem
                  key={cat.id}
                  id={cat.id}
                  selected={activeCategory === cat.id}
                  onClick={(id) => setActiveCategory(id as TemplateCategory)}
                >
                  {cat.label}
                </TabItem>
              ))}
            </TabBar>

            <div className={styles.templateList}>
              {filteredTemplates.length === 0 ? (
                <Text size="S" color="TEXT_GREY">
                  テンプレートなし
                </Text>
              ) : (
                filteredTemplates.map((t, i) => (
                  <div
                    key={t.id}
                    className={`${styles.templateItem} ${t.id === selectedTemplateId ? styles.templateItemSelected : ""}`}
                    onClick={() => props.onSelectTemplate(t.id)}
                  >
                    <span
                      className={styles.templateColor}
                      style={{ background: t.color }}
                    />
                    <Text size="S" className={styles.templateName}>
                      {t.name}
                    </Text>
                    <Text size="S" color="TEXT_GREY">
                      {t.w}×{t.h}
                    </Text>
                    {reorderMode && (
                      <span className={styles.templateActions}>
                        <button
                          className={styles.templateOrderBtn}
                          disabled={i === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveUp(t.id);
                          }}
                        >
                          ↑
                        </button>
                        <button
                          className={styles.templateOrderBtn}
                          disabled={i === filteredTemplates.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveDown(t.id);
                          }}
                        >
                          ↓
                        </button>
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            <Cluster gap={0.25}>
              {reorderMode ? (
                <Button
                  size="s"
                  variant="primary"
                  onClick={() => setReorderMode(false)}
                >
                  完了
                </Button>
              ) : (
                <>
                  <Button size="s" onClick={() => props.onOpenTemplateEditor()}>
                    作成
                  </Button>
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
                    variant="secondary"
                    onClick={() => {
                      if (selectedTpl)
                        props.onDuplicateTemplate(selectedTpl.id);
                    }}
                    disabled={!selectedTpl}
                  >
                    複製
                  </Button>
                  {filteredTemplates.length > 1 && (
                    <Button
                      size="s"
                      variant="secondary"
                      onClick={() => setReorderMode(true)}
                    >
                      並び替え
                    </Button>
                  )}
                  <Button
                    size="s"
                    variant="danger"
                    onClick={() => {
                      if (selectedTpl) props.onDeleteTemplate(selectedTpl.id);
                    }}
                    disabled={!selectedTpl}
                  >
                    削除
                  </Button>
                </>
              )}
            </Cluster>
          </Stack>
        </Base>

        {selectedTpl && (
          <Base
            padding={0.75}
            className={styles.panel}
            style={{ marginTop: 8 }}
          >
            <Stack gap={0.5}>
              <Heading type={"blockTitle"}>配置メニュー</Heading>
              <Stack gap={0.4}>
                <Cluster gap={0.5} align="center">
                  <Heading type="subSubBlockTitle">選択中の部品：</Heading>
                  <Text size="S" weight="bold">
                    {selectedTpl.name}
                  </Text>
                </Cluster>
                <Cluster gap={0.25} align="center">
                  <Heading type="subSubBlockTitle">配置角度：</Heading>
                  <Text size="S" color="TEXT_GREY">
                    {placementRotation}°
                  </Text>
                  <Button size="s" variant="secondary" onClick={() => props.onSetPlacementRotation((placementRotation + 90) % 360)}>
                    <FaArrowRotateRightIcon />
                  </Button>
                </Cluster>
              </Stack>
            </Stack>
          </Base>
        )}
      </div>
    );
  }

  if (currentTool === "wire") {
    return (
      <div className={styles.container}>
        <Base padding={0.75} className={styles.panel}>
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
        </Base>
      </div>
    );
  }

  return null;
}
