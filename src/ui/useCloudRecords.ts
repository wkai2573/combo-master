import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RecordStore, VersionCount } from '../stats/cloud';
import { readRecordCache, writeRecordCache } from '../stats/recordCache';
import type { BattleRecord } from '../stats/records';
import { compareVersion, defaultVersionList } from '../stats/summary';

const newestFirst = (list: VersionCount[]): VersionCount[] => [...list].sort((a, b) => compareVersion(b.version, a.version));

export type CloudStatus = 'unavailable' | 'loading' | 'ready' | 'error';

export interface CloudRecords {
  status: CloudStatus;
  error: string;
  /** 畫面上有資料是上次成功取得的本機備援，不是剛從伺服器取得的 */
  stale: boolean;
  versions: VersionCount[];
  /** 目前勾選的版本：沒動過是預設（勝率統計最低版本以上的所有版本） */
  chosen: string[];
  /** 勾選的版本的全部戰績（兩種對手類型都在，對手類型由畫面再篩） */
  records: BattleRecord[];
  retry(): void;
}

/**
 * 戰績頁的資料來源：先取各版本的場數，再依勾選的版本向伺服器取戰績，已經取過的版本不重取。
 * 新資料到之前先用本機備援（上次成功取得的資料）填畫面；取得失敗時顯示錯誤並繼續用備援。
 * store 是 null 代表沒有設定伺服器。
 */
export function useCloudRecords(store: RecordStore | null, picked: string[] | null): CloudRecords {
  const cached = useMemo(() => (store ? readRecordCache() : null), [store]);
  const [versions, setVersions] = useState<VersionCount[]>(newestFirst(cached?.versions ?? []));
  // 剛從伺服器取得的戰績，鍵是版本；備援另外放在 cached
  const [fresh, setFresh] = useState<Record<string, BattleRecord[]>>({});
  const [status, setStatus] = useState<CloudStatus>(store ? 'loading' : 'unavailable');
  const [error, setError] = useState('');
  // 各版本場數是不是已經從伺服器取得（取得之前不知道有哪些版本可以取）
  const [versionsFresh, setVersionsFresh] = useState(false);
  const [reload, setReload] = useState(0);

  const chosen = useMemo(() => picked ?? defaultVersionList(versions), [picked, versions]);

  const fail = (e: unknown) => {
    setStatus('error');
    setError(e instanceof Error ? e.message : '取得戰績失敗');
  };

  // 取各版本的場數；重試時重新來過
  useEffect(() => {
    if (!store) return;
    let alive = true;
    setStatus('loading');
    setError('');
    setFresh({});
    setVersionsFresh(false);
    store.versions().then((list) => {
      if (!alive) return;
      setVersions(newestFirst(list));
      setVersionsFresh(true);
    }, (e: unknown) => alive && fail(e));
    return () => {
      alive = false;
    };
  }, [store, reload]);

  // 依勾選的版本取戰績：只取還沒取過的
  const missing = useMemo(() => (versionsFresh ? chosen.filter((v) => !(v in fresh)) : []), [versionsFresh, chosen, fresh]);
  useEffect(() => {
    if (!store || !versionsFresh) return;
    if (missing.length === 0) {
      setStatus('ready');
      return;
    }
    let alive = true;
    setStatus('loading');
    store.fetchRecords(missing).then((list) => {
      if (!alive) return;
      const next: Record<string, BattleRecord[]> = Object.fromEntries(missing.map((v) => [v, [] as BattleRecord[]]));
      for (const r of list) (next[r.version] ??= []).push(r);
      setFresh((prev) => ({ ...prev, ...next }));
      setError('');
    }, (e: unknown) => alive && fail(e));
    return () => {
      alive = false;
    };
  }, [store, versionsFresh, missing.join(',')]);

  // 成功取得的資料寫進本機備援
  useEffect(() => {
    if (status === 'ready' && versionsFresh) writeRecordCache({ versions, byVersion: fresh });
  }, [status, versionsFresh, versions, fresh]);

  const shown = useMemo(() => chosen.map((v) => ({ v, list: fresh[v] ?? cached?.byVersion[v] })), [chosen, fresh, cached]);
  const records = useMemo(() => shown.flatMap((s) => s.list ?? []), [shown]);
  const stale = shown.some((s) => !(s.v in fresh) && s.list !== undefined);
  const retry = useCallback(() => setReload((n) => n + 1), []);
  return { status, error, stale, versions, chosen, records, retry };
}
