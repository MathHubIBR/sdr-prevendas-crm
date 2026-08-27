// Tela de Dashboard: KPIs de atividade e conversão calculados on-the-fly a partir do SQLite.

const DashboardView = {
  render(container) {
    const toquesPorCanal = Repo.dashboard.toquesPorCanalTotal(30);
    const porEstagio = Repo.dashboard.oportunidadesPorEstagio();
    const toquesPorDia = Repo.dashboard.toquesPorDia(14);
    const totalOportunidades = Repo.dashboard.totalOportunidades();
    const totalGanhas = Repo.dashboard.totalGanhas();
    const atrasados = Repo.dashboard.followupsAtrasadosCount();
    const toques7dias = Repo.dashboard.toquesPorDia(7).reduce((sum, r) => sum + r.total, 0);
    const perdidas = (porEstagio.find((e) => e.estagio === 'Perdido') || {}).total || 0;
    const taxaConversao = (totalGanhas + perdidas) > 0 ? Math.round((totalGanhas / (totalGanhas + perdidas)) * 100) : 0;

    const estagioMap = {};
    STAGES.forEach((s) => (estagioMap[s] = { total: 0, valor_total: 0 }));
    porEstagio.forEach((r) => (estagioMap[r.estagio] = r));
    const maxEstagio = Math.max(1, ...Object.values(estagioMap).map((e) => e.total));

    const maxCanal = Math.max(1, ...toquesPorCanal.map((r) => r.total));

    // Agrupa toques por dia (somando todos os canais) para o gráfico diário.
    const diaMap = {};
    toquesPorDia.forEach((r) => {
      diaMap[r.dia] = (diaMap[r.dia] || 0) + r.total;
    });
    const dias = Object.keys(diaMap).sort();
    const maxDia = Math.max(1, ...Object.values(diaMap));

    container.innerHTML = `
      <h2>Dashboard</h2>

      <div class="kpi-grid">
        <div class="kpi-box"><div class="num">${toques7dias}</div><div class="label">Toques nos últimos 7 dias</div></div>
        <div class="kpi-box"><div class="num">${atrasados}</div><div class="label">Follow-ups atrasados</div></div>
        <div class="kpi-box"><div class="num">${totalOportunidades}</div><div class="label">Oportunidades no funil</div></div>
        <div class="kpi-box"><div class="num">${taxaConversao}%</div><div class="label">Taxa de conversão (Ganho / Ganho+Perdido)</div></div>
      </div>

      <div class="card">
        <h3>Toques por canal (últimos 30 dias)</h3>
        ${toquesPorCanal.length === 0 ? '<div class="empty-state">Sem interações registradas no período.</div>' : toquesPorCanal.map((r) => `
          <div class="bar-row">
            <div>${channelLabel(r.canal)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(r.total / maxCanal) * 100}%"></div></div>
            <div>${r.total}</div>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <h3>Contas por estágio do funil</h3>
        ${STAGES.map((s) => `
          <div class="bar-row">
            <div>${s}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(estagioMap[s].total / maxEstagio) * 100}%"></div></div>
            <div>${estagioMap[s].total}</div>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <h3>Toques por dia (últimos 14 dias)</h3>
        ${dias.length === 0 ? '<div class="empty-state">Sem interações registradas no período.</div>' : dias.map((d) => `
          <div class="bar-row">
            <div>${formatDateBR(d)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(diaMap[d] / maxDia) * 100}%"></div></div>
            <div>${diaMap[d]}</div>
          </div>
        `).join('')}
      </div>
    `;
  },
};
