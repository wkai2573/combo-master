import type { CardData } from '../data/types';

export const FACE_WIDTH = 1260;
export const FACE_HEIGHT = 1760;
export const FACE_FONT = 'Noto Sans TC';

export interface FaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const textFields = {
  custom: '自訂文字', name: '卡名', text: '效果內文', atk: '攻擊力', def: '防禦力', combo: '連擊值',
  expReq: '經驗需求', traits: '特徵', cls: '職業', slot: '裝備部位', duration: '持續回合', uid: '永久編號',
} as const;
export type TextField = keyof typeof textFields;

interface Layer {
  id: string;
  name: string;
  rect: FaceRect;
  hidden?: boolean;
  locked?: boolean;
}

export interface FaceImageLayer extends Layer {
  kind: 'image';
  source: 'art' | 'frame' | 'upload';
  fit: 'cover' | 'contain' | 'fill';
}

export interface TextBackground {
  coverage: 'text' | 'lines' | 'area';
  color: string;
  opacity: number;
  paddingX: number;
  paddingY: number;
}

export interface FaceTextLayer extends Layer {
  kind: 'text';
  field: TextField;
  font: string;
  size: number;
  weight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  flow: 'up' | 'down' | 'fit';
  keywords: boolean;
  background?: TextBackground;
}

export type FaceLayer = FaceImageLayer | FaceTextLayer;

export interface KeywordStyle {
  term: string;
  style: 'frame' | 'image';
  color: string;
  fill: string;
  image?: string;
  showText: boolean;
  imageWidth: number;
}

export interface FaceTemplate {
  id: string;
  name: string;
  layers: FaceLayer[];
  keywords: KeywordStyle[];
}

export interface FaceCard {
  template: string;
  images?: Record<string, string>;
  texts?: Record<string, string>;
}

export interface FaceLibrary {
  formatVersion: 1;
  templates: FaceTemplate[];
  cards: Record<string, FaceCard>;
}

export function defaultTextLayer(name: string, field: TextField = 'custom'): FaceTextLayer {
  return {
    id: field, name, kind: 'text', rect: { x: 110, y: 530, width: 1040, height: 450 }, field,
    font: FACE_FONT, size: 70, weight: 700, color: '#171310', align: 'left', flow: 'down', keywords: false,
  };
}

export function defaultTextBackground(): TextBackground {
  return { coverage: 'lines', color: '#fff4dd', opacity: 0.7, paddingX: 12, paddingY: 10 };
}

const art: FaceImageLayer = {
  id: 'art', name: '無框插畫', kind: 'image', source: 'art', fit: 'cover', locked: true,
  rect: { x: 49, y: 315, width: 1162, height: 1395 },
};
const frame: FaceImageLayer = {
  id: 'frame', name: '卡框', kind: 'image', source: 'frame', fit: 'fill', locked: true,
  rect: { x: 0, y: 0, width: FACE_WIDTH, height: FACE_HEIGHT },
};

function fitted(field: TextField, rect: FaceRect): FaceTextLayer {
  return { ...defaultTextLayer(textFields[field], field), rect, flow: 'fit', align: 'center', color: '#ffffff' };
}

const effect: FaceTextLayer = {
  ...defaultTextLayer(textFields.text, 'text'), rect: { x: 117, y: 545, width: 1026, height: 743 },
  flow: 'up', keywords: true, background: defaultTextBackground(),
};
const title = fitted('name', { x: 263, y: 1401, width: 734, height: 186 });
const traits: FaceTextLayer = {
  ...fitted('traits', { x: 795, y: 1610, width: 204, height: 38 }), align: 'right', color: '#211b17',
  background: { coverage: 'text', color: '#fff4dd', opacity: 1, paddingX: 7, paddingY: 5 },
};

export const facePresets: FaceTemplate[] = [
  {
    id: 'move', name: '招式', keywords: [], layers: [art, frame,
      fitted('atk', { x: 145, y: 87, width: 110, height: 116 }),
      fitted('combo', { x: 503, y: 111, width: 254, height: 216 }),
      fitted('def', { x: 1005, y: 87, width: 110, height: 116 }), effect, title, traits],
  },
  {
    id: 'equipment', name: '裝備', keywords: [], layers: [art, frame,
      fitted('expReq', { x: 145, y: 87, width: 110, height: 116 }), effect, title],
  },
];

export function templatesOf(library: FaceLibrary): FaceTemplate[] {
  return [...facePresets, ...library.templates];
}

export function templateFor(library: FaceLibrary, entry: FaceCard): FaceTemplate | undefined {
  return facePresets.find(({ id }) => id === entry.template) ?? library.templates.find(({ id }) => id === entry.template);
}

export function textOf(layer: FaceTextLayer, values: FaceCard, uid: string, card: CardData): string {
  if (layer.field === 'custom') return values.texts?.[layer.id] ?? '';
  if (layer.field === 'uid') return uid;
  if (layer.field === 'traits') return card.traits.join('・');
  return String(card[layer.field] ?? '');
}

export function containRect(rect: FaceRect): FaceRect {
  const width = Math.max(1, Math.min(FACE_WIDTH, Math.round(rect.width)));
  const height = Math.max(1, Math.min(FACE_HEIGHT, Math.round(rect.height)));
  return {
    x: Math.max(0, Math.min(FACE_WIDTH - width, Math.round(rect.x))),
    y: Math.max(0, Math.min(FACE_HEIGHT - height, Math.round(rect.y))),
    width, height,
  };
}
