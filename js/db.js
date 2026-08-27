// Camada de banco de dados: SQLite (sql.js/WASM) rodando 100% no navegador,
// persistido em IndexedDB a cada alteração. Sem servidor, sem instalação.

const IDB_NAME = 'kluthe_crm_db';
const IDB_STORE = 'snapshots';
const IDB_KEY = 'main';

let sqlJsModule = null;
let db = null;
let fileHandle = null;
let fileMode = false; // true quando os dados estão vinculados a um arquivo real no disco

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const conn = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const conn = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS contas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_empresa TEXT NOT NULL,
  segmento_icp TEXT,
  origem_lead TEXT,
  responsavel TEXT,
  status_geral TEXT NOT NULL DEFAULT 'Ativa',
  data_criacao TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS contatos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cargo TEXT,
  telefone TEXT,
  email TEXT,
  linkedin_url TEXT
);

CREATE TABLE IF NOT EXISTS interacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  contato_id INTEGER REFERENCES contatos(id) ON DELETE SET NULL,
  data_hora TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  canal TEXT NOT NULL,
  resultado TEXT NOT NULL,
  observacao TEXT,
  data_proxima_acao TEXT,
  canal_proxima_acao TEXT,
  observacao_proxima_acao TEXT
);

CREATE TABLE IF NOT EXISTS oportunidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  estagio TEXT NOT NULL DEFAULT 'Prospecção',
  produto_interesse TEXT,
  valor_estimado REAL,
  data_proxima_acao TEXT,
  proxima_acao_descricao TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_contatos_conta ON contatos(conta_id);
