import { useState } from 'react';
import { ModelessDialog, Button, Text } from 'smarthr-ui';
import type { ToolType } from '../types';
import styles from './HelpPanel.module.css';

const TOOL_HELP: Record<ToolType, { label: string; lines: string[] }> = {
  select: {
    label: '選択',
    lines: [
      'クリック … 部品を選択',
      'ドラッグ … 部品 / 配線端点を移動',
      'Delete / Backspace … 選択部品を削除',
      'R … 選択部品を回転',
    ],
  },
  block: {
    label: '基板編集',
    lines: [
      'クリック … 無効ホールの設定 / 解除',
    ],
  },
  component: {
    label: '部品配置',
    lines: [
      'クリック … 選択テンプレートを配置',
      'R / 右クリック … 配置前に回転',
    ],
  },
  wire: {
    label: '配線',
    lines: [
      '1回目クリック … 始点を設定',
      '2回目クリック … 終点を設定して配線',
      'Escape / 右クリック … 配線をキャンセル',
    ],
  },
  label: {
    label: 'ラベル',
    lines: [
      'クリック … ラベルを編集',
    ],
  },
  erase: {
    label: '消去',
    lines: [
      'クリック … 部品 / 配線 / ラベル / 無効ホールを削除',
    ],
  },
};

const COMMON_SHORTCUTS = [
  ['1〜6', 'ツール切り替え'],
  ['Ctrl+Z', '元に戻す'],
  ['Ctrl+Shift+Z / Ctrl+Y', 'やり直し'],
  ['Ctrl+ホイール', 'ズーム'],
  ['Escape', 'キャンセル'],
];

interface Props {
  currentTool: ToolType;
}

export default function HelpPanel({ currentTool }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const toolHelp = TOOL_HELP[currentTool];

  if (!isOpen) {
    return (
      <div className={styles.minimized}>
        <Button size="s" variant="secondary" onClick={() => setIsOpen(true)}>
          ? 操作ガイド
        </Button>
      </div>
    );
  }

  return (
    <ModelessDialog
      isOpen={isOpen}
      heading="操作ガイド"
      size="S"
      bottom={48}
      left={12}
      onClickClose={() => setIsOpen(false)}
      onPressEscape={() => setIsOpen(false)}
    >
      <div className={styles.content}>
        <div className={styles.section}>
          <Text weight="bold" size="S" className={styles.sectionTitle}>
            {toolHelp.label}ツール
          </Text>
          <ul className={styles.list}>
            {toolHelp.lines.map((line, i) => (
              <li key={i} className={styles.item}>
                <Text size="S">{line}</Text>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.section}>
          <Text weight="bold" size="S" className={styles.sectionTitle}>
            共通ショートカット
          </Text>
          <table className={styles.table}>
            <tbody>
              {COMMON_SHORTCUTS.map(([key, desc], i) => (
                <tr key={i}>
                  <td className={styles.keyCell}>
                    <Text size="S" as="kbd" className={styles.kbd}>{key}</Text>
                  </td>
                  <td>
                    <Text size="S">{desc}</Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ModelessDialog>
  );
}
