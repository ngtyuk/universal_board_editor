export type TemplateCategory = 'microcontroller' | 'passive' | 'io' | 'ic' | 'other';

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: 'microcontroller', label: 'マイコン' },
  { id: 'passive', label: '受動部品' },
  { id: 'io', label: '入出力' },
  { id: 'ic', label: 'IC/モジュール' },
  { id: 'other', label: 'その他' },
];

export type ComponentType = 'generic' | 'resistor' | 'capacitor' | 'diode' | 'switch' | 'led';

export const COMPONENT_TYPES: { id: ComponentType; label: string }[] = [
  { id: 'generic', label: '汎用' },
  { id: 'resistor', label: '抵抗' },
  { id: 'capacitor', label: 'コンデンサ' },
  { id: 'diode', label: 'ダイオード' },
  { id: 'switch', label: 'スイッチ' },
  { id: 'led', label: 'LED' },
];

export interface ComponentTemplate {
  id: string;
  name: string;
  w: number;
  h: number;
  color: string;
  pins: string[];
  pinOffsets?: [number, number][];
  category?: TemplateCategory;
  componentType?: ComponentType;
  passthrough?: boolean;
  conductionGroups?: number[][];
  polarity?: boolean;
}

export type BoardSide = 'front' | 'back';

export interface PlacedComponent {
  id: string;
  templateId: string;
  row: number;
  col: number;
  name: string;
  rotation: number; // 0, 90, 180, 270
  side?: BoardSide;
  properties?: Record<string, string>;
}

export interface Wire {
  from: [number, number];
  to: [number, number];
  color: string;
  side?: BoardSide;
}

export interface HoleData {
  label: string;
  _manual?: boolean;
}

export interface BoardState {
  cols: number;
  rows: number;
  holes: Record<string, HoleData>;
  components: PlacedComponent[];
  wires: Wire[];
  templates: ComponentTemplate[];
  projectName?: string;
  projectMemo?: string;
  blockedHoles?: string[];
  netNames?: Record<string, string>;
}

export type ToolType = 'select' | 'component' | 'wire' | 'label' | 'erase' | 'block';

export interface TemplateEditorPin {
  r: number;
  c: number;
  label: string;
}
