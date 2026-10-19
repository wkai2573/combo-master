import { useState } from 'react';
import { doneLessons, recommendedNext } from '../../tutorial/completion';
import { groupLessons, LESSONS } from '../../tutorial/lessons';

/** 教學課程清單：每一課一列，依分組分段，任何一課都能直接進 */
export function Lessons({ onStart, onBack }: { onStart: (no: number) => void; onBack: () => void }) {
  // 回到清單時會重新掛載，所以剛完成的課會顯示完成標記
  const [done] = useState(() => doneLessons(LESSONS.map((l) => l.no)));
  const next = recommendedNext(LESSONS.map((l) => l.no), done);
  return (
    <div className="page narrow lessons">
      <div className="row" style={{ marginBottom: 10 }}>
        <button onClick={onBack}>← 返回</button>
        <h2 style={{ margin: 0 }}>教學</h2>
      </div>
      {groupLessons().map((section) => (
        <section key={section.group} className="lessongroup">
          <h3 className="lessongrouptitle">{section.group}</h3>
          <div className="lessonlist">
            {section.lessons.map((l) => (
              <button key={l.no} className={`lesson${done.has(l.no) ? ' done' : ''}`} onClick={() => onStart(l.no)}>
                <span className="lessonmark" aria-label={done.has(l.no) ? '已完成' : '尚未完成'}>{done.has(l.no) ? '✓' : l.no}</span>
                <span className="lessonbody">
                  <b>
                    第 {l.no} 課　{l.title}
                    {next === l.no && <i className="menu-tag">推薦下一課</i>}
                  </b>
                  <span>{l.blurb}</span>
                </span>
                <span className="lessonmin">約 {l.minutes} 分鐘</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