CREATE INDEX IF NOT EXISTS idx_interacoes_conta ON interacoes(conta_id);
CREATE INDEX IF NOT EXISTS idx_interacoes_contato ON interacoes(contato_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_conta ON oportunidades(conta_id);
`;

async function initDb() {
  if (!sqlJsModule) {
    const wasmBinary = base64ToUint8Array(SQL_WASM_BASE64);
    sqlJsModule = await initSqlJs({ wasmBinary });
  }

  // Tenta usar um arquivo real vinculado anteriormente (mais seguro: não é
  // compartilhado com outras páginas file://, ao contrário do IndexedDB).
  let loadedFromFile = false;
  if (fileSystemAccessSupported()) {
    try {
      const remembered = await loadHandleRef();
      if (remembered && (await ensurePermission(remembered))) {
        const bytes = await readFileBytes(remembered);
        fileHandle = remembered;
        fileMode = true;
        if (bytes.length > 0) {
          db = new sqlJsModule.Database(bytes);
          loadedFromFile = true;
        }
      }
    } catch (e) {
      console.warn('Não foi possível reabrir o arquivo vinculado:', e);
    }
  }

  if (!loadedFromFile) {
    const saved = await idbGet(IDB_KEY);
    if (saved) {
      db = new sqlJsModule.Database(new Uint8Array(saved));
    } else {
      db = new sqlJsModule.Database();
    }
  }

  db.run(SCHEMA_SQL);
  await persist();
  return db;
}

let persistTimer = null;
async function persist() {
  const data = db.export();
  // O IndexedDB é sempre gravado como rede de segurança automática.
  await idbSet(IDB_KEY, data);
  // Se houver um arquivo vinculado, ele é a cópia autoritativa.
  if (fileMode && fileHandle) {
    try {
      await writeFileBytes(fileHandle, data);
    } catch (e) {
      console.warn('Falha ao gravar no arquivo vinculado (dados seguros no IndexedDB):', e);
    }
  }
}
function persistSoon() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 150);
}

// ---------- Vincular/desvincular arquivo real ----------

async function linkNewFile(suggestedName = 'crm_kluthe.db') {
  const handle = await pickNewFile(suggestedName);
  fileHandle = handle;
  fileMode = true;
  await saveHandleRef(handle);
  await persist();
  return handle;
}

async function linkExistingFile() {
  const handle = await pickExistingFile();
  const bytes = await readFileBytes(handle);
  if (bytes.length > 0) {
    db = new sqlJsModule.Database(bytes);
    db.run(SCHEMA_SQL);
  }
  fileHandle = handle;
  fileMode = true;
  await saveHandleRef(handle);
  await persist();
  return handle;
}

async function unlinkFile() {
  fileHandle = null;
  fileMode = false;
  await clearHandleRef();
}

function currentFileStatus() {
  return { fileMode, fileName: fileHandle ? fileHandle.name : null, supported: fileSystemAccessSupported() };
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function one(sql, params = []) {
  const rows = all(sql, params);
  return rows.length ? rows[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  const lastId = one('SELECT last_insert_rowid() AS id').id;
  const changes = db.getRowsModified();
  persistSoon();
  return { lastId, changes };
}

// ---------- Repositório de domínio ----------

const Repo = {
  contas: {
    list(filter = {}) {
      let sql = 'SELECT * FROM contas WHERE 1=1';
      const params = [];
      if (filter.q) {
        sql += ' AND nome_empresa LIKE ?';
        params.push(`%${filter.q}%`);
      }
      if (filter.status) {
        sql += ' AND status_geral = ?';
        params.push(filter.status);
      }
      sql += ' ORDER BY nome_empresa ASC';
      return all(sql, params);
    },
    get(id) {
      return one('SELECT * FROM contas WHERE id = ?', [id]);
    },
    create(data) {
      const { lastId } = run(
        `INSERT INTO contas (nome_empresa, segmento_icp, origem_lead, responsavel, status_geral)
         VALUES (?, ?, ?, ?, ?)`,
        [data.nome_empresa, data.segmento_icp || null, data.origem_lead || null, data.responsavel || null, data.status_geral || 'Ativa']
      );
      return lastId;
    },
    update(id, data) {
      run(
        `UPDATE contas SET nome_empresa=?, segmento_icp=?, origem_lead=?, responsavel=?, status_geral=? WHERE id=?`,
        [data.nome_empresa, data.segmento_icp || null, data.origem_lead || null, data.responsavel || null, data.status_geral || 'Ativa', id]
      );
    },
    remove(id) {
      run('DELETE FROM contas WHERE id = ?', [id]);
    },
  },

  contatos: {
    listByConta(contaId) {
      return all('SELECT * FROM contatos WHERE conta_id = ? ORDER BY nome ASC', [contaId]);
    },
    get(id) {
      return one('SELECT * FROM contatos WHERE id = ?', [id]);
    },
    create(data) {
      const { lastId } = run(
        `INSERT INTO contatos (conta_id, nome, cargo, telefone, email, linkedin_url) VALUES (?, ?, ?, ?, ?, ?)`,
        [data.conta_id, data.nome, data.cargo || null, data.telefone || null, data.email || null, data.linkedin_url || null]
      );
      return lastId;
    },
    update(id, data) {
      run(
        `UPDATE contatos SET nome=?, cargo=?, telefone=?, email=?, linkedin_url=? WHERE id=?`,
        [data.nome, data.cargo || null, data.telefone || null, data.email || null, data.linkedin_url || null, id]
      );
    },
    remove(id) {
      run('DELETE FROM contatos WHERE id = ?', [id]);
    },
  },

  interacoes: {
    listByConta(contaId) {
      return all(
        `SELECT i.*, ct.nome AS contato_nome FROM interacoes i
         LEFT JOIN contatos ct ON ct.id = i.contato_id
         WHERE i.conta_id = ? ORDER BY datetime(i.data_hora) DESC, i.id DESC`,
        [contaId]
      );
    },
    create(data) {
      const { lastId } = run(
        `INSERT INTO interacoes (conta_id, contato_id, data_hora, canal, resultado, observacao, data_proxima_acao, canal_proxima_acao, observacao_proxima_acao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.conta_id,
          data.contato_id || null,
          data.data_hora || nowLocalDateTime(),
          data.canal,
          data.resultado,
          data.observacao || null,
          data.data_proxima_acao || null,
          data.canal_proxima_acao || null,
          data.observacao_proxima_acao || null,
        ]
      );
      return lastId;
    },
    followupsHoje() {
      // Para cada par (conta, contato), pega a interação mais recente.
      // Se ela tiver próxima ação marcada para hoje ou atrasada, entra na lista.
      return all(`
        SELECT i.*, c.nome_empresa, ct.nome AS contato_nome
        FROM interacoes i
        JOIN contas c ON c.id = i.conta_id
        LEFT JOIN contatos ct ON ct.id = i.contato_id
        WHERE i.data_proxima_acao IS NOT NULL
          AND i.id = (
            SELECT i2.id FROM interacoes i2
            WHERE i2.conta_id = i.conta_id
              AND IFNULL(i2.contato_id, -1) = IFNULL(i.contato_id, -1)
            ORDER BY datetime(i2.data_hora) DESC, i2.id DESC
            LIMIT 1
          )
          AND date(i.data_proxima_acao) <= date('now','localtime')
        ORDER BY date(i.data_proxima_acao) ASC, datetime(i.data_hora) ASC
      `);
    },
    followupsFuturos() {
      return all(`
        SELECT i.*, c.nome_empresa, ct.nome AS contato_nome
        FROM interacoes i
        JOIN contas c ON c.id = i.conta_id
        LEFT JOIN contatos ct ON ct.id = i.contato_id
        WHERE i.data_proxima_acao IS NOT NULL
          AND i.id = (
            SELECT i2.id FROM interacoes i2
            WHERE i2.conta_id = i.conta_id
              AND IFNULL(i2.contato_id, -1) = IFNULL(i.contato_id, -1)
            ORDER BY datetime(i2.data_hora) DESC, i2.id DESC
            LIMIT 1
          )
          AND date(i.data_proxima_acao) > date('now','localtime')
        ORDER BY date(i.data_proxima_acao) ASC
      `);
    },
  },

  oportunidades: {
    list() {
      return all(`
        SELECT o.*, c.nome_empresa FROM oportunidades o
        JOIN contas c ON c.id = o.conta_id
        ORDER BY datetime(o.atualizado_em) DESC
      `);
    },
    listByConta(contaId) {
      return all('SELECT * FROM oportunidades WHERE conta_id = ? ORDER BY datetime(atualizado_em) DESC', [contaId]);
    },
    get(id) {
      return one('SELECT * FROM oportunidades WHERE id = ?', [id]);
    },
    create(data) {
      const { lastId } = run(
        `INSERT INTO oportunidades (conta_id, estagio, produto_interesse, valor_estimado, data_proxima_acao, proxima_acao_descricao)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [data.conta_id, data.estagio || 'Prospecção', data.produto_interesse || null, data.valor_estimado || null, data.data_proxima_acao || null, data.proxima_acao_descricao || null]
      );
      return lastId;
    },
    update(id, data) {
      run(
        `UPDATE oportunidades SET estagio=?, produto_interesse=?, valor_estimado=?, data_proxima_acao=?, proxima_acao_descricao=?, atualizado_em=? WHERE id=?`,
        [data.estagio, data.produto_interesse || null, data.valor_estimado || null, data.data_proxima_acao || null, data.proxima_acao_descricao || null, nowLocalDateTime(), id]
      );
    },
    updateEstagio(id, estagio) {
      run('UPDATE oportunidades SET estagio=?, atualizado_em=? WHERE id=?', [estagio, nowLocalDateTime(), id]);
    },
    remove(id) {
      run('DELETE FROM oportunidades WHERE id = ?', [id]);
    },
  },

  dashboard: {
    toquesPorDia(diasAtras = 14) {
      return all(`
        SELECT date(data_hora) AS dia, canal, COUNT(*) AS total
        FROM interacoes
        WHERE date(data_hora) >= date('now','localtime','-${diasAtras} days')
        GROUP BY dia, canal
        ORDER BY dia ASC
      `);
    },
    toquesPorCanalTotal(diasAtras = 30) {
      return all(`
        SELECT canal, COUNT(*) AS total
        FROM interacoes
        WHERE date(data_hora) >= date('now','localtime','-${diasAtras} days')
        GROUP BY canal
        ORDER BY total DESC
      `);
    },
    oportunidadesPorEstagio() {
      return all(`SELECT estagio, COUNT(*) AS total, SUM(IFNULL(valor_estimado,0)) AS valor_total FROM oportunidades GROUP BY estagio`);
    },
    totalOportunidades() {
      return one('SELECT COUNT(*) AS total FROM oportunidades').total;
    },
    totalGanhas() {
      return one("SELECT COUNT(*) AS total FROM oportunidades WHERE estagio = 'Ganho'").total;
    },
    followupsAtrasadosCount() {
      return one(`
        SELECT COUNT(*) AS total FROM (
          SELECT i.id FROM interacoes i
          WHERE i.data_proxima_acao IS NOT NULL
            AND i.id = (
              SELECT i2.id FROM interacoes i2
              WHERE i2.conta_id = i.conta_id
                AND IFNULL(i2.contato_id, -1) = IFNULL(i.contato_id, -1)
              ORDER BY datetime(i2.data_hora) DESC, i2.id DESC
              LIMIT 1
            )
            AND date(i.data_proxima_acao) < date('now','localtime')
        )
      `).total;
    },
  },
};

// ---------- Backup manual ----------

function exportBackupFile() {
  const data = db.export();
  const blob = new Blob([data], { type: 'application/x-sqlite3' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = todayISO();
  a.href = url;
  a.download = `crm_kluthe_backup_${stamp}.db`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importBackupFile(file) {
  const buffer = await file.arrayBuffer();
  db = new sqlJsModule.Database(new Uint8Array(buffer));
  db.run(SCHEMA_SQL);
  await persist();
}
