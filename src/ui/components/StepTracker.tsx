import { STEP_GROUPS as GROUPS, STEP_ORDER as ORDER } from '../../data/turnSteps';
import type { Phase, PlayerId } from '../../engine/types';

export function StepTracker({ phase, waitingFor, me }: { phase: Phase; waitingFor: PlayerId | null; me: PlayerId }) {
  const at = phase === '結束' ? ORDER.length : ORDER.indexOf(phase);
  const cur = GROUPS.flatMap((g) => g.steps).find((s) => s.phase === phase);
  const turnNote =
    waitingFor === null || (phase !== '先手' && phase !== '反擊') ? '' : waitingFor === me ? '　輪到你' : '　輪到對手';

  return (
    <div className="steps" aria-label="回合步驟">
      <ol>
        {GROUPS.map((g) => {
          const idx = g.steps.map((s) => ORDER.indexOf(s.phase));
          const state = idx.includes(at) ? 'now' : Math.max(...idx) < at ? 'done' : 'next';
          return (
            <li key={g.label} className={`grp ${state}${g.steps.length > 1 ? ' multi' : ''}`}>
              {g.steps.length === 1 ? (
                <span className="st">{g.label}</span>
              ) : (
                <>
                  <span className="glabel">{g.label}</span>
                  <span className="subs">
                    {g.steps.map((s, i) => {
                      const o = ORDER.indexOf(s.phase);
                      return (
                        <span key={s.phase} className={`st ${o === at ? 'now' : o < at ? 'done' : 'next'}`}>
                          {i > 0 && <i className="arr">›</i>}
                          {s.phase}
                        </span>
                      );
                    })}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
      <div className="hint">
        {cur ? (
          <>
            <b>{cur.phase}</b>：{cur.hint}
            {turnNote && <span className="who">{turnNote}</span>}
          </>
        ) : (
          '\u00a0'
        )}
      </div>
    </div>
  );
}
