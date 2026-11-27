import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type PointerEvent, type ReactNode, type SetStateAction } from 'react';
import { gameFaces, imageFor } from '../cardLayout/gameFaces';
import { arrangeFace, LayeredFace } from '../cardLayout/LayeredFace';
import { isFaceImage, mergeFaceLibrary, parseFaceLibrary } from '../cardLayout/library';
import {
  containRect, defaultTextBackground, defaultTextLayer, FACE_FONT, FACE_HEIGHT, FACE_WIDTH, facePresets,
  templateFor, templatesOf, textFields, type FaceCard, type FaceLayer, type FaceLibrary, type FaceRect,
  type FaceTemplate, type FaceTextLayer, type KeywordStyle, type TextField,
} from '../cardLayout/model';
import type { CardData } from '../data/types';
import { loadFaceDraft, saveFaceDraft } from './cardComposerStorage';
import './cardComposer.css';

const rasterTypes = 'image/png,image/jpeg,image/webp,image/gif,image/avif';
const builtIn = (id: string) => facePresets.some((preset) => preset.id === id);
type Entry = { uid: string; card: CardData };
type BoundField = Exclude<TextField, 'custom' | 'uid'>;

interface ComposerProps {
  cards: Entry[];
  initialUid?: string;
  renderField: (uid: string, field: BoundField) => ReactNode;
}

function assigned(library: FaceLibrary, { uid, card }: Entry): FaceCard {
  return library.cards[uid] ?? { template: card.kind === 'equip' ? 'equipment' : 'move' };
}

function bind(library: FaceLibrary, uid: string, content: FaceCard): FaceLibrary {
  return { ...library, cards: { ...library.cards, [uid]: content } };
}

