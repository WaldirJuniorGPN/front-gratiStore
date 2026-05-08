const API_BASE_URL = 'http://localhost:8080';

const GRAU_URGENCIA_LABEL = {
    sem_urgencia: 'Sem urgência',
    atencao: 'Atenção',
    urgente: 'Urgente',
    critico: 'Crítico',
    irregular: 'Irregular'
};

function formatarData(iso) {
    if (!iso) return '—';
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
}

function badgeUrgencia(grau) {
    const safe = grau || 'sem_urgencia';
    return `<span class="badge badge-${safe}">${GRAU_URGENCIA_LABEL[safe] || safe}</span>`;
}

const TABS = {
    'com-direito': {
        endpoint: '/ferias/com-direito',
        titulo: 'Atendentes com direito',
        subtitulo: 'Atendentes com período aquisitivo concluído e dentro do prazo concessional.',
        emptyMsg: 'Nenhum atendente com saldo disponível neste momento.',
        colunas: [
            { th: 'Atendente' },
            { th: 'Loja' },
            { th: 'Período aquisitivo' },
            { th: 'Direito' },
            { th: 'Gozados' },
            { th: 'Restantes' },
            { th: 'Limite p/ gozar' },
            { th: 'Grau' }
        ],
        renderRow: (item) => {
            const restantesClass = (item.diasRestantes != null && item.diasRestantes <= 5) ? 'cell-restantes-baixo' : '';
            return `
                <tr data-atendente-id="${item.atendenteId}">
                    <td class="cell-name">${item.nome || '—'}</td>
                    <td class="cell-muted">${item.loja || '—'}</td>
                    <td class="cell-muted">${formatarData(item.periodoAquisitivoInicio)} → ${formatarData(item.periodoAquisitivoFim)}</td>
                    <td>${item.diasDireito ?? '—'}</td>
                    <td>${item.diasGozados ?? '—'}</td>
                    <td class="${restantesClass}">${item.diasRestantes ?? '—'}</td>
                    <td>${formatarData(item.limiteConcessao)}</td>
                    <td>${badgeUrgencia(item.grauUrgencia)}</td>
                </tr>`;
        }
    },
    'vencidas': {
        endpoint: '/ferias/vencidas',
        titulo: 'Férias a vencer ou vencidas',
        subtitulo: 'Períodos com grau urgente, crítico ou irregular (a até 120 dias do limite ou já vencidos).',
        emptyMsg: 'Nenhuma férias vencida ou próxima do vencimento. 🎉',
        colunas: [
            { th: 'Atendente' },
            { th: 'Loja' },
            { th: 'Período aquisitivo' },
            { th: 'Limite p/ gozar' },
            { th: 'Atraso' },
            { th: 'Grau' }
        ],
        renderRow: (item) => {
            const atraso = (item.diasAtraso && item.diasAtraso > 0) ? `${item.diasAtraso} dia(s)` : '—';
            const atrasoClass = (item.diasAtraso && item.diasAtraso > 0) ? 'cell-atraso atrasado' : 'cell-atraso';
            return `
                <tr data-atendente-id="${item.atendenteId}">
                    <td class="cell-name">${item.nome || '—'}</td>
                    <td class="cell-muted">${item.loja || '—'}</td>
                    <td class="cell-muted">${formatarData(item.periodoAquisitivoInicio)} → ${formatarData(item.periodoAquisitivoFim)}</td>
                    <td>${formatarData(item.limiteConcessao)}</td>
                    <td class="${atrasoClass}">${atraso}</td>
                    <td>${badgeUrgencia(item.grauUrgencia)}</td>
                </tr>`;
        }
    },
    'sem-direito': {
        endpoint: '/ferias/sem-direito',
        titulo: 'Atendentes sem direito',
        subtitulo: 'Atendentes ativos cujo período aquisitivo (12 meses) ainda não foi concluído.',
        emptyMsg: 'Todos os atendentes já completaram seu primeiro período aquisitivo.',
        colunas: [
            { th: 'Atendente' },
            { th: 'Loja' },
            { th: 'Admissão' },
            { th: 'Dias até o direito' }
        ],
        renderRow: (item) => `
            <tr data-atendente-id="${item.atendenteId}">
                <td class="cell-name">${item.nome || '—'}</td>
                <td class="cell-muted">${item.loja || '—'}</td>
                <td>${formatarData(item.dataAdmissao)}</td>
                <td>${item.diasRestantesParaDireito ?? '—'} dia(s)</td>
            </tr>`
    }
};

