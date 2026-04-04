import { useState, useCallback, useEffect, useRef } from 'react';
import type { BoardState, PlacedComponent, ComponentTemplate, ToolType, BoardSide } from '../types';
import { DEFAULT_TEMPLATES } from '../utils/constants';
import {
  getEffectiveDims,
  getComponentAtHole,
  getComponentPinPositions,
  getHolesOnWire,
  isPointOnWire,
  generateId,
} from '../utils/board';

const STORAGE_KEY = 'universal-board-state';
const TEMPLATE_STORAGE_KEY = 'universal-board-templates';

function loadCustomTemplates(): ComponentTemplate[] {
  try {
    const json = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!json) return [];
    return JSON.parse(json) as ComponentTemplate[];
  } catch {
    return [];
  }
}

function loadTemplates(): ComponentTemplate[] {
  return [...DEFAULT_TEMPLATES, ...loadCustomTemplates()];
}

const initialState: BoardState = {
  cols: 30,
  rows: 20,
  holes: {},
  components: [],
  wires: [],
  templates: loadTemplates(),
};

function loadSavedState(): BoardState {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return initialState;
    const data = JSON.parse(json) as BoardState;
    // localStorage の基板データにテンプレートが含まれていても無視し、
    // テンプレートは独立したストレージから読み込む
    return {
      ...data,
      templates: loadTemplates(),
    };
  } catch {
    return initialState;
  }
}

const HISTORY_MAX = 50;

