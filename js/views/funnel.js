// Tela de Funil: kanban por estágio, com drag & drop nativo (HTML5 DnD).

const FunnelView = {
  render(container) {
    const oportunidades = Repo.oportunidades.list();
    const byStage = {};
    STAGES.forEach((s) => (byStage[s] = []));
    oportunidades.forEach((o) => {
      if (!byStage[o.estagio]) byStage[o.estagio] = [];
      byStage[o.estagio].push(o);
    });

    container.innerHTML = `
      <div class="toolbar" style="justify-content: space-between">
        <h2 style="margin:0">Funil de Vendas</h2>
        <button class="primary" id="btn-nova-oportunidade">+ Nova Oportunidade</button>
      </div>
      <div class="kanban">
        ${STAGES.map((stage) => `
          <div class="kanban-col" data-stage="${escapeHtml(stage)}">
            <h4>${escapeHtml(stage)} <span>${byStage[stage].length}</span></h4>
            <div class="kanban-drop" data-stage="${escapeHtml(stage)}" style="min-height:120px">
              ${byStage[stage].map((o) => `
                <div class="kanban-card" draggable="true" data-id="${o.id}">
                  <strong>${escapeHtml(o.nome_empresa)}</strong>
                  ${o.produto_interesse ? escapeHtml(o.produto_interesse) + '<br/>' : ''}
                  ${o.valor_estimado ? `<span class="valor">${formatMoney(o.valor_estimado)}</span>` : ''}
                  ${o.data_proxima_acao ? `<div class="prox">Próx: ${formatDateBR(o.data_proxima_acao)} — ${escapeHtml(o.proxima_acao_descricao || '')}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    qs('#btn-nova-oportunidade', container).addEventListener('click', () => this.openOpportunityForm());

    qsa('.kanban-card', container).forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('click', () => {
        const o = Repo.oportunidades.get(Number(card.dataset.id));
        this.openOpportunityForm({ existing: o });
      });
    });

    qsa('.kanban-col', container).forEach((col) => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('drag-over');
      });
      col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const id = Number(e.dataTransfer.getData('text/plain'));
        const novoEstagio = col.dataset.stage;
        if (id) {
          Repo.oportunidades.updateEstagio(id, novoEstagio);
          Router.refreshCurrent();
          toast(`Movida para "${novoEstagio}".`);
        }
      });
    });
  },

  openOpportunityForm({ contaId, existing } = {}) {
    const isEdit = !!existing;
    const contas = Repo.contas.list();
    const fixedConta = contaId || existing?.conta_id;

    const modal = openModal(`
      <button class="modal-close" id="modal-close">&times;</button>
      <h3>${isEdit ? 'Editar Oportunidade' : 'Nova Oportunidade'}</h3>
      <form id="form-oportunidade">
        <div class="form-grid">
          <label style="grid-column: 1 / -1">Conta *
            ${fixedConta
              ? `<input type="text" disabled value="${escapeHtml(Repo.contas.get(fixedConta)?.nome_empresa || '')}" />
                 <input type="hidden" name="conta_id" value="${fixedConta}" />`
              : `<select name="conta_id" required>
                  <option value="">Selecione...</option>
                  ${contas.map((c) => `<option value="${c.id}">${escapeHtml(c.nome_empresa)}</option>`).join('')}
                 </select>`}
          </label>
          <label>Estágio
            <select name="estagio">
              ${STAGES.map((s) => `<option value="${s}" ${existing?.estagio === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </label>
          <label>Valor Estimado (R$)
            <input type="number" step="0.01" name="valor_estimado" value="${existing?.valor_estimado ?? ''}" />
          </label>
          <label style="grid-column: 1 / -1">Produto de Interesse
            <input type="text" name="produto_interesse" value="${escapeHtml(existing?.produto_interesse || '')}" />
          </label>
          <label>Data da Próxima Ação
            <input type="date" name="data_proxima_acao" value="${existing?.data_proxima_acao || ''}" />
          </label>
          <label>Descrição da Próxima Ação
            <input type="text" name="proxima_acao_descricao" value="${escapeHtml(existing?.proxima_acao_descricao || '')}" />
          </label>
        </div>
        <div class="form-actions">
          ${isEdit ? '<button type="button" class="danger" id="btn-excluir-oportunidade">Excluir</button>' : ''}
          <button type="button" id="btn-cancelar">Cancelar</button>
          <button type="submit" class="primary">Salvar</button>
        </div>
      </form>
    `);

    qs('#modal-close', modal).addEventListener('click', closeModal);
    qs('#btn-cancelar', modal).addEventListener('click', closeModal);
    if (isEdit) {
      qs('#btn-excluir-oportunidade', modal).addEventListener('click', () => {
        if (confirm('Excluir esta oportunidade?')) {
          Repo.oportunidades.remove(existing.id);
          closeModal();
          Router.refreshCurrent();
          toast('Oportunidade excluída.');
        }
      });
    }
    qs('#form-oportunidade', modal).addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      if (!data.conta_id) { toast('Selecione uma conta.'); return; }
      data.conta_id = Number(data.conta_id);
      if (isEdit) {
        Repo.oportunidades.update(existing.id, data);
        toast('Oportunidade atualizada.');
      } else {
        Repo.oportunidades.create(data);
        toast('Oportunidade criada.');
      }
      closeModal();
      Router.refreshCurrent();
    });
  },
};
