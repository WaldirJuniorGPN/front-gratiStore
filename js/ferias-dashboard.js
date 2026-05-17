exigirPermissao('ferias-painel');

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

function mostrarMensagem(texto, tipo = 'erro', timeout = 4000) {
    const el = document.getElementById('mensagem');
    el.textContent = texto;
    el.className = `mensagem ${tipo}`;
    el.hidden = false;
    if (timeout) {
        setTimeout(() => { el.hidden = true; el.className = 'mensagem'; }, timeout);
    }
}

function renderBadgeUrgencia(grau) {
    const safe = grau || 'sem_urgencia';
    const label = GRAU_URGENCIA_LABEL[safe] || safe;
    return `<span class="badge badge-${safe}">${label}</span>`;
}

function atualizarKpis(dashboard) {
    const valores = {
        'sem-direito': dashboard.totalSemDireito,
        'com-direito': dashboard.totalComDireito,
        'urgente': dashboard.totalUrgente,
        'critico': dashboard.totalCritico,
        'irregular': dashboard.totalIrregular
    };
    document.querySelectorAll('.kpi-card').forEach(card => {
        const tipo = card.dataset.kpi;
        const span = card.querySelector('[data-value]');
        const valor = valores[tipo];
        span.textContent = (valor === undefined || valor === null) ? '0' : valor;
    });
    document.getElementById('kpiGrid').setAttribute('aria-busy', 'false');
}

function renderUrgentes(lista) {
    const tbody = document.getElementById('corpoUrgentes');
    if (!Array.isArray(lista) || lista.length === 0) {
        tbody.innerHTML = `
            <tr class="row-empty">
                <td colspan="7">Nenhum atendente em situação urgente no momento. 🎉</td>
            </tr>`;
        return;
    }

    tbody.innerHTML = lista.map(item => {
        const atraso = (item.diasAtraso && item.diasAtraso > 0) ? `${item.diasAtraso} dia(s)` : '—';
        const atrasoClass = (item.diasAtraso && item.diasAtraso > 0) ? 'cell-atraso atrasado' : 'cell-atraso';
        const periodoInicio = formatarData(item.periodoAquisitivoInicio);
        const periodoFim = formatarData(item.periodoAquisitivoFim);
        return `
            <tr data-atendente-id="${item.atendenteId}">
                <td class="cell-name">${item.nome || '—'}</td>
                <td class="cell-muted">${item.loja || '—'}</td>
                <td class="cell-muted">${periodoInicio} → ${periodoFim}</td>
                <td>${formatarData(item.limiteConcessao)}</td>
                <td class="${atrasoClass}">${atraso}</td>
                <td>${renderBadgeUrgencia(item.grauUrgencia)}</td>
                <td class="th-acao">
                    <button class="btn-row" title="Abrir histórico" aria-label="Abrir histórico do atendente">→</button>
                </td>
            </tr>`;
    }).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
        tr.addEventListener('click', () => {
            const id = tr.dataset.atendenteId;
            if (id) window.location.href = `/html/ferias-atendente.html?id=${id}`;
        });
    });
}

async function carregarDashboard() {
    try {
        const dados = await apiGet('/ferias/dashboard');
        atualizarKpis(dados);
        renderUrgentes(dados.proximosAVencer || []);
    } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao carregar o painel de férias.') : 'Não foi possível conectar ao servidor.';
        mostrarMensagem(msg, 'erro');
    }
}

async function exportarPdf() {
    const botao = document.getElementById('btnExportarPdf');
    const textoOriginal = botao.innerHTML;
    botao.disabled = true;
    botao.innerHTML = '<span class="btn-icon">…</span> Gerando PDF';

    try {
        const resp = await apiFetch('/ferias/relatorio/pdf');

        const disposition = resp.headers.get('content-disposition') || '';
        const match = disposition.match(/filename="?([^"]+)"?/i);
        const hoje = new Date().toISOString().slice(0, 10);
        const fileName = match ? match[1] : `relatorio-ferias-${hoje}.pdf`;

        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        mostrarMensagem('Relatório PDF gerado com sucesso!', 'sucesso', 3500);
    } catch (err) {
        console.error('Erro ao exportar PDF:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao gerar o relatório PDF.') : 'Não foi possível baixar o relatório.';
        mostrarMensagem(msg, 'erro');
    } finally {
        botao.disabled = false;
        botao.innerHTML = textoOriginal;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    carregarDashboard();
    document.getElementById('btnExportarPdf').addEventListener('click', exportarPdf);
});