export function useBoardState() {
  const [state, setState] = useState<BoardState>(loadSavedState);
  const historyRef = useRef<BoardState[]>([]);
  const historyIndexRef = useRef(-1);

  // 初回マウント時に現在の state を履歴に入れる
  useEffect(() => {
    if (historyRef.current.length === 0) {
      historyRef.current = [state];
      historyIndexRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // state 変化時に履歴を記録（undo/redo は同一参照なのでスキップされる）
  useEffect(() => {
    if (historyRef.current.length === 0) return;
    const idx = historyIndexRef.current;
    if (historyRef.current[idx] === state) return;
    historyRef.current = [...historyRef.current.slice(0, idx + 1), state].slice(-HISTORY_MAX);
    historyIndexRef.current = historyRef.current.length - 1;
  }, [state]);

  // setState をラップしてバリデーションのみ行う（履歴記録は useEffect 側）
  const commitState: typeof setState = useCallback((action) => {
    setState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (next === prev) return prev;
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    historyIndexRef.current = idx - 1;
    setState(historyRef.current[idx - 1]);
    setStatusMessage(`元に戻しました (${idx - 1}/${historyRef.current.length - 1})`);
  }, []);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx >= historyRef.current.length - 1) return;
    historyIndexRef.current = idx + 1;
    setState(historyRef.current[idx + 1]);
    setStatusMessage(`やり直しました (${idx + 1}/${historyRef.current.length - 1})`);
  }, []);

  // localStorage への自動保存 (基板データ: テンプレートを除外)
  useEffect(() => {
    try {
      const { templates: _, ...boardData } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(boardData));
    } catch {
      // quota exceeded or private browsing
    }
  }, [state]);

  // localStorage への自動保存 (カスタムテンプレート)
  useEffect(() => {
    try {
      const customTemplates = state.templates.filter(
        t => !DEFAULT_TEMPLATES.find(d => d.id === t.id)
      );
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(customTemplates));
    } catch {
      // quota exceeded or private browsing
    }
  }, [state.templates]);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [wireStart, setWireStart] = useState<[number, number] | null>(null);
  const [wireColor, setWireColor] = useState('#ff6b6b');
  const [placementRotation, setPlacementRotation] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [currentSide, setCurrentSide] = useState<BoardSide>('front');
  const [showNets, setShowNets] = useState(false);
  const [statusMessage, setStatusMessage] = useState('準備完了');
  const [notification, setNotification] = useState<{
    message: string; type: 'info' | 'success' | 'warning' | 'error';
  } | null>(null);

  const notify = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setNotification({ message, type });
    setStatusMessage(message);
  }, []);

  const selectTool = useCallback((tool: ToolType) => {
    setCurrentTool(tool);
    setWireStart(null);
    setStatusMessage(`ツール: ${{
      select: '選択', block: '基板編集', component: '部品配置', wire: '配線', label: 'ラベル', erase: '消去'
    }[tool]}`);
  }, []);

  const resizeBoard = useCallback((cols: number, rows: number) => {
    commitState(s => ({ ...s, cols, rows }));
    setStatusMessage(`基板サイズ: ${cols} × ${rows}`);
  }, []);

  const placeComponent = useCallback((r: number, c: number) => {
    commitState(s => {
      if (!selectedTemplateId) {
        notify('テンプレートを選択してください', 'warning');
        return s;
      }
      const tpl = s.templates.find(t => t.id === selectedTemplateId);
      if (!tpl) return s;

      const dims = getEffectiveDims(tpl, placementRotation);
      if (r + dims.h > s.rows || c + dims.w > s.cols) {
        notify('基板の範囲外です', 'error');
        return s;
      }

      for (let dr = 0; dr < dims.h; dr++) {
        for (let dc = 0; dc < dims.w; dc++) {
          if (getComponentAtHole(r + dr, c + dc, s.components, s.templates, currentSide)) {
            notify('他の部品と重なっています', 'error');
            return s;
          }
          if (s.blockedHoles?.includes(`${r + dr},${c + dc}`)) {
            notify('無効ホールと重なっています', 'error');
            return s;
          }
        }
      }

      const comp: PlacedComponent = {
        id: generateId(),
        templateId: tpl.id,
        row: r, col: c,
        name: tpl.name,
        rotation: placementRotation,
        side: currentSide,
      };
      setStatusMessage(`${tpl.name} を配置しました (${placementRotation}°)`);
      return { ...s, components: [...s.components, comp] };
    });
  }, [selectedTemplateId, placementRotation, currentSide, notify]);

  const removeComponent = useCallback((id: string) => {
    commitState(s => {
      const comp = s.components.find(c => c.id === id);
      const newHoles = { ...s.holes };
      if (comp) {
        const tpl = s.templates.find(t => t.id === comp.templateId);
        if (tpl) {
          for (const [pr, pc] of getComponentPinPositions(comp, tpl)) {
            const key = `${pr},${pc}`;
            if (newHoles[key] && !newHoles[key]._manual) delete newHoles[key];
          }
        }
      }
      return {
        ...s,
        holes: newHoles,
        components: s.components.filter(c => c.id !== id),
      };
    });
    setSelectedComponentId(prev => prev === id ? null : prev);
    setStatusMessage('部品を削除しました');
  }, []);

  const rotateComponent = useCallback((id: string) => {
    commitState(s => {
      const comp = s.components.find(c => c.id === id);
      if (!comp) return s;
      const tpl = s.templates.find(t => t.id === comp.templateId);
      if (!tpl) return s;

      // Clear old labels
      const newHoles = { ...s.holes };
      for (const [pr, pc] of getComponentPinPositions(comp, tpl)) {
        const key = `${pr},${pc}`;
        if (newHoles[key] && !newHoles[key]._manual) delete newHoles[key];
      }

      const newRotation = ((comp.rotation || 0) + 90) % 360;
      const newDims = getEffectiveDims(tpl, newRotation);

      if (comp.row + newDims.h > s.rows || comp.col + newDims.w > s.cols) {
        notify('回転すると基板の範囲外になります', 'error');
        return s;
      }

      for (let dr = 0; dr < newDims.h; dr++) {
        for (let dc = 0; dc < newDims.w; dc++) {
          const other = s.components.find(c => {
            if (c.id === id) return false;
            if ((c.side || 'front') !== (comp.side || 'front')) return false;
            const ot = s.templates.find(t => t.id === c.templateId);
            if (!ot) return false;
            const od = getEffectiveDims(ot, c.rotation || 0);
            const tr = comp.row + dr, tc = comp.col + dc;
            return tr >= c.row && tr < c.row + od.h && tc >= c.col && tc < c.col + od.w;
          });
          if (other) {
            notify('回転すると他の部品と重なります', 'error');
            return s;
          }
        }
      }

      setStatusMessage(`${comp.name} を ${newRotation}° に回転`);
      return {
        ...s,
        holes: newHoles,
        components: s.components.map(c => c.id === id ? { ...c, rotation: newRotation } : c),
      };
    });
  }, [notify]);

  const renameComponent = useCallback((id: string, name: string) => {
    commitState(s => ({
      ...s,
      components: s.components.map(c => c.id === id ? { ...c, name } : c),
    }));
  }, [commitState]);

  const reorderComponents = useCallback((ids: string[]) => {
    commitState(s => {
      const byId = new Map(s.components.map(c => [c.id, c]));
      const reordered = ids.map(id => byId.get(id)).filter(Boolean) as typeof s.components;
      return { ...s, components: reordered };
    });
  }, [commitState]);

  const moveComponent = useCallback((id: string, newRow: number, newCol: number) => {
    commitState(s => {
      const comp = s.components.find(c => c.id === id);
      if (!comp) return s;
      if (comp.row === newRow && comp.col === newCol) return s;
      const tpl = s.templates.find(t => t.id === comp.templateId);
      if (!tpl) return s;

      const dims = getEffectiveDims(tpl, comp.rotation || 0);
      if (newRow < 0 || newCol < 0 || newRow + dims.h > s.rows || newCol + dims.w > s.cols) {
        notify('移動先が基板の範囲外です', 'error');
        return s;
      }

      for (let dr = 0; dr < dims.h; dr++) {
        for (let dc = 0; dc < dims.w; dc++) {
          const other = getComponentAtHole(newRow + dr, newCol + dc, s.components, s.templates, comp.side || 'front');
          if (other && other.id !== id) {
            notify('移動先に他の部品があります', 'error');
            return s;
          }
          if (s.blockedHoles?.includes(`${newRow + dr},${newCol + dc}`)) {
            notify('移動先に無効ホールがあります', 'error');
            return s;
          }
        }
      }

      // Clear old pin labels
      const newHoles = { ...s.holes };
      for (const [pr, pc] of getComponentPinPositions(comp, tpl)) {
        const key = `${pr},${pc}`;
        if (newHoles[key] && !newHoles[key]._manual) delete newHoles[key];
      }

      setStatusMessage(`${comp.name} を移動しました`);
      return {
        ...s,
        holes: newHoles,
        components: s.components.map(c => c.id === id ? { ...c, row: newRow, col: newCol } : c),
      };
    });
  }, [notify]);

  const addWire = useCallback((from: [number, number], to: [number, number]) => {
    commitState(s => {
      const fromKey = `${from[0]},${from[1]}`;
      const toKey = `${to[0]},${to[1]}`;
      if (s.blockedHoles?.includes(fromKey) || s.blockedHoles?.includes(toKey)) {
        notify('無効ホールに配線できません', 'error');
        return s;
      }
      const wires = [...s.wires];

      // 新しい配線の端点が既存配線の途中にあれば、その配線を分割する
      const splitAt = (point: [number, number]) => {
        const [r, c] = point;
        for (let i = 0; i < wires.length; i++) {
          const w = wires[i];
          if ((w.side || 'front') !== currentSide) continue;
          if (isPointOnWire(r, c, w)) {
            wires.splice(i, 1,
              { from: w.from, to: point, color: w.color, side: w.side },
              { from: point, to: w.to, color: w.color, side: w.side },
            );
            break;
          }
        }
      };
      // 同じ配線（from/toが同一または逆順）が同面に既に存在するかチェック
      const isDuplicate = (a: [number, number], b: [number, number]) =>
        wires.some(w =>
          (w.side || 'front') === currentSide &&
          ((w.from[0] === a[0] && w.from[1] === a[1] && w.to[0] === b[0] && w.to[1] === b[1]) ||
           (w.from[0] === b[0] && w.from[1] === b[1] && w.to[0] === a[0] && w.to[1] === a[1]))
        );

      // ルーティング: 直線 / 45度斜め / 斜め+直線の2セグメント
      const dr = to[0] - from[0];
      const dc = to[1] - from[1];
      const adr = Math.abs(dr);
      const adc = Math.abs(dc);
      const segments: [from: [number, number], to: [number, number]][] = [];

      if (dr === 0 || dc === 0 || adr === adc) {
        // 水平 / 垂直 / 完全な45度 → 直線1本
        segments.push([from, to]);
      } else if (adr > adc) {
        // 斜め adc マス + 垂直に残り
        const signR = dr > 0 ? 1 : -1;
        const signC = dc > 0 ? 1 : -1;
        const corner: [number, number] = [from[0] + signR * adc, from[1] + signC * adc];
        segments.push([from, corner], [corner, to]);
      } else {
        // 斜め adr マス + 水平に残り
        const signR = dr > 0 ? 1 : -1;
        const signC = dc > 0 ? 1 : -1;
        const corner: [number, number] = [from[0] + signR * adr, from[1] + signC * adr];
        segments.push([from, corner], [corner, to]);
      }

      // 各セグメントの端点・中間点で既存配線を分割
      for (const seg of segments) {
        splitAt(seg[0]);
        splitAt(seg[1]);
      }

      const newWires: typeof wires = [];
      for (const [a, b] of segments) {
        if (!isDuplicate(a, b)) newWires.push({ from: a, to: b, color: wireColor, side: currentSide });
      }

      if (newWires.length === 0) {
        notify('同じ配線が既に存在します', 'error');
        return s;
      }

      return { ...s, wires: [...wires, ...newWires] };
    });
    setStatusMessage(`配線完了: 行${from[0]+1},列${from[1]+1} → 行${to[0]+1},列${to[1]+1}`);
  }, [wireColor, currentSide, notify]);

  const setHoleLabel = useCallback((r: number, c: number, label: string) => {
    commitState(s => {
      const key = `${r},${c}`;
      const newHoles = { ...s.holes };
      newHoles[key] = { label, _manual: true };
      return { ...s, holes: newHoles };
    });
  }, []);

  const eraseAt = useCallback((r: number, c: number) => {
    commitState(s => {
      const comp = getComponentAtHole(r, c, s.components, s.templates, currentSide);
      if (comp) {
        const tpl = s.templates.find(t => t.id === comp.templateId);
        const newHoles = { ...s.holes };
        if (tpl) {
          for (const [pr, pc] of getComponentPinPositions(comp, tpl)) {
            const key = `${pr},${pc}`;
            if (newHoles[key] && !newHoles[key]._manual) delete newHoles[key];
          }
        }
        setSelectedComponentId(prev => prev === comp.id ? null : prev);
        setStatusMessage('部品を削除しました');
        return { ...s, holes: newHoles, components: s.components.filter(c => c.id !== comp.id) };
      }

      // 端点が一致する配線を削除（アクティブ面のみ）
      const endpointIdx = s.wires.findIndex(w =>
        (w.side || 'front') === currentSide &&
        ((w.from[0] === r && w.from[1] === c) || (w.to[0] === r && w.to[1] === c)));
      if (endpointIdx >= 0) {
        setStatusMessage('配線を削除しました');
        return { ...s, wires: s.wires.filter((_, i) => i !== endpointIdx) };
      }

      // 配線の途中を通るホールで分割（アクティブ面のみ）
      const midIdx = s.wires.findIndex(w =>
        (w.side || 'front') === currentSide && isPointOnWire(r, c, w));
      if (midIdx >= 0) {
        const w = s.wires[midIdx];
        const holes = getHolesOnWire(w);
        const idx = holes.findIndex(h => h[0] === r && h[1] === c);
        const newWires = s.wires.filter((_, i) => i !== midIdx);
        if (idx >= 2) {
          newWires.push({ from: w.from, to: holes[idx - 1], color: w.color, side: w.side });
        }
        if (idx <= holes.length - 3) {
          newWires.push({ from: holes[idx + 1], to: w.to, color: w.color, side: w.side });
        }
        setStatusMessage('配線を分割しました');
        return { ...s, wires: newWires };
      }

      const key = `${r},${c}`;
      if (s.holes[key]) {
        const newHoles = { ...s.holes };
        delete newHoles[key];
        setStatusMessage('ラベルを削除しました');
        return { ...s, holes: newHoles };
      }

      if (s.blockedHoles?.includes(key)) {
        setStatusMessage('無効ホールを解除しました');
        return { ...s, blockedHoles: s.blockedHoles.filter(k => k !== key) };
      }

      return s;
    });
  }, [currentSide]);

  const toggleBlockedHole = useCallback((r: number, c: number) => {
    commitState(s => {
      const key = `${r},${c}`;
      const blocked = s.blockedHoles || [];
      if (blocked.includes(key)) {
        setStatusMessage(`無効ホールを解除しました (行${r + 1}, 列${c + 1})`);
        return { ...s, blockedHoles: blocked.filter(k => k !== key) };
      }
      // 部品がある場所はブロック不可
      if (getComponentAtHole(r, c, s.components, s.templates)) {
        notify('部品がある場所には無効ホールを設定できません', 'error');
        return s;
      }
      // 配線の端点がある場所はブロック不可
      const hasWire = s.wires.some(w =>
        (w.from[0] === r && w.from[1] === c) || (w.to[0] === r && w.to[1] === c)
      );
      if (hasWire) {
        notify('配線がある場所には無効ホールを設定できません', 'error');
        return s;
      }
      setStatusMessage(`無効ホールを設定しました (行${r + 1}, 列${c + 1})`);
      return { ...s, blockedHoles: [...blocked, key] };
    });
  }, [commitState, notify]);

  const moveWireEndpoint = useCallback((wireIndex: number, endpoint: 'from' | 'to', newPos: [number, number]) => {
    commitState(s => {
      if (wireIndex < 0 || wireIndex >= s.wires.length) return s;
      const wire = s.wires[wireIndex];
      const newWire = { ...wire, [endpoint]: newPos };

      // from と to が同じならスキップ
      if (newWire.from[0] === newWire.to[0] && newWire.from[1] === newWire.to[1]) return s;

      // 重複チェック
      const isDup = s.wires.some((w, i) => {
        if (i === wireIndex) return false;
        if ((w.side || 'front') !== (wire.side || 'front')) return false;
        return (
          (w.from[0] === newWire.from[0] && w.from[1] === newWire.from[1] &&
           w.to[0] === newWire.to[0] && w.to[1] === newWire.to[1]) ||
          (w.from[0] === newWire.to[0] && w.from[1] === newWire.to[1] &&
           w.to[0] === newWire.from[0] && w.to[1] === newWire.from[1])
        );
      });
      if (isDup) {
        notify('同じ配線が既に存在します', 'error');
        return s;
      }

      setStatusMessage('配線を移動しました');
      return { ...s, wires: s.wires.map((w, i) => i === wireIndex ? newWire : w) };
    });
  }, [notify]);

  const addTemplate = useCallback((tpl: ComponentTemplate) => {
    commitState(s => ({ ...s, templates: [...s.templates, tpl] }));
    notify(`テンプレート「${tpl.name}」を追加しました`, 'success');
  }, [notify]);

  const updateTemplate = useCallback((tpl: ComponentTemplate) => {
    commitState(s => ({
      ...s,
      templates: s.templates.map(t => t.id === tpl.id ? tpl : t),
    }));
    notify(`テンプレート「${tpl.name}」を更新しました`, 'success');
  }, [notify]);

  const deleteTemplate = useCallback((id: string) => {
    commitState(s => {
      if (DEFAULT_TEMPLATES.find(t => t.id === id)) {
        notify('デフォルトテンプレートは削除できません', 'error');
        return s;
      }
      if (s.components.some(c => c.templateId === id)) {
        notify('使用中のテンプレートは削除できません', 'error');
        return s;
      }
      setStatusMessage('テンプレートを削除しました');
      return { ...s, templates: s.templates.filter(t => t.id !== id) };
    });
    setSelectedTemplateId(prev => prev === id ? '' : prev);
  }, [notify]);

  const resetBoard = useCallback(() => {
    setState(s => {
      const next = { ...initialState, templates: s.templates };
      historyRef.current = [next];
      historyIndexRef.current = 0;
      return next;
    });
    setSelectedComponentId(null);
    setWireStart(null);
    notify('基板を初期化しました', 'success');
  }, [notify]);

  const setProjectName = useCallback((name: string) => {
    commitState(s => ({ ...s, projectName: name }));
  }, [commitState]);

  const setProjectMemo = useCallback((memo: string) => {
    commitState(s => ({ ...s, projectMemo: memo }));
  }, [commitState]);

  const saveProject = useCallback(() => {
    const { templates: _, ...boardData } = state;
    const data = JSON.stringify(boardData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const filename = state.projectName?.trim() || 'universal-board-project';
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatusMessage('プロジェクトを保存しました');
  }, [state]);

  const loadProject = useCallback((json: string) => {
    try {
      const data = JSON.parse(json) as BoardState;
      const currentTemplates = state.templates;

      // 基板内の部品が参照するテンプレートが存在するか確認
      const missingTemplates = (data.components || [])
        .map(c => c.templateId)
        .filter((id, i, arr) => arr.indexOf(id) === i) // unique
        .filter(id => !currentTemplates.find(t => t.id === id));

      if (missingTemplates.length > 0) {
        notify(`テンプレートが見つかりません: ${missingTemplates.join(', ')}`, 'error');
        return;
      }

      const next = { ...data, templates: currentTemplates };
      historyRef.current = [next];
      historyIndexRef.current = 0;
      setState(next);
      setSelectedComponentId(null);
      notify('プロジェクトを読み込みました', 'success');
    } catch {
      notify('読み込みエラー', 'error');
    }
  }, [notify, state.templates]);

  const exportImage = useCallback((canvas: HTMLCanvasElement) => {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'universal-board.png';
    a.click();
    setStatusMessage('画像を出力しました');
  }, []);

  const exportTemplates = useCallback(() => {
    const customTemplates = state.templates.filter(
      t => !DEFAULT_TEMPLATES.find(d => d.id === t.id)
    );
    if (customTemplates.length === 0) {
      notify('エクスポートするカスタムテンプレートがありません', 'warning');
      return;
    }
    const data = JSON.stringify(customTemplates, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'universal-board-templates.json';
    a.click();
    URL.revokeObjectURL(a.href);
    notify(`${customTemplates.length}件のテンプレートをエクスポートしました`, 'success');
  }, [state.templates, notify]);

  const importTemplates = useCallback((json: string) => {
    try {
      const imported = JSON.parse(json) as ComponentTemplate[];
      if (!Array.isArray(imported) || imported.length === 0) {
        notify('有効なテンプレートが見つかりません', 'error');
        return;
      }
      // デフォルトテンプレートと同じIDは無視
      const filtered = imported.filter(
        t => t.id && t.name && !DEFAULT_TEMPLATES.find(d => d.id === t.id)
      );
      if (filtered.length === 0) {
        notify('インポートするテンプレートがありません', 'warning');
        return;
      }
      commitState(s => {
        const newTemplates = [...s.templates];
        let added = 0;
        let updated = 0;
        for (const tpl of filtered) {
          const existingIdx = newTemplates.findIndex(t => t.id === tpl.id);
          if (existingIdx >= 0) {
            newTemplates[existingIdx] = tpl;
            updated++;
          } else {
            newTemplates.push(tpl);
            added++;
          }
        }
        const parts: string[] = [];
        if (added > 0) parts.push(`${added}件追加`);
        if (updated > 0) parts.push(`${updated}件更新`);
        notify(`テンプレートをインポートしました (${parts.join(', ')})`, 'success');
        return { ...s, templates: newTemplates };
      });
    } catch {
      notify('テンプレートの読み込みエラー', 'error');
    }
  }, [notify, commitState]);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  return {
    state,
    undo, redo, canUndo, canRedo,
    selectedComponentId, setSelectedComponentId,
    currentTool, selectTool,
    wireStart, setWireStart,
    wireColor, setWireColor,
    placementRotation, setPlacementRotation,
    selectedTemplateId, setSelectedTemplateId,
    currentSide, setCurrentSide,
    showNets, setShowNets,
    statusMessage, setStatusMessage,
    notification, setNotification,
    resizeBoard,
    placeComponent,
    removeComponent,
    renameComponent,
    reorderComponents,
    rotateComponent,
    moveComponent,
    addWire,
    moveWireEndpoint,
    setHoleLabel,
    eraseAt,
    toggleBlockedHole,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    resetBoard,
    saveProject,
    loadProject,
    exportImage,
    exportTemplates,
    importTemplates,
    setProjectName,
    setProjectMemo,
  };
}
