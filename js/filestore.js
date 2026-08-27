// Persistência opcional via File System Access API.
//
// Por padrão este app salva no IndexedDB do navegador — mas no Chrome/Edge
// TODAS as páginas abertas via file:// compartilham o MESMO IndexedDB
// (não é isolado por pasta/arquivo como se poderia imaginar). Isso significa
// que abrir uma cópia diferente deste app (outra pasta, um clone de teste, etc.)
// pode sobrescrever os dados reais sem aviso nenhum.
//
// Para eliminar esse risco, o usuário pode "vincular" o app a um arquivo .db
// real e explícito no disco. A partir daí, toda alteração é gravada nesse
// arquivo específico (além do IndexedDB, que continua como rede de segurança).

const FILE_HANDLE_IDB_NAME = 'kluthe_crm_filehandle';
const FILE_HANDLE_IDB_STORE = 'handle';
const FILE_HANDLE_IDB_KEY = 'main';

function fileSystemAccessSupported() {
  return typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';
}

function openHandleIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FILE_HANDLE_IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(FILE_HANDLE_IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandleRef(handle) {
  const conn = await openHandleIdb();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(FILE_HANDLE_IDB_STORE, 'readwrite');
    tx.objectStore(FILE_HANDLE_IDB_STORE).put(handle, FILE_HANDLE_IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandleRef() {
  const conn = await openHandleIdb();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(FILE_HANDLE_IDB_STORE, 'readonly');
    const req = tx.objectStore(FILE_HANDLE_IDB_STORE).get(FILE_HANDLE_IDB_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function clearHandleRef() {
  const conn = await openHandleIdb();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(FILE_HANDLE_IDB_STORE, 'readwrite');
    tx.objectStore(FILE_HANDLE_IDB_STORE).delete(FILE_HANDLE_IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function ensurePermission(handle, mode = 'readwrite') {
  const opts = { mode };
  try {
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if ((await handle.requestPermission(opts)) === 'granted') return true;
  } catch (e) {
    console.warn('Permissão de arquivo negada/indisponível:', e);
  }
  return false;
}

async function pickExistingFile() {
  const [handle] = await window.showOpenFilePicker({
    types: [{ description: 'Banco de dados do CRM', accept: { 'application/x-sqlite3': ['.db'] } }],
    excludeAcceptAllOption: false,
  });
  return handle;
}

async function pickNewFile(suggestedName = 'crm_kluthe.db') {
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [{ description: 'Banco de dados do CRM', accept: { 'application/x-sqlite3': ['.db'] } }],
  });
  return handle;
}

async function readFileBytes(handle) {
  const file = await handle.getFile();
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

async function writeFileBytes(handle, bytes) {
  const writable = await handle.createWritable();
  await writable.write(bytes);
  await writable.close();
}