function imageData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (!isFaceImage(reader.result)) throw new Error('請選擇 PNG、JPEG、WebP、GIF 或 AVIF 圖片。');
        const img = new Image();
        img.src = reader.result;
        await img.decode();
        resolve(reader.result);
      } catch (error) { reject(error); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function FileField({ label, accept, onFile }: { label: string; accept: string; onFile: (file: File) => void }) {
  return <label className="cc-file">{label}
    <input type="file" accept={accept} onChange={(e) => {
      const file = e.currentTarget.files?.[0];
      e.currentTarget.value = '';
      if (file) onFile(file);
    }} />
  </label>;
}

function NumberField({ label, value, min, max, step = 1, disabled, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; disabled?: boolean; onChange: (next: number) => void;
}) {
  return <label>{label}<input type="number" value={value} min={min} max={max} step={step} disabled={disabled}
    onChange={(e) => {
      const next = e.target.valueAsNumber;
      if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
    }} /></label>;
}

const rectLabels = { x: 'X', y: 'Y', width: '寬度', height: '高度' };
function outlineStyle(rect: FaceRect): CSSProperties {
  return {
    left: (100 * rect.x / FACE_WIDTH) + '%', top: (100 * rect.y / FACE_HEIGHT) + '%',
    width: (100 * rect.width / FACE_WIDTH) + '%', height: (100 * rect.height / FACE_HEIGHT) + '%',
  };
}

function TextStyle({ layer, layoutSize, onChange }: { layer: FaceTextLayer; layoutSize?: number; onChange: (next: FaceTextLayer) => void }) {
  const bg = layer.background;
  return <>
    <div className="cc-pair">
      <label>字體<input list="cc-fonts" maxLength={100} value={layer.font} onChange={(e) => onChange({ ...layer, font: e.target.value })} /></label>
      <datalist id="cc-fonts">{[FACE_FONT, '微軟正黑體', 'Noto Serif TC', 'Arial', 'Georgia'].map((name) => <option key={name} value={name} />)}</datalist>
      <label>字色<input type="color" value={layer.color} onChange={(e) => onChange({ ...layer, color: e.target.value })} /></label>
      <label>字重<select value={layer.weight} onChange={(e) => onChange({ ...layer, weight: Number(e.target.value) })}>
        {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => <option key={weight}>{weight}</option>)}
      </select></label>
      <NumberField label="字級（px）" value={layoutSize === undefined ? layer.size : Math.round(layoutSize)} min={1} max={FACE_HEIGHT} disabled={layer.flow === 'fit'}
        onChange={(size) => onChange({ ...layer, size })} />
      <label>排版方式<select value={layer.flow} onChange={(e) => onChange({ ...layer, flow: e.target.value as FaceTextLayer['flow'] })}>
        <option value="down">向下換行</option><option value="up">底緣固定，向上換行</option><option value="fit">單行自動適配</option>
      </select></label>
      <label>對齊<select value={layer.align} onChange={(e) => onChange({ ...layer, align: e.target.value as FaceTextLayer['align'] })}>
        <option value="left">靠左</option><option value="center">置中</option><option value="right">靠右</option>
      </select></label>
    </div>
    <label className="cc-check"><input type="checkbox" checked={layer.keywords}
      onChange={(e) => onChange({ ...layer, keywords: e.target.checked })} />套用關鍵字樣式</label>
    <fieldset>
      <legend>文字底色</legend>
      <label className="cc-check"><input type="checkbox" checked={Boolean(bg)}
        onChange={(e) => onChange({ ...layer, background: e.target.checked ? defaultTextBackground() : undefined })} />顯示底色</label>
      {bg && <div className="cc-pair">
        <label>覆蓋範圍<select value={bg.coverage}
          onChange={(e) => onChange({ ...layer, background: { ...bg, coverage: e.target.value as typeof bg.coverage } })}>
          <option value="lines">文字高度、整欄寬度</option><option value="text">貼合文字</option><option value="area">整個選取範圍</option>
        </select></label>
        <label>底色<input type="color" value={bg.color} onChange={(e) => onChange({ ...layer, background: { ...bg, color: e.target.value } })} /></label>
        <NumberField label="不透明度（%）" value={Math.round(bg.opacity * 100)} min={0} max={100}
          onChange={(value) => onChange({ ...layer, background: { ...bg, opacity: value / 100 } })} />
        <NumberField label="水平留白（px）" value={bg.paddingX} min={0} max={FACE_WIDTH}
          onChange={(paddingX) => onChange({ ...layer, background: { ...bg, paddingX } })} />
        <NumberField label="垂直留白（px）" value={bg.paddingY} min={0} max={FACE_HEIGHT}
          onChange={(paddingY) => onChange({ ...layer, background: { ...bg, paddingY } })} />
      </div>}
    </fieldset>
  </>;
}

function KeywordRules({ rules, change, onError }: {
  rules: KeywordStyle[]; change: (update: (rules: KeywordStyle[]) => KeywordStyle[]) => void; onError: (error: string) => void;
}) {
  const set = (index: number, update: Partial<KeywordStyle>) => change((all) =>
    all.map((rule, i) => i === index ? { ...rule, ...update } : rule));
  return <details className="cc-keywords">
    <summary>自訂關鍵字樣式</summary>
    <p className="muted">效果內文會依卡表套用費用、標籤和關鍵字樣式。在這裡可指定字詞的底框或圖片。</p>
    {rules.map((rule, i) => <fieldset key={i}>
      <legend>關鍵字 {i + 1}</legend>
      <label>比對文字<input maxLength={100} value={rule.term} placeholder="例如追擊判定、蓋X"
        onChange={(e) => set(i, { term: e.target.value })} /></label>
      <div className="cc-pair">
        <label>樣式<select value={rule.style} onChange={(e) => set(i, { style: e.target.value as KeywordStyle['style'] })}>
          <option value="frame">底框</option><option value="image">圖片</option>
        </select></label>
        <label>字色<input type="color" value={rule.color} onChange={(e) => set(i, { color: e.target.value })} /></label>
        {rule.style === 'frame' && <label>框色<input type="color" value={rule.fill} onChange={(e) => set(i, { fill: e.target.value })} /></label>}
      </div>
      {rule.style === 'image' && <>
        <FileField label={rule.image ? '更換關鍵字圖片' : '上傳關鍵字圖片'} accept={rasterTypes}
          onFile={(file) => void imageData(file).then((image) => change((all) =>
            all.map((item) => item === rule ? { ...item, image } : item)))
            .catch((error) => onError(error instanceof Error ? error.message : '圖片無法開啟。'))} />
        <label className="cc-check"><input type="checkbox" checked={rule.showText} onChange={(e) => set(i, { showText: e.target.checked })} />在圖片上保留文字</label>
        <NumberField label="圖片寬度（倍字級）" value={rule.imageWidth} min={0.5} max={12} step={0.1}
          onChange={(imageWidth) => set(i, { imageWidth })} />
      </>}
      <button type="button" onClick={() => change((all) => all.filter((_, index) => i !== index))}>移除規則</button>
    </fieldset>)}
    <button type="button" onClick={() => change((all) => [
      ...all, { term: '', style: 'frame', color: '#ffffff', fill: '#203c79', showText: false, imageWidth: 1.25 },
    ])}>新增關鍵字樣式</button>
  </details>;
}

