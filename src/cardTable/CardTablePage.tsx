import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ALL_CARDS, ALL_CHARACTERS } from '../data/cards';
import { matchesCard, type CardScope } from '../data/cardSearch';
import { cardTable } from '../data/cardTableData';
import {
  addedCharacterFields, blankMoveAdditions, cardFields, cardValue, characterFields, classes, emptyDraft, equalValue, exFields,
  fieldLabels, isFieldValue, keywordFields, kinds, makeDiff, nextCardUid, nextUid, orderLists,
  orderOf, parseDiff, previewCard, realignDraft, slots, sortByOrder,
  type Draft, type Edit, type Field, type OrderList,
} from '../data/cardTableDraft';
import { isExCardId } from '../data/exCards';
import type { Keyword } from '../data/keywords';
import { TUTORIAL_CHARACTERS } from '../data/tutorialCharacters';
import type { CardData, CardKind, CharacterData } from '../data/types';
import { CardFace, InspectPanel } from '../ui/components/CardFace';
import { KeywordTooltip } from '../ui/components/KeywordText';
import { SortableList } from '../ui/components/SortableList';
import { APP_VERSION } from '../version';
import { CardComposer } from './CardComposer';

const key = 'combo-master:card-table-draft';
const tabs = ['卡片', '角色', '關鍵字', 'Ex 卡'] as const;
const uidById = new Map(Object.entries(cardTable.uids).map(([uid, id]) => [uid[0] + ':' + id, uid]));
const cardUids = new Map(Object.entries(cardTable.uids).filter(([uid]) => /^[AEBX]/.test(uid)).map(([uid, id]) => [id, uid]));
const numberFields: Field[] = ['atk', 'def', 'combo', 'expReq', 'duration', 'hp'];
const filterFields: Field[] = ['kind', 'cls', 'traits', 'slot', 'group', 'combo'];
type SheetField = Field | 'uid';
type Value = Edit['value'];
type LocalDraft = { draft: Draft; issued: string[]; invalidated: Edit[] };
const emptyLocal = (): LocalDraft => ({ draft: emptyDraft(), issued: [], invalidated: [] });

function loadDraft(): LocalDraft {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyLocal();
    const saved = JSON.parse(raw);
    const { draft, invalidated } = realignDraft(cardTable, parseDiff(saved.diff));
    return {
      draft,
      issued: Array.isArray(saved.issued) ? saved.issued.filter((uid: unknown) => typeof uid === 'string' && /^[AEBCKX][1-9]\d{0,14}$/.test(uid)) : [],
      invalidated: [...(Array.isArray(saved.invalidated) ? saved.invalidated : []), ...invalidated],
    };
  } catch {
    return emptyLocal();
  }
}

const showValue = (value: Value) => Array.isArray(value) ? value.join('、') || '空白' : value === null || value === '' ? '空白' : String(value);
const inputValue = (value: Value) => Array.isArray(value) ? value.join('、') : String(value ?? '');

function fieldLabel(field: Field, prefix: string) {
  if (field === 'name') return prefix === 'C' ? '角色名稱' : prefix === 'K' ? '關鍵字名稱' : '卡片名稱';
  return prefix === 'C' && field === 'expReq' ? '覺醒經驗' : fieldLabels[field];
}

type FieldRows<Row> = { label: string; prefix: string; fields: readonly Field[]; rows: Row[] };

