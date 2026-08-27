// Ponto de entrada: inicializa o banco e controla a navegação entre telas.

const Router = {
  tabs: {
    followup: { label: 'Follow-up de Hoje', view: FollowupView },
    accounts: { label: 'Contas', view: AccountsView },
    funnel: { label: 'Funil', view: FunnelView },
    dashboard: { label: 'Dashboard', view: DashboardView },
  },
  current: 'followup',

  init() {
    const nav = qs('#tabs');
    nav.innerHTML = Object.entries(this.tabs)
      .map(([key, t]) => `<button data-tab="${key}">${t.label}</button>`)
      .join('');
    qsa('button', nav).forEach((btn) => {
      btn.addEventListener('click', () => this.goTo(btn.dataset.tab));
    });
    qs('#btn-nova-interacao').addEventListener('click', () => InteractionsView.openForm());
    qs('#btn-exportar').addEventListener('click', () => {
      exportBackupFile();
      toast('Backup exportado.');
    });
    qs('#input-importar').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('Importar este backup vai substituir todos os dados atuais. Continuar?')) {
        e.target.value = '';
        return;
      }
      await importBackupFile(file);
      e.target.value = '';
      this.refreshCurrent();
      toast('Backup importado com sucesso.');
    });
    qs('#btn-vincular-arquivo').addEventListener('click', () => this.openLinkFileDialog());
    this.updateFileLinkStatus();
    this.goTo('followup');
  },

  updateFileLinkStatus() {
    const el = qs('#file-link-status');
    const btn = qs('#btn-vincular-arquivo');
    const status = currentFileStatus();
    if (!status.supported) {
      el.textContent = '';
      btn.style.display = 'none';
      return;
    }
    if (status.fileMode) {
      el.textContent = `🔗 ${status.fileName}`;
      el.title = 'Dados gravados neste arquivo real, além do navegador.';
      el.style.color = '#8fd19e';
      btn.textContent = 'Trocar arquivo';
    } else {
      el.textContent = '⚠️ não vinculado a arquivo';
      el.title = 'Os dados dependem só do armazenamento do navegador. Clique em "Vincular arquivo" para salvar num arquivo real e evitar perda de dados.';
      el.style.color = '#f0c060';
      btn.textContent = '🔗 Vincular arquivo';
    }
  },

  openLinkFileDialog() {
    const modal = openModal(`
      <button class="modal-close" id="modal-close">&times;</button>
      <h3>Vincular a um arquivo real</h3>
      <p class="muted">Por padrão os dados ficam só no armazenamento do navegador, que é compartilhado entre TODAS as páginas abertas localmente (risco de sobrescrita por outra cópia deste app). Vincular a um arquivo <code>.db</code> real no disco elimina esse risco: esse arquivo passa a ser a cópia oficial dos dados.</p>
      <div class="form-actions" style="justify-content:flex-start; flex-wrap:wrap;">
        <button class="primary" id="btn-abrir-existente">Vincular arquivo existente...</button>
        <button id="btn-criar-novo">Criar novo arquivo...</button>
        <button id="btn-cancelar-link">Cancelar</button>
      </div>
    `);
    qs('#modal-close', modal).addEventListener('click', closeModal);
    qs('#btn-cancelar-link', modal).addEventListener('click', closeModal);
    qs('#btn-abrir-existente', modal).addEventListener('click', async () => {
      try {
        if (!confirm('O conteúdo do arquivo escolhido vai SUBSTITUIR os dados atuais na tela. Continuar?')) return;
        await linkExistingFile();
        closeModal();
        this.updateFileLinkStatus();
        this.refreshCurrent();
        toast('Arquivo vinculado com sucesso.');
      } catch (e) {
        if (e.name !== 'AbortError') { console.error(e); toast('Não foi possível vincular o arquivo.'); }
      }
    });
    qs('#btn-criar-novo', modal).addEventListener('click', async () => {
      try {
        await linkNewFile();
        closeModal();
        this.updateFileLinkStatus();
        toast('Arquivo criado e vinculado.');
      } catch (e) {
        if (e.name !== 'AbortError') { console.error(e); toast('Não foi possível criar o arquivo.'); }
      }
    });
  },

  goTo(tabKey) {
    this.current = tabKey;
    qsa('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabKey));
    this.refreshCurrent();
  },

  goToAccountDetail(contaId) {
    AccountsView.state.mode = 'detail';
    AccountsView.state.contaId = contaId;
    this.goTo('accounts');
  },

  refreshCurrent() {
    const container = qs('#view-container');
    this.tabs[this.current].view.render(container);
  },
};

(async function boot() {
  const statusEl = qs('#db-status');
  try {
    await initDb();
    statusEl.textContent = 'Banco carregado';
    Router.init();
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Erro ao carregar o banco de dados';
    qs('#view-container').innerHTML = `<div class="empty-state">Não foi possível iniciar o banco de dados local.<br/>Detalhe: ${escapeHtml(err.message || err)}</div>`;
  }
})();