const state = {
    tab: 'com-direito',
    page: 0,
    size: 20,
    totalPages: 1,
    totalElements: 0
};

function mostrarMensagem(texto, tipo = 'erro', timeout = 4000) {
    const el = document.getElementById('mensagem');
    el.textContent = texto;
    el.className = `mensagem ${tipo}`;
    el.hidden = false;
    if (timeout) setTimeout(() => { el.hidden = true; el.className = 'mensagem'; }, timeout);
}

function renderHeader(config) {
    const thead = document.getElementById('cabecalhoLista');
    thead.innerHTML = `<tr>${config.colunas.map(c => `<th>${c.th}</th>`).join('')}</tr>`;
}

function setLoading(colspan) {
    document.getElementById('corpoLista').innerHTML = `
        <tr class="row-loading"><td colspan="${colspan}">Carregando...</td></tr>`;
}

function renderEmpty(config) {
    document.getElementById('corpoLista').innerHTML = `
        <tr class="row-empty"><td colspan="${config.colunas.length}">${config.emptyMsg}</td></tr>`;
}

function renderRows(config, rows) {
    if (!rows || rows.length === 0) {
        renderEmpty(config);
        return;
    }
    const tbody = document.getElementById('corpoLista');
    tbody.innerHTML = rows.map(config.renderRow).join('');
    tbody.querySelectorAll('tr').forEach(tr => {
        tr.addEventListener('click', () => {
            const id = tr.dataset.atendenteId;
            if (id) window.location.href = `/html/ferias-atendente.html?id=${id}`;
        });
    });
}

function atualizarPaginacao() {
    const btnAnterior = document.getElementById('btnAnterior');
    const btnProximo = document.getElementById('btnProximo');
    const paginaAtual = document.getElementById('paginaAtual');
    const footerInfo = document.getElementById('footerInfo');

    btnAnterior.disabled = state.page <= 0;
    btnProximo.disabled = state.page >= state.totalPages - 1;
    paginaAtual.textContent = `Página ${state.page + 1} de ${Math.max(state.totalPages, 1)}`;

    if (state.totalElements === 0) {
        footerInfo.textContent = 'Nenhum resultado encontrado.';
    } else {
        const inicio = state.page * state.size + 1;
        const fim = Math.min((state.page + 1) * state.size, state.totalElements);
        footerInfo.textContent = `Exibindo ${inicio}–${fim} de ${state.totalElements} resultado(s).`;
    }
}

async function carregarTab() {
    const config = TABS[state.tab];
    if (!config) return;

    document.getElementById('tituloLista').textContent = config.titulo;
    document.getElementById('subtituloLista').textContent = config.subtitulo;
    renderHeader(config);
    setLoading(config.colunas.length);

    try {
        const url = `${API_BASE_URL}${config.endpoint}?page=${state.page}&size=${state.size}`;
        const resp = await fetch(url);
        if (!resp.ok) {
            const err = await resp.json().catch(() => null);
            mostrarMensagem(err?.message || 'Erro ao carregar a lista.', 'erro');
            renderEmpty(config);
            return;
        }
        const data = await resp.json();
        state.totalPages = data.totalPages || 1;
        state.totalElements = data.totalElements || 0;
        renderRows(config, data.content || []);
        atualizarPaginacao();
    } catch (err) {
        console.error('Erro ao carregar lista:', err);
        mostrarMensagem('Não foi possível conectar ao servidor.', 'erro');
        renderEmpty(config);
    }
}

function selecionarTab(novoTab, push = true) {
    if (!TABS[novoTab]) return;
    state.tab = novoTab;
    state.page = 0;
    document.querySelectorAll('.tab').forEach(btn => {
        btn.setAttribute('aria-selected', btn.dataset.tab === novoTab ? 'true' : 'false');
    });
    if (push) {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', novoTab);
        window.history.replaceState({}, '', url);
    }
    carregarTab();
}

function lerTabDaUrl() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    return TABS[tab] ? tab : 'com-direito';
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => selecionarTab(btn.dataset.tab));
    });

    document.getElementById('pageSize').addEventListener('change', (e) => {
        state.size = parseInt(e.target.value, 10) || 20;
        state.page = 0;
        carregarTab();
    });

    document.getElementById('btnAnterior').addEventListener('click', () => {
        if (state.page > 0) {
            state.page--;
            carregarTab();
        }
    });

    document.getElementById('btnProximo').addEventListener('click', () => {
        if (state.page < state.totalPages - 1) {
            state.page++;
            carregarTab();
        }
    });

    selecionarTab(lerTabDaUrl(), false);
});
