import { useState } from 'react';
import type { Request } from '../../engine/types';
import { CardFace } from './CardFace';
import { SortableList } from './SortableList';

/** 選項對應畫面上的某張卡（例如窗口裡的效果來源）：滑過或聚焦選項時讓那張卡亮起來 */
function hintCard(uid: number | undefined, on: boolean) {
  if (uid === undefined) return;
  document.querySelectorAll(`[data-uid="${uid}"]`).forEach((el) => el.classList.toggle('hint', on));
}

interface Props {
  prompt: Request;
  selected: string[];
  onPick: (key: string) => void;
  onSubmit: (keys: string[]) => void;
}

/** 每個提示物件一個編號：連續兩個提示的選項可能完全相同（同一批表側經驗），不能只靠選項分辨 */
const promptIds = new WeakMap<Request, number>();
let nextPromptId = 0;
const promptId = (prompt: Request) => {
  let id = promptIds.get(prompt);
  if (id === undefined) promptIds.set(prompt, (id = nextPromptId++));
  return id;
};

/** 要把全部選項排好順序的提示：拖曳卡片調整，按確定送出整列（最左邊是第一個） */
function OrderPrompt({ prompt, onSubmit }: Pick<Props, 'prompt' | 'onSubmit'>) {
  const [order, setOrder] = useState(() => prompt.options.map((o) => o.key));
  const byKey = new Map(prompt.options.map((o) => [o.key, o]));
  return (
    <div className="prompt">
      <div className="ptitle">{prompt.title}</div>
      <SortableList
        className="cardrow"
        items={order.map((k) => byKey.get(k)!)}
        getKey={(o) => o.key}
        renderItem={(o) => <CardFace id={o.cardId ?? null} size="md" glow />}
        onReorder={setOrder}
      />
      <div className="btns">
        <span className="muted">拖曳卡片調整順序</span>
        <button className="primary" onClick={() => onSubmit(order)}>確定</button>
      </div>
    </div>
  );
}

/** 目前需要你回應的選擇。必選 1 個時，點選即送出；其餘情況點選切換後按確定。 */
export function PromptPanel({ prompt, selected, onPick, onSubmit }: Props) {
  if (prompt.ordered) {
    // 換了一個提示就重新開始排，不沿用上一個提示的順序
    return <OrderPrompt key={promptId(prompt)} prompt={prompt} onSubmit={onSubmit} />;
  }
  const single = prompt.min === 1 && prompt.max === 1;
  const isCard = (o: Request['options'][number]) => o.cardId !== undefined || o.hidden;
  const cardOpts = prompt.options.filter(isCard);
  const btnOpts = prompt.options.filter((o) => !isCard(o));
  const countText = single ? '' : `（選 ${prompt.min === prompt.max ? prompt.min : `${prompt.min}~${prompt.max}`} 個）`;

  return (
    <div className="prompt">
      <div className="ptitle">{prompt.title}{countText}</div>
      {cardOpts.length > 0 && (
        <div className="cardrow">
          {cardOpts.map((o) => (
            <CardFace
              key={o.key} id={o.cardId ?? null} size="md" glow selected={selected.includes(o.key)}
              onClick={() => (single ? onSubmit([o.key]) : onPick(o.key))}
            />
          ))}
        </div>
      )}
      <div className="btns">
        {btnOpts.map((o) => (
          <button
            key={o.key}
            className={o.key === 'yes' || o.key === 'pass' || o.key === 'end' ? '' : 'primary'}
            onClick={() => (single ? onSubmit([o.key]) : onPick(o.key))}
            onMouseEnter={() => hintCard(o.uid, true)}
            onMouseLeave={() => hintCard(o.uid, false)}
            onFocus={() => hintCard(o.uid, true)}
            onBlur={() => hintCard(o.uid, false)}
          >
            {o.label}
          </button>
        ))}
        {!single && (
          <button
            className="primary"
            disabled={selected.length < prompt.min || selected.length > prompt.max}
            onClick={() => onSubmit(selected)}
          >
            {selected.length === 0 && prompt.min === 0 ? '略過' : `確定（${selected.length}）`}
          </button>
        )}
      </div>
    </div>
  );
}
