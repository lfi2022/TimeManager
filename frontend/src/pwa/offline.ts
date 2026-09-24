export type PendingMutation = {
  id: string;
  url: string;
  method: string;
  body: unknown;
};
const dbName = 'tempopoint-offline';
function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore('mutations', { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function queue(m: Omit<PendingMutation, 'id'>) {
  const item = { ...m, id: crypto.randomUUID() };
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const r = db
      .transaction('mutations', 'readwrite')
      .objectStore('mutations')
      .put(item);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
  return item;
}
