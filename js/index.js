const mensagemDiv = document.getElementById('mensagem');
const ultimaAtualizacaoEl = document.getElementById('ultimaAtualizacao');
const btnAtualizar = document.getElementById('btnAtualizar');
const kpiGrid = document.getElementById('kpiGrid');

const kpiLojasEl = document.getElementById('kpiLojas');
const kpiAtendentesEl = document.getElementById('kpiAtendentes');
const kpiVendasEl = document.getElementById('kpiVendas');
const kpiCalcsEl = document.getElementById('kpiCalculadoras');
const corpoRanking = document.getElementById('corpoRanking');
const feriasMiniInfo = document.getElementById('feriasMiniInfo');

const statusLojasEl = document.getElementById('statusLojas');
const statusCalcsEl = document.getElementById('statusCalcs');
const statusDestinatariosEl = document.getElementById('statusDestinatarios');

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function formatarNumero(valor) {
    return new Intl.NumberFormat('pt-BR').format(valor || 0);
}

function formatarHora(date) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function mostrarMensagem(texto, tipo = 'erro', timeout = 5000) {
    mensagemDiv.textContent = texto;
    mensagemDiv.className = `mensagem ${tipo}`;
    mensagemDiv.hidden = false;
    if (timeout) {
        setTimeout(() => {
            mensagemDiv.hidden = true;
            mensagemDiv.className = 'mensagem';
            mensagemDiv.textContent = '';
        }, timeout);
    }
}

async function safeApiGet(path, fallback = null) {
    try {
        return await apiGet(path);
    } catch (err) {
        console.error(`Erro em GET ${path}:`, err);
        return fallback;
    }
}

/**
 * Tira um widget do dashboard de cena por completo (TASK-03): some do fluxo
 * (o grid reflui sem coluna fantasma — ver css/index.css) e sai da árvore de
 * acessibilidade. Usado quando a página dona do widget está bloqueada para o
 * usuário — o card NÃO é renderizado com "—"/"R$ 0,00" (mentira), ele não
 * existe. `[data-widget]` casa o mapa do Apêndice B da TASK-00.
 * @param {string} id ID do widget (ex.: `'kpi-vendas'`).
 */
function removerWidget(id) {
    document.querySelectorAll(`[data-widget="${id}"]`).forEach((el) => {
        el.hidden = true;
        el.setAttribute('aria-hidden', 'true');
    });
}

/**
 * Mantém o par Ranking + Férias equilibrado conforme quantos sobraram:
 *  - 2 visíveis  → layout normal (2 colunas).
 *  - 1 visível   → `--solo`: o que restou ocupa a largura toda (sem metade vazia).
 *  - 0 visíveis  → esconde o wrapper inteiro (sem faixa vazia entre seções).
 * Idempotente (recalcula do estado atual) — seguro a cada "Atualizar".
 */
function ajustarDashboardGrid() {
    const grid = document.querySelector('.dashboard-grid');
    if (!grid) return;
    const ranking = grid.querySelector('[data-widget="ranking-vendas"]');
    const ferias = grid.querySelector('[data-widget="ferias-mini"]');
    const visiveis = (ranking && !ranking.hidden ? 1 : 0) + (ferias && !ferias.hidden ? 1 : 0);

    if (visiveis === 0) {
        grid.hidden = true;
        grid.setAttribute('aria-hidden', 'true');
        grid.classList.remove('dashboard-grid--solo');
    } else {
        grid.hidden = false;
        grid.removeAttribute('aria-hidden');
        grid.classList.toggle('dashboard-grid--solo', visiveis === 1);
    }
}

