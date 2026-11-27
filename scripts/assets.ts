// 用法見 README 的「資產」章節。
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { download, pack, publish, type Releases, type Repo } from './assetsLib';

const USAGE = [
  '用法：',
  '  bun run assets:pack',
  '  bun run assets:publish [--allow-removal]',
  '  bun run assets:download [tag] [--force]',
].join('\n');

const root = fileURLToPath(new URL('..', import.meta.url));
const run = (command: string, args: string[]) => execFileSync(command, args, { cwd: root, encoding: 'utf8' }).trim();

const repo: Repo = {
  isDirty: () => run('git', ['status', '--porcelain']) !== '',
  head: () => run('git', ['rev-parse', 'HEAD']),
  isPushed: (sha) => {
    run('git', ['fetch', '--quiet', 'origin', 'main']);
    const { status } = spawnSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main'], { cwd: root });
    if (status !== 0 && status !== 1) throw new Error('無法比對 origin/main');
    return status === 0;
  },
};

const releases: Releases = {
  listTags: () => (JSON.parse(run('gh', ['release', 'list', '--exclude-drafts', '--limit', '1000', '--json', 'tagName'])) as
    { tagName: string }[]).map((release) => release.tagName),
  download: (tag, name) => {
    const dir = mkdtempSync(join(tmpdir(), 'combo-master-assets-'));
    try {
      run('gh', ['release', 'download', tag, '--pattern', name, '--dir', dir]);
      return readFileSync(join(dir, name));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  create: (tag, sha, files, notes) => {
    execFileSync('gh', ['release', 'create', tag, ...files, '--target', sha, '--title', tag, '--notes', notes],
      { cwd: root, stdio: 'inherit' });
  },
  remove: (tag) => {
    run('gh', ['release', 'delete', tag, '--yes', '--cleanup-tag']);
  },
};

function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
}

const [command, ...rest] = process.argv.slice(2);
const flags = rest.filter((arg) => arg.startsWith('--'));
const positional = rest.filter((arg) => !arg.startsWith('--'));

/** 打錯的參數直接拒絕，不靜默忽略 */
function accepts(allowedFlags: string[], maxPositional: number): boolean {
  return flags.every((flag) => allowedFlags.includes(flag)) && positional.length <= maxPositional;
}

try {
  if (command === 'pack' && accepts([], 0)) {
    const result = pack(root);
    console.log('已打包 ' + result.count + ' 個檔案（' + (result.size / 1024 ** 2).toFixed(1) + ' MB）：' + result.zipPath);
  } else if (command === 'publish' && accepts(['--allow-removal'], 0)) {
    const tag = publish({ root, repo, releases, day: today(), allowRemoval: flags.includes('--allow-removal'), log: console.log });
    console.log('已發布 ' + tag);
  } else if (command === 'download' && accepts(['--force'], 1)) {
    download({ root, releases, tag: positional[0], force: flags.includes('--force'), log: console.log });
  } else {
    console.error(USAGE);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
