import { useRef, useCallback } from 'react';
import {
  Button,
  FormControl,
  Select,
  Base,
  Text,
  Stack,
  Cluster,
} from 'smarthr-ui';
import type { BoardState, ToolType, ComponentTemplate } from '../types';
import { WIRE_COLORS } from '../utils/constants';
import styles from './ToolOptionsPanel.module.css';

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
  onDeleteTemplate: (id: string) => void;
  onExportTemplates: () => void;
  onImportTemplates: (json: string) => void;
}

export default function ToolOptionsPanel(props: Props) {
  const {
    state,
    currentTool,
    selectedTemplateId,
    placementRotation,
    wireColor,
  } = props;

  const templateFileInputRef = useRef<HTMLInputElement>(null);

  const handleImportTemplates = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) props.onImportTemplates(ev.target.result as string);
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [props.onImportTemplates],
  );

  const selectedTpl = state.templates.find((t) => t.id === selectedTemplateId);

  const templateOptions = [
    { value: '', label: '-- 選択 --' },
    ...state.templates.map((t) => ({
      value: t.id,
      label: `${t.name} (${t.w}×${t.h})`,
    })),
  ];

  if (currentTool === 'component') {
    return (
      <div className={styles.container}>
        <Base padding={0.75} className={styles.panel}>
          <Stack gap={0.5}>
            <FormControl label="テンプレート">
              <Select
                options={templateOptions}
                value={selectedTemplateId}
                onChange={(e) => props.onSelectTemplate(e.target.value)}
              />
            </FormControl>

            {selectedTpl && (
              <Cluster gap={0.5} align="center">
                <Text size="S">配置角度: {placementRotation}°</Text>
                <Button
                  size="s"
                  variant="secondary"
                  onClick={() =>
                    props.onSetPlacementRotation((placementRotation + 90) % 360)
                  }
                >
                  R 回転
                </Button>
              </Cluster>
            )}

            <Cluster gap={0.25}>
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
                variant="danger"
                onClick={() => {
                  if (selectedTpl) props.onDeleteTemplate(selectedTpl.id);
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
        </Base>
        <input
          ref={templateFileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportTemplates}
        />
      </div>
    );
  }

  if (currentTool === 'wire') {
    return (
      <div className={styles.container}>
        <Base padding={0.75} className={styles.panel}>
          <FormControl label="配線の色">
            <Cluster gap={0.25}>
              {WIRE_COLORS.map((c) => (
                <div
                  key={c}
                  className={`${styles.wireColorBtn} ${c === wireColor ? styles.wireColorActive : ''}`}
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
