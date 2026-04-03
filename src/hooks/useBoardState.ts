import { useState, useCallback, useEffect } from 'react';
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

export function useBoardState() {
  const [state, setState] = useState<BoardState>(loadSavedState);

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
      select: '選択', component: '部品配置', wire: '配線', label: 'ラベル', erase: '消去'
    }[tool]}`);
  }, []);

  const resizeBoard = useCallback((cols: number, rows: number) => {
    setState(s => ({ ...s, cols, rows }));
    setStatusMessage(`基板サイズ: ${cols} × ${rows}`);
  }, []);

  const placeComponent = useCallback((r: number, c: number) => {
    setState(s => {
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
    setState(s => {
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
    setState(s => {
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

  const moveComponent = useCallback((id: string, newRow: number, newCol: number) => {
    setState(s => {
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
    const sameRow = from[0] === to[0];
    const sameCol = from[1] === to[1];
    if (!sameRow && !sameCol) {
      const corner: [number, number] = [from[0], to[1]];
      setState(s => ({
        ...s,
        wires: [
          ...s.wires,
          { from, to: corner, color: wireColor, side: currentSide },
          { from: corner, to, color: wireColor, side: currentSide },
        ],
      }));
    } else {
      setState(s => ({
        ...s,
        wires: [...s.wires, { from, to, color: wireColor, side: currentSide }],
      }));
    }
    setStatusMessage(`配線完了: 行${from[0]+1},列${from[1]+1} → 行${to[0]+1},列${to[1]+1}`);
  }, [wireColor, currentSide]);

  const setHoleLabel = useCallback((r: number, c: number, label: string) => {
    setState(s => {
      const key = `${r},${c}`;
      const newHoles = { ...s.holes };
      newHoles[key] = { label, _manual: true };
      return { ...s, holes: newHoles };
    });
  }, []);

  const eraseAt = useCallback((r: number, c: number) => {
    setState(s => {
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
      return s;
    });
  }, [currentSide]);

  const addTemplate = useCallback((tpl: ComponentTemplate) => {
    setState(s => ({ ...s, templates: [...s.templates, tpl] }));
    notify(`テンプレート「${tpl.name}」を追加しました`, 'success');
  }, [notify]);

  const updateTemplate = useCallback((tpl: ComponentTemplate) => {
    setState(s => ({
      ...s,
      templates: s.templates.map(t => t.id === tpl.id ? tpl : t),
    }));
    notify(`テンプレート「${tpl.name}」を更新しました`, 'success');
  }, [notify]);

  const deleteTemplate = useCallback((id: string) => {
    setState(s => {
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
    setState(s => ({
      ...initialState,
      templates: s.templates,
    }));
    setSelectedComponentId(null);
    setWireStart(null);
    notify('基板を初期化しました', 'success');
  }, [notify]);

  const saveProject = useCallback(() => {
    const { templates: _, ...boardData } = state;
    const data = JSON.stringify(boardData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'universal-board-project.json';
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

      setState({
        ...data,
        templates: currentTemplates,
      });
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

  return {
    state,
    selectedComponentId, setSelectedComponentId,
    currentTool, selectTool,
    wireStart, setWireStart,
    wireColor, setWireColor,
    placementRotation, setPlacementRotation,
    selectedTemplateId, setSelectedTemplateId,
    currentSide, setCurrentSide,
    statusMessage, setStatusMessage,
    notification, setNotification,
    resizeBoard,
    placeComponent,
    removeComponent,
    rotateComponent,
    moveComponent,
    addWire,
    setHoleLabel,
    eraseAt,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    resetBoard,
    saveProject,
    loadProject,
    exportImage,
  };
}
