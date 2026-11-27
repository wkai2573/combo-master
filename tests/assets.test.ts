import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  download, latestTag, MANIFEST_NAME, nextTag, pack, parseManifest, publish, scanAssets, ZIP_NAME,
  type Releases, type Repo,
} from '../scripts/assetsLib';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function project(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'assets-test-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const read = (root: string, path: string) => readFileSync(join(root, path), 'utf8');

/** 記憶體裡的 Releases，記下每次發布與下載 */
function fakeReleases() {
  const store = new Map<string, Map<string, Uint8Array>>();
  const created: string[] = [];
  const downloaded: string[] = [];
  const releases: Releases = {
    listTags: () => [...store.keys()],
    download: (tag, name) => {
      downloaded.push(name);
      const data = store.get(tag)?.get(name);
      if (!data) throw new Error('沒有 ' + tag + '/' + name);
      return data;
    },
    create: (tag, _sha, files) => {
      created.push(tag);
      store.set(tag, new Map(files.map((file) => [basename(file), readFileSync(file)])));
    },
  };
  return { releases, store, created, downloaded };
}

const clean: Repo = { isDirty: () => false, head: () => 'abc', isPushed: () => true };
const sample = { 'assets/originals/法師/A58-Explosion!.png': '原圖', 'assets/portraits/A1.webp': '插畫' };
const day = '2026-11-27';
const log = () => {};

describe('資產清單與 tag', () => {
  it('清單包含 assets 底下所有檔案，略過系統檔與 assets 以外的檔案', () => {
    const root = project({ ...sample, 'assets/Thumbs.db': 'x', 'src/a.ts': 'x' });
    expect(Object.keys(scanAssets(root).files).sort()).toEqual(Object.keys(sample).sort());
  });

  it('指向 assets 以外的清單路徑會被拒絕', () => {
    for (const path of ['assets/../a', '../a', 'src/a', 'assets\\a', 'C:/a', 'assets//a']) {
      const data = new TextEncoder().encode(JSON.stringify({ files: { [path]: 'a'.repeat(64) } }));
      expect(() => parseManifest(data), path).toThrow('不允許的路徑');
    }
  });

  it('最新版依日期和序號判斷，忽略其他 tag', () => {
    expect(latestTag(['assets-2026-11-27.10', 'v9', 'assets-2026-11-27.9', 'assets-2026-11-26'])).toBe('assets-2026-11-27.10');
  });

  it('同一天第二次起加上序號', () => {
    expect(nextTag(['assets-2026-11-26'], day)).toBe('assets-2026-11-27');
    expect(nextTag(['assets-2026-11-27'], day)).toBe('assets-2026-11-27.2');
    expect(nextTag(['assets-2026-11-27', 'assets-2026-11-27.2'], day)).toBe('assets-2026-11-27.3');
  });
});

describe('發布', () => {
  it('上傳資產包和清單', () => {
    const fake = fakeReleases();
    expect(publish({ root: project(sample), repo: clean, releases: fake.releases, day, log })).toBe('assets-2026-11-27');
    expect([...fake.store.get('assets-2026-11-27')!.keys()].sort()).toEqual([MANIFEST_NAME, ZIP_NAME].sort());
  });

  it.each([
    ['有未提交的修改', { ...clean, isDirty: () => true }, '尚未 commit'],
    ['commit 還沒推送', { ...clean, isPushed: () => false }, '還沒推到 origin/main'],
  ])('%s時不上傳', (_name, repo, message) => {
    const fake = fakeReleases();
    expect(() => publish({ root: project(sample), repo, releases: fake.releases, day, log })).toThrow(message);
    expect(fake.created).toEqual([]);
  });

  it('內容和最新版相同時不上傳，有改動才發新版', () => {
    const fake = fakeReleases();
    const root = project(sample);
    const options = { root, repo: clean, releases: fake.releases, day, log };
    publish(options);
    expect(() => publish(options)).toThrow('完全相同');
    writeFileSync(join(root, 'assets/portraits/A1.webp'), '新插畫');
    expect(publish(options)).toBe('assets-2026-11-27.2');
  });

  it('本機缺少上一版的檔案時停下來，明確允許才發布', () => {
    const fake = fakeReleases();
    publish({ root: project(sample), repo: clean, releases: fake.releases, day, log });
    const options = { root: project({ 'assets/portraits/A1.webp': '插畫' }), repo: clean, releases: fake.releases, day, log };
    expect(() => publish(options)).toThrow('缺少最新一版');
    expect(fake.created).toHaveLength(1);
    publish({ ...options, allowRemoval: true });
    expect(fake.created).toHaveLength(2);
  });

  it('超過單檔上限或沒有任何資產時不上傳', () => {
    const fake = fakeReleases();
    const options = { repo: clean, releases: fake.releases, day, log };
    expect(() => publish({ ...options, root: project(sample), maxSize: 10 })).toThrow('超過');
    expect(() => publish({ ...options, root: project() })).toThrow('沒有任何檔案');
    expect(fake.created).toEqual([]);
  });
});

describe('下載還原', () => {
  function published() {
    const fake = fakeReleases();
    publish({ root: project(sample), repo: clean, releases: fake.releases, day, log });
    fake.downloaded.length = 0;
    return fake;
  }

  it('空的專案可以完整還原，含中文與符號檔名', () => {
    const fake = published();
    const root = project();
    expect(download({ root, releases: fake.releases, log }).added).toHaveLength(2);
    for (const [path, text] of Object.entries(sample)) expect(read(root, path)).toBe(text);
  });

  it('預設保留本機不同的檔案，只補缺少的，也不刪多出來的', () => {
    const fake = published();
    const root = project({ 'assets/portraits/A1.webp': '本機新版', 'assets/portraits/A2.webp': '尚未發布' });
    const result = download({ root, releases: fake.releases, log });
    expect(result.conflicts).toEqual(['assets/portraits/A1.webp']);
    expect(read(root, 'assets/portraits/A1.webp')).toBe('本機新版');
    expect(read(root, 'assets/portraits/A2.webp')).toBe('尚未發布');
    expect(existsSync(join(root, 'assets/originals/法師/A58-Explosion!.png'))).toBe(true);
  });

  it('加上 force 才覆蓋', () => {
    const fake = published();
    const root = project({ 'assets/portraits/A1.webp': '本機新版', 'assets/portraits/A2.webp': '尚未發布' });
    expect(download({ root, releases: fake.releases, force: true, log }).overwritten).toEqual(['assets/portraits/A1.webp']);
    expect(read(root, 'assets/portraits/A1.webp')).toBe('插畫');
    expect(read(root, 'assets/portraits/A2.webp')).toBe('尚未發布');
  });

  it('本機已經完整時不下載資產包', () => {
    const fake = published();
    download({ root: project(sample), releases: fake.releases, log });
    expect(fake.downloaded).toEqual([MANIFEST_NAME]);
  });

  it('資產包和清單不符時不寫入任何檔案', () => {
    const fake = published();
    fake.store.get('assets-2026-11-27')!.set(ZIP_NAME, readFileSync(pack(project({ ...sample, 'assets/portraits/A1.webp': '被換掉' })).zipPath));
    const root = project();
    expect(() => download({ root, releases: fake.releases, log })).toThrow('和清單不符');
    expect(existsSync(join(root, 'assets'))).toBe(false);
  });
});