function FilteredRows<Row extends { uid: string }>({ label, prefix, fields, rows, getValue, children }: FieldRows<Row> & {
  getValue: (row: Row, field: Field) => Value;
  children: (rows: Row[], state: { filtered: boolean; sorted: boolean }) => ReactNode;
}) {
  const viewKey = `combo-master:card-table-view:${label}`;
  const [savedView] = useState(() => {
    try {
      const saved = localStorage.getItem(viewKey);
      return saved ? JSON.parse(saved) as { filters?: Partial<Record<SheetField, string[]>>; sortField?: SheetField | ''; descending?: boolean } : {};
    } catch { return {}; }
  });
  const [filters, setFilters] = useState<Partial<Record<SheetField, string[]>>>(savedView.filters ?? {});
  const [sortField, setSortField] = useState<SheetField | ''>(savedView.sortField ?? '');
  const [descending, setDescending] = useState(savedView.descending ?? false);
  useEffect(() => {
    const view = { filters, sortField, descending };
    try { localStorage.setItem(viewKey, JSON.stringify(view)); } catch { /* 設定只存在記憶體也可繼續使用 */ }
  }, [viewKey, filters, sortField, descending]);
  const availableFilters: SheetField[] = ['uid', ...fields.filter((field) => filterFields.includes(field) || field === 'combo')];
  const availableSorts: SheetField[] = ['uid', ...fields.filter((field) => numberFields.includes(field))];
  const columnLabel = (field: SheetField) => field === 'uid' ? '編號' : fieldLabel(field, prefix);
  const valueOf = (row: Row, field: SheetField) => field === 'uid' ? row.uid : getValue(row, field);
  const filterValues = (row: Row, field: SheetField): string[] => {
    const value = valueOf(row, field);
    if (Array.isArray(value)) return value.length ? value : [''];
    return [value === null ? '' : String(value)];
  };
  const compareLabels = (a: string, b: string) => a.localeCompare(b, 'zh-Hant', { numeric: true });
  const optionsFor = (field: SheetField) =>
    [...new Set([...rows.flatMap((row) => filterValues(row, field)), ...(filters[field] ?? [])])].sort(compareLabels);
  const optionLabel = (field: SheetField, value: string) => {
    if (value === '') return '空白';
    return field === 'kind' ? (kinds[value as CardKind] ?? value) : value;
  };
  const activeFilters = availableFilters.filter((field) => filters[field]?.length);
  const visibleRows = rows.filter((row) => activeFilters.every((field) =>
    filterValues(row, field).some((value) => filters[field]?.includes(value))));
  if (sortField) {
    visibleRows.sort((a, b) => {
      const left = valueOf(a, sortField);
      const right = valueOf(b, sortField);
      if (left === null || right === null) return Number(left === null) - Number(right === null);
      const difference = typeof left === 'number' && typeof right === 'number'
        ? left - right : compareLabels(String(left), String(right));
      return descending ? -difference : difference;
    });
  }

  return (
    <>
      <div className="ct-filters ct-field-filters" role="group" aria-label={`${label}篩選與排序`}>
        {availableFilters.map((field) => {
          const selected = filters[field] ?? [];
          return <details key={field}>
            <summary>{columnLabel(field)}{selected.length ? `（${selected.length}）` : ''}</summary>
            <div className="ct-filter-options" role="group" aria-label={`${columnLabel(field)}篩選`}>
              {selected.length > 0 && <button type="button"
                onClick={() => setFilters((current) => ({ ...current, [field]: [] }))}>清除此欄</button>}
              {optionsFor(field).map((value) => <label key={value}>
                <input type="checkbox" checked={selected.includes(value)} onChange={(event) => {
                  const checked = event.target.checked;
                  setFilters((current) => {
                    const previous = current[field] ?? [];
                    return { ...current, [field]: checked ? [...previous, value] : previous.filter((item) => item !== value) };
                  });
                }} /> {optionLabel(field, value)}
              </label>)}
            </div>
          </details>;
        })}
        <label>排序 <select aria-label="排序" value={sortField} onChange={(event) => setSortField(event.target.value as SheetField | '')}>
          <option value="">卡表順序</option>
          {availableSorts.map((field) => <option key={field} value={field}>{columnLabel(field)}</option>)}
        </select></label>
        <select aria-label="排序方向" value={descending ? 'desc' : 'asc'} disabled={!sortField}
          onChange={(event) => setDescending(event.target.value === 'desc')}>
          <option value="asc">小到大</option><option value="desc">大到小</option>
        </select>
        {activeFilters.length > 0 && <button type="button" onClick={() => setFilters({})}>清除篩選</button>}
        <span role="status">{visibleRows.length} 筆</span>
      </div>
      {children(visibleRows, { filtered: activeFilters.length > 0, sorted: Boolean(sortField) })}
    </>
  );
}

