// 資產打包、發布與還原。git 與 GitHub Releases 由呼叫端傳入，命令列接線在 assets.ts。
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { unzipSync, zipSync, type Zippable } from 'fflate';

export const ASSET_DIR = 'assets';
export const OUTPUT_DIR = 'exports';
export const ZIP_NAME = 'combo-master-assets.zip';
export const MANIFEST_NAME = 'assets-manifest.json';
/** GitHub Release 的單一檔案必須小於 2 GiB */
export const MAX_RELEASE_FILE = 2 * 1024 ** 3;
/** 發布後保留的資產版本數 */
export const KEEP_RELEASES = 3;

const SYSTEM_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
const TAG = /^assets-(\d{4}-\d{2}-\d{2})(?:\.(\d+))?$/;

/** 資產包內容清單：以專案根目錄為基準的路徑對應 SHA-256 */
export interface Manifest {
  files: Record<string, string>;
}

export interface Repo {
  isDirty(): boolean;
  head(): string;
  isPushed(sha: string): boolean;
}

export interface Releases {
  listTags(): string[];
  download(tag: string, name: string): Uint8Array;
  create(tag: string, sha: string, files: string[], notes: string): void;
  /** 刪除 Release 和它的 tag */
  remove(tag: string): void;
}

type Log = (message: string) => void;

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const megabytes = (bytes: number) => (bytes / 1024 ** 2).toFixed(1) + ' MB';

function listAssetFiles(root: string, dir = ASSET_DIR): string[] {
  if (!existsSync(join(root, dir))) return [];
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = dir + '/' + entry.name;
    if (entry.isDirectory()) return listAssetFiles(root, path);
    return entry.isFile() && !SYSTEM_FILES.has(entry.name) ? [path] : [];
  }).sort();
}

export function scanAssets(root: string): Manifest {
  return { files: Object.fromEntries(listAssetFiles(root).map((path) => [path, sha256(readFileSync(join(root, path)))])) };
}

/** 清單來自下載的檔案，寫入本機前要擋掉指向 assets/ 以外的路徑 */
function isSafePath(path: string): boolean {
  const parts = path.split('/');
  return parts[0] === ASSET_DIR && parts.length > 1 && !/[\\:]/.test(path)
    && parts.every((part) => part !== '' && part !== '.' && part !== '..');
}

export function parseManifest(data: Uint8Array): Manifest {
  const value = JSON.parse(new TextDecoder().decode(data)) as Partial<Manifest> | null;
  const files = value?.files;
  if (!files || typeof files !== 'object') throw new Error('資產清單格式錯誤：缺少 files');
  for (const [path, hash] of Object.entries(files)) {
    if (!isSafePath(path)) throw new Error('資產清單含有不允許的路徑：' + path);
    if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) throw new Error('資產清單的雜湊格式錯誤：' + path);
  }
  return { files };
}

function compareTags(a: string, b: string): number {
  const [, dayA, numberA = '1'] = TAG.exec(a)!;
  const [, dayB, numberB = '1'] = TAG.exec(b)!;
  return dayA.localeCompare(dayB) || Number(numberA) - Number(numberB);
}

/** 只挑出資產版本的 tag，由舊到新 */
const assetTags = (tags: string[]) => tags.filter((tag) => TAG.test(tag)).sort(compareTags);

export function latestTag(tags: string[]): string | undefined {
  return assetTags(tags).at(-1);
}

/** 在新版上傳成功後呼叫。刪不掉的不影響這次發布，下次發布時仍在清單裡，會再試一次 */
function pruneReleases(releases: Releases, tags: string[], log: Log) {
  for (const tag of assetTags(tags).slice(0, -KEEP_RELEASES)) {
    try {
      releases.remove(tag);
      log('已刪除舊版 ' + tag);
    } catch (error) {
      log('舊版 ' + tag + ' 刪除失敗，下次發布時再試：' + (error instanceof Error ? error.message : error));
    }
  }
}

export function nextTag(tags: string[], day: string): string {
  const last = latestTag(tags.filter((tag) => TAG.exec(tag)?.[1] === day));
  if (!last) return 'assets-' + day;
  return 'assets-' + day + '.' + (Number(TAG.exec(last)![2] ?? '1') + 1);
}

