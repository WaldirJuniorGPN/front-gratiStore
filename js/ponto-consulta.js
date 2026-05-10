const API_BASE_URL = 'http://localhost:8080';

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

const STATUS_SEM_HORARIOS = ['FOLGA', 'FALTA', 'ATESTADO_INTEGRAL'];

const lojaSelect = document.getElementById('lojaSelect');
const atendenteSelect = document.getElementById('atendenteSelect');
const mesAnoInput = document.getElementById('mesAno');
const btnBuscar = document.getElementById('btnBuscar');
const corpoHistorico = document.getElementById('corpoHistorico');
const tituloHistorico = document.getElementById('tituloHistorico');
const contagemRegistros = document.getElementById('contagemRegistros');
const mensagemDiv = document.getElementById('mensagem');

const modalDia = document.getElementById('modalDia');
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

const modalExcluir = document.getElementById('modalExcluir');
const diaParaExcluirEl = document.getElementById('diaParaExcluir');
const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');

let registrosAtuais = [];
let edicaoAtual = null;
let registroParaExcluir = null;

function pad2(n) { return String(n).padStart(2, '0'); }

function formatarData(iso) {
    if (!iso) return '—';
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
}

function formatarDataLonga(iso) {
    if (!iso) return '—';
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
}

function diaSemana(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
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
        const resp = await fetch(`${API_BASE_URL}/lojas/listar`);
        if (!resp.ok) {
            mostrarMensagem('Erro ao carregar a lista de lojas.', 'erro');
            return;
        }
        const lojas = await resp.json();
        lojas.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.nome;
            lojaSelect.appendChild(opt);
        });
    } catch (err) {
        console.error('Erro ao carregar lojas:', err);
        mostrarMensagem('Erro de conexão com o servidor.', 'erro');
    }
}

async function carregarAtendentes(lojaId) {
    atendenteSelect.innerHTML = '<option value="">Selecione um funcionário...</option>';
    if (!lojaId) {
        atendenteSelect.disabled = true;
        return;
    }
    try {
        const resp = await fetch(`${API_BASE_URL}/lojas/${lojaId}/atendentes`);
        if (!resp.ok) {
            mostrarMensagem('Erro ao carregar funcionários.', 'erro');
            return;
        }
        const atendentes = await resp.json();
        atendentes.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = a.nome;
            atendenteSelect.appendChild(opt);
        });
        atendenteSelect.disabled = false;
    } catch (err) {
        console.error('Erro ao carregar atendentes:', err);
        mostrarMensagem('Erro de conexão com o servidor.', 'erro');
    }
}

