import { parseFaceLibrary } from '../cardLayout/library';
import type { FaceLibrary } from '../cardLayout/model';

let database: Promise<IDBDatabase> | undefined;
function openStorage() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('combo-master-card-layouts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('library');
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        database = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('卡面資料庫正由另一個分頁使用。'));
  }).catch((error) => {
    database = undefined;
    throw error;
  });
  return database;
}

export async function loadFaceDraft(): Promise<FaceLibrary | undefined> {
  const db = await openStorage();
  return new Promise((resolve, reject) => {
    const request = db.transaction('library', 'readonly').objectStore('library').get('draft');
    request.onsuccess = () => {
      try {
        resolve(request.result === undefined ? undefined : parseFaceLibrary(request.result));
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveFaceDraft(value: FaceLibrary): Promise<void> {
  const db = await openStorage();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('library', 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.objectStore('library').put(value, 'draft');
  });
}
