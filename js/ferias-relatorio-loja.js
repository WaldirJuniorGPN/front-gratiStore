const STATUS_LABEL = {
    em_aquisicao: 'Em aquisição',
    disponivel: 'Disponível',
    parcial: 'Parcial',
    gozado: 'Gozado',
    vencido: 'Vencido'
};

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

function formatarCnpj(cnpj) {
    if (!cnpj) return '—';
    const limpo = String(cnpj).replace(/\D/g, '');
    if (limpo.length !== 14) return cnpj;
    return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function badge(tipo, valor) {
    const safe = valor || 'sem_urgencia';
    const dict = tipo === 'status' ? STATUS_LABEL : GRAU_URGENCIA_LABEL;
    return `<span class="badge badge-${safe}">${dict[safe] || safe}</span>`;
}

function mostrarMensagem(texto, tipo = 'erro', timeout = 4000) {
    const el = document.getElementById('mensagem');
    el.textContent = texto;
    el.className = `mensagem ${tipo}`;
    el.hidden = false;
    if (timeout) setTimeout(() => { el.hidden = true; el.className = 'mensagem'; }, timeout);
}

async function carregarLojas() {
    const select = document.getElementById('lojaSelect');
    try {
        const lojas = await apiGet('/lojas/listar');
        lojas.forEach((loja) => {
            const opt = document.createElement('option');
            opt.value = loja.id;
            opt.textContent = loja.nome;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Erro ao carregar lojas:', err);
        const msg = err instanceof ApiError ? (err.message || 'Não foi possível carregar a lista de lojas.') : 'Não foi possível conectar ao servidor.';
        mostrarMensagem(msg, 'erro');
    }
}

function renderRegistros(registros) {
    if (!registros || registros.length === 0) {
        return '<span class="registros-inline-empty">Sem registros</span>';
    }
    const itens = registros.map(r => {
        const abono = r.abonoPecuniario ? ` · abono: ${r.diasAbono} dia(s)` : '';
        return `<li>${formatarData(r.dataInicio)} → ${formatarData(r.dataFim)} · ${r.dias} dia(s)${abono}</li>`;
    }).join('');
    return `<ul class="registros-inline">${itens}</ul>`;
}

function renderPeriodos(periodos) {
    if (!periodos || periodos.length === 0) {
        return `<tr><td colspan="6" class="atendente-empty">Sem períodos aquisitivos registrados.</td></tr>`;
    }
    return periodos.map(p => `
        <tr>
            <td data-label="Período">${formatarData(p.inicio)} → ${formatarData(p.fim)}</td>
            <td data-label="Limite p/ gozar">${formatarData(p.limiteConcessao)}</td>
            <td data-label="Status">${badge('status', p.status)}</td>
            <td data-label="Grau">${badge('urgencia', p.grauUrgencia)}</td>
            <td data-label="Saldo (direito · gozados · restantes)">
                <strong>${p.diasDireito ?? 0}</strong> · ${p.diasGozados ?? 0} · ${p.diasRestantes ?? 0}
            </td>
            <td data-label="Registros">${renderRegistros(p.registros)}</td>
        </tr>`).join('');
}

function renderRelatorio(relatorio) {
    document.getElementById('lojaResumo').hidden = false;
    document.getElementById('resumoNome').textContent = relatorio.nomeLoja || '—';
    document.getElementById('resumoCnpj').textContent = formatarCnpj(relatorio.cnpj);
    document.getElementById('resumoAtendentes').textContent = (relatorio.atendentes?.length || 0);

    const conteudo = document.getElementById('conteudoRelatorio');

    if (!relatorio.atendentes || relatorio.atendentes.length === 0) {
        conteudo.innerHTML = `<div class="placeholder">Nenhum atendente ativo encontrado para esta loja.</div>`;
        return;
    }

    conteudo.innerHTML = relatorio.atendentes.map(a => `
        <article class="atendente-bloco">
            <header class="atendente-bloco-head">
                <div>
                    <h3>${a.nomeAtendente || '—'}</h3>
                    <span class="meta"><strong>Admissão:</strong> ${formatarData(a.dataAdmissao)} · <strong>Períodos:</strong> ${a.periodos?.length || 0}</span>
                </div>
                <a href="/html/ferias-atendente.html?id=${a.atendenteId}">Abrir histórico →</a>
            </header>
            <div class="table-wrapper">
                <table class="periodos-table">
                    <thead>
                        <tr>
                            <th>Período</th>
                            <th>Limite p/ gozar</th>
                            <th>Status</th>
                            <th>Grau</th>
                            <th>Saldo</th>
                            <th>Registros</th>
                        </tr>
                    </thead>
                    <tbody>${renderPeriodos(a.periodos)}</tbody>
                </table>
            </div>
        </article>`).join('');
}

async function carregarRelatorio(lojaId) {
    const conteudo = document.getElementById('conteudoRelatorio');
    document.getElementById('lojaResumo').hidden = true;

    if (!lojaId) {
        conteudo.innerHTML = `<div class="placeholder"><p>Selecione uma loja para visualizar o relatório.</p></div>`;
        return;
    }

    conteudo.innerHTML = `<div class="placeholder"><p>Carregando relatório...</p></div>`;

    try {
        const data = await apiGet(`/ferias/loja/${lojaId}`);
        renderRelatorio(data);
    } catch (err) {
        console.error('Erro ao carregar relatório:', err);
        const msg = err instanceof ApiError ? (err.message || 'Não foi possível carregar o relatório.') : 'Não foi possível conectar ao servidor.';
        mostrarMensagem(msg, 'erro');
        conteudo.innerHTML = `<div class="placeholder"><p>Erro ao carregar o relatório.</p></div>`;
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
    carregarLojas();

    document.getElementById('lojaSelect').addEventListener('change', (e) => {
        carregarRelatorio(e.target.value);
    });

    document.getElementById('btnExportarPdf').addEventListener('click', exportarPdf);
});