function Editor({ cards, initialUid, renderField, library, setLibrary }: ComposerProps & {
  library: FaceLibrary; setLibrary: Dispatch<SetStateAction<FaceLibrary | undefined>>;
}) {
  const [uid, setUid] = useState(initialUid ?? 'A39');
  const [layerId, setLayerId] = useState('text');
  const [selectionVisible, setSelectionVisible] = useState(true);
  const [notice, setNotice] = useState('');
  const [dragRect, setDragRect] = useState<FaceRect>();
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: FaceRect; pointer: number; x: number; y: number; resize: boolean; rect: FaceRect } | null>(null);
  const entry = cards.find((entry) => entry.uid === uid) ?? cards[0];
  const content = useMemo(() => assigned(library, entry), [library, entry]);
  const template = templateFor(library, content)!;
  const layers = template.layers;
  const selected = layers.find(({ id }) => id === layerId) ?? layers.at(-1);
  const displayTemplate = selected && dragRect ? {
    ...template, layers: layers.map((layer) => layer === selected ? { ...layer, rect: dragRect } : layer),
  } : template;
  const drawing = useMemo(() => arrangeFace(displayTemplate, content, entry.uid, entry.card), [displayTemplate, content, entry]);
  const overflowing = drawing.filter((item) => item.kind === 'text' && item.layout.overflow);
  const missing = drawing.filter((item) => item.kind === 'image' && !item.src);
  const index = selected ? layers.indexOf(selected) : -1;
  const selectedDrawing = drawing.find((item) => item.layer.id === selected?.id);

  function changeContent(update: (content: FaceCard, template: FaceTemplate) => FaceCard) {
    setLibrary((current) => {
      const base = current ?? gameFaces;
      const content = assigned(base, entry);
      const updated = update(content, templateFor(base, content)!);
      return updated === content ? base : bind(base, entry.uid, updated);
    });
  }

  function changeTemplate(update: (template: FaceTemplate) => FaceTemplate, copy = false) {
    const newId = crypto.randomUUID();
    setLibrary((current) => {
      const base = current ?? gameFaces;
      const content = assigned(base, entry);
      const template = templateFor(base, content)!;
      const changed = update(template);
      const next = copy || builtIn(template.id)
        ? { ...changed, id: newId, name: changed.name === template.name ? template.name.slice(0, 97) + ' 複本' : changed.name } : changed;
      const templates = next.id === template.id ? base.templates.map((item) => item.id === next.id ? next : item) : [...base.templates, next];
      return bind({ ...base, templates }, entry.uid, { ...content, template: next.id });
    });
  }

  function applyTemplate(id: string) {
    const next = templateFor(library, { template: id });
    if (!next) return;
    changeContent((content) => ({ ...content, template: id }));
    setNotice('已套用「' + next.name + '」範本。');
  }

  function editLayer(next: FaceLayer) {
    changeTemplate((template) => ({ ...template, layers: template.layers.map((layer) => layer.id === next.id ? next : layer) }));
  }

  function addLayer(kind: FaceLayer['kind']) {
    const id = crypto.randomUUID();
    const rect = { x: 240, y: 430, width: 780, height: kind === 'image' ? 675 : 250 };
    const layer: FaceLayer = kind === 'image' ? { kind, id, name: '圖片', source: 'upload', fit: 'contain', rect }
      : { ...defaultTextLayer('文字'), id, rect };
    changeTemplate((template) => ({ ...template, layers: [...template.layers, layer] }));
    setLayerId(id);
  }

  function reorder(step: number) {
    changeTemplate((template) => {
      const layers = [...template.layers];
      [layers[index], layers[index + step]] = [layers[index + step], layers[index]];
      return { ...template, layers };
    });
  }

  function upload(file: File, id: string) {
    void imageData(file).then((image) => {
      changeContent((content, template) => template.layers.some((layer) => layer.id === id && layer.kind === 'image')
        ? { ...content, images: { ...content.images, [id]: image } } : content);
      setNotice('已讀取圖片 ' + file.name);
    }).catch((error) => setNotice(error instanceof Error ? error.message : '圖片無法開啟。'));
  }

  function startMove(event: PointerEvent, resize: boolean) {
    if (!selected || selected.locked || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { start: selected.rect, pointer: event.pointerId, x: event.clientX, y: event.clientY, resize, rect: selected.rect };
  }

  function move(event: PointerEvent) {
    const active = drag.current;
    const board = boardRef.current?.getBoundingClientRect();
    if (!active || active.pointer !== event.pointerId || !board?.width) return;
    const dx = (event.clientX - active.x) * FACE_WIDTH / board.width;
    const dy = (event.clientY - active.y) * FACE_HEIGHT / board.height;
    const start = active.start;
    active.rect = containRect(active.resize
      ? { ...start, width: Math.min(start.width + dx, FACE_WIDTH - start.x), height: Math.min(start.height + dy, FACE_HEIGHT - start.y) }
      : { ...start, x: start.x + dx, y: start.y + dy });
    setDragRect(active.rect);
  }

  function endMove(event: PointerEvent, save: boolean) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    if (save && selected && active.rect !== active.start) editLayer({ ...selected, rect: active.rect });
    drag.current = null;
    setDragRect(undefined);
  }

  async function importLibrary(file: File) {
    try {
      const imported = parseFaceLibrary(JSON.parse(await file.text()));
      setLibrary((current) => mergeFaceLibrary(current ?? gameFaces, imported));
      setNotice('已匯入卡面設定。');
    } catch (error) { setNotice(error instanceof Error ? error.message : '無法匯入卡面設定。'); }
  }

  function exportLibrary() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(library, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'combo-master-card-faces.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="cc" aria-label="卡面合成">
    <div className="cc-toolbar">
      <label>預覽卡片<select value={entry.uid} onChange={(e) => { setUid(e.target.value); setLayerId('text'); setNotice(''); }}>
        {cards.map(({ uid, card }) => <option key={uid} value={uid}>{uid} {card.name}</option>)}
      </select></label>
      <label>套用範本<select value={template.id} onChange={(e) => applyTemplate(e.target.value)}>
        {templatesOf(library).map(({ id, name }) => <option key={id} value={id}>{name.trim() || '未命名範本'}</option>)}
      </select></label>
      {!library.cards[entry.uid] && <button type="button" onClick={() => applyTemplate(template.id)}>套用到卡片</button>}
      <button type="button" onClick={() => { changeTemplate((template) => template, true); setNotice('已另存範本。'); }}>另存範本</button>
      <div className="cc-files">
        <FileField label="匯入卡面設定" accept=".json,application/json" onFile={(file) => void importLibrary(file)} />
        <button type="button" className="primary" onClick={exportLibrary}>匯出卡面設定</button>
      </div>
    </div>
    {notice && <p className="cc-notice" role="status">{notice}</p>}
    <div className="cc-workspace">
      <aside className="cc-panel cc-layer-panel" aria-label="圖層">
        <h2>圖層</h2>
        <label>範本名稱<input maxLength={100} value={template.name} onChange={(e) => {
          const name = e.target.value;
          changeTemplate((template) => ({ ...template, name }));
        }} /></label>
        <div className="cc-actions">
          <button type="button" onClick={() => addLayer('image')}>新增圖片</button>
          <button type="button" onClick={() => addLayer('text')}>新增文字</button>
        </div>
        <ol className="cc-layers">
          {[...layers].reverse().map((layer) => <li key={layer.id}>
            <button type="button" aria-pressed={layer === selected} onClick={() => setLayerId(layer.id)}>
              <span>{layer.name.trim() || '未命名圖層'}</span>
              <small>{layer.hidden ? '已隱藏' : layer.kind === 'image' ? '圖片' : '文字'}{layer.locked ? ' · 已鎖定' : ''}</small>
            </button>
          </li>)}
        </ol>
        {selected && <div className="cc-actions">
          <button type="button" disabled={index === layers.length - 1} onClick={() => reorder(1)}>上移</button>
          <button type="button" disabled={index < 1} onClick={() => reorder(-1)}>下移</button>
          <button type="button" onClick={() => editLayer({ ...selected, hidden: !selected.hidden })}>{selected.hidden ? '顯示' : '隱藏'}</button>
          <button type="button" onClick={() => editLayer({ ...selected, locked: !selected.locked })}>{selected.locked ? '解鎖' : '鎖定'}</button>
          <button type="button" onClick={() => changeTemplate((template) => ({
            ...template, layers: template.layers.filter(({ id }) => id !== selected.id),
          }))}>移除圖層</button>
        </div>}
      </aside>
      <section className="cc-preview" aria-label="卡面預覽">
        <div className="cc-preview-bar">
          <strong>{entry.uid} {entry.card.name}</strong>
          <label className="cc-check"><input type="checkbox" checked={selectionVisible} onChange={(e) => setSelectionVisible(e.target.checked)} />顯示選取框</label>
        </div>
        <div className="cc-stage" onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
          onDrop={(e) => {
            e.preventDefault();
            const slot = selected?.kind === 'image' ? selected : layers.find((layer) => layer.kind === 'image' && layer.source === 'art');
            const file = e.dataTransfer.files[0];
            if (slot && file) { setLayerId(slot.id); upload(file, slot.id); }
          }}>
          <div className="cc-board" ref={boardRef}>
            <LayeredFace drawing={drawing} label={entry.card.name + '預覽'} />
            {selected && !selected.hidden && selectionVisible && <div
              className={'cc-outline' + (selected.locked ? ' cc-locked' : '')} style={outlineStyle(dragRect ?? selected.rect)}
              onPointerDown={(e) => startMove(e, false)} onPointerMove={move} onPointerUp={(e) => endMove(e, true)}
              onPointerCancel={(e) => endMove(e, false)} onLostPointerCapture={(e) => endMove(e, false)} aria-hidden="true">
              {!selected.locked && <div className="cc-handle" onPointerDown={(e) => startMove(e, true)} />}
            </div>}
          </div>
        </div>
        <div className="cc-preview-info">
          <span className="muted">1260 × 1760 px</span>
          {overflowing.length > 0 && <span className="cc-warning" role="status">文字超出範圍 · {overflowing.map(({ layer }) => layer.name).join('、')}</span>}
          {missing.length > 0 && <span className="cc-warning">缺少圖片 · {missing.map(({ layer }) => layer.name).join('、')}</span>}
        </div>
      </section>
      <aside className="cc-panel cc-properties" aria-label="圖層設定">
        <h2>圖層設定</h2>
        {selected && <>
          <label>圖層名稱<input maxLength={100} value={selected.name} onChange={(e) => editLayer({ ...selected, name: e.target.value })} /></label>
          {selected.kind === 'image' ? <>
            <FileField label="上傳圖層圖片" accept={rasterTypes} onFile={(file) => upload(file, selected.id)} />
            <p className="cc-image-status muted">{content.images?.[selected.id] ? '已套入上傳圖片' :
              imageFor(selected, entry.uid, entry.card, content) ? '已從遊戲帶入圖片' : '等待上傳圖片'}</p>
            {content.images?.[selected.id] && <button type="button" onClick={() => changeContent((content) => {
              const images = { ...content.images };
              delete images[selected.id];
              return { ...content, images };
            })}>清除上傳圖片</button>}
            <label>圖片來源<select value={selected.source} onChange={(e) => editLayer({ ...selected, source: e.target.value as typeof selected.source })}>
              <option value="upload">上傳</option><option value="art">卡片的無框插畫</option><option value="frame">依職業與部位帶入卡框</option>
            </select></label>
            <label>圖片適配<select value={selected.fit} onChange={(e) => editLayer({ ...selected, fit: e.target.value as typeof selected.fit })}>
              <option value="cover">裁切填滿</option><option value="contain">保留整張</option><option value="fill">拉伸</option>
            </select></label>
          </> : <>
            <label>文字來源<select value={selected.field} onChange={(e) => editLayer({ ...selected, field: e.target.value as TextField })}>
              {Object.entries(textFields).map(([field, label]) => <option key={field} value={field}>{label}</option>)}
            </select></label>
            {selected.field === 'custom' ? <label>文字內容<textarea rows={4} maxLength={10000} value={content.texts?.[selected.id] ?? ''}
              onChange={(e) => { const value = e.target.value; changeContent((content) => ({ ...content, texts: { ...content.texts, [selected.id]: value } })); }} /></label>
              : selected.field !== 'uid' && <div key={entry.uid + ':' + selected.field} className="cc-bound">{renderField(entry.uid, selected.field)}</div>}
            <TextStyle layer={selected} onChange={editLayer}
              layoutSize={selected.flow === 'fit' && selectedDrawing?.kind === 'text' ? selectedDrawing.layout.size : undefined} />
          </>}
          <fieldset>
            <legend>圖層範圍（px）</legend>
            <div className="cc-pair">
              {(Object.keys(rectLabels) as Array<keyof FaceRect>).map((key) =>
                <NumberField key={key} label={rectLabels[key]} value={(dragRect ?? selected.rect)[key]}
                  min={key === 'width' || key === 'height' ? 1 : 0} max={key === 'x' || key === 'width' ? FACE_WIDTH : FACE_HEIGHT}
                  disabled={selected.locked} onChange={(value) => editLayer({ ...selected, rect: containRect({ ...selected.rect, [key]: value }) })} />)}
            </div>
          </fieldset>
        </>}
        <KeywordRules rules={template.keywords} onError={setNotice} change={(update) =>
          changeTemplate((template) => ({ ...template, keywords: update(template.keywords) }))} />
      </aside>
    </div>
  </section>;
}

export function CardComposer(props: ComposerProps) {
  const [library, setLibrary] = useState<FaceLibrary>();
  const [storageFailed, setStorageFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void loadFaceDraft().then((draft) => { if (active) setLibrary(draft ? mergeFaceLibrary(gameFaces, draft) : gameFaces); })
      .catch(() => { if (active) { setStorageFailed(true); setLibrary(gameFaces); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!library || library === gameFaces) return;
    let active = true;
    void saveFaceDraft(library).then(() => { if (active) setStorageFailed(false); })
      .catch(() => { if (active) setStorageFailed(true); });
    return () => { active = false; };
  }, [library]);
  return <>
    {storageFailed && <p role="alert" className="ct-notice">瀏覽器無法讀寫卡面草稿。離開前可匯出卡面設定。</p>}
    {library && props.cards.length > 0 ? <Editor {...props} library={library} setLibrary={setLibrary} />
      : <p role="status">{library ? '卡表裡沒有可預覽的卡片。' : '正在讀取卡面設定。'}</p>}
  </>;
}