async function carregarDashboard() {
    // "Modo tolerante" durante a carga: se um 403 residual escapar (revogação
    // no meio da sessão — TASK-00 §3), o listener global de `gs:forbidden`
    // (role-guard.js / TASK-06) não deve cuspir o toast vermelho de "acesso
    // negado" na Início — aqui o widget só some (princípio nº 2). O flag é
    // baixado no `finally`, restaurando o comportamento normal fora da Início.
    window.__gsDashboardTolerante = true;
    kpiGrid.setAttribute('aria-busy', 'true');
    btnAtualizar.disabled = true;
    ultimaAtualizacaoEl.textContent = 'Carregando...';

    // Decide ANTES de chamar: sem a página dona, nem fetch nem render do
    // widget. `temPermissao` (TASK-01) lê as permissões da sessão; MASTER
    // bypassa. Fail-open de UX se o guard não estiver carregado — a barreira
    // real é o 403 do backend (TASK-00 §B3), nunca o front.
    const podeVendas = typeof temPermissao !== 'function' || temPermissao('resultados');
    const podeFerias = typeof temPermissao !== 'function' || temPermissao('ferias-painel');

    if (podeVendas) {
        corpoRanking.innerHTML = '<tr class="row-loading"><td colspan="5">Carregando ranking...</td></tr>';
    } else {
        // Sem "Resultados": o KPI de vendas e o ranking não existem para ele,
        // e `/lojas/*/vendas` nem é chamado (Network coerente — princípio nº 3).
        removerWidget('kpi-vendas');
        removerWidget('ranking-vendas');
    }
    if (!podeFerias) {
        removerWidget('ferias-mini');
    }
    ajustarDashboardGrid();

    try {
        const lojas = await safeApiGet('/lojas/listar', []);

        const [vendasRaw, atendentesPorLoja, calculadoras, ferias, destinatariosPage] = await Promise.all([
            podeVendas
                ? Promise.all(
                    lojas.map((l) =>
                        safeApiGet(`/lojas/${l.id}/vendas`, null)
                            .then((d) => ({ lojaId: l.id, valor: Number(d?.valor || 0), ok: d !== null }))
                    )
                )
                : Promise.resolve(null),
            Promise.all(
                lojas.map((l) =>
                    safeApiGet(`/lojas/${l.id}/atendentes`, [])
                        .then((d) => ({ lojaId: l.id, qtd: Array.isArray(d) ? d.length : 0 }))
                )
            ),
            safeApiGet('/calculadoras/listar', []),
            podeFerias ? safeApiGet('/ferias/dashboard', null) : Promise.resolve(null),
            safeApiGet('/notificacoes/destinatarios?page=0&size=1', null)
        ]);

        // Defesa em profundidade: se há lojas mas TODAS as chamadas distintivas
        // de vendas falharam (revogação no meio da sessão → 403 residual em
        // `/lojas/*/vendas`, ou o endpoint fora), não há dado algum — o widget
        // é removido, não exibido zerado ("R$ 0,00" fake é mentira; melhor não
        // existir — TASK-03 "honestidade dos totais"). Falha pontual de uma
        // loja segue contando 0, como antes (comportamento idêntico ao de hoje).
        let vendasPorLoja = vendasRaw;
        if (vendasRaw && lojas.length && vendasRaw.every((v) => !v.ok)) {
            vendasPorLoja = null;
            removerWidget('kpi-vendas');
            removerWidget('ranking-vendas');
        }

        renderizarKpis({ lojas, vendasPorLoja, atendentesPorLoja, calculadoras });
        if (vendasPorLoja) {
            renderizarRanking({ lojas, vendasPorLoja, atendentesPorLoja });
        }
        renderizarFerias(ferias, podeFerias);
        renderizarStatus({ lojas, calculadoras, destinatariosPage });
        ajustarDashboardGrid();

        const agora = new Date();
        ultimaAtualizacaoEl.textContent = `Atualizado às ${formatarHora(agora)}`;
        kpiGrid.setAttribute('aria-busy', 'false');
        btnAtualizar.disabled = false;
    } finally {
        window.__gsDashboardTolerante = false;
    }
}

function renderizarKpis({ lojas, vendasPorLoja, atendentesPorLoja, calculadoras }) {
    kpiLojasEl.textContent = formatarNumero(lojas.length);
    const totalAtendentes = atendentesPorLoja.reduce((acc, x) => acc + x.qtd, 0);
    kpiAtendentesEl.textContent = formatarNumero(totalAtendentes);
    // Totais honestos: só soma o que foi carregado. Sem "Resultados"
    // (`vendasPorLoja === null`) o card já foi removido — não escrever
    // "R$ 0,00" nele seria mentir sobre um dado que o usuário não pode ver.
    if (vendasPorLoja) {
        const totalVendas = vendasPorLoja.reduce((acc, x) => acc + x.valor, 0);
        kpiVendasEl.textContent = formatarMoeda(totalVendas);
    }
    kpiCalcsEl.textContent = formatarNumero(Array.isArray(calculadoras) ? calculadoras.length : 0);
}

