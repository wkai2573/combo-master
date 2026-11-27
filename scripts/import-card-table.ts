import { closeSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyDiff } from '../src/data/cardTableDraft';
import type { CardTableData } from '../src/data/cardTableData';
import { hasEffect } from '../src/engine/effects';

const output = fileURLToPath(new URL('../src/data/cardTable.json', import.meta.url));
const source = process.argv[2];
if (!source || process.argv.length !== 3) throw new Error('用法：bun run table <差異檔>');

const input: unknown = JSON.parse(readFileSync(source, 'utf8'));
const pending = output + '.import';
const lockPath = output + '.lock';
const lock = openSync(lockPath, 'wx');
try {
  const before = readFileSync(output, 'utf8');
  const baseline = JSON.parse(before) as CardTableData;
  const { table, notes } = applyDiff(baseline, input, { hasEffect });
  if (JSON.stringify(table) !== JSON.stringify(baseline)) {
    writeFileSync(pending, JSON.stringify(table, null, 2) + '\n', { flag: 'wx' });
    renameSync(pending, output);
    console.log(`已寫入 ${output}`);
  } else {
    console.log('卡表資料無變更');
  }
  for (const note of notes) console.log('注意：' + note);
} finally {
  try {
    rmSync(pending, { force: true });
  } finally {
    closeSync(lock);
    rmSync(lockPath);
  }
}
