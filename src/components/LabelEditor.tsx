import { useState, useEffect, useRef } from 'react';
import { Button, Input, FormControl, Stack, Cluster, Base } from 'smarthr-ui';
import styles from './LabelEditor.module.css';

interface Props {
  visible: boolean;
  x: number;
  y: number;
  initialLabel: string;
  onApply: (label: string) => void;
  onClose: () => void;
}

export default function LabelEditor({ visible, x, y, initialLabel, onApply, onClose }: Props) {
  const [value, setValue] = useState(initialLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) setTimeout(() => inputRef.current?.focus(), 0);
  }, [visible]);

  if (!visible) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onApply(value.trim());
    if (e.key === 'Escape') onClose();
  };

  return (
    <Base padding={1} className={styles.editor} style={{ left: x, top: y }}>
      <Stack gap={0.5}>
        <FormControl label="ホールラベル">
          <Input
            ref={inputRef}
            value={value}
            placeholder="例: GND"
            width="100%"
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </FormControl>
        <Cluster gap={0.25}>
          <Button size="s" onClick={() => onApply(value.trim())}>適用</Button>
          <Button size="s" variant="secondary" onClick={onClose}>閉じる</Button>
        </Cluster>
      </Stack>
    </Base>
  );
}
