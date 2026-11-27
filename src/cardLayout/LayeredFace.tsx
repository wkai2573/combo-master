import { useMemo, type CSSProperties } from 'react';
import type { CardData } from '../data/types';
import { gameFaceFor, imageFor } from './gameFaces';
import { FACE_FONT, FACE_WIDTH, textOf, type FaceCard, type FaceImageLayer, type FaceRect, type FaceTemplate, type FaceTextLayer } from './model';
import { layoutFaceText, type FaceMetrics, type FaceTextLayout } from './textLayout';
import './layeredFace.css';

type Drawing =
  | { kind: 'image'; layer: FaceImageLayer; src?: string }
  | { kind: 'text'; layer: FaceTextLayer; layout: FaceTextLayout };

const unit = (px: number) => (px * 100 / FACE_WIDTH) + 'cqw';
const rectStyle = ({ x, y, width, height }: FaceRect): CSSProperties =>
  ({ left: unit(x), top: unit(y), width: unit(width), height: unit(height) });

function fontFamily(font: string): string {
  return '"' + (font.replace(/["\\]/g, '').trim() || FACE_FONT) + '", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
}

let canvasContext: CanvasRenderingContext2D | null | undefined;
function measureWith(layer: FaceTextLayer) {
  canvasContext ??= typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  const context = canvasContext;
  const family = fontFamily(layer.font);
  return (text: string, size: number): FaceMetrics => {
    if (!context) {
      const width = [...text].length * size;
      return { width, left: 0, right: width, ascent: size * 0.8, descent: size * 0.2, fontAscent: size * 0.9, fontDescent: size * 0.2 };
    }
    context.font = layer.weight + ' ' + size + 'px ' + family;
    const m = context.measureText(text);
    return {
      width: m.width, left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight,
      ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent,
      fontAscent: m.fontBoundingBoxAscent ?? size * 0.9, fontDescent: m.fontBoundingBoxDescent ?? size * 0.2,
    };
  };
}

/** 圖片、底色與文字使用各自的元素，卡片大小改變時按同一比例縮放。 */
export function arrangeFace(template: FaceTemplate, content: FaceCard, uid: string, card: CardData): Drawing[] {
  return template.layers.filter((layer) => !layer.hidden).map((layer) => layer.kind === 'image'
    ? { kind: 'image', layer, src: imageFor(layer, uid, card, content) }
    : { kind: 'text', layer, layout: layoutFaceText(layer, textOf(layer, content, uid, card), template.keywords, measureWith(layer)) });
}

function TextDrawing({ layer, layout }: { layer: FaceTextLayer; layout: FaceTextLayout }) {
  const { rows, size, background } = layout;
  return (
    <>
      {background && <div className="lf-background" style={{
        ...rectStyle({ ...background, x: layer.rect.x + background.x, y: layer.rect.y + background.y }),
        backgroundColor: layer.background?.color, opacity: layer.background?.opacity, borderRadius: unit(8),
      }} />}
      <div className="lf-ink" data-text-layer={layer.id} style={{
        ...rectStyle(layer.rect), fontFamily: fontFamily(layer.font), fontWeight: layer.weight, color: layer.color,
      }}>
        {rows.flatMap((row, rowIndex) => row.runs.map((run, index) => {
          const custom = run.custom;
          const image = custom?.style === 'image' ? custom.image : undefined;
          const expense = run.style === 'cover' || run.style === 'rage';
          return (
            <span className={'lf-run lf-' + run.style} key={rowIndex + ':' + index} style={{
              left: unit(row.x + run.x), top: unit(row.baseline), width: unit(run.width),
              color: custom?.color,
            }}>
              {run.mark && (
                <span className="lf-mark" style={{
                  ...rectStyle(run.mark),
                  backgroundColor: image ? 'transparent' : custom?.fill,
                  borderRadius: unit(0.08 * size),
                }}>
                  {image && <img src={image} alt="" draggable={false} />}
                  {expense && <span className="lf-cost-disc" style={{ width: unit(Math.max(size * 0.97, run.mark.width - size * 0.14)) }} />}
                </span>
              )}
              {(!image || custom?.showText) && <span className="lf-run-text" style={{
                left: unit(run.textX), top: unit(-run.fontOffset - run.textSize / 2), fontSize: unit(run.textSize),
              }}>{run.text}</span>}
            </span>
          );
        }))}
      </div>
    </>
  );
}

export function LayeredFace({ drawing, label, className, style }: {
  drawing: Drawing[]; label: string; className?: string; style?: CSSProperties;
}) {
  return (
    <div className={className ? 'layered-face ' + className : 'layered-face'} style={style} role="img" aria-label={label}>
      {drawing.map((entry) => entry.kind === 'image'
        ? entry.src && <img className="lf-image" key={entry.layer.id} data-image-layer={entry.layer.id} src={entry.src}
          alt="" draggable={false} style={{ ...rectStyle(entry.layer.rect), objectFit: entry.layer.fit }} />
        : <TextDrawing key={entry.layer.id} layer={entry.layer} layout={entry.layout} />)}
    </div>
  );
}

export function GameLayeredFace({ face, card, className, style }: {
  face: NonNullable<ReturnType<typeof gameFaceFor>>; card: CardData; className?: string; style?: CSSProperties;
}) {
  const { template, content, uid } = face;
  const drawing = useMemo(() => arrangeFace(template, content, uid, card), [template, content, uid, card]);
  return <LayeredFace drawing={drawing} label={card.name} className={className} style={style} />;
}
