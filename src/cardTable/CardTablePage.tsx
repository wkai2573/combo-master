import { useEffect, useState, type FormEvent } from 'react';
import { ALL_CARDS, ALL_CHARACTERS } from '../data/cards';
import { matchesCard, type CardScope } from '../data/cardSearch';
import { cardTable } from '../data/cardTableData';
import {
  blankMoveAdditions, canDelete, cardFields, cardValue, characterFields, classes, emptyDraft, equalValue, exFields,
  fieldLabels, isFieldValue, keywordFields, kinds, makeDiff, nextCardUid, nextUid, orderLists,
  orderOf, parseDiff, previewCard, realignDraft, slots, sortByOrder,
  type Draft, type Edit, type Field, type OrderList,
} from '../data/cardTableDraft';
import { EX_LEAVE_RULES, isExCardId } from '../data/exCards';
import type { Keyword } from '../data/keywords';
import type { CardData, CardKind } from '../data/types';
import { CardFace, InspectPanel } from '../ui/components/CardFace';
import { KeywordText, KeywordTooltip } from '../ui/components/KeywordText';
import { SortableList } from '../ui/components/SortableList';
import { APP_VERSION } from '../version';

const key = 'combo-master:card-table-draft';
const tabs = ['卡片', '角色', '關鍵字', 'Ex 卡'] as const;
const uidById = new Map(Object.entries(cardTable.uids).map(([uid, id]) => [uid[0] + ':' + id, uid]));
const cardUids = new Map(Object.entries(cardTable.uids).filter(([uid]) => /^[AEBX]/.test(uid)).map(([uid, id]) => [id, uid]));
const numberFields: Field[] = ['atk', 'def', 'combo', 'expReq', 'duration', 'hp'];
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
      issued: Array.isArray(saved.issued) ? saved.issued.filter((uid: unknown) => typeof uid === 'string' && /^[AEBKX][1-9]\d{0,14}$/.test(uid)) : [],
      invalidated: [...(Array.isArray(saved.invalidated) ? saved.invalidated : []), ...invalidated],
    };
  } catch {
    return emptyLocal();
  }
}

const showValue = (value: Value) => Array.isArray(value) ? value.join('、') || '空白' : value === null || value === '' ? '空白' : String(value);
const inputValue = (value: Value) => Array.isArray(value) ? value.join('、') : String(value ?? '');

