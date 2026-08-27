// Tela de Follow-up: lista contas/contatos com próxima ação hoje ou atrasada,
// derivada da última interação registrada de cada par conta+contato.

const FollowupView = {
  state: { showFuturos: false },

  render(container) {
    const hoje = Repo.interacoes.followupsHoje();
    const futuros = this.state.showFuturos ? Repo.interacoes.followupsFuturos() : [];

    const rowHtml = (i, isFuturo) => {
      const dias = daysDiffFromToday(i.data_proxima_acao);
      let badge = '';
      if (!isFuturo) {
        badge = dias < 0
          ? `<span class="badge atrasado">Atrasado (${Math.abs(dias)}d)</span>`
          : `<span class="badge hoje">Hoje</span>`;
      } else {
        badge = `<span class="muted">em ${dias}d</span>`;
      }
      return `
        <tr data-conta="${i.conta_id}" data-contato="${i.contato_id || ''}">
          <td>${formatDateBR(i.data_proxima_acao)} ${badge}</td>
          <td><a class="link" data-goto-conta="${i.conta_id}">${escapeHtml(i.nome_empresa)}</a></td>
          <td>${escapeHtml(i.contato_nome || '-')}</td>
          <td>${channelLabel(i.canal_proxima_acao)}</td>
          <td>${escapeHtml(i.observacao_proxima_acao || '')}</td>
          <td class="muted">${escapeHtml(i.observacao || '')}</td>
          <td><button class="small primary btn-followup-interagir" data-conta="${i.conta_id}" data-contato="${i.contato_id || ''}">Registrar</button></td>
        </tr>
      `;
    };

    container.innerHTML = `
      <h2>Follow-up de Hoje</h2>
      <p class="muted">Contas/contatos cuja última interação registrada tem próxima ação marcada para hoje ou atrasada.</p>

      ${hoje.length === 0 ? '<div class="empty-state">Nenhum follow-up pendente para hoje. 🎉</div>' : `
      <table class="clickable">
        <thead><tr><th>Data prevista</th><th>Conta</th><th>Contato</th><th>Canal previsto</th><th>Próxima ação</th><th>Última observação</th><th></th></tr></thead>
        <tbody>${hoje.map((i) => rowHtml(i, false)).join('')}</tbody>
      </table>`}

      <div class="subsection">
        <button class="ghost" id="btn-toggle-futuros">${this.state.showFuturos ? '▾ Ocultar próximos agendados' : '▸ Ver próximos agendados'}</button>
        ${this.state.showFuturos ? `
          ${futuros.length === 0 ? '<div class="empty-state">Nenhum follow-up futuro agendado.</div>' : `
          <table>
            <thead><tr><th>Data prevista</th><th>Conta</th><th>Contato</th><th>Canal previsto</th><th>Próxima ação</th><th>Última observação</th><th></th></tr></thead>
            <tbody>${futuros.map((i) => rowHtml(i, true)).join('')}</tbody>
          </table>`}
        ` : ''}
      </div>
    `;

    qs('#btn-toggle-futuros', container).addEventListener('click', () => {
      this.state.showFuturos = !this.state.showFuturos;
      this.render(container);
    });

    qsa('[data-goto-conta]', container).forEach((a) => {
      a.addEventListener('click', () => {
        Router.goToAccountDetail(Number(a.dataset.gotoConta));
      });
    });

    qsa('.btn-followup-interagir', container).forEach((btn) => {
      btn.addEventListener('click', () => {
        InteractionsView.openForm({
          contaId: Number(btn.dataset.conta),
          contatoId: btn.dataset.contato ? Number(btn.dataset.contato) : undefined,
        });
      });
    });
  },
};
