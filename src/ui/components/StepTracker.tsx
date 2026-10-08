import type { Phase, PlayerId } from '../../engine/types';

interface Step {
  phase: Phase;
  hint: string;
}

interface Group {
  label: string;
  steps: Step[];
}

// 一個回合的步驟流動：重置 → 戰鬥（先手→反擊→追擊→傷害→歸還）→ 抽牌 → 爆發 → 增益 → 回合結束
const GROUPS: Group[] = [
  { label: '重置', steps: [{ phase: '重置', hint: '把橫置的卡改回重置狀態' }] },
  {
    label: '戰鬥',
    steps: [
      { phase: '先手', hint: '先攻出 1 張招式' },
      { phase: '反擊', hint: '後攻先，輪流出招或收招' },
      { phase: '追擊', hint: '雙方翻牌組頂，不在範圍內才成功' },
      { phase: '傷害', hint: '對方攻擊 − 我方防禦＝放進怒氣區的張數' },
      { phase: '歸還', hint: '招式與追擊卡依序放進經驗區' },
    ],
  },
  { label: '抽牌', steps: [{ phase: '抽牌', hint: '各抽 1 張' }] },
  { label: '爆發', steps: [{ phase: '爆發', hint: '可把手牌放進經驗區，再抽 2 張' }] },
  { label: '增益', steps: [{ phase: '增益', hint: '可打出 1 張裝備或增益' }] },
  { label: '回合結束', steps: [{ phase: '回合結束', hint: '交換先後攻，進入下一回合' }] },
];

const ORDER: Phase[] = GROUPS.flatMap((g) => g.steps.map((s) => s.phase));

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
