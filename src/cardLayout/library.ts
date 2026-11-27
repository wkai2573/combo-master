import { FACE_HEIGHT, FACE_WIDTH, facePresets, textFields, type FaceLibrary } from './model';

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const number = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const color = (value: unknown) => typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value);
const id = (value: unknown): value is string => typeof value === 'string' &&
  /^[A-Za-z\d_-]{1,80}$/.test(value) && !Object.hasOwn(Object.prototype, value);
const label = (value: unknown) => typeof value === 'string' && value.length <= 100;
const pick = (value: unknown, ...choices: string[]) => typeof value === 'string' && choices.includes(value);
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
export const isFaceImage = (value: unknown): value is string => typeof value === 'string' &&
  /^data:image\/(?:png|jpeg|webp|gif|avif);base64,[A-Za-z\d+/]+={0,2}$/.test(value);

function validRect(value: unknown) {
  return object(value) && number(value.x, 0, FACE_WIDTH - 1) && number(value.y, 0, FACE_HEIGHT - 1) &&
    number(value.width, 1, FACE_WIDTH - value.x) && number(value.height, 1, FACE_HEIGHT - value.y);
}

function validBackground(value: unknown) {
  return object(value) && pick(value.coverage, 'text', 'lines', 'area') && color(value.color) &&
    number(value.opacity, 0, 1) && number(value.paddingX, 0, FACE_WIDTH) && number(value.paddingY, 0, FACE_HEIGHT);
}

function validLayer(layer: unknown) {
  if (!object(layer) || !id(layer.id) || !label(layer.name) || !validRect(layer.rect) ||
    !optionalBoolean(layer.hidden) || !optionalBoolean(layer.locked)) return false;
  if (layer.kind === 'image') return pick(layer.source, 'art', 'frame', 'upload') && pick(layer.fit, 'cover', 'contain', 'fill');
  return layer.kind === 'text' && typeof layer.field === 'string' && Object.hasOwn(textFields, layer.field) &&
    label(layer.font) && number(layer.size, 1, FACE_HEIGHT) && number(layer.weight, 100, 900) && color(layer.color) &&
    pick(layer.align, 'left', 'center', 'right') && pick(layer.flow, 'up', 'down', 'fit') &&
    (layer.fitInkHeight === undefined || number(layer.fitInkHeight, 1, FACE_HEIGHT)) &&
    typeof layer.keywords === 'boolean' && (layer.background === undefined || validBackground(layer.background));
}

function validKeyword(rule: unknown) {
  return object(rule) && label(rule.term) && pick(rule.style, 'frame', 'image') && color(rule.color) && color(rule.fill) &&
    (rule.image === undefined || isFaceImage(rule.image)) && typeof rule.showText === 'boolean' && number(rule.imageWidth, 0.5, 12);
}

function valuesMatch(value: unknown, valid: (value: unknown) => boolean) {
  return value === undefined || (object(value) && Object.entries(value).every(([key, content]) => id(key) && valid(content)));
}

export function parseFaceLibrary(value: unknown): FaceLibrary {
  if (!object(value) || value.formatVersion !== 1 || !Array.isArray(value.templates) || !object(value.cards)) {
    throw new Error('卡面設定格式不符或版本不支援。');
  }
  const ids = new Set(facePresets.map(({ id }) => id));
  for (const template of value.templates) {
    if (!object(template) || !id(template.id) || ids.has(template.id) || !label(template.name) ||
      !Array.isArray(template.layers) || !template.layers.every(validLayer) ||
      new Set(template.layers.map((layer) => layer.id)).size !== template.layers.length ||
      !Array.isArray(template.keywords) || !template.keywords.every(validKeyword)) {
      throw new Error('範本含有重複編號、無效圖層或關鍵字設定。');
    }
    ids.add(template.id);
  }
  for (const [uid, card] of Object.entries(value.cards)) {
    if (!/^[AEBX][1-9]\d{0,14}$/.test(uid) || !object(card) || !id(card.template) || !ids.has(card.template) ||
      !valuesMatch(card.images, isFaceImage) || !valuesMatch(card.texts, (text) => typeof text === 'string' && text.length <= 10000)) {
      throw new Error(uid + ' 的卡面設定無效。');
    }
  }
  return value as unknown as FaceLibrary;
}
