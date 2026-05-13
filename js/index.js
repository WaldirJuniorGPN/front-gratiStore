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

async function carregarDashboard() {
    kpiGrid.setAttribute('aria-busy', 'true');
    btnAtualizar.disabled = true;
    ultimaAtualizacaoEl.textContent = 'Carregando...';
    corpoRanking.innerHTML = '<tr class="row-loading"><td colspan="5">Carregando ranking...</td></tr>';

    const lojas = await safeApiGet('/lojas/listar', []);

    const [vendasPorLoja, atendentesPorLoja, calculadoras, ferias, destinatariosPage] = await Promise.all([
        Promise.all(
            lojas.map((l) =>
                safeApiGet(`/lojas/${l.id}/vendas`, { valor: 0 })
                    .then((d) => ({ lojaId: l.id, valor: Number(d?.valor || 0) }))
            )
        ),
        Promise.all(
            lojas.map((l) =>
                safeApiGet(`/lojas/${l.id}/atendentes`, [])
                    .then((d) => ({ lojaId: l.id, qtd: Array.isArray(d) ? d.length : 0 }))
            )
        ),
        safeApiGet('/calculadoras/listar', []),
        safeApiGet('/ferias/dashboard', null),
        safeApiGet('/notificacoes/destinatarios?page=0&size=1', null)
    ]);

    renderizarKpis({ lojas, vendasPorLoja, atendentesPorLoja, calculadoras });
    renderizarRanking({ lojas, vendasPorLoja, atendentesPorLoja });
    renderizarFerias(ferias);
    renderizarStatus({ lojas, calculadoras, destinatariosPage });

    const agora = new Date();
    ultimaAtualizacaoEl.textContent = `Atualizado às ${formatarHora(agora)}`;
    kpiGrid.setAttribute('aria-busy', 'false');
    btnAtualizar.disabled = false;
}

function renderizarKpis({ lojas, vendasPorLoja, atendentesPorLoja, calculadoras }) {
    kpiLojasEl.textContent = formatarNumero(lojas.length);
    const totalAtendentes = atendentesPorLoja.reduce((acc, x) => acc + x.qtd, 0);
    kpiAtendentesEl.textContent = formatarNumero(totalAtendentes);
    const totalVendas = vendasPorLoja.reduce((acc, x) => acc + x.valor, 0);
    kpiVendasEl.textContent = formatarMoeda(totalVendas);
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

function renderizarFerias(ferias) {
    if (!ferias) {
        document.querySelectorAll('[data-ferias]').forEach(el => { el.textContent = '—'; });
        feriasMiniInfo.textContent = 'Não foi possível carregar os dados de férias.';
        feriasMiniInfo.hidden = false;
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