async function carregarHistoricoCompleto() {
    const registros = [];
    let page = 0;
    while (true) {
        try {
            const resp = await fetch(`${API_BASE_URL}/ponto?page=${page}&size=1000`);
            if (!resp.ok) break;
            const data = await resp.json();
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
    return registros;
}

async function buscarPontos() {
    const mesAno = mesAnoInput.value;
    const atendenteId = parseInt(atendenteSelect.value);
    if (!mesAno || !atendenteId) {
        mostrarMensagem('Selecione loja, funcionário e mês para buscar.', 'erro');
        return;
    }

    btnBuscar.disabled = true;
    corpoHistorico.innerHTML = '<tr class="row-loading"><td colspan="8">Carregando registros...</td></tr>';

    try {
        const [ano, mes] = mesAno.split('-');
        const todos = await carregarHistoricoCompleto();
        registrosAtuais = todos
            .filter(r => r.atendenteId === atendenteId && r.data && r.data.startsWith(`${ano}-${mes}`))
            .sort((a, b) => a.data.localeCompare(b.data));

        const nomeFuncionario = atendenteSelect.options[atendenteSelect.selectedIndex]?.textContent || '';
        const nomeMes = new Date(parseInt(ano), parseInt(mes) - 1, 1)
            .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        tituloHistorico.textContent = `${nomeFuncionario} — ${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}`;
        contagemRegistros.textContent = registrosAtuais.length;

        renderizarTabela();
    } finally {
        btnBuscar.disabled = false;
    }
}

function renderizarTabela() {
    corpoHistorico.innerHTML = '';

    if (registrosAtuais.length === 0) {
        const tr = document.createElement('tr');
        tr.className = 'row-empty';
        const td = document.createElement('td');
        td.colSpan = 8;
        td.textContent = 'Nenhum registro encontrado para o período selecionado.';
        tr.appendChild(td);
        corpoHistorico.appendChild(tr);
        return;
    }

    registrosAtuais.forEach(r => {
        const tr = document.createElement('tr');

        const inicioAlmoco = getInicioAlmoco(r);
        const fimAlmoco = r.fimAlmoco || '';
        const almoco = (inicioAlmoco && fimAlmoco)
            ? `${inicioAlmoco} → ${fimAlmoco}`
            : (inicioAlmoco || fimAlmoco || '—');
        const total = calcularTotal(r.entrada, inicioAlmoco, fimAlmoco, r.saida) || '—';
        const statusKey = (r.status || 'COMUM').toLowerCase();
        const statusLabel = STATUS_LABEL[r.status] || r.status || '—';

        tr.innerHTML = `
            <td class="cell-date">${formatarData(r.data)}</td>
            <td class="cell-muted">${diaSemana(r.data)}</td>
            <td class="cell-time">${r.entrada || '<span class="cell-empty">—</span>'}</td>
            <td class="cell-time">${almoco === '—' ? '<span class="cell-empty">—</span>' : almoco}</td>
            <td class="cell-time">${r.saida || '<span class="cell-empty">—</span>'}</td>
            <td class="cell-total">${total}</td>
            <td><span class="badge badge-${statusKey}">${statusLabel}</span></td>
            <td class="cell-acao"></td>
        `;

        const acaoTd = tr.querySelector('.cell-acao');
        const btnEditar = botaoAcao('✎', 'Editar', () => abrirModalEdicao(r));
        const btnExcluir = botaoAcao('🗑', 'Excluir', () => abrirModalExclusao(r), 'btn-icon-danger');
        acaoTd.appendChild(btnEditar);
        acaoTd.appendChild(btnExcluir);

        corpoHistorico.appendChild(tr);
    });
}

function botaoAcao(icone, titulo, onClick, classeExtra = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-icon-action ${classeExtra}`.trim();
    btn.title = titulo;
    btn.setAttribute('aria-label', titulo);
    btn.textContent = icone;
    btn.addEventListener('click', onClick);
    return btn;
}

function abrirModalEdicao(registro) {
    edicaoAtual = registro;
    modalDayInfo.innerHTML = `<strong>${formatarDataLonga(registro.data)}</strong>`;

    inputStatus.value = registro.status || 'COMUM';
    inputEntrada.value = registro.entrada || '';
    inputInicioAlmoco.value = getInicioAlmoco(registro);
    inputFimAlmoco.value = registro.fimAlmoco || '';
    inputSaida.value = registro.saida || '';

    limparErroForm();
    aplicarVisibilidadeHorarios();
    atualizarTotal();

    modalDia.hidden = false;
    setTimeout(() => inputStatus.focus(), 50);
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

async function salvarPonto(event) {
    event.preventDefault();
    if (!edicaoAtual) return;
    limparErroForm();

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
        data: edicaoAtual.data,
        entrada,
        inicioAlmoco,
        fimAlmoco,
        saida,
        status,
        atendenteId: edicaoAtual.atendenteId
    };

    btnSalvar.disabled = true;

    try {
        const resp = await fetch(`${API_BASE_URL}/ponto/${edicaoAtual.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (resp.ok) {
            mostrarMensagem('Ponto atualizado com sucesso!', 'sucesso');
            fecharModalDia();
            await buscarPontos();
        } else {
            const erro = await resp.json().catch(() => null);
            mostrarErroForm(erro?.message || 'Erro ao atualizar o ponto.');
        }
    } catch (err) {
        console.error('Erro ao atualizar ponto:', err);
        mostrarErroForm('Erro de conexão com o servidor.');
    } finally {
        btnSalvar.disabled = false;
    }
}

function abrirModalExclusao(registro) {
    registroParaExcluir = registro;
    diaParaExcluirEl.textContent = formatarData(registro.data);
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
        const resp = await fetch(`${API_BASE_URL}/ponto/${registroParaExcluir.id}`, {
            method: 'DELETE'
        });
        if (resp.ok) {
            mostrarMensagem('Ponto excluído com sucesso!', 'sucesso');
            fecharModalExclusao();
            await buscarPontos();
        } else {
            mostrarMensagem('Erro ao excluir o ponto.', 'erro');
            fecharModalExclusao();
        }
    } catch (err) {
        console.error('Erro ao excluir ponto:', err);
        mostrarMensagem('Erro de conexão com o servidor.', 'erro');
        fecharModalExclusao();
    } finally {
        btnConfirmarExclusao.disabled = false;
    }
}

// Eventos
lojaSelect.addEventListener('change', e => {
    carregarAtendentes(e.target.value);
});
btnBuscar.addEventListener('click', buscarPontos);

inputStatus.addEventListener('change', () => {
    aplicarVisibilidadeHorarios();
    atualizarTotal();
});

[inputEntrada, inputInicioAlmoco, inputFimAlmoco, inputSaida].forEach(inp => {
    inp.addEventListener('input', atualizarTotal);
});

formDia.addEventListener('submit', salvarPonto);
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
