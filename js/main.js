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
    this.goTo('followup');
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
    statusEl.textContent = 'Banco carregado (dados salvos neste navegador)';
    Router.init();
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Erro ao carregar o banco de dados';
    qs('#view-container').innerHTML = `<div class="empty-state">Não foi possível iniciar o banco de dados local.<br/>Detalhe: ${escapeHtml(err.message || err)}</div>`;
  }
})();