export function pack(root: string) {
  const entries: Zippable = {};
  const manifest: Manifest = { files: {} };
  for (const path of listAssetFiles(root)) {
    const data = readFileSync(join(root, path));
    manifest.files[path] = sha256(data);
    // 圖片本身已壓縮，直接封存
    entries[path] = [data, { level: 0 }];
  }
  const count = Object.keys(manifest.files).length;
  if (!count) throw new Error(ASSET_DIR + '/ 裡沒有任何檔案');
  const zip = zipSync(entries);
  const zipPath = join(root, OUTPUT_DIR, ZIP_NAME);
  const manifestPath = join(root, OUTPUT_DIR, MANIFEST_NAME);
  mkdirSync(join(root, OUTPUT_DIR), { recursive: true });
  writeFileSync(zipPath, zip);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return { manifest, zipPath, manifestPath, count, size: zip.length };
}

export interface PublishOptions {
  root: string;
  repo: Repo;
  releases: Releases;
  /** 本地日期，格式 YYYY-MM-DD */
  day: string;
  allowRemoval?: boolean;
  maxSize?: number;
  log: Log;
}

export function publish({ root, repo, releases, day, allowRemoval, maxSize = MAX_RELEASE_FILE, log }: PublishOptions): string {
  if (repo.isDirty()) throw new Error('有尚未 commit 的修改。請先 commit 再發布。');
  const head = repo.head();
  if (!repo.isPushed(head)) throw new Error('目前的 commit 還沒推到 origin/main。請先推送（推送會部署正式站）再發布。');

  const local = scanAssets(root).files;
  const tags = releases.listTags();
  const previous = latestTag(tags);
  if (previous) {
    const remote = parseManifest(releases.download(previous, MANIFEST_NAME)).files;
    const removed = Object.keys(remote).filter((path) => !Object.hasOwn(local, path));
    const unchanged = !removed.length && Object.keys(local).length === Object.keys(remote).length
      && Object.entries(local).every(([path, hash]) => remote[path] === hash);
    if (unchanged) throw new Error('資產內容和最新一版 ' + previous + ' 完全相同，不需要發布。');
    // 沒還原完整就發布，最新版會缺檔
    if (removed.length && !allowRemoval) {
      throw new Error([
        '本機缺少最新一版 ' + previous + ' 的 ' + removed.length + ' 個檔案：',
        ...removed.map((path) => '  ' + path),
        '如果是還沒下載，請先執行 bun run assets:download。確定要移除這些檔案，加上 --allow-removal。',
      ].join('\n'));
    }
  }

  const result = pack(root);
  if (result.size >= maxSize) {
    throw new Error('資產包 ' + megabytes(result.size) + ' 超過 GitHub Release 單檔上限 ' + megabytes(maxSize) + '，需要先決定分檔方式。');
  }
  const tag = nextTag(tags, day);
  log('上傳 ' + tag + '：' + result.count + ' 個檔案，' + megabytes(result.size));
  releases.create(tag, head, [result.zipPath, result.manifestPath],
    '資產包：' + result.count + ' 個檔案，' + megabytes(result.size) + '。\n\n還原方式：`bun run assets:download ' + tag + '`');
  pruneReleases(releases, [...tags, tag], log);
  return tag;
}

export interface DownloadOptions {
  root: string;
  releases: Releases;
  tag?: string;
  force?: boolean;
  log: Log;
}

export function download({ root, releases, tag, force, log }: DownloadOptions) {
  const target = tag ?? latestTag(releases.listTags());
  if (!target) throw new Error('GitHub Releases 還沒有任何資產包。');
  const remote = parseManifest(releases.download(target, MANIFEST_NAME)).files;
  const added: string[] = [];
  const different: string[] = [];
  for (const [path, hash] of Object.entries(remote)) {
    if (!existsSync(join(root, path))) added.push(path);
    else if (sha256(readFileSync(join(root, path))) !== hash) different.push(path);
  }
  const overwritten = force ? different : [];
  const conflicts = force ? [] : different;
  const wanted = [...added, ...overwritten];

  if (wanted.length) {
    const selected = new Set(wanted);
    const entries = unzipSync(releases.download(target, ZIP_NAME), { filter: (file) => selected.has(file.name) });
    // 全部核對通過才開始寫入
    for (const path of wanted) {
      if (!entries[path] || sha256(entries[path]) !== remote[path]) throw new Error('資產包內容和清單不符：' + path);
    }
    for (const path of wanted) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), entries[path]);
    }
  }

  log(target + '：新增 ' + added.length + ' 個，覆蓋 ' + overwritten.length + ' 個。');
  if (conflicts.length) {
    log([
      '下列 ' + conflicts.length + ' 個檔案和資產包內容不同，保留本機版本（加 --force 覆蓋）：',
      ...conflicts.map((path) => '  ' + path),
    ].join('\n'));
  }
  return { tag: target, added, overwritten, conflicts };
}
