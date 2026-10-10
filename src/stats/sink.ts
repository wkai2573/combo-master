import type { BattleRecord } from './records';
import { defaultUploader } from './upload';

/**
 * 對局結束時戰績的去向。預設交給上傳器（存補傳佇列並上傳到雲端）；
 * 測試可以換成自己的接收函式。只有持有引擎的一方（單機與房主）會呼叫它。
 */
export type RecordSink = (record: BattleRecord) => void;

let sink: RecordSink = (record) => defaultUploader().submit(record);

export const submitRecord: RecordSink = (record) => sink(record);

/** 換掉接收函式，回傳還原的函式 */
export function setRecordSink(next: RecordSink): () => void {
  const prev = sink;
  sink = next;
  return () => {
    sink = prev;
  };
}
