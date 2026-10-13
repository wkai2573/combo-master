import { useEffect, useState } from 'react';
import { useCoarsePointer } from '../layoutMode';
import type { Request } from '../../engine/types';
import { CardFace } from './CardFace';
import { confirmButton, orderPromptButtons } from '../promptButtons';
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
  /** 這些牌已經在手牌列上可以直接選或拖（手機版面），提示欄不再重複畫出 */
  skipUids?: Set<number>;
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
export function PromptPanel({ prompt, selected, onPick, onSubmit, skipUids }: Props) {
  // 觸控：必選 1 個的卡片選項，第一下只選取，同一張再點一下才送出
  const coarse = useCoarsePointer();
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => setArmed(null), [prompt]);
  if (prompt.ordered) {
    // 換了一個提示就重新開始排，不沿用上一個提示的順序
    return <OrderPrompt key={promptId(prompt)} prompt={prompt} onSubmit={onSubmit} />;
  }
  const single = prompt.min === 1 && prompt.max === 1;
  const isCard = (o: Request['options'][number]) => o.cardId !== undefined || o.hidden;
  const onHand = (o: Request['options'][number]) => o.uid !== undefined && !!skipUids?.has(o.uid);
  const cardOpts = prompt.options.filter((o) => isCard(o) && !onHand(o));
  const btnOpts = prompt.options.filter((o) => !isCard(o));
  const confirm = confirmButton(selected.length, prompt.min, prompt.max);
  const countText = single ? '' : `（選 ${prompt.min === prompt.max ? prompt.min : `${prompt.min}~${prompt.max}`} 個）`;

  return (
    <div className="prompt">
      <div className="ptitle">{prompt.title}{countText}{armed && '　再點一下送出'}</div>
      {cardOpts.length > 0 && (
        <div className="cardrow">
          {cardOpts.map((o) => (
            <CardFace
              key={o.key} id={o.cardId ?? null} size="md" glow selected={selected.includes(o.key) || armed === o.key}
              onClick={() => (single ? (coarse && armed !== o.key ? setArmed(o.key) : onSubmit([o.key])) : onPick(o.key))}
            />
          ))}
        </div>
      )}
      <div className="btns">
        {orderPromptButtons(btnOpts).map(({ opt: o, primary }) => (
          <button
            key={o.key}
            className={primary ? 'primary' : ''}
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
            className={confirm.primary ? 'primary' : ''}
            disabled={selected.length < prompt.min || selected.length > prompt.max}
            onClick={() => onSubmit(selected)}
          >
            {confirm.label}
          </button>
        )}
      </div>
    </div>
  );
}
