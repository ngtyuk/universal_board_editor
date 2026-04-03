import type { ComponentTemplate } from '../types';

export const HOLE_SPACING = 24;
export const HOLE_RADIUS = 3.5;
export const BOARD_PAD = 20;

export const WIRE_COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
  '#ff922b', '#cc5de8', '#ffffff', '#888888',
];

export const DEFAULT_TEMPLATES: ComponentTemplate[] = [
  {
    id: 'rp2040-zero', name: 'RP2040-Zero', w: 7, h: 9, color: '#1a1a2e',
    pinOffsets: [
      // Left side (top → bottom)
      [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],
      // Bottom (left → right, excluding left corner)
      [8,1],[8,2],[8,3],[8,4],[8,5],[8,6],
      // Right side (bottom → top)
      [7,6],[6,6],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
    ],
    pins: [
      '5V','GND','3V3','GP29','GP28','GP27','GP26','GP15','GP14',
      'GP13','GP12','GP11','GP10','GP9','GP8',
      'GP7','GP6','GP5','GP4','GP3','GP2','GP1','GP0',
    ],
  },
  {
    id: 'raspi-pico', name: 'Raspberry Pi Pico', w: 8, h: 20, color: '#008744',
    pinOffsets: [
      // Left side pin 1–20 (top → bottom)
      [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],
      [10,0],[11,0],[12,0],[13,0],[14,0],[15,0],[16,0],[17,0],[18,0],[19,0],
      // Right side pin 21–40 (bottom → top)
      [19,7],[18,7],[17,7],[16,7],[15,7],[14,7],[13,7],[12,7],[11,7],[10,7],
      [9,7],[8,7],[7,7],[6,7],[5,7],[4,7],[3,7],[2,7],[1,7],[0,7],
    ],
    pins: [
      'GP0','GP1','GND','GP2','GP3','GP4','GP5','GND','GP6','GP7',
      'GP8','GP9','GND','GP10','GP11','GP12','GP13','GND','GP14','GP15',
      'GP16','GP17','GND','GP18','GP19','GP20','GP21','GND','GP22','RUN',
      'GP26','GP27','GND','GP28','VREF','3V3','3V3E','GND','VSYS','VBUS',
    ],
  },
  {
    id: 'raspi-pico2', name: 'Raspberry Pi Pico 2', w: 8, h: 20, color: '#006633',
    pinOffsets: [
      [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],
      [10,0],[11,0],[12,0],[13,0],[14,0],[15,0],[16,0],[17,0],[18,0],[19,0],
      [19,7],[18,7],[17,7],[16,7],[15,7],[14,7],[13,7],[12,7],[11,7],[10,7],
      [9,7],[8,7],[7,7],[6,7],[5,7],[4,7],[3,7],[2,7],[1,7],[0,7],
    ],
    pins: [
      'GP0','GP1','GND','GP2','GP3','GP4','GP5','GND','GP6','GP7',
      'GP8','GP9','GND','GP10','GP11','GP12','GP13','GND','GP14','GP15',
      'GP16','GP17','GND','GP18','GP19','GP20','GP21','GND','GP22','RUN',
      'GP26','GP27','GND','GP28','VREF','3V3','3V3E','GND','VSYS','VBUS',
    ],
  },
  {
    id: 'resistor', name: '抵抗', w: 1, h: 5, color: '#FF9800',
    pinOffsets: [[0,0],[4,0]],
    pins: ['1','2'],
  },
  {
    id: 'led', name: 'LED', w: 1, h: 3, color: '#FFEB3B',
    pinOffsets: [[0,0],[2,0]],
    pins: ['+','-'],
  },
  {
    id: 'capacitor', name: 'コンデンサ', w: 1, h: 3, color: '#00BCD4',
    pinOffsets: [[0,0],[2,0]],
    pins: ['+','-'],
  },
  {
    id: 'diode', name: 'ダイオード', w: 1, h: 4, color: '#9C27B0',
    pinOffsets: [[0,0],[3,0]],
    pins: ['A','K'],
  },
  {
    id: 'switch-4.5mm', name: 'タクトSW (4.5mm)', w: 2, h: 3, color: '#795548',
    pinOffsets: [[0,0],[0,1],[2,0],[2,1]],
    pins: ['1','2','3','4'],
  },
  {
    id: 'switch-6mm', name: 'タクトSW (6mm)', w: 3, h: 4, color: '#795548',
    pinOffsets: [[0,0],[0,2],[3,0],[3,2]],
    pins: ['1','2','3','4'],
  },
  {
    id: 'switch-12mm', name: 'タクトSW (12mm)', w: 5, h: 6, color: '#795548',
    pinOffsets: [[0,1],[0,3],[5,1],[5,3]],
    pins: ['1','2','3','4'],
  },
];
