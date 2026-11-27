import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseFaceLibrary } from '../src/cardLayout/library';
import { cardTable } from '../src/data/cardTableData';

const source = process.argv[2];
if (!source) {
  console.error('用法：bun run faces <卡面設定.json>');
  process.exit(1);
}

try {
  const library = parseFaceLibrary(JSON.parse(await readFile(source, 'utf8')));
  const cards = Object.keys(library.cards);
  const unknown = cards.filter((uid) => !Object.hasOwn(cardTable.uids, uid));
  if (unknown.length) throw new Error('卡表找不到 ' + unknown.join('、') + '。請先匯入卡表差異檔並確認永久編號。');

  const destination = fileURLToPath(new URL('../src/cardLayout/game-faces.json', import.meta.url));
  const temp = destination + '.' + randomUUID() + '.tmp';
  const data = JSON.stringify(library, null, 2) + '\n';
  if ((await readFile(destination, 'utf8')) !== data) {
    try {
      await writeFile(temp, data, { flag: 'wx' });
      await rename(temp, destination);
    } finally {
      await rm(temp, { force: true });
    }
  }
  console.log('已匯入 ' + cards.length + ' 張卡面設定與 ' + library.templates.length + ' 個自訂範本。');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
