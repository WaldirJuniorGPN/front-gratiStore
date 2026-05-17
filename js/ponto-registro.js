exigirPermissao('ponto-registro');

const STATUS_LABEL = {
    COMUM: 'Comum',
    FERIADO: 'Feriado',
    ATESTADO_INTEGRAL: 'Atestado integral',
    ATESTADO_MATUTINO: 'Atestado (manhã)',
    ATESTADO_VESPERTINO: 'Atestado (tarde)',
    FOLGA: 'Folga',
    FALTA: 'Falta',
    DESCONTAR_EM_HORAS: 'Descontar em horas'
};

const lojaSelect = document.getElementById('lojaSelect');
const atendenteSelect = document.getElementById('atendenteSelect');
const mesAnoInput = document.getElementById('mesAno');
const calendarioContainer = document.getElementById('calendarioContainer');
const calendarTitulo = document.getElementById('calendarTitulo');
const calendarLegend = document.getElementById('calendarLegend');
const resumoMes = document.getElementById('resumoMes');
const mensagemDiv = document.getElementById('mensagem');

const modalDia = document.getElementById('modalDia');
const modalTitulo = document.getElementById('modalTitulo');
const modalDayInfo = document.getElementById('modalDayInfo');
const formDia = document.getElementById('formDia');
const inputStatus = document.getElementById('status');
const inputEntrada = document.getElementById('entrada');
const inputInicioAlmoco = document.getElementById('inicioAlmoco');
const inputFimAlmoco = document.getElementById('fimAlmoco');
const inputSaida = document.getElementById('saida');
const totalContainer = document.getElementById('totalContainer');
const totalValue = document.getElementById('totalValue');
const erroFormulario = document.getElementById('erroFormulario');
const hintHorarios = document.getElementById('hintHorarios');
const btnSalvar = document.getElementById('btnSalvar');
const btnSalvarProximo = document.getElementById('btnSalvarProximo');
const btnExcluir = document.getElementById('btnExcluir');

const modalExcluir = document.getElementById('modalExcluir');
const diaParaExcluirEl = document.getElementById('diaParaExcluir');
const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');

let registrosAtuais = [];
let edicaoAtual = null; // { dataIso, dataObj, registroId? }
let registroParaExcluir = null;

const STATUS_SEM_HORARIOS = ['FOLGA', 'FALTA', 'ATESTADO_INTEGRAL'];

function pad2(n) { return String(n).padStart(2, '0'); }

function formatarData(iso) {
    if (!iso) return '—';
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
}

function formatarDataLonga(dataObj) {
    return dataObj.toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
}

