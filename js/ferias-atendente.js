exigirPermissao('ferias-lista');

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

const state = {
    atendenteId: null,
    historico: null,
    periodoSelecionado: null
};

function formatarData(iso) {
    if (!iso) return '—';
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
}

function diasEntre(inicioIso, fimIso) {
    if (!inicioIso || !fimIso) return 0;
    const inicio = new Date(inicioIso + 'T00:00:00');
    const fim = new Date(fimIso + 'T00:00:00');
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return 0;
    if (fim < inicio) return 0;
    return Math.round((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
}

function badge(tipo, valor) {
    const safe = valor || 'sem_urgencia';
    const dict = tipo === 'status' ? STATUS_LABEL : GRAU_URGENCIA_LABEL;
    const label = dict[safe] || safe;
    return `<span class="badge badge-${safe}">${label}</span>`;
}

function mostrarMensagem(texto, tipo = 'erro', timeout = 4000) {
    const el = document.getElementById('mensagem');
    el.textContent = texto;
    el.className = `mensagem ${tipo}`;
    el.hidden = false;
    if (timeout) setTimeout(() => { el.hidden = true; el.className = 'mensagem'; }, timeout);
}

function classeSaldo(restantes, total) {
    if (total === 0) return '';
    if (restantes === 0) return 'danger';
    if (restantes <= 5) return 'warning';
    return 'ok';
}

function renderRegistros(periodo) {
    if (!periodo.registros || periodo.registros.length === 0) {
        return `<div class="registros-empty">Nenhum registro de férias gozadas neste período.</div>`;
    }
    const linhas = periodo.registros.map(r => `
        <tr>
            <td data-label="Início">${formatarData(r.dataInicio)}</td>
            <td data-label="Fim">${formatarData(r.dataFim)}</td>
            <td data-label="Dias gozados">${r.dias} dia(s)</td>
            <td data-label="Abono">${r.abonoPecuniario ? `<span class="badge badge-abono">${r.diasAbono} dia(s)</span>` : '—'}</td>
            <td data-label="Ações">
                <button class="btn-danger" data-cancelar="${r.id}" data-requer-role="MASTER">Cancelar</button>
            </td>
        </tr>`).join('');

    return `
        <table class="registros-table">
            <thead>
                <tr>
                    <th>Início</th>
                    <th>Fim</th>
                    <th>Dias gozados</th>
                    <th>Abono</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>${linhas}</tbody>
        </table>`;
}

function renderPeriodo(periodo) {
    const total = periodo.diasDireito || 0;
    const usados = periodo.diasGozados || 0;
    const restantes = periodo.diasRestantes ?? Math.max(total - usados, 0);
    const pct = total > 0 ? Math.min(100, Math.round((usados / total) * 100)) : 0;

    const podeRegistrar = periodo.status && periodo.status !== 'em_aquisicao' && restantes > 0;
    const acaoRegistrar = podeRegistrar
        ? `<button class="btn btn-primary" data-registrar="${periodo.id}" data-requer-role="MASTER">＋ Registrar férias</button>`
        : `<button class="btn btn-secondary" disabled title="Sem saldo ou ainda em aquisição">Sem saldo disponível</button>`;

    return `
        <article class="periodo-card" data-periodo-id="${periodo.id}">
            <header class="periodo-head">
                <div>
                    <div class="periodo-titulo">
                        <h3>Período aquisitivo: ${formatarData(periodo.inicio)} → ${formatarData(periodo.fim)}</h3>
                        ${badge('status', periodo.status)}
                        ${badge('urgencia', periodo.grauUrgencia)}
                    </div>
                    <div class="periodo-meta">
                        <span><strong>Limite p/ gozar:</strong> ${formatarData(periodo.limiteConcessao)}</span>
                    </div>
                </div>
                ${acaoRegistrar}
            </header>

            <div class="saldo-grid">
                <div class="saldo-item">
                    <span class="saldo-label">Direito</span>
                    <span class="saldo-value">${total}</span>
                </div>
                <div class="saldo-item">
                    <span class="saldo-label">Gozados</span>
                    <span class="saldo-value">${usados}</span>
                    <div class="progress" aria-hidden="true">
                        <div class="progress-bar" style="width: ${pct}%;"></div>
                    </div>
                </div>
                <div class="saldo-item">
                    <span class="saldo-label">Restantes</span>
                    <span class="saldo-value ${classeSaldo(restantes, total)}">${restantes}</span>
                </div>
            </div>

            <div class="registros">
                <div class="registros-titulo">
                    <h4>Registros de gozo</h4>
                </div>
                ${renderRegistros(periodo)}
            </div>
        </article>`;
}

function renderHistorico() {
    if (!state.historico) return;
    const { nome, loja, dataAdmissao, periodos } = state.historico;
    document.getElementById('nomeAtendente').textContent = nome || '—';
    document.getElementById('lojaAtendente').textContent = loja || '—';
    document.getElementById('admissaoAtendente').textContent = formatarData(dataAdmissao);
    document.getElementById('qtdPeriodos').textContent = (periodos?.length || 0);

    const lista = document.getElementById('listaPeriodos');
    if (!periodos || periodos.length === 0) {
        lista.innerHTML = `<div class="periodos-loading">Atendente ainda não possui períodos aquisitivos registrados.</div>`;
        return;
    }
    lista.innerHTML = periodos.map(renderPeriodo).join('');
    aplicarRoleNoDom(lista);

    lista.querySelectorAll('[data-registrar]').forEach(btn => {
        btn.addEventListener('click', () => abrirModal(btn.dataset.registrar));
    });
    lista.querySelectorAll('[data-cancelar]').forEach(btn => {
        btn.addEventListener('click', () => cancelarRegistro(btn.dataset.cancelar));
    });
}

async function carregarHistorico() {
    try {
        state.historico = await apiGet(`/ferias/atendente/${state.atendenteId}`);
        renderHistorico();
    } catch (err) {
        console.error('Erro ao carregar histórico:', err);
        const msg = err instanceof ApiError ? (err.message || 'Não foi possível carregar o histórico.') : 'Não foi possível conectar ao servidor.';
        mostrarMensagem(msg, 'erro');
        document.getElementById('listaPeriodos').innerHTML = '';
    }
}

/* ===== Modal de registro ===== */
const modal = document.getElementById('modalRegistro');
const inputInicio = document.getElementById('dataInicio');
const inputFim = document.getElementById('dataFim');
const checkboxAbono = document.getElementById('abonoPecuniario');
const grupoAbono = document.getElementById('grupoDiasAbono');
const inputDiasAbono = document.getElementById('diasAbono');
const resumoDias = document.getElementById('resumoDias');
const resumoTotal = document.getElementById('resumoTotal');
const resumoSaldo = document.getElementById('resumoSaldo');
const erroFormulario = document.getElementById('erroFormulario');
const formRegistro = document.getElementById('formRegistro');
const contextoPeriodo = document.getElementById('contextoPeriodo');
const btnConfirmar = document.getElementById('btnConfirmar');

function abrirModal(periodoId) {
    const periodo = state.historico?.periodos?.find(p => String(p.id) === String(periodoId));
    if (!periodo) return;
    state.periodoSelecionado = periodo;

    contextoPeriodo.innerHTML = `
        Período aquisitivo <strong>${formatarData(periodo.inicio)} → ${formatarData(periodo.fim)}</strong> ·
        Saldo disponível: <strong>${periodo.diasRestantes} dia(s)</strong> ·
        Limite: <strong>${formatarData(periodo.limiteConcessao)}</strong>
    `;

    formRegistro.reset();
    grupoAbono.hidden = true;
    inputDiasAbono.value = '0';
    erroFormulario.hidden = true;
    erroFormulario.textContent = '';

    inputInicio.min = periodo.inicio || '';
    inputFim.min = periodo.inicio || '';

    atualizarResumo();
    modal.hidden = false;
    setTimeout(() => inputInicio.focus(), 30);
}

function fecharModal() {
    modal.hidden = true;
    state.periodoSelecionado = null;
}

function calcularLimiteAbono(periodo) {
    const direito = periodo.diasDireito || 0;
    return Math.min(Math.floor(direito / 3), 10);
}

function atualizarResumo() {
    const periodo = state.periodoSelecionado;
    if (!periodo) return;

    const dias = diasEntre(inputInicio.value, inputFim.value);
    const abono = checkboxAbono.checked ? Math.max(0, parseInt(inputDiasAbono.value || '0', 10)) : 0;
    const total = dias + abono;
    const saldoApos = (periodo.diasRestantes ?? 0) - total;

    resumoDias.textContent = dias;
    resumoTotal.textContent = total;
    resumoSaldo.textContent = `${saldoApos} dia(s)`;

    erroFormulario.hidden = true;
    erroFormulario.textContent = '';
}

function validarFormulario() {
    const periodo = state.periodoSelecionado;
    if (!periodo) return 'Selecione um período aquisitivo válido.';
    if (!inputInicio.value || !inputFim.value) return 'Informe a data de início e a data de término.';

    const inicio = new Date(inputInicio.value + 'T00:00:00');
    const fim = new Date(inputFim.value + 'T00:00:00');
    if (fim < inicio) return 'A data de término não pode ser anterior à data de início.';

    const dias = diasEntre(inputInicio.value, inputFim.value);
    const abono = checkboxAbono.checked ? Math.max(0, parseInt(inputDiasAbono.value || '0', 10)) : 0;

    if (dias < 1) return 'O período de gozo precisa ter ao menos 1 dia.';
    if (abono < 0) return 'A quantidade de dias de abono não pode ser negativa.';

    const limiteAbono = calcularLimiteAbono(periodo);
    if (abono > limiteAbono) {
        return `O abono pecuniário não pode exceder ${limiteAbono} dia(s) (1/3 do direito, máx. 10).`;
    }

    if (dias + abono > (periodo.diasRestantes ?? 0)) {
        return `A soma de gozo e abono (${dias + abono}) excede o saldo restante (${periodo.diasRestantes}).`;
    }

    const totalRegistros = (periodo.registros?.length || 0);
    if (totalRegistros >= 3) {
        return 'Já existem 3 registros para este período (limite CLT art. 134).';
    }

    if (totalRegistros > 0) {
        if (dias < 5) return 'Em fracionamento, frações secundárias precisam ter no mínimo 5 dias corridos.';
        const temFracao14 = (periodo.registros || []).some(r => r.dias >= 14) || dias >= 14;
        if (!temFracao14) return 'Pelo menos uma das frações precisa ter no mínimo 14 dias corridos.';
    }

    return null;
}

async function submeterFormulario(event) {
    event.preventDefault();
    const periodo = state.periodoSelecionado;
    if (!periodo) return;

    const erro = validarFormulario();
    if (erro) {
        erroFormulario.textContent = erro;
        erroFormulario.hidden = false;
        return;
    }

    const payload = {
        periodoAquisitivoId: periodo.id,
        dataInicio: inputInicio.value,
        dataFim: inputFim.value,
        abonoPecuniario: checkboxAbono.checked,
        diasAbono: checkboxAbono.checked ? parseInt(inputDiasAbono.value || '0', 10) : 0
    };

    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Salvando...';

    try {
        await apiPost('/ferias/registrar', payload);
        fecharModal();
        mostrarMensagem('Registro de férias salvo com sucesso!', 'sucesso', 3500);
        await carregarHistorico();
    } catch (err) {
        console.error('Erro ao registrar:', err);
        erroFormulario.textContent = err instanceof ApiError
            ? (err.message || 'Erro ao registrar férias.')
            : 'Não foi possível conectar ao servidor.';
        erroFormulario.hidden = false;
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Registrar férias';
    }
}

async function cancelarRegistro(registroId) {
    if (!confirm('Cancelar este registro de férias? O saldo será devolvido ao período.')) return;

    try {
        await apiDelete(`/ferias/registro/${registroId}`);
        mostrarMensagem('Registro cancelado com sucesso. Saldo devolvido.', 'sucesso', 3500);
        await carregarHistorico();
    } catch (err) {
        console.error('Erro ao cancelar registro:', err);
        const msg = err instanceof ApiError ? (err.message || 'Não foi possível cancelar o registro.') : 'Não foi possível conectar ao servidor.';
        mostrarMensagem(msg, 'erro');
    }
}

/* ===== Listeners ===== */
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'), 10);
    if (!id) {
        mostrarMensagem('Atendente não informado na URL.', 'erro', 0);
        document.getElementById('listaPeriodos').innerHTML = '';
        return;
    }
    state.atendenteId = id;
    carregarHistorico();

    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', fecharModal));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) fecharModal();
    });

    inputInicio.addEventListener('change', atualizarResumo);
    inputFim.addEventListener('change', atualizarResumo);
    checkboxAbono.addEventListener('change', () => {
        grupoAbono.hidden = !checkboxAbono.checked;
        if (!checkboxAbono.checked) inputDiasAbono.value = '0';
        atualizarResumo();
    });
    inputDiasAbono.addEventListener('input', atualizarResumo);

    formRegistro.addEventListener('submit', submeterFormulario);
});
