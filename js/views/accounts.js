// Tela de Contas: lista, cadastro/edição, e detalhe (com contatos + histórico + oportunidades).

const AccountsView = {
  state: { mode: 'list', contaId: null, search: '', status: '' },

  render(container) {
    if (this.state.mode === 'detail' && this.state.contaId) {
      this.renderDetail(container, this.state.contaId);
    } else {
      this.renderList(container);
    }
  },

  renderList(container) {
    const contas = Repo.contas.list({ q: this.state.search, status: this.state.status });
    container.innerHTML = `
      <h2>Contas</h2>
      <div class="toolbar">
        <input type="text" id="acc-search" placeholder="Buscar por nome da empresa..." value="${escapeHtml(this.state.search)}" style="min-width:240px" />
        <select id="acc-status-filter">
          <option value="">Todos os status</option>
          <option value="Ativa">Ativa</option>
          <option value="Inativa">Inativa</option>
        </select>
        <button class="primary" id="btn-nova-conta">+ Nova Conta</button>
      </div>
      ${contas.length === 0 ? '<div class="empty-state">Nenhuma conta cadastrada ainda.</div>' : `
      <table class="clickable">
        <thead><tr>
          <th>Empresa</th><th>Segmento/ICP</th><th>Origem</th><th>Responsável</th><th>Status</th><th>Criada em</th>
        </tr></thead>
        <tbody>
          ${contas.map((c) => `
            <tr data-id="${c.id}">
              <td>${escapeHtml(c.nome_empresa)}</td>
              <td>${escapeHtml(c.segmento_icp || '')}</td>
              <td>${escapeHtml(c.origem_lead || '')}</td>
              <td>${escapeHtml(c.responsavel || '')}</td>
              <td><span class="badge ${c.status_geral === 'Ativa' ? 'ativa' : 'inativa'}">${escapeHtml(c.status_geral)}</span></td>
              <td>${formatDateBR(c.data_criacao)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`}
    `;

    qs('#acc-search', container).addEventListener('input', (e) => {
      this.state.search = e.target.value;
      this.renderList(container);
    });
    qs('#acc-status-filter', container).value = this.state.status;
    qs('#acc-status-filter', container).addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.renderList(container);
    });
    qs('#btn-nova-conta', container).addEventListener('click', () => this.openAccountForm());
    qsa('tbody tr', container).forEach((tr) => {
      tr.addEventListener('click', () => {
        this.state.mode = 'detail';
        this.state.contaId = Number(tr.dataset.id);
        this.render(container);
      });
    });
  },

  renderDetail(container, contaId) {
    const conta = Repo.contas.get(contaId);
    if (!conta) {
      this.state.mode = 'list';
      this.render(container);
      return;
    }
    const contatos = Repo.contatos.listByConta(contaId);
    const interacoes = Repo.interacoes.listByConta(contaId);
    const oportunidades = Repo.oportunidades.listByConta(contaId);

    container.innerHTML = `
      <button class="ghost" id="btn-voltar">&larr; Voltar para Contas</button>
      <div class="card">
        <div class="detail-header">
          <div>
            <h2 style="margin-bottom:4px">${escapeHtml(conta.nome_empresa)}
              <span class="badge ${conta.status_geral === 'Ativa' ? 'ativa' : 'inativa'}">${escapeHtml(conta.status_geral)}</span>
            </h2>
            <div class="muted">
              ${conta.segmento_icp ? `<span class="tag">${escapeHtml(conta.segmento_icp)}</span>` : ''}
              ${conta.origem_lead ? `Origem: ${escapeHtml(conta.origem_lead)} · ` : ''}
              Responsável: ${escapeHtml(conta.responsavel || '-')} · Criada em ${formatDateBR(conta.data_criacao)}
            </div>
          </div>
          <div style="display:flex; gap:8px">
            <button id="btn-editar-conta">Editar</button>
            <button class="primary" id="btn-registrar-interacao">+ Registrar Interação</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="detail-header"><h3>Contatos</h3><button class="small" id="btn-novo-contato">+ Novo Contato</button></div>
        ${contatos.length === 0 ? '<div class="empty-state">Nenhum contato cadastrado.</div>' : `
        <table>
          <thead><tr><th>Nome</th><th>Cargo</th><th>Telefone</th><th>Email</th><th>LinkedIn</th><th></th></tr></thead>
          <tbody>
            ${contatos.map((ct) => `
              <tr data-id="${ct.id}">
                <td>${escapeHtml(ct.nome)}</td>
                <td>${escapeHtml(ct.cargo || '')}</td>
                <td>${escapeHtml(ct.telefone || '')}</td>
                <td>${escapeHtml(ct.email || '')}</td>
                <td>${ct.linkedin_url ? `<a class="link" href="${escapeHtml(ct.linkedin_url)}" target="_blank" rel="noopener">perfil</a>` : ''}</td>
                <td><button class="small edit-contato" data-id="${ct.id}">Editar</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
      </div>

      <div class="card">
        <div class="detail-header"><h3>Oportunidades</h3><button class="small" id="btn-nova-oportunidade">+ Nova Oportunidade</button></div>
        ${oportunidades.length === 0 ? '<div class="empty-state">Nenhuma oportunidade vinculada.</div>' : `
        <table>
          <thead><tr><th>Estágio</th><th>Produto</th><th>Valor Estimado</th><th>Próxima Ação</th></tr></thead>
          <tbody>
            ${oportunidades.map((o) => `
              <tr>
                <td>${escapeHtml(o.estagio)}</td>
                <td>${escapeHtml(o.produto_interesse || '')}</td>
                <td>${formatMoney(o.valor_estimado)}</td>
                <td>${o.data_proxima_acao ? `${formatDateBR(o.data_proxima_acao)} — ${escapeHtml(o.proxima_acao_descricao || '')}` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
      </div>

      <div class="card">
        <h3>Histórico de Interações</h3>
        ${interacoes.length === 0 ? '<div class="empty-state">Nenhuma interação registrada.</div>' : `
        <table>
          <thead><tr><th>Data</th><th>Canal</th><th>Contato</th><th>Resultado</th><th>Observação</th><th>Próxima Ação</th></tr></thead>
          <tbody>
            ${interacoes.map((i) => `
              <tr>
                <td>${formatDateTimeBR(i.data_hora)}</td>
                <td>${channelLabel(i.canal)}</td>
                <td>${escapeHtml(i.contato_nome || '-')}</td>
                <td>${resultLabel(i.resultado)}</td>
                <td>${escapeHtml(i.observacao || '')}</td>
                <td>${i.data_proxima_acao ? `${formatDateBR(i.data_proxima_acao)} (${channelLabel(i.canal_proxima_acao)})` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
      </div>
    `;

    qs('#btn-voltar', container).addEventListener('click', () => {
      this.state.mode = 'list';
      this.render(container);
    });
    qs('#btn-editar-conta', container).addEventListener('click', () => this.openAccountForm(conta));
    qs('#btn-registrar-interacao', container).addEventListener('click', () => {
      InteractionsView.openForm({ contaId: conta.id });
    });
    qs('#btn-novo-contato', container).addEventListener('click', () => this.openContactForm(conta.id));
    qsa('.edit-contato', container).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const contato = Repo.contatos.get(Number(btn.dataset.id));
        this.openContactForm(conta.id, contato);
      });
    });
    qs('#btn-nova-oportunidade', container).addEventListener('click', () => {
      FunnelView.openOpportunityForm({ contaId: conta.id });
    });
  },

  openAccountForm(existing) {
    const isEdit = !!existing;
    const modal = openModal(`
      <button class="modal-close" id="modal-close">&times;</button>
      <h3>${isEdit ? 'Editar Conta' : 'Nova Conta'}</h3>
      <form id="form-conta">
        <div class="form-grid">
          <label style="grid-column: 1 / -1">Nome da Empresa *
            <input type="text" name="nome_empresa" required value="${escapeHtml(existing?.nome_empresa || '')}" />
          </label>
          <label>Segmento / ICP
            <input type="text" name="segmento_icp" value="${escapeHtml(existing?.segmento_icp || '')}" />
          </label>
          <label>Origem do Lead
            <input type="text" name="origem_lead" value="${escapeHtml(existing?.origem_lead || '')}" />
          </label>
          <label>Responsável
            <input type="text" name="responsavel" value="${escapeHtml(existing?.responsavel || 'Matheus')}" />
          </label>
          <label>Status
            <select name="status_geral">
              <option value="Ativa" ${existing?.status_geral !== 'Inativa' ? 'selected' : ''}>Ativa</option>
              <option value="Inativa" ${existing?.status_geral === 'Inativa' ? 'selected' : ''}>Inativa</option>
            </select>
          </label>
        </div>
        <div class="form-actions">
          ${isEdit ? '<button type="button" class="danger" id="btn-excluir-conta">Excluir</button>' : ''}
          <button type="button" id="btn-cancelar">Cancelar</button>
          <button type="submit" class="primary">Salvar</button>
        </div>
      </form>
    `);

    qs('#modal-close', modal).addEventListener('click', closeModal);
    qs('#btn-cancelar', modal).addEventListener('click', closeModal);
    if (isEdit) {
      qs('#btn-excluir-conta', modal).addEventListener('click', () => {
        if (confirm(`Excluir a conta "${existing.nome_empresa}"? Isso remove também contatos, interações e oportunidades vinculadas.`)) {
          Repo.contas.remove(existing.id);
          closeModal();
          this.state.mode = 'list';
          this.state.contaId = null;
          Router.refreshCurrent();
          toast('Conta excluída.');
        }
      });
    }
    qs('#form-conta', modal).addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      if (isEdit) {
        Repo.contas.update(existing.id, data);
        toast('Conta atualizada.');
      } else {
        const newId = Repo.contas.create(data);
        this.state.mode = 'detail';
        this.state.contaId = newId;
        toast('Conta criada.');
      }
      closeModal();
      Router.refreshCurrent();
    });
  },

  openContactForm(contaId, existing) {
    const isEdit = !!existing;
    const modal = openModal(`
      <button class="modal-close" id="modal-close">&times;</button>
      <h3>${isEdit ? 'Editar Contato' : 'Novo Contato'}</h3>
      <form id="form-contato">
        <div class="form-grid">
          <label style="grid-column: 1 / -1">Nome *
            <input type="text" name="nome" required value="${escapeHtml(existing?.nome || '')}" />
          </label>
          <label>Cargo
            <input type="text" name="cargo" value="${escapeHtml(existing?.cargo || '')}" />
          </label>
          <label>Telefone
            <input type="text" name="telefone" value="${escapeHtml(existing?.telefone || '')}" />
          </label>
          <label>Email
            <input type="email" name="email" value="${escapeHtml(existing?.email || '')}" />
          </label>
          <label>LinkedIn (URL)
            <input type="url" name="linkedin_url" value="${escapeHtml(existing?.linkedin_url || '')}" />
          </label>
        </div>
        <div class="form-actions">
          ${isEdit ? '<button type="button" class="danger" id="btn-excluir-contato">Excluir</button>' : ''}
          <button type="button" id="btn-cancelar">Cancelar</button>
          <button type="submit" class="primary">Salvar</button>
        </div>
      </form>
    `);

    qs('#modal-close', modal).addEventListener('click', closeModal);
    qs('#btn-cancelar', modal).addEventListener('click', closeModal);
    if (isEdit) {
      qs('#btn-excluir-contato', modal).addEventListener('click', () => {
        if (confirm(`Excluir o contato "${existing.nome}"?`)) {
          Repo.contatos.remove(existing.id);
          closeModal();
          Router.refreshCurrent();
          toast('Contato excluído.');
        }
      });
    }
    qs('#form-contato', modal).addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      data.conta_id = contaId;
      if (isEdit) {
        Repo.contatos.update(existing.id, data);
        toast('Contato atualizado.');
      } else {
        Repo.contatos.create(data);
        toast('Contato criado.');
      }
      closeModal();
      Router.refreshCurrent();
    });
  },
};