function renderizarRanking({ lojas, vendasPorLoja, atendentesPorLoja }) {
    corpoRanking.innerHTML = '';

    if (!lojas.length) {
        const tr = document.createElement('tr');
        tr.className = 'row-empty';
        const td = document.createElement('td');
        td.colSpan = 5;
        td.textContent = 'Nenhuma loja cadastrada ainda.';
        tr.appendChild(td);
        corpoRanking.appendChild(tr);
        return;
    }

    const totalVendas = vendasPorLoja.reduce((acc, x) => acc + x.valor, 0);
    const lookupVendas = Object.fromEntries(vendasPorLoja.map(v => [v.lojaId, v.valor]));
    const lookupAtendentes = Object.fromEntries(atendentesPorLoja.map(a => [a.lojaId, a.qtd]));

    const ranking = [...lojas]
        .map(l => ({
            id: l.id,
            nome: l.nome,
            vendas: lookupVendas[l.id] || 0,
            qtdAtendentes: lookupAtendentes[l.id] || 0
        }))
        .sort((a, b) => b.vendas - a.vendas);

    ranking.forEach((item, idx) => {
        const tr = document.createElement('tr');
        const pct = totalVendas > 0 ? (item.vendas / totalVendas) * 100 : 0;
        const medal = idx < 3 ? 'cell-rank cell-rank-medal' : 'cell-rank';

        tr.innerHTML = `
            <td class="${medal}">${idx + 1}</td>
            <td class="cell-name">${item.nome || '—'}</td>
            <td class="cell-num">${formatarNumero(item.qtdAtendentes)}</td>
            <td class="cell-num cell-currency">${formatarMoeda(item.vendas)}</td>
            <td>
                <div class="bar-wrap">
                    <div class="bar-track"><div class="bar-fill" style="width: ${pct.toFixed(1)}%"></div></div>
                    <span class="bar-pct">${pct.toFixed(1)}%</span>
                </div>
            </td>
        `;
        corpoRanking.appendChild(tr);
    });
}

function renderizarFerias(ferias, podeFerias) {
    // Sem o "Painel de Férias": o widget não existe para este usuário
    // (`/ferias/dashboard` nem foi chamado). Defesa em profundidade: se
    // tinha acesso mas a chamada falhou — inclusive 403 residual por
    // revogação no meio da sessão (TASK-00 §3) — o `safeApiGet` devolveu o
    // fallback `null` e o widget é removido, não exibido com erro/"—".
    if (!podeFerias || !ferias) {
        removerWidget('ferias-mini');
        return;
    }
    const map = {
        comDireito: ferias.totalComDireito,
        semDireito: ferias.totalSemDireito,
        urgente: ferias.totalUrgente,
        critico: ferias.totalCritico,
        irregular: ferias.totalIrregular
    };
    document.querySelectorAll('[data-ferias]').forEach(el => {
        const chave = el.dataset.ferias;
        const valor = map[chave];
        el.textContent = (valor === undefined || valor === null) ? '0' : formatarNumero(valor);
    });
    feriasMiniInfo.hidden = true;
}

function renderizarStatus({ lojas, calculadoras, destinatariosPage }) {
    statusLojasEl.textContent = formatarNumero(lojas.length);
    statusCalcsEl.textContent = formatarNumero(Array.isArray(calculadoras) ? calculadoras.length : 0);

    let totalDestinatarios = 0;
    if (destinatariosPage) {
        if (typeof destinatariosPage.totalElements === 'number') {
            totalDestinatarios = destinatariosPage.totalElements;
        } else if (Array.isArray(destinatariosPage.content)) {
            totalDestinatarios = destinatariosPage.content.length;
        } else if (Array.isArray(destinatariosPage)) {
            totalDestinatarios = destinatariosPage.length;
        }
    }
    statusDestinatariosEl.textContent = formatarNumero(totalDestinatarios);
}

btnAtualizar.addEventListener('click', () => {
    carregarDashboard().catch(err => {
        console.error('Erro ao atualizar dashboard:', err);
        mostrarMensagem('Erro ao atualizar dados.', 'erro');
        btnAtualizar.disabled = false;
    });
});

document.addEventListener('DOMContentLoaded', () => {
    carregarDashboard().catch(err => {
        console.error('Erro inicial:', err);
        mostrarMensagem('Erro ao carregar o dashboard.', 'erro');
    });
});
