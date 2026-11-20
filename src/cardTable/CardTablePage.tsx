import { useEffect, useState, type FormEvent } from 'react';
import { ALL_CARDS, ALL_CHARACTERS } from '../data/cards';
import { cardTable } from '../data/cardTableData';
import {
  canDelete, cardValue, classes, emptyDraft, equalValue, fieldLabels, isFieldValue,
  kinds, makeDiff, nextCardUid, parseDiff, previewCard, realignDraft, slots,
  type Draft, type Edit, type Field,
} from '../data/cardTableDraft';
import { isExCardId } from '../data/exCards';
import { KEYWORDS } from '../data/keywords';
import type { CardData, CardKind } from '../data/types';
import { CardFace, InspectPanel } from '../ui/components/CardFace';
import { KeywordText, KeywordTooltip } from '../ui/components/KeywordText';
import { APP_VERSION } from '../version';

const key = 'combo-master:card-table-draft';
const tabs = ['卡片', '角色', '關鍵字', 'Ex 卡'] as const;
const uidById = new Map(Object.entries(cardTable.uids).map(([uid, id]) => [uid[0] + ':' + id, uid]));
const cardUids = new Map(Object.entries(cardTable.uids).filter(([uid]) => /^[AEBX]/.test(uid)).map(([uid, id]) => [id, uid]));
const fields = Object.keys(fieldLabels) as Field[];
const numberFields: Field[] = ['atk', 'def', 'combo', 'expReq', 'duration'];
type Value = Edit['value'];
type LocalDraft = { draft: Draft; issued: string[]; invalidated: Edit[] };
const emptyLocal = (): LocalDraft => ({ draft: emptyDraft(), issued: [], invalidated: [] });

function loadDraft(): LocalDraft {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyLocal();
    const saved = JSON.parse(raw);
    const { edits, additions, deletions } = parseDiff(saved.diff);
    const { draft, invalidated } = realignDraft(cardTable, { edits, additions, deletions });
    return {
      draft,
      issued: Array.isArray(saved.issued) ? saved.issued.filter((uid: unknown) => typeof uid === 'string' && /^[AEB][1-9]\d{0,14}$/.test(uid)) : [],
      invalidated: [...(Array.isArray(saved.invalidated) ? saved.invalidated : []), ...invalidated],
    };
  } catch {
    return emptyLocal();
  }
}

const showValue = (value: Value) => Array.isArray(value) ? value.join('、') || '空白' : value === null || value === '' ? '空白' : String(value);
const inputValue = (value: Value) => Array.isArray(value) ? value.join('、') : String(value ?? '');

function CardField({ field, value, original, reset, onChange }: {
  field: Field; value: Value; original?: Value; reset?: () => void; onChange: (value: Value) => void;
}) {
  const [input, setInput] = useState<string>();
  const options = field === 'kind' ? Object.entries(kinds)
    : field === 'cls' ? classes.map((cls) => [cls, cls])
    : field === 'slot' ? [['', '未指定'], ...slots.map((slot) => [slot, slot])] : null;
  return (
    <div className="ct-field">
      <label className={original === undefined ? undefined : 'ct-edited'}>
        {fieldLabels[field]}
        {options ? (
          <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)}>
            {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        ) : field === 'text' ? (
          <textarea maxLength={10000} rows={4} value={String(value)} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input
            type={numberFields.includes(field) ? 'number' : 'text'}
            min={field === 'combo' ? 1 : 0}
            max={field === 'combo' ? 9 : 99}
            value={input ?? inputValue(value)}
            onChange={(e) => {
              setInput(e.target.value);
              const raw = e.target.value.trim();
              const next = field === 'traits' ? raw.split(/[、，,]/).map((trait) => trait.trim()).filter(Boolean)
                : numberFields.includes(field) ? raw === '' ? null : Number(raw) : raw;
              if (isFieldValue(field, next) && !(field === 'combo' && next === 0)) onChange(next);
            }}
            onBlur={() => setInput(undefined)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
        )}
      </label>
      {original !== undefined && <div className="ct-original">原值 {showValue(original)} <button type="button" onClick={reset}>清除此欄</button></div>}
    </div>
  );
}