function diaSemana(dataObj) {
    return dataObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

function ehHoje(dataObj) {
    const hoje = new Date();
    return dataObj.getFullYear() === hoje.getFullYear()
        && dataObj.getMonth() === hoje.getMonth()
        && dataObj.getDate() === hoje.getDate();
}

function dateToIso(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getInicioAlmoco(r) {
    return r?.inicioAlmoco || r?.incioAlmoco || '';
}

function calcularTotal(entrada, inicioAlmoco, fimAlmoco, saida) {
    if (!entrada || !saida) return null;
    const m = (t) => {
        const [h, mi] = t.split(':').map(Number);
        return h * 60 + (mi || 0);
    };
    let total = m(saida) - m(entrada);
    if (inicioAlmoco && fimAlmoco) total -= (m(fimAlmoco) - m(inicioAlmoco));
    if (total < 0 || isNaN(total)) return null;
    return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

function mostrarMensagem(texto, tipo = 'erro', timeout = 4000) {
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

function mostrarErroForm(texto) {
    erroFormulario.textContent = texto;
    erroFormulario.hidden = false;
}

function limparErroForm() {
    erroFormulario.hidden = true;
    erroFormulario.textContent = '';
}

async function carregarLojas() {
    try {
        const lojas = await apiGet('/lojas/listar');
        lojas.forEach((l) => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.nome;
            lojaSelect.appendChild(opt);
        });
    } catch (err) {
        console.error('Erro ao carregar lojas:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao carregar a lista de lojas.') : 'Erro de conexão com o servidor.';
        mostrarMensagem(msg, 'erro');
    }
}

async function carregarAtendentes(lojaId) {
    atendenteSelect.innerHTML = '<option value="">Selecione um funcionário...</option>';
    if (!lojaId) {
        atendenteSelect.disabled = true;
        return;
    }
    try {
        const atendentes = await apiGet(`/lojas/${lojaId}/atendentes`);
        atendentes.forEach((a) => {
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = a.nome;
            atendenteSelect.appendChild(opt);
        });
        atendenteSelect.disabled = false;
    } catch (err) {
        console.error('Erro ao carregar atendentes:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao carregar funcionários.') : 'Erro de conexão com o servidor.';
        mostrarMensagem(msg, 'erro');
    }
}

async function carregarHistorico(atendenteId, ano, mes) {
    const registros = [];
    let page = 0;
    while (true) {
        try {
            const data = await apiGet(`/ponto?page=${page}&size=1000`);
            const lista = data.content || data;
            if (!Array.isArray(lista) || lista.length === 0) break;
            registros.push(...lista);
            if (data.totalPages && page >= data.totalPages - 1) break;
            page++;
        } catch (err) {
            console.error('Erro ao buscar histórico:', err);
            break;
        }
    }
    return registros.filter((r) => r.atendenteId === atendenteId && r.data && r.data.startsWith(`${ano}-${mes}`));
}

function getSemanasDoMes(mes, ano) {
    const semanas = [];
    const primeiroDia = new Date(ano, mes - 1, 1);
    const ultimoDia = new Date(ano, mes, 0);
    let cursor = new Date(primeiroDia);
    cursor.setDate(cursor.getDate() - cursor.getDay()); // recua até domingo

    while (cursor <= ultimoDia || cursor.getDay() !== 0) {
        const semana = [];
        for (let i = 0; i < 7; i++) {
            semana.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        semanas.push(semana);
    }
    return semanas;
}

function atualizarResumo(registros, ano, mes) {
    const contagem = {
        comum: 0, folga: 0, falta: 0, atestado: 0,
        feriado: 0, descontar: 0, vazio: 0
    };
    registros.forEach(r => {
        switch (r.status) {
            case 'COMUM': contagem.comum++; break;
            case 'FOLGA': contagem.folga++; break;
            case 'FALTA': contagem.falta++; break;
            case 'ATESTADO_INTEGRAL':
            case 'ATESTADO_MATUTINO':
            case 'ATESTADO_VESPERTINO': contagem.atestado++; break;
            case 'FERIADO': contagem.feriado++; break;
            case 'DESCONTAR_EM_HORAS': contagem.descontar++; break;
        }
    });
    const totalDiasMes = new Date(ano, mes, 0).getDate();
    contagem.vazio = Math.max(0, totalDiasMes - registros.length);

    Object.entries(contagem).forEach(([k, v]) => {
        const el = resumoMes.querySelector(`[data-resumo="${k}"]`);
        if (el) el.textContent = v;
    });
    resumoMes.hidden = false;
}

async function exibirCalendario() {
    const mesAno = mesAnoInput.value;
    const atendenteId = parseInt(atendenteSelect.value);

    if (!mesAno || !atendenteId) {
        calendarioContainer.innerHTML = '<p class="calendar-placeholder">Selecione loja, funcionário e mês para visualizar o calendário.</p>';
        resumoMes.hidden = true;
        calendarLegend.hidden = true;
        calendarTitulo.textContent = 'Calendário';
        return;
    }

    calendarioContainer.innerHTML = '<p class="calendar-loading">Carregando calendário...</p>';
    calendarLegend.hidden = true;

    const [anoStr, mesStr] = mesAno.split('-');
    const ano = parseInt(anoStr);
    const mes = parseInt(mesStr);

    registrosAtuais = await carregarHistorico(atendenteId, anoStr, mesStr);
    const nomeFuncionario = atendenteSelect.options[atendenteSelect.selectedIndex]?.textContent || '';
    const nomeMes = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    calendarTitulo.textContent = `${nomeFuncionario} — ${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}`;

    const semanas = getSemanasDoMes(mes, ano);
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    const wkHeader = document.createElement('div');
    wkHeader.className = 'calendar-weekdays';
    diasSemana.forEach(d => {
        const el = document.createElement('div');
        el.className = 'calendar-weekday';
        el.textContent = d;
        wkHeader.appendChild(el);
    });
    grid.appendChild(wkHeader);

    semanas.forEach(semana => {
        const wkRow = document.createElement('div');
        wkRow.className = 'calendar-week';
        semana.forEach(dataObj => {
            wkRow.appendChild(criarDayCard(dataObj, mes));
        });
        grid.appendChild(wkRow);
    });

    calendarioContainer.innerHTML = '';
    calendarioContainer.appendChild(grid);
    calendarLegend.hidden = false;
    atualizarResumo(registrosAtuais, ano, mes);
}

function criarDayCard(dataObj, mesAtual) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calendar-day';
    const dataIso = dateToIso(dataObj);
    btn.dataset.data = dataIso;

    const ehDoMes = (dataObj.getMonth() + 1) === mesAtual;
    if (!ehDoMes) {
        btn.disabled = true;
    }

    if (ehHoje(dataObj)) {
        btn.classList.add('calendar-day--hoje');
    }

    const registro = registrosAtuais.find(r => r.data === dataIso);
    const status = registro?.status;

    if (registro) {
        btn.classList.add('calendar-day--has-registro');
        btn.classList.add(`calendar-day--${status?.toLowerCase()}`);
    }

    btn.innerHTML = `
        <div class="calendar-day-head">
            <span class="calendar-day-num">${dataObj.getDate()}</span>
            <span class="calendar-day-week">${diaSemana(dataObj)}</span>
        </div>
    `;

    if (status) {
        const badge = document.createElement('span');
        badge.className = `badge badge-${status.toLowerCase()} calendar-day-status`;
        badge.textContent = STATUS_LABEL[status] || status;
        btn.appendChild(badge);
    }

    if (registro && (registro.entrada || registro.saida)) {
        const times = document.createElement('div');
        times.className = 'calendar-day-times';
        const entrada = registro.entrada || '—';
        const saida = registro.saida || '—';
        times.innerHTML = `<span>${entrada} → ${saida}</span>`;
        btn.appendChild(times);
    } else if (!registro && ehDoMes) {
        const empty = document.createElement('span');
        empty.className = 'calendar-day-empty';
        empty.textContent = 'Sem registro';
        btn.appendChild(empty);
    }

    if (ehDoMes) {
        btn.addEventListener('click', () => abrirModalDia(dataObj, registro));
    }

    return btn;
}

function abrirModalDia(dataObj, registro) {
    const dataIso = dateToIso(dataObj);
    edicaoAtual = { dataIso, dataObj, registroId: registro?.id || null };

    modalTitulo.textContent = registro ? 'Editar ponto' : 'Registrar ponto';
    modalDayInfo.innerHTML = `<strong>${formatarDataLonga(dataObj)}</strong>`;
    btnSalvar.textContent = registro ? 'Salvar alterações' : 'Salvar';

    inputStatus.value = registro?.status || 'COMUM';
    inputEntrada.value = registro?.entrada || '';
    inputInicioAlmoco.value = getInicioAlmoco(registro);
    inputFimAlmoco.value = registro?.fimAlmoco || '';
    inputSaida.value = registro?.saida || '';

    btnExcluir.hidden = !registro;

    // Mostra "Salvar e próximo" só quando existir um próximo dia no mês atual
    const proximoDia = obterProximoDiaDoMes(dataObj);
    btnSalvarProximo.hidden = !proximoDia;

    limparErroForm();
    aplicarVisibilidadeHorarios();
    atualizarTotal();

    modalDia.hidden = false;
    setTimeout(() => inputStatus.focus(), 50);
}

function obterProximoDiaDoMes(dataObj) {
    if (!mesAnoInput.value) return null;
    const mesAtual = parseInt(mesAnoInput.value.split('-')[1]);
    const proximo = new Date(dataObj);
    proximo.setDate(proximo.getDate() + 1);
    return (proximo.getMonth() + 1) === mesAtual ? proximo : null;
}

function fecharModalDia() {
    modalDia.hidden = true;
    edicaoAtual = null;
}

function aplicarVisibilidadeHorarios() {
    const status = inputStatus.value;
    const semHorarios = STATUS_SEM_HORARIOS.includes(status);

    [inputEntrada, inputInicioAlmoco, inputFimAlmoco, inputSaida].forEach(inp => {
        inp.disabled = semHorarios;
        if (semHorarios) inp.value = '';
    });

    if (status === 'COMUM') {
        hintHorarios.textContent = 'Para o status "Comum", todos os horários são obrigatórios.';
        totalContainer.style.display = '';
    } else if (semHorarios) {
        hintHorarios.textContent = `O status "${STATUS_LABEL[status]}" não exige horários.`;
        totalContainer.style.display = 'none';
    } else {
        hintHorarios.textContent = 'Informe os horários se aplicável.';
        totalContainer.style.display = '';
    }
}

function atualizarTotal() {
    const total = calcularTotal(
        inputEntrada.value,
        inputInicioAlmoco.value,
        inputFimAlmoco.value,
        inputSaida.value
    );
    totalValue.textContent = total || '—';
}

async function salvarPonto(event, opts = {}) {
    event?.preventDefault?.();
    if (!edicaoAtual) return;
    limparErroForm();

    const { dataIso, dataObj, registroId } = edicaoAtual;
    const status = inputStatus.value;
    const entrada = inputEntrada.value || null;
    const inicioAlmoco = inputInicioAlmoco.value || null;
    const fimAlmoco = inputFimAlmoco.value || null;
    const saida = inputSaida.value || null;

    if (status === 'COMUM' && (!entrada || !inicioAlmoco || !fimAlmoco || !saida)) {
        mostrarErroForm('Para "Comum", informe todos os horários (entrada, almoço e saída).');
        return;
    }

    const payload = {
        data: dataIso,
        entrada,
        inicioAlmoco,
        fimAlmoco,
        saida,
        status,
        atendenteId: parseInt(atendenteSelect.value)
    };

    btnSalvar.disabled = true;
    btnSalvarProximo.disabled = true;

    try {
        if (registroId) {
            await apiPut(`/ponto/${registroId}`, payload);
        } else {
            await apiPost('/ponto', payload);
        }
        mostrarMensagem(
            registroId ? 'Ponto atualizado com sucesso!' : 'Ponto registrado com sucesso!',
            'sucesso',
            2000
        );
        await exibirCalendario();

        if (opts.avancar) {
            const proximo = obterProximoDiaDoMes(dataObj);
            if (proximo) {
                const proximoIso = dateToIso(proximo);
                const proximoRegistro = registrosAtuais.find((r) => r.data === proximoIso);
                abrirModalDia(proximo, proximoRegistro);
            } else {
                fecharModalDia();
                mostrarMensagem('Último dia do mês registrado!', 'sucesso', 3000);
            }
        } else {
            fecharModalDia();
        }
    } catch (err) {
        console.error('Erro ao salvar ponto:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao salvar o ponto.') : 'Erro de conexão com o servidor.';
        mostrarErroForm(msg);
    } finally {
        btnSalvar.disabled = false;
        btnSalvarProximo.disabled = false;
    }
}

function abrirModalExclusao() {
    if (!edicaoAtual?.registroId) return;
    registroParaExcluir = edicaoAtual.registroId;
    diaParaExcluirEl.textContent = formatarData(edicaoAtual.dataIso);
    modalExcluir.hidden = false;
}

function fecharModalExclusao() {
    modalExcluir.hidden = true;
    registroParaExcluir = null;
}

async function confirmarExclusao() {
    if (!registroParaExcluir) return;
    btnConfirmarExclusao.disabled = true;
    try {
        await apiDelete(`/ponto/${registroParaExcluir}`);
        mostrarMensagem('Ponto excluído com sucesso!', 'sucesso');
        fecharModalExclusao();
        fecharModalDia();
        await exibirCalendario();
    } catch (err) {
        console.error('Erro ao excluir ponto:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao excluir o ponto.') : 'Erro de conexão com o servidor.';
        mostrarMensagem(msg, 'erro');
        fecharModalExclusao();
    } finally {
        btnConfirmarExclusao.disabled = false;
    }
}

// Eventos
lojaSelect.addEventListener('change', e => {
    carregarAtendentes(e.target.value);
    exibirCalendario();
});
atendenteSelect.addEventListener('change', exibirCalendario);
mesAnoInput.addEventListener('change', exibirCalendario);

inputStatus.addEventListener('change', () => {
    aplicarVisibilidadeHorarios();
    atualizarTotal();
});

[inputEntrada, inputInicioAlmoco, inputFimAlmoco, inputSaida].forEach(inp => {
    inp.addEventListener('input', atualizarTotal);
});

formDia.addEventListener('submit', (e) => salvarPonto(e, { avancar: true }));
btnSalvar.addEventListener('click', (e) => salvarPonto(e, { avancar: false }));
btnExcluir.addEventListener('click', abrirModalExclusao);
btnConfirmarExclusao.addEventListener('click', confirmarExclusao);

modalDia.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', fecharModalDia);
});
modalExcluir.querySelectorAll('[data-close-confirm]').forEach(el => {
    el.addEventListener('click', fecharModalExclusao);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!modalExcluir.hidden) fecharModalExclusao();
        else if (!modalDia.hidden) fecharModalDia();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const hoje = new Date();
    mesAnoInput.value = `${hoje.getFullYear()}-${pad2(hoje.getMonth() + 1)}`;
    carregarLojas();
});
