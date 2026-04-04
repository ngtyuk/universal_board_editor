export interface ComponentTemplate {
  id: string;
  name: string;
  w: number;
  h: number;
  color: string;
  pins: string[];
  pinOffsets?: [number, number][];
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
}

export type ToolType = 'select' | 'component' | 'wire' | 'label' | 'erase';

export interface TemplateEditorPin {
  r: number;
  c: number;
  label: string;
}