function FieldTable<Row>({ label, prefix, fields, rows, children }: FieldRows<Row> & {
  children: (row: Row, index: number) => ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const sheet = sheetRef.current;
    const table = tableRef.current;
    if (!sheet || !table) return;
    const update = () => setCanScroll(sheet.scrollWidth > sheet.clientWidth);
    const observer = new ResizeObserver(update);
    observer.observe(sheet);
    observer.observe(table);
    update();
    return () => observer.disconnect();
  }, []);

  function scrollColumns(direction: number) {
    const sheet = sheetRef.current;
    if (sheet) sheet.scrollBy({ left: direction * sheet.clientWidth * 0.7 });
  }

  return (
    <>
      {canScroll && (
        <div className="ct-sheet-scroll" role="group" aria-label={`${label}橫向捲動`}>
          <button type="button" onClick={() => scrollColumns(-1)}>← 向左捲動</button>
          <button type="button" onClick={() => scrollColumns(1)}>向右捲動 →</button>
        </div>
      )}
      <div ref={sheetRef} className="ct-sheet" tabIndex={0} role="region" aria-label={label}>
        <table ref={tableRef} aria-label={label}>
          <thead><tr>
            <th scope="col">編號</th>
            {fields.map((field) => <th scope="col" key={field} data-field={field}>{fieldLabel(field, prefix)}</th>)}
            <th scope="col">操作</th>
          </tr></thead>
          <tbody>
            {rows.map(children)}
            {rows.length === 0 && <tr><td colSpan={fields.length + 2}>找不到符合條件的資料。</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CardField({ field, value, original, reset, onChange, prefix, compact = false }: {
  field: Field; value: Value; original?: Value; reset?: () => void; onChange: (value: Value) => void; prefix: string;
  compact?: boolean;
}) {
  const [input, setInput] = useState<string>();
  const options = field === 'kind' ? Object.entries(kinds)
    : field === 'cls' ? classes.map((cls) => [cls, cls])
    : field === 'slot' ? [['', '未指定'], ...slots.map((slot) => [slot, slot])] : null;
  return (
    <div className="ct-field" data-nodrag>
      <label className={original === undefined ? undefined : 'ct-edited'}>
        <span className={compact ? 'ct-cell-label' : undefined}>{fieldLabel(field, prefix)}</span>
        {options ? (
          <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)}>
            {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        ) : field === 'text' || field === 'desc' || field === 'awakenText' ? (
          <textarea maxLength={10000} rows={compact ? 1 : 4} value={String(value)} onChange={(e) => onChange(e.target.value)} />
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
              if (isFieldValue(field, next, prefix) && !(field === 'combo' && next === 0)) onChange(next);
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
  const [composing, setComposing] = useState(false);
  const [selection, setSelection] = useState<string>();
  const [cardTextView, setCardTextView] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CardKind>('move');
  const [newCardClass, setNewCardClass] = useState<(typeof classes)[number]>('共用');
  const [exKind, setExKind] = useState<CardKind>('move');
  const [filterKind, setFilterKind] = useState<'all' | CardKind>('all');
  const [exFilterKind, setExFilterKind] = useState<'all' | CardKind>('all');
  const [combo, setCombo] = useState(0);
  const [scope, setScope] = useState<CardScope>('all');
  const [query, setQuery] = useState('');
  const [exFilters, setExFilters] = useState({ combo: 0, attack: '', defense: '', expReq: '', slot: '', duration: '', traits: '', query: '' });
  const [exView, setExView] = useState(false);
  const [message, setMessage] = useState('');
  const [storageFailed, setStorageFailed] = useState(false);
  const [exportTried, setExportTried] = useState(false);
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
  const draftOrder = (list: OrderList) => draft.edits.find(({ uid }) => uid === list)?.value as string[] | undefined;
  function changeField(uid: string, field: Field, base: Value, value: Value) {
    const edits = draft.edits.filter((edit) => edit.uid !== uid || edit.field !== field);
    if (!equalValue(base, value)) edits.push({ uid, field, base, value });
    updateDraft({ ...draft, edits });
  }
  function orderControls(list: OrderList) {
    const order = draftOrder(list);
    return order && <p className="ct-original ct-changed">
      <button onClick={() => changeField(list, 'order', null, null)}>清除排序</button>
    </p>;
  }
  function rowOrderControls<Row>(list: OrderList, rows: Row[], index: number, uid: string,
    fullOrder: string[], sorted: boolean, getId: (row: Row) => string) {
    return ([-1, 1] as const).map((step) => {
      const destination = index + step;
      return <button key={step} type="button" disabled={sorted || destination < 0 || destination >= rows.length}
        title={sorted ? '切回卡表順序即可上移或下移' : undefined}
        aria-label={`${uid} ${step < 0 ? '上移' : '下移'}`} onClick={() => {
          const order = [...fullOrder];
          const from = order.indexOf(getId(rows[index]));
          const to = order.indexOf(getId(rows[destination]));
          [order[from], order[to]] = [order[to], order[from]];
          changeField(list, 'order', orderOf(cardTable, list), order);
        }}>{step < 0 ? '↑' : '↓'}</button>;
    });
  }
  const deleted = new Set(draft.deletions.map(({ uid }) => uid));
  const isEx = tab === 'Ex 卡';
  const isCharacter = tab === '角色';
  const cardList = isEx ? 'exCards' : 'cards';
  function cardEntries(ex: boolean) {
    const entries = ALL_CARDS.filter((card) => isExCardId(card.id) === ex).map((card) => {
      const uid = cardUids.get(card.id)!;
      const edits = draft.edits.filter((edit) => edit.uid === uid);
      const preview = ex ? { ...card, ...Object.fromEntries(edits.map(({ field, value }) => [field, value])) }
        : edits.length ? previewCard(card, edits) : card;
      return { uid, card: preview, base: card, edits, added: false };
    });
    for (const addition of draft.additions) {
      if (!('card' in addition) || isExCardId(addition.card.id) !== ex) continue;
      const { uid, card } = addition;
      entries.push({ uid, card: ex ? card : previewCard(card, []), base: card, edits: [], added: true });
    }
    return entries;
  }
  const cards = cardEntries(isEx);
  const entryKey = (entry: (typeof cards)[number]) => (entry.added ? 'draft:' : 'base:') + entry.uid;
  const selected = cards.find((entry) => entryKey(entry) === selection && (entry.added || !deleted.has(entry.uid)));

  function addRecord(event: FormEvent) {
    event.preventDefault();
    const id = name.trim();
    if (isCharacter) {
      if (!isFieldValue('name', id, 'C')
        || [...ALL_CHARACTERS, ...TUTORIAL_CHARACTERS, ...(cardTable.removedCharacters ?? [])].some((character) => character.id === id || character.name === id)
        || draft.additions.some((entry) => 'character' in entry && (entry.character.id === id || entry.character.name === id))) {
        setMessage('請輸入有效且未使用的角色名稱。');
        return;
      }
      const uid = nextUid(cardTable, 'C', local.issued);
      const character: CharacterData = { id, name: id, cls: '共用', hp: 0, expReq: 0, text: '', awakenText: '', pending: true };
      setLocal({ ...local, issued: [...local.issued, uid], draft: { ...draft, additions: [...draft.additions, { uid, character }] } });
      setName('');
      setMessage('');
      setSelection('draft:' + uid);
      return;
    }
    const isKeyword = tab === '關鍵字';
    const prefix = isEx ? 'X' : isKeyword ? 'K' : '';
    if (!isFieldValue('name', id, prefix) || (isKeyword
      ? cardTable.keywords.some((keyword) => keyword.name === id) || draft.additions.some((entry) => 'keyword' in entry && entry.keyword.name === id)
      : ALL_CARDS.some((card) => card.id === id) || cardTable.removedCards?.some((card) => card.id === id)
        || draft.additions.some((entry) => 'card' in entry && entry.card.id === id))) {
      setMessage(isKeyword ? '請輸入有效且未使用的關鍵字名稱。' : isEx ? '請輸入未使用且以 Ex- 開頭的卡名。' : '請輸入有效且未使用的卡名。');
      return;
    }
    const uid = prefix ? nextUid(cardTable, prefix, local.issued) : nextCardUid(cardTable, kind, local.issued);
    const recordKind = isEx ? exKind : kind;
    const card: CardData = { id, name: id, kind: recordKind, cls: isEx ? '共用' : newCardClass, traits: [], atk: 0, def: 0, combo: recordKind === 'move' ? 1 : 0, expReq: 0, text: '' };
    if (recordKind === 'equip') card.slot = '武器';
    const addition = isKeyword ? { uid, keyword: { name: id, group: '名詞', desc: '' } } : {
      uid, card,
    };
    setLocal({ ...local, issued: [...local.issued, uid], draft: { ...draft, additions: [...draft.additions, addition] } });
    setName('');
    setMessage('');
    setSelection('draft:' + uid);
  }

  function editField(entry: NonNullable<typeof selected>, field: Field, value: Value) {
    if (!isFieldValue(field, value, entry.uid[0])) return;
    if (entry.added) {
      const card = { ...entry.base, [field]: value ?? undefined };
      updateDraft({ ...draft, additions: draft.additions.map((addition) => addition.uid === entry.uid ? { ...addition, card } : addition) });
      return;
    }
    changeField(entry.uid, field, cardValue(entry.base, field), value);
  }

  function deleteRow(uid: string, id: string, added: boolean, list: OrderList) {
    if (added) updateDraft({
      ...draft,
      additions: draft.additions.filter((entry) => entry.uid !== uid),
      edits: draft.edits.map((edit) => edit.uid === list
        ? { ...edit, value: (edit.value as string[]).filter((value) => value !== id) } : edit),
    });
    else updateDraft({
      ...draft,
      deletions: [...draft.deletions, { uid, id }],
    });
    setSelection(undefined);
  }

  const blankMoves = exportTried ? blankMoveAdditions(makeDiff(cardTable, draft, APP_VERSION).additions) : [];
  function exportDraft() {
    const diff = makeDiff(cardTable, draft, APP_VERSION);
    if (blankMoveAdditions(diff.additions).length) {
      setExportTried(true);
      return;
    }
    setExportTried(false);
    const url = URL.createObjectURL(new Blob([JSON.stringify(diff, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'combo-master-card-table.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const visibleCards = cards.filter((entry) => entry.added || !deleted.has(entry.uid));
  const legacyOrder = !isEx && draftOrder('added');
  const addedIds = new Set(legacyOrder ? orderOf(cardTable, 'added') : []);
  const sortableCards = sortByOrder(visibleCards, draftOrder(cardList) ?? (legacyOrder
    ? [...orderOf(cardTable, 'cards').filter((id) => !addedIds.has(id)), ...legacyOrder] : []), (entry) => entry.base.id);
  const search = (isEx ? exFilters.query : query).trim();
  const showExMoveFields = exFilterKind === 'all' || exFilterKind === 'move';
  const showExEquipFields = exFilterKind === 'all' || exFilterKind === 'equip';
  const showExBuffFields = exFilterKind === 'all' || exFilterKind === 'buff';
  const filtering = Boolean(search) || (isEx
    ? exFilterKind !== 'all' || showExMoveFields && (exFilters.combo !== 0 || exFilters.attack !== '' || exFilters.defense !== '')
      || showExEquipFields && (exFilters.expReq !== '' || exFilters.slot !== '')
      || showExBuffFields && exFilters.duration !== '' || exFilters.traits !== ''
    : filterKind !== 'all' || combo !== 0 || scope !== 'all');
  const matchingCards = filtering ? sortableCards.filter(({ card }) => {
    if (!matchesCard(card, isEx ? exFilterKind : filterKind, isEx ? showExMoveFields ? exFilters.combo : 0 : combo, isEx ? 'all' : scope, search)) return false;
    if (!isEx) return true;
    return (!showExMoveFields || exFilters.attack === '' || card.kind === 'move' && String(card.atk) === exFilters.attack)
      && (!showExMoveFields || exFilters.defense === '' || card.kind === 'move' && String(card.def) === exFilters.defense)
      && (!showExEquipFields || exFilters.expReq === '' || card.kind === 'equip' && String(card.expReq) === exFilters.expReq)
      && (!showExEquipFields || exFilters.slot === '' || card.kind === 'equip' && card.slot === exFilters.slot)
      && (!showExBuffFields || exFilters.duration === '' || card.kind === 'buff' && String(card.duration ?? '') === exFilters.duration)
      && (exFilters.traits === '' || card.traits.includes(exFilters.traits));
  }) : sortableCards;
  const renderCard = (entry: (typeof cards)[number]) => (
    <div key={entryKey(entry)} className={entry.edits.length || entry.added ? 'ct-changed' : undefined}>
      <CardFace id={entry.card.id} card={entry.card} showExStats={isEx} selected={selection === entryKey(entry)} onClick={() => setSelection(entryKey(entry))} />
      <button data-nodrag className="ct-open" onClick={() => setSelection(entryKey(entry))} aria-label={`${entry.uid} ${entry.card.name} 詳細資料`}>{entry.uid}{entry.added ? ' · 新增草稿' : ''}</button>
    </div>
  );
  const cardPrefix = isEx ? 'X' : 'A';
  const sheetCardFields: readonly Field[] = isEx ? ['kind', 'name', 'traits', 'atk', 'def', 'combo', 'expReq', 'slot', 'duration', 'text']
    : ['kind', 'name', 'cls', 'traits', 'atk', 'def', 'combo', 'expReq', 'slot', 'duration', 'text'];
  const sortableCardIds = sortableCards.map(({ base }) => base.id);
  const cardFieldVisible = (entry: (typeof cards)[number], field: Field) => {
    if (isEx) {
      if (['atk', 'def', 'combo'].includes(field)) return entry.card.kind === 'move';
      if (field === 'expReq' || field === 'slot') return entry.card.kind === 'equip';
      if (field === 'duration') return entry.card.kind === 'buff';
    }
    if (entry.edits.some((edit) => edit.field === field)) return true;
    if (['atk', 'def', 'combo'].includes(field)) return entry.card.kind === 'move';
    if (field === 'slot') return entry.card.kind === 'equip';
    if (field === 'duration') return entry.card.kind === 'buff';
    return true;
  };
  function renderCardField(entry: (typeof cards)[number], field: Field, compact = false) {
    const edit = entry.edits.find((item) => item.field === field);
    return <CardField key={field} prefix={entry.uid[0]} field={field} value={edit ? edit.value : cardValue(entry.card, field)}
      original={edit?.base} reset={() => editField(entry, field, cardValue(entry.base, field))}
      onChange={(value) => editField(entry, field, value)} compact={compact} />;
  }
  const characters = sortByOrder([
    ...ALL_CHARACTERS.map((character) => ({ uid: uidById.get('C:' + character.id)!, character, added: false })),
    ...draft.additions.flatMap((entry) => 'character' in entry ? [{ ...entry, added: true }] : []),
  ].filter((entry) => entry.added || !deleted.has(entry.uid)), draftOrder('characters') ?? [], ({ character }) => character.id);
  const characterIds = characters.map(({ character }) => character.id);
  const keywords = sortByOrder([
    ...cardTable.keywords.map((keyword) => ({ uid: uidById.get('K:' + keyword.name)!, keyword, added: false })),
    ...draft.additions.flatMap((entry) => 'keyword' in entry ? [{ ...entry, added: true }] : []),
  ].filter((entry) => entry.added || !deleted.has(entry.uid)), draftOrder('keywords') ?? [], ({ keyword }) => keyword.name);
  const keywordNames = keywords.map(({ keyword }) => keyword.name);
  const keywordKey = ({ uid, added }: (typeof keywords)[number]) => (added ? 'draft:' : 'base:') + uid;

  function editKeyword(uid: string, keyword: Keyword, added: boolean, field: Field, value: Value) {
    if (!added) {
      changeField(uid, field, cardValue(keyword, field), value);
      return;
    }
    if (field === 'name' && keywords.some((entry) => entry.keyword !== keyword && entry.keyword.name === value)) {
      setMessage('此關鍵字名稱已使用。');
      return;
    }
    setMessage('');
    const additions = draft.additions.map((entry) => 'keyword' in entry && entry.uid === uid
      ? { uid, keyword: { ...keyword, [field]: value } } : entry);
    const edits = draft.edits.map((edit) => edit.uid === 'keywords' && field === 'name'
      ? { ...edit, value: (edit.value as string[]).map((id) => id === keyword.name ? value as string : id) } : edit);
    updateDraft({ ...draft, additions, edits });
  }

  function renderRecordField(uid: string, entry: Parameters<typeof cardValue>[0], field: Field,
    onChange?: (field: Field, value: Value) => void, added = false) {
    const base = cardValue(entry, field);
    const edit = added ? undefined : draft.edits.find((item) => item.uid === uid && item.field === field);
    const update = onChange ?? ((changedField, value) => changeField(uid, changedField, base, value));
    return <CardField prefix={uid[0]} field={field} value={edit ? edit.value : base}
      original={edit?.base} reset={() => update(field, base)} onChange={(value) => update(field, value)} compact />;
  }

  function recordValue(uid: string, entry: Parameters<typeof cardValue>[0], field: Field, added: boolean): Value {
    const edit = added ? undefined : draft.edits.find((item) => item.uid === uid && item.field === field);
    return edit ? edit.value : cardValue(entry, field);
  }

  const hasDraft = draft.edits.length + draft.additions.length + draft.deletions.length > 0;
  const tabPrefixes = { 卡片: 'AEB', 角色: 'C', 關鍵字: 'K', 'Ex 卡': 'X' };
  const pendingDeletions = draft.deletions.filter(({ uid }) => tabPrefixes[tab].includes(uid[0]));
  const composerCards = composing ? [...cards, ...cardEntries(!isEx)].filter(({ uid }) => uid && !deleted.has(uid)) : [];
  return (
    <main className="ct">
      <header className="ct-header">
        <h1>連擊大師卡表</h1>
        <span className="muted">基準 v{APP_VERSION}</span>
        <div className="ct-actions">
          <button disabled={!hasDraft} onClick={exportDraft}>匯出差異檔</button>
          {hasDraft && <button onClick={() => setLocal({ ...local, draft: emptyDraft(), invalidated: [] })}>清除全部草稿</button>}
        </div>
      </header>
      {storageFailed && <p role="alert">瀏覽器無法儲存草稿。關閉頁面前請匯出差異檔。</p>}
      {blankMoves.length > 0 && (
        <section className="ct-notice" role="alert" aria-label="無法匯出">
          <strong>{blankMoves.length} 張新增招式缺少特徵與效果文字，補上其中之一才能匯出差異檔（否則無法與基準白板卡區分）</strong>
          <ul>{blankMoves.map(({ uid, card }) => (
            <li key={uid}>{uid} {card.name}{' '}
              <button onClick={() => { setTab('卡片'); setName(''); setMessage(''); setSelection('draft:' + uid); }}>前往補上</button>
            </li>
          ))}</ul>
        </section>
      )}
      {invalidated.length > 0 && (
        <section className="ct-notice" aria-label="草稿作廢">
          <strong>{invalidated.length} 項本地修改已因基準更新而作廢</strong>
          <button onClick={() => setLocal({ ...local, invalidated: [] })}>關閉</button>
          <ul>{invalidated.map((edit, index) => <li key={index}>{edit.field === 'order' ? orderLists[edit.uid as OrderList] : edit.uid} {fieldLabels[edit.field]} {showValue(edit.base)} → {showValue(edit.value)}</li>)}</ul>
        </section>
      )}
      <nav className="ct-tabs" aria-label="卡表分頁">
        {tabs.map((item) => <button key={item} aria-pressed={!composing && tab === item}
          onClick={() => { setComposing(false); setTab(item); setSelection(undefined); setName(''); setMessage(''); }}>{item}</button>)}
        <button type="button" aria-pressed={composing} onClick={() => setComposing(true)}>卡面合成</button>
      </nav>
      {composing ? <CardComposer cards={composerCards} initialUid={selected?.uid} renderField={(uid, field) => {
        const entry = composerCards.find((entry) => entry.uid === uid);
        return entry && renderCardField(entry, field);
      }} /> : <>
      <form className="ct-new" onSubmit={addRecord}>
        <label>{isCharacter ? '新角色名稱' : tab === '關鍵字' ? '新關鍵字名稱' : '新卡名稱'} <input required maxLength={100} placeholder={isEx ? 'Ex-' : undefined} value={name} onChange={(e) => setName(e.target.value)} /></label>
        {(tab === '卡片' || isEx) && <label>類型 <select value={isEx ? exKind : kind} onChange={(e) => isEx
          ? setExKind(e.target.value as CardKind) : setKind(e.target.value as CardKind)}>
          {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>}
        {tab === '卡片' && <label>職業 <select aria-label="新卡職業" value={newCardClass}
          onChange={(e) => setNewCardClass(e.target.value as (typeof classes)[number])}>
          {classes.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
        </select></label>}
        <button>新增{tab}</button>
        {message && <span role="alert">{message}</span>}
      </form>
      {pendingDeletions.length > 0 && (
        <ul className="ct-deletions">{pendingDeletions.map(({ uid, id }) => (
          <li key={uid}>待刪除 {uid} {id} <button onClick={() => updateDraft({ ...draft, deletions: draft.deletions.filter((d) => d.uid !== uid) })}>撤銷刪除</button></li>
        ))}</ul>
      )}
      {(tab === '卡片' || tab === 'Ex 卡') && (
        <>
        <div className="ct-filters" role="group" aria-label={`${tab}篩選`}>
          {isEx ? <>
            <select aria-label="Ex 卡類型篩選" value={exFilterKind} onChange={(e) => setExFilterKind(e.target.value as 'all' | CardKind)}>
              <option value="all">全部類型</option>
              {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {showExMoveFields && <>
            <select aria-label="Ex 卡連擊值" value={exFilters.combo} onChange={(e) => setExFilters({ ...exFilters, combo: Number(e.target.value) })}>
              <option value={0}>全部連擊值</option>
              {Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={i + 1}>連擊值 {i + 1}</option>)}
            </select>
            <select aria-label="Ex 卡攻擊力" value={exFilters.attack} onChange={(e) => setExFilters({ ...exFilters, attack: e.target.value })}>
              <option value="">全部攻擊力</option>
              {[...new Set(sortableCards.filter(({ card }) => card.kind === 'move').map(({ card }) => card.atk))].sort((a, b) => a - b).map((value) => <option key={value} value={value}>攻擊力 {value}</option>)}
            </select>
            <select aria-label="Ex 卡防禦力" value={exFilters.defense} onChange={(e) => setExFilters({ ...exFilters, defense: e.target.value })}>
              <option value="">全部防禦力</option>
              {[...new Set(sortableCards.filter(({ card }) => card.kind === 'move').map(({ card }) => card.def))].sort((a, b) => a - b).map((value) => <option key={value} value={value}>防禦力 {value}</option>)}
            </select>
            </>}
            {showExEquipFields && <>
            <select aria-label="Ex 卡經驗需求" value={exFilters.expReq} onChange={(e) => setExFilters({ ...exFilters, expReq: e.target.value })}>
              <option value="">全部經驗需求</option>
              {[...new Set(sortableCards.filter(({ card }) => card.kind === 'equip').map(({ card }) => card.expReq))].sort((a, b) => a - b).map((value) => <option key={value} value={value}>經驗需求 {value}</option>)}
            </select>
            <select aria-label="Ex 卡部位" value={exFilters.slot} onChange={(e) => setExFilters({ ...exFilters, slot: e.target.value })}>
              <option value="">全部部位</option>
              {[...new Set(sortableCards.filter(({ card }) => card.kind === 'equip').map(({ card }) => card.slot).filter((slot): slot is NonNullable<CardData['slot']> => Boolean(slot)))].sort((a, b) => a.localeCompare(b, 'zh-Hant')).map((slot) => <option key={slot} value={slot}>{slot}</option>)}
            </select>
            </>}
            {showExBuffFields && <select aria-label="Ex 卡持續回合" value={exFilters.duration} onChange={(e) => setExFilters({ ...exFilters, duration: e.target.value })}>
              <option value="">全部持續回合</option>
              {[...new Set(sortableCards.filter(({ card }) => card.kind === 'buff' && card.duration !== undefined).map(({ card }) => card.duration!))].sort((a, b) => a - b).map((value) => <option key={value} value={value}>持續回合 {value}</option>)}
            </select>}
            <select aria-label="Ex 卡特徵" value={exFilters.traits} onChange={(e) => setExFilters({ ...exFilters, traits: e.target.value })}>
              <option value="">全部特徵</option>
              {[...new Set(sortableCards.flatMap(({ card }) => card.traits))].sort((a, b) => a.localeCompare(b, 'zh-Hant')).map((trait) => <option key={trait} value={trait}>{trait}</option>)}
            </select>
          </> : <>
            <select aria-label="卡片類型" value={filterKind} onChange={(e) => setFilterKind(e.target.value as 'all' | CardKind)}>
              <option value="all">全部類型</option>
              {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select aria-label="連擊值" value={combo} onChange={(e) => setCombo(Number(e.target.value))}>
              <option value={0}>全部連擊值</option>
              {Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={i + 1}>連擊值 {i + 1}</option>)}
            </select>
            <select aria-label="專用或共用" value={scope} onChange={(e) => setScope(e.target.value as CardScope)}>
              <option value="all">專用＋共用</option>
              <option value="class">只看專用</option>
              <option value="common">只看共用</option>
            </select>
          </>}
          <input type="search" aria-label="搜尋名稱、效果或特徵" placeholder="搜尋名稱／效果／特徵"
            value={isEx ? exFilters.query : query} onChange={(e) => isEx
              ? setExFilters({ ...exFilters, query: e.target.value }) : setQuery(e.target.value)} />
          <div className="ct-view" role="group" aria-label={`${tab}顯示方式`}>
            <button type="button" aria-pressed={!(isEx ? exView : cardTextView)} onClick={() => isEx ? setExView(false) : setCardTextView(false)}>卡面</button>
            <button type="button" aria-pressed={isEx ? exView : cardTextView} onClick={() => isEx ? setExView(true) : setCardTextView(true)}>表格</button>
          </div>
        </div>
        {orderControls(cardList)}
        {!isEx && orderControls('added')}
        <FilteredRows key={tab} label={tab} prefix={cardPrefix} fields={sheetCardFields}
          rows={matchingCards} getValue={(entry, field) => cardFieldVisible(entry, field)
            ? recordValue(entry.uid, entry.card, field, entry.added) : null}>
          {(rows, { filtered, sorted }) => (isEx ? exView : cardTextView) ? (
            <FieldTable label={`${tab}表格`} prefix={cardPrefix} fields={sheetCardFields} rows={rows}>
              {(entry, index) => (
                <tr key={entryKey(entry)} className={entry.added || selection === entryKey(entry) ? 'ct-sheet-marked' : undefined}>
                  <th scope="row">{entry.uid}{entry.added && <small>草稿</small>}</th>
                  {sheetCardFields.map((field) => <td key={field}>
                    {cardFieldVisible(entry, field) ? renderCardField(entry, field, true) : '—'}
                  </td>)}
                  <td className="ct-row-actions">
                    {rowOrderControls(cardList, rows, index, entry.uid, sortableCardIds, sorted, ({ base }) => base.id)}
                    <button type="button" aria-label={`刪除 ${entry.uid}`}
                      onClick={() => deleteRow(entry.uid, entry.base.id, entry.added, cardList)}>刪除</button>
                  </td>
                </tr>
              )}
            </FieldTable>
          ) : <div className={selected ? 'ct-layout ct-with-detail' : 'ct-layout'}>
            <div>
              {rows.length === 0 ? <p>找不到符合條件的卡片。</p> : filtering || filtered || sorted
                ? <div className="ct-grid">{rows.map(renderCard)}</div>
                : <SortableList className="ct-grid ct-sortable" items={rows} getKey={(entry) => entry.base.id} renderItem={renderCard}
                  onReorder={(order) => changeField(cardList, 'order', orderOf(cardTable, cardList), order)} />}
            </div>
            {selected && (
              <section className="ct-detail" aria-label={`${selected.uid} 詳細資料`} key={entryKey(selected)}>
                <div className="ct-detail-actions">
                  <strong>{selected.uid}</strong>
                  <button onClick={() => deleteRow(selected.uid, selected.base.id, selected.added, cardList)}>刪除卡片</button>
                  <button onClick={() => setSelection(undefined)}>關閉詳細資料</button>
                </div>
                <InspectPanel id={selected.card.id} card={selected.card} />
                {(isEx ? exFields : cardFields).filter((field) => cardFieldVisible(selected, field))
                  .map((field) => renderCardField(selected, field))}
              </section>
            )}
          </div>}
        </FilteredRows>
        </>
      )}
      {isCharacter && <>
        {orderControls('characters')}
        <FilteredRows label="角色表格" prefix="C" fields={addedCharacterFields}
          rows={characters} getValue={({ uid, character, added }, field) => recordValue(uid, character, field, added)}>
          {(rows, { sorted }) => <FieldTable label="角色表格" prefix="C" fields={addedCharacterFields} rows={rows}>
            {({ uid, character, added }, index) => {
              const recordKey = (added ? 'draft:' : 'base:') + uid;
              const editCharacter = added ? (field: Field, value: Value) => updateDraft({
                ...draft, additions: draft.additions.map((entry) => entry.uid === uid ? { uid, character: { ...character, [field]: value } } : entry),
              }) : undefined;
              return (
                <tr key={recordKey} className={added ? 'ct-sheet-marked' : undefined}>
                  <th scope="row">{uid}{added && <small>草稿</small>}</th>
                  {characterFields.map((field) => <td key={field}>
                    {renderRecordField(uid, character, field, editCharacter, added)}
                    {field === 'cls' && draft.edits.some((edit) => edit.uid === uid && edit.field === 'cls')
                      && <small role="status">更改職業會改變可使用的專用卡。</small>}
                  </td>)}
                  {(['text', 'awakenText'] as const).map((field) => <td key={field} className="ct-sheet-copy">
                    {renderRecordField(uid, character, field, editCharacter, added)}
                  </td>)}
                  <td className="ct-row-actions">
                    {rowOrderControls('characters', rows, index, uid, characterIds, sorted, (row) => row.character.id)}
                    <button type="button" aria-label={`刪除 ${uid}`}
                      onClick={() => deleteRow(uid, character.id, added, 'characters')}>刪除</button>
                  </td>
                </tr>
              );
            }}
          </FieldTable>}
        </FilteredRows>
      </>}
      {tab === '關鍵字' && <>
        {orderControls('keywords')}
        <FilteredRows label="關鍵字表格" prefix="K" fields={keywordFields}
          rows={keywords} getValue={({ uid, keyword, added }, field) => recordValue(uid, keyword, field, added)}>
          {(rows, { sorted }) => <FieldTable label="關鍵字表格" prefix="K" fields={keywordFields} rows={rows}>
            {(entry, index) => {
              const { uid, keyword, added } = entry;
              return <tr key={keywordKey(entry)} className={added ? 'ct-sheet-marked' : undefined}>
                <th scope="row">{uid}{added && <small>草稿</small>}</th>
                {keywordFields.map((field) => <td key={field}>{renderRecordField(uid, keyword, field,
                  (changedField, value) => editKeyword(uid, keyword, added, changedField, value), added)}</td>)}
                <td className="ct-row-actions">
                  {rowOrderControls('keywords', rows, index, uid, keywordNames, sorted, (row) => row.keyword.name)}
                  <button type="button" aria-label={`刪除 ${uid}`}
                    onClick={() => deleteRow(uid, keyword.name, added, 'keywords')}>刪除</button>
                </td>
              </tr>;
            }}
          </FieldTable>}
        </FilteredRows>
      </>}
      </>}
      <KeywordTooltip />
    </main>
  );
}
