import type { Request } from '../../engine/types';
import { CardFace } from './CardFace';

interface Props {
  prompt: Request;
  selected: string[];
  onPick: (key: string) => void;
  onSubmit: (keys: string[]) => void;
}

/** 目前需要你回應的選擇。必選 1 個時，點選即送出；其餘情況點選切換後按確定。 */
export function PromptPanel({ prompt, selected, onPick, onSubmit }: Props) {
  const single = prompt.min === 1 && prompt.max === 1;
  const cardOpts = prompt.options.filter((o) => o.cardId);
  const btnOpts = prompt.options.filter((o) => !o.cardId);
  const countText = single ? '' : `（選 ${prompt.min === prompt.max ? prompt.min : `${prompt.min}~${prompt.max}`} 個）`;

  return (
    <div className="prompt">
      <div className="ptitle">{prompt.title}{countText}</div>
      {cardOpts.length > 0 && (
        <div className="cardrow">
          {cardOpts.map((o) => (
            <CardFace
              key={o.key} id={o.cardId!} size="md" glow selected={selected.includes(o.key)}
              onClick={() => (single ? onSubmit([o.key]) : onPick(o.key))}
            />
          ))}
        </div>
      )}
      <div className="btns">
        {btnOpts.map((o) => (
          <button
            key={o.key}
            className={o.key === 'yes' || o.key === 'pass' ? '' : 'primary'}
            onClick={() => (single ? onSubmit([o.key]) : onPick(o.key))}
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