function CardField({ field, value, original, reset, onChange, prefix }: {
  field: Field; value: Value; original?: Value; reset?: () => void; onChange: (value: Value) => void; prefix: string;
}) {
  const [input, setInput] = useState<string>();
  const options = field === 'kind' ? Object.entries(kinds)
    : field === 'cls' ? classes.map((cls) => [cls, cls])
    : field === 'slot' ? [['', '未指定'], ...slots.map((slot) => [slot, slot])] : null;
  return (
    <div className="ct-field" data-nodrag>
      <label className={original === undefined ? undefined : 'ct-edited'}>
        {prefix === 'C' && field === 'expReq' ? '覺醒經驗' : fieldLabels[field]}
        {options ? (
          <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)}>
            {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        ) : field === 'text' || field === 'desc' ? (
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
  const [selection, setSelection] = useState<string>();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CardKind>('move');
  const [filterKind, setFilterKind] = useState<'all' | CardKind>('all');
  const [combo, setCombo] = useState(0);
  const [scope, setScope] = useState<CardScope>('all');
  const [query, setQuery] = useState('');
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
    return order && <p className="ct-original ct-changed">原順序 {showValue(orderOf(cardTable, list))}
      {' '}<button onClick={() => changeField(list, 'order', null, null)}>清除排序</button>
    </p>;
  }
  const deleted = new Set(draft.deletions.map(({ uid }) => uid));
  const isEx = tab === 'Ex 卡';
  const cardList = isEx ? 'exCards' : 'added';
  const sortableIds = new Set(orderOf(cardTable, cardList));
  const cards = ALL_CARDS.filter((card) => isExCardId(card.id) === (tab === 'Ex 卡')).map((card) => {
    const uid = cardUids.get(card.id)!;
    const edits = draft.edits.filter((edit) => edit.uid === uid);
    const preview = isEx ? { ...card, ...Object.fromEntries(edits.map(({ field, value }) => [field, value])) }
      : edits.length ? previewCard(card, edits) : card;
    return { uid, card: preview, base: card, edits, added: false };
  });
  for (const addition of draft.additions) {
    if (!('card' in addition) || isExCardId(addition.card.id) !== isEx) continue;
    const { uid, card } = addition;
    cards.push({ uid, card: isEx ? card : previewCard(card, []), base: card, edits: [], added: true });
  }
  const entryKey = (entry: (typeof cards)[number]) => (entry.added ? 'draft:' : 'base:') + entry.uid;
  const selected = cards.find((entry) => entryKey(entry) === selection && (entry.added || !deleted.has(entry.uid)));

  function addCard(event: FormEvent) {
    event.preventDefault();
    const id = name.trim();
    const isKeyword = tab === '關鍵字';
    const prefix = isEx ? 'X' : isKeyword ? 'K' : '';
    if (!isFieldValue('name', id, prefix) || (isKeyword
      ? cardTable.keywords.some((keyword) => keyword.name === id) || draft.additions.some((entry) => 'keyword' in entry && entry.keyword.name === id)
      : ALL_CARDS.some((card) => card.id === id) || draft.additions.some((entry) => 'card' in entry && entry.card.id === id))) {
      setMessage(isKeyword ? '請輸入有效且未使用的關鍵字名稱。' : isEx ? '請輸入未使用且以 Ex- 開頭的卡名。' : '請輸入有效且未使用的卡名。');
      return;
    }
    const uid = prefix ? nextUid(cardTable, prefix, local.issued) : nextCardUid(cardTable, kind, local.issued);
    const card: CardData = { id, name: id, kind, cls: '共用', traits: [], atk: 0, def: 0, combo: kind === 'move' ? 1 : 0, expReq: 0, text: '' };
    if (kind === 'equip') card.slot = '武器';
    const addition = isKeyword ? { uid, keyword: { name: id, group: '名詞', desc: '' } } : {
      uid, card: isEx ? { ...card, kind: 'move' as const, combo: 0, slot: undefined, text: EX_LEAVE_RULES.exp } : card,
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

  function deleteCard(entry: NonNullable<typeof selected>) {
    if (entry.added) updateDraft({
      ...draft,
      additions: draft.additions.filter(({ uid }) => uid !== entry.uid),
      edits: draft.edits.map((edit) => edit.uid === cardList
        ? { ...edit, value: (edit.value as string[]).filter((id) => id !== entry.base.id) } : edit),
    });
    else updateDraft({
      ...draft,
      edits: draft.edits.filter(({ uid }) => uid !== entry.uid),
      deletions: [...draft.deletions, { uid: entry.uid, id: entry.card.id }],
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
  const fixedCards = visibleCards.filter((entry) => !entry.added && !sortableIds.has(entry.base.id));
  const sortableCards = sortByOrder(visibleCards.filter((entry) => entry.added || sortableIds.has(entry.base.id)), draftOrder(cardList) ?? [], (entry) => entry.base.id);
  const search = query.trim();
  const filtering = Boolean(search) || (!isEx && (filterKind !== 'all' || combo !== 0 || scope !== 'all'));
  const matchingCards = filtering ? [...fixedCards, ...sortableCards].filter(({ card }) =>
    matchesCard(card, isEx ? 'all' : filterKind, isEx ? 0 : combo, isEx ? 'all' : scope, search)) : [];
  const renderCard = (entry: (typeof cards)[number]) => (
    <div key={entryKey(entry)} className={entry.edits.length || entry.added ? 'ct-changed' : undefined}>
      <CardFace id={entry.card.id} card={entry.card} selected={selection === entryKey(entry)} onClick={() => setSelection(entryKey(entry))} />
      <button data-nodrag className="ct-open" onClick={() => setSelection(entryKey(entry))} aria-label={`${entry.uid} ${entry.card.name} 詳細資料`}>{entry.uid}{entry.added ? ' · 新增草稿' : ''}</button>
    </div>
  );
  const keywords = sortByOrder([
    ...cardTable.keywords.map((keyword) => ({ uid: uidById.get('K:' + keyword.name)!, keyword, added: false })),
    ...draft.additions.flatMap((entry) => 'keyword' in entry ? [{ ...entry, added: true }] : []),
  ], draftOrder('keywords') ?? [], ({ keyword }) => keyword.name);
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

  function renderFields(uid: string, entry: Parameters<typeof cardValue>[0], fields: readonly Field[],
    onChange?: (field: Field, value: Value) => void, added = false) {
    return fields.map((field) => {
      const base = cardValue(entry, field);
      const edit = added ? undefined : draft.edits.find((item) => item.uid === uid && item.field === field);
      const update = onChange ?? ((changedField, value) => changeField(uid, changedField, base, value));
      return <CardField key={field} prefix={uid[0]} field={field} value={edit?.value ?? base}
        original={edit?.base} reset={() => update(field, base)} onChange={(value) => update(field, value)} />;
    });
  }

  const hasDraft = draft.edits.length + draft.additions.length + draft.deletions.length > 0;
  return (
    <main className="ct">
      <header className="ct-header">
        <h1>連擊大師卡表</h1>
        <span className="muted">基準 v{APP_VERSION}</span>
        <div className="ct-actions">
          <button disabled={!hasDraft} onClick={exportDraft}>匯出差異檔</button>
          <button disabled={!hasDraft && !invalidated.length} onClick={() => setLocal({ ...local, draft: emptyDraft(), invalidated: [] })}>清除全部草稿</button>
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
        {tabs.map((item) => <button key={item} aria-pressed={tab === item} onClick={() => { setTab(item); setSelection(undefined); setName(''); setMessage(''); }}>{item}</button>)}
      </nav>
      {tab !== '角色' && (
        <form className="ct-new" onSubmit={addCard}>
          <label>{tab === '關鍵字' ? '新關鍵字名稱' : '新卡名稱'} <input required maxLength={100} placeholder={isEx ? 'Ex-' : undefined} value={name} onChange={(e) => setName(e.target.value)} /></label>
          {tab === '卡片' && <label>類型 <select value={kind} onChange={(e) => setKind(e.target.value as CardKind)}>
            {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>}
          <button>新增{tab}</button>
          {message && <span role="alert">{message}</span>}
        </form>
      )}
      {(tab === '卡片' || isEx) && draft.deletions.some(({ uid }) => uid.startsWith('X') === isEx) && (
        <ul className="ct-deletions">{draft.deletions.filter(({ uid }) => uid.startsWith('X') === isEx).map(({ uid, id }) => (
          <li key={uid}>待刪除 {uid} {id} <button onClick={() => updateDraft({ ...draft, deletions: draft.deletions.filter((d) => d.uid !== uid) })}>撤銷刪除</button></li>
        ))}</ul>
      )}
      {(tab === '卡片' || tab === 'Ex 卡') && (
        <>
        <div className="ct-filters" role="group" aria-label="卡片篩選">
          {!isEx && <>
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
            value={query} onChange={(e) => setQuery(e.target.value)} />
          <span role="status">{filtering ? matchingCards.length : visibleCards.length} 張</span>
        </div>
        {orderControls(cardList)}
        <div className={selected ? 'ct-layout ct-with-detail' : 'ct-layout'}>
          {filtering ? (
            <div>
              {matchingCards.length > 0 ? <div className="ct-grid">{matchingCards.map(renderCard)}</div> : <p>找不到符合條件的卡片。</p>}
            </div>
          ) : <div>
            {fixedCards.length > 0 && <div className="ct-grid">{fixedCards.map(renderCard)}</div>}
            <SortableList className="ct-grid ct-sortable" items={sortableCards} getKey={(entry) => entry.base.id} renderItem={renderCard}
              onReorder={(order) => changeField(cardList, 'order', orderOf(cardTable, cardList), order)} />
          </div>}
          {selected && (
            <section className="ct-detail" aria-label={`${selected.uid} 詳細資料`} key={entryKey(selected)}>
              <div className="ct-detail-actions">
                <strong>{selected.uid}</strong>
                {(isEx || selected.added || canDelete(selected.card)) && <button onClick={() => deleteCard(selected)}>刪除卡片</button>}
                <button onClick={() => setSelection(undefined)}>關閉詳細資料</button>
              </div>
              <InspectPanel id={selected.card.id} card={selected.card} />
              {(isEx ? exFields : cardFields).filter((field) => {
                if (selected.edits.some((edit) => edit.field === field)) return true;
                if (['atk', 'def', 'combo'].includes(field)) return selected.card.kind === 'move';
                if (field === 'slot') return selected.card.kind === 'equip';
                if (field === 'duration') return selected.card.kind === 'buff';
                return true;
              }).map((field) => {
                const edit = selected.edits.find((item) => item.field === field);
                return <CardField key={field} prefix={selected.uid[0]} field={field} value={edit ? edit.value : cardValue(selected.card, field)}
                  original={edit?.base} reset={() => editField(selected, field, cardValue(selected.base, field))}
                  onChange={(value) => editField(selected, field, value)} />;
              })}
            </section>
          )}
        </div>
        </>
      )}
      {tab === '角色' && <div className="ct-records">{ALL_CHARACTERS.map((character) => (
        <article key={character.id}>
          <h2>{character.name} <small>{uidById.get('C:' + character.id)}</small></h2>
          {renderFields(uidById.get('C:' + character.id)!, character, characterFields)}
          {draft.edits.some(({ uid, field }) => uid === uidById.get('C:' + character.id) && field === 'cls')
            && <p role="status">更改職業會改變可使用的專用卡。</p>}
          <p><KeywordText text={character.text} /></p>
          {character.awakenText && <p><KeywordText text={character.awakenText} /></p>}
        </article>
      ))}</div>}
      {tab === '關鍵字' && <>
        {orderControls('keywords')}
        <SortableList className="ct-records ct-sortable" items={keywords} getKey={keywordKey}
          onReorder={(order) => changeField('keywords', 'order', orderOf(cardTable, 'keywords'),
            order.map((key) => keywords.find((entry) => keywordKey(entry) === key)!.keyword.name))}
          renderItem={({ uid, keyword, added }) => (
            <article className={added ? 'ct-changed' : undefined}>
              <h2>{(!added && draft.edits.find((edit) => edit.uid === uid && edit.field === 'name')?.value) || keyword.name} <small>{uid}{added ? ' · 新增草稿' : ''}</small></h2>
              {renderFields(uid, keyword, keywordFields, (field, value) => editKeyword(uid, keyword, added, field, value), added)}
              {added && <button data-nodrag onClick={() => updateDraft({
                ...draft,
                additions: draft.additions.filter((entry) => entry.uid !== uid),
                edits: draft.edits.map((edit) => edit.uid === 'keywords'
                  ? { ...edit, value: (edit.value as string[]).filter((id) => id !== keyword.name) } : edit),
              })}>清除此關鍵字草稿</button>}
            </article>
          )} />
      </>}
      <KeywordTooltip />
    </main>
  );
}
