import { CHANGE_TYPE_LABEL, CHANGELOG } from '../../data/changelog';
import { Modal } from './Modal';

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <div className="changelog">
        <h3>更新日誌</h3>
        {CHANGELOG.map((e) => (
          <section key={e.version}>
            <h4>
              v{e.version} <span className="muted">・{e.date}</span>
            </h4>
            <ul>
              {e.items.map((it, i) => (
                <li key={i}>
                  <span className={`tag ${it.type}`}>{CHANGE_TYPE_LABEL[it.type]}</span>
                  {it.text}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <div style={{ marginTop: 12 }}>
          <button onClick={onClose}>關閉</button>
        </div>
      </div>
    </Modal>
  );
}