export function CardTablePage() {
  const [local, setLocal] = useState(loadDraft);
  const [tab, setTab] = useState<(typeof tabs)[number]>('卡片');
  const [selection, setSelection] = useState<string>();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CardKind>('move');
  const [message, setMessage] = useState('');
  const [storageFailed, setStorageFailed] = useState(false);
  const { draft, invalidated } = local;

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ diff: makeDiff(cardTable, draft, APP_VERSION), issued: local.issued, invalidated }));
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  }, [local, draft, invalidated]);

  const updateDraft = (next: Draft) => setLocal({ ...local, draft: next });
  const deleted = new Set(draft.deletions.map(({ uid }) => uid));
  const cards = ALL_CARDS.filter((card) => isExCardId(card.id) === (tab === 'Ex 卡')).map((card) => {
    const uid = cardUids.get(card.id)!;
    const edits = draft.edits.filter((edit) => edit.uid === uid);
    return { uid, card: edits.length ? previewCard(card, edits) : card, base: card, edits, added: false };
  });
  if (tab === '卡片') {
    for (const { uid, card } of draft.additions) {
      cards.push({ uid, card: previewCard(card, []), base: card, edits: [], added: true });
    }
  }
  const entryKey = (entry: (typeof cards)[number]) => (entry.added ? 'draft:' : 'base:') + entry.uid;
  const selected = cards.find((entry) => entryKey(entry) === selection && (entry.added || !deleted.has(entry.uid)));

  function addCard(event: FormEvent) {
    event.preventDefault();
    const id = name.trim();
    if (!isFieldValue('name', id) || ALL_CARDS.some((card) => card.id === id) || draft.additions.some((entry) => entry.card.id === id)) {
      setMessage('請輸入有效且未使用的卡名。');
      return;
    }
    const uid = nextCardUid(cardTable, kind, local.issued);
    const card: CardData = { id, name: id, kind, cls: '共用', traits: [], atk: 0, def: 0, combo: kind === 'move' ? 1 : 0, expReq: 0, text: '' };
    if (kind === 'equip') card.slot = '武器';
    setLocal({ ...local, issued: [...local.issued, uid], draft: { ...draft, additions: [...draft.additions, { uid, card }] } });
    setName('');
    setMessage('');
    setSelection('draft:' + uid);
  }

  function editField(entry: NonNullable<typeof selected>, field: Field, value: Value) {
    if (!isFieldValue(field, value)) return;
    if (entry.added) {
      const card = { ...entry.base, [field]: value ?? undefined };
      updateDraft({ ...draft, additions: draft.additions.map((addition) => addition.uid === entry.uid ? { ...addition, card } : addition) });
      return;
    }
    const base = cardValue(entry.base, field);
    const edits = draft.edits.filter((edit) => edit.uid !== entry.uid || edit.field !== field);
    if (!equalValue(base, value)) edits.push({ uid: entry.uid, field, base, value });
    updateDraft({ ...draft, edits });
  }

  function deleteCard(entry: NonNullable<typeof selected>) {
    if (entry.added) updateDraft({ ...draft, additions: draft.additions.filter(({ uid }) => uid !== entry.uid) });
    else updateDraft({
      ...draft,
      edits: draft.edits.filter(({ uid }) => uid !== entry.uid),
      deletions: [...draft.deletions, { uid: entry.uid, id: entry.card.id }],
    });
    setSelection(undefined);
  }

  function exportDraft() {
    const diff = makeDiff(cardTable, draft, APP_VERSION);
    const url = URL.createObjectURL(new Blob([JSON.stringify(diff, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'combo-master-card-table.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const hasDraft = draft.edits.length + draft.additions.length + draft.deletions.length > 0;
  return (
    <main className="ct">
      <header className="ct-header">
        <h1>連擊大師卡表</h1>
        <span className="muted">基準 v{APP_VERSION}</span>
        <div className="ct-actions">
          <button disabled={!hasDraft} onClick={exportDraft}>匯出差異檔</button>
          <button disabled={!hasDraft} onClick={() => updateDraft(emptyDraft())}>清除全部草稿</button>
        </div>
      </header>
      {storageFailed && <p role="alert">瀏覽器無法儲存草稿。關閉頁面前請匯出差異檔。</p>}
      {invalidated.length > 0 && (
        <section className="ct-notice" aria-label="草稿作廢">
          <strong>{invalidated.length} 項本地修改已因基準更新而作廢</strong>
          <button onClick={() => setLocal({ ...local, invalidated: [] })}>關閉</button>
          <ul>{invalidated.map((edit, index) => <li key={index}>{edit.uid} {fieldLabels[edit.field]} {showValue(edit.base)} → {showValue(edit.value)}</li>)}</ul>
        </section>
      )}
      <nav className="ct-tabs" aria-label="卡表分頁">
        {tabs.map((item) => <button key={item} aria-pressed={tab === item} onClick={() => { setTab(item); setSelection(undefined); }}>{item}</button>)}
      </nav>
      {tab === '卡片' && (
        <form className="ct-new" onSubmit={addCard}>
          <label>新卡名稱 <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>類型 <select value={kind} onChange={(e) => setKind(e.target.value as CardKind)}>
            {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <button>新增卡片</button>
          {message && <span role="alert">{message}</span>}
        </form>
      )}
      {tab === '卡片' && draft.deletions.length > 0 && (
        <ul className="ct-deletions">{draft.deletions.map(({ uid, id }) => (
          <li key={uid}>待刪除 {uid} {id} <button onClick={() => updateDraft({ ...draft, deletions: draft.deletions.filter((d) => d.uid !== uid) })}>撤銷刪除</button></li>
        ))}</ul>
      )}
      {(tab === '卡片' || tab === 'Ex 卡') && (
        <div className={selected ? 'ct-layout ct-with-detail' : 'ct-layout'}>
          <div className="ct-grid">
            {cards.filter((entry) => entry.added || !deleted.has(entry.uid)).map((entry) => (
              <div key={entryKey(entry)} className={entry.edits.length || entry.added ? 'ct-changed' : undefined}>
                <CardFace id={entry.card.id} card={entry.card} selected={selection === entryKey(entry)} onClick={() => setSelection(entryKey(entry))} />
                <button className="ct-open" onClick={() => setSelection(entryKey(entry))} aria-label={`${entry.uid} ${entry.card.name} 詳細資料`}>{entry.uid}{entry.added ? ' · 新增草稿' : ''}</button>
              </div>
            ))}
          </div>
          {selected && (
            <section className="ct-detail" aria-label={`${selected.uid} 詳細資料`} key={entryKey(selected)}>
              <div className="ct-detail-actions">
                <strong>{selected.uid}</strong>
                {tab === '卡片' && (selected.added || canDelete(selected.card)) && <button onClick={() => deleteCard(selected)}>刪除卡片</button>}
                <button onClick={() => setSelection(undefined)}>關閉詳細資料</button>
              </div>
              <InspectPanel id={selected.card.id} card={selected.card} />
              {tab === '卡片' && fields.filter((field) => {
                if (selected.edits.some((edit) => edit.field === field)) return true;
                if (['atk', 'def', 'combo'].includes(field)) return selected.card.kind === 'move';
                if (field === 'slot') return selected.card.kind === 'equip';
                if (field === 'duration') return selected.card.kind === 'buff';
                return true;
              }).map((field) => {
                const edit = selected.edits.find((item) => item.field === field);
                return <CardField key={field} field={field} value={edit ? edit.value : cardValue(selected.card, field)}
                  original={edit?.base} reset={() => editField(selected, field, cardValue(selected.base, field))}
                  onChange={(value) => editField(selected, field, value)} />;
              })}
            </section>
          )}
        </div>
      )}
      {tab === '角色' && <div className="ct-records">{ALL_CHARACTERS.map((character) => (
        <article key={character.id}>
          <h2>{character.name} <small>{uidById.get('C:' + character.id)}</small></h2>
          <p>{character.cls} · 生命值 {character.hp} · 覺醒經驗 {character.expReq}</p>
          <p><KeywordText text={character.text} /></p>
          {character.awakenText && <p><KeywordText text={character.awakenText} /></p>}
        </article>
      ))}</div>}
      {tab === '關鍵字' && <div className="ct-records">{KEYWORDS.map((keyword) => (
        <article key={keyword.name}>
          <h2>{keyword.name} <small>{uidById.get('K:' + keyword.name)}</small></h2>
          <p className="muted">{keyword.group}</p>
          <p>{keyword.desc}</p>
        </article>
      ))}</div>}
      <KeywordTooltip />
    </main>
  );
}
