// Modal de registro rápido de interação, reutilizado por Follow-up, Contas e Funil.

const InteractionsView = {
  openForm({ contaId, contatoId, presetProximaAcao } = {}) {
    const contas = Repo.contas.list();
    const contatosIniciais = contaId ? Repo.contatos.listByConta(contaId) : [];
    const lockConta = !!contaId;

    const modal = openModal(`
      <button class="modal-close" id="modal-close">&times;</button>
      <h3>Registrar Interação</h3>
      <form id="form-interacao">
        <div class="form-grid">
          <label style="grid-column: 1 / -1">Conta *
            ${lockConta
              ? `<input type="text" disabled value="${escapeHtml(Repo.contas.get(contaId)?.nome_empresa || '')}" />
                 <input type="hidden" name="conta_id" value="${contaId}" />`
              : `<select name="conta_id" id="sel-conta" required>
                  <option value="">Selecione...</option>
                  ${contas.map((c) => `<option value="${c.id}">${escapeHtml(c.nome_empresa)}</option>`).join('')}
                 </select>`}
          </label>
          <label style="grid-column: 1 / -1">Contato
            <select name="contato_id" id="sel-contato">
              <option value="">(sem contato específico)</option>
              ${contatosIniciais.map((ct) => `<option value="${ct.id}" ${ct.id === contatoId ? 'selected' : ''}>${escapeHtml(ct.nome)}</option>`).join('')}
            </select>
          </label>
          <label>Canal *
            <select name="canal" required>
              ${CHANNELS.map((c) => `<option value="${c.value}">${c.label}</option>`).join('')}
            </select>
          </label>
          <label>Resultado *
            <select name="resultado" required>
              ${RESULTS.map((r) => `<option value="${r.value}">${r.label}</option>`).join('')}
            </select>
          </label>
          <label style="grid-column: 1 / -1">Observação
            <textarea name="observacao" placeholder="O que foi conversado..."></textarea>
          </label>
        </div>

        <div class="subsection">
          <div class="checkbox-row">
            <input type="checkbox" id="chk-proxima-acao" ${presetProximaAcao ? 'checked' : ''} />
            <label for="chk-proxima-acao" style="font-weight:600; color:var(--text)">Definir próxima ação</label>
          </div>
          <div class="form-grid" id="campos-proxima-acao" style="margin-top:10px; ${presetProximaAcao ? '' : 'display:none'}">
            <label>Data
              <input type="date" name="data_proxima_acao" value="${todayISO()}" />
            </label>
            <label>Canal previsto
              <select name="canal_proxima_acao">
                ${CHANNELS.map((c) => `<option value="${c.value}">${c.label}</option>`).join('')}
              </select>
            </label>
            <label style="grid-column: 1 / -1">Observação da próxima ação
              <input type="text" name="observacao_proxima_acao" placeholder="ex: retornar ligação, enviar proposta..." />
            </label>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" id="btn-cancelar">Cancelar</button>
          <button type="submit" class="primary">Salvar Interação</button>
        </div>
      </form>
    `);

    qs('#modal-close', modal).addEventListener('click', closeModal);
    qs('#btn-cancelar', modal).addEventListener('click', closeModal);

    const chk = qs('#chk-proxima-acao', modal);
    const campos = qs('#campos-proxima-acao', modal);
    chk.addEventListener('change', () => {
      campos.style.display = chk.checked ? '' : 'none';
    });

    if (!lockConta) {
      qs('#sel-conta', modal).addEventListener('change', (e) => {
        const cid = Number(e.target.value);
        const selContato = qs('#sel-contato', modal);
        const contatos = cid ? Repo.contatos.listByConta(cid) : [];
        selContato.innerHTML = `<option value="">(sem contato específico)</option>` +
          contatos.map((ct) => `<option value="${ct.id}">${escapeHtml(ct.nome)}</option>`).join('');
      });
    }

    qs('#form-interacao', modal).addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      if (!data.conta_id) { toast('Selecione uma conta.'); return; }
      data.conta_id = Number(data.conta_id);
      data.contato_id = data.contato_id ? Number(data.contato_id) : null;
      if (!chk.checked) {
        data.data_proxima_acao = null;
        data.canal_proxima_acao = null;
        data.observacao_proxima_acao = null;
      }
      Repo.interacoes.create(data);
      closeModal();
      Router.refreshCurrent();
      toast('Interação registrada.');
    });
  },
};
