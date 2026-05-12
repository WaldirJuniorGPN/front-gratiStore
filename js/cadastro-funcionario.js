exigirRole('MASTER');

const API_BASE_URL = 'http://localhost:8080';

const tabelaBody = document.getElementById('corpoAtendentes');
const filtroLojaSelect = document.getElementById('filtroLoja');
const buscaInput = document.getElementById('busca');
const tituloLista = document.getElementById('tituloLista');
const contagemEl = document.getElementById('contagemAtendentes');
const mensagemDiv = document.getElementById('mensagem');

const modalAtendente = document.getElementById('modalAtendente');
const modalTitulo = document.getElementById('modalTitulo');
const formAtendente = document.getElementById('formAtendente');
const inputNome = document.getElementById('nome');
const inputLoja = document.getElementById('loja');
const inputSalario = document.getElementById('salario');
const inputDataAdmissao = document.getElementById('dataAdmissao');
const erroFormulario = document.getElementById('erroFormulario');
const btnConfirmar = document.getElementById('btnConfirmar');
const btnNovoAtendente = document.getElementById('btnNovoAtendente');

const modalExclusao = document.getElementById('modalExclusao');
const atendenteParaExcluirEl = document.getElementById('atendenteParaExcluir');
const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');

let estadoLojas = [];
let estadoAtendentes = [];
let atendenteEditandoId = null;
let atendenteExcluindoId = null;
let salariosCache = {};

function formatarMoeda(valor) {
    if (valor === null || valor === undefined || isNaN(valor)) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarDataAdmissao(iso) {
    if (!iso) return '—';
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
}

function parseSalario(valor) {
    if (!valor) return NaN;
    const limpo = String(valor).trim();
    // Aceita formatos comuns: "2000", "2000.00", "2000,00", "2.000,00"
    // Heurística: se tem vírgula, vírgula é o separador decimal e pontos são milhares
    if (limpo.includes(',')) {
        return parseFloat(limpo.replace(/\./g, '').replace(/,/g, '.'));
    }
    return parseFloat(limpo);
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
        estadoLojas = await resp.json();
        preencherSelectLojas(filtroLojaSelect, 'Selecione uma loja...');
        preencherSelectLojas(inputLoja, 'Selecione uma loja');
    } catch (err) {
        console.error('Erro ao carregar lojas:', err);
        mostrarMensagem('Erro de conexão com o servidor.', 'erro');
    }
}

function preencherSelectLojas(selectEl, placeholder) {
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    estadoLojas.forEach(loja => {
        const opt = document.createElement('option');
        opt.value = loja.id;
        opt.textContent = loja.nome;
        selectEl.appendChild(opt);
    });
}

async function carregarAtendentes(lojaId) {
    if (!lojaId) {
        estadoAtendentes = [];
        renderizarLista();
        return;
    }
    tabelaBody.innerHTML = '<tr class="row-loading"><td colspan="4">Carregando atendentes...</td></tr>';
    try {
        const resp = await fetch(`${API_BASE_URL}/lojas/${lojaId}/atendentes`);
        if (!resp.ok) {
            mostrarMensagem('Erro ao carregar atendentes.', 'erro');
            estadoAtendentes = [];
            renderizarLista();
            return;
        }
        const atendentes = await resp.json();
        const atendentesComSalario = await Promise.all(
            atendentes.map(async (a) => {
                const salario = await obterSalario(a.id);
                return { ...a, salario };
            })
        );
        estadoAtendentes = atendentesComSalario;
        renderizarLista();
    } catch (err) {
        console.error('Erro ao carregar atendentes:', err);
        mostrarMensagem('Erro de conexão com o servidor.', 'erro');
        estadoAtendentes = [];
        renderizarLista();
    }
}

async function obterSalario(id) {
    if (salariosCache[id] !== undefined) return salariosCache[id];
    try {
        const resp = await fetch(`${API_BASE_URL}/atendentes/salario/${id}`);
        if (resp.ok) {
            const data = await resp.json();
            salariosCache[id] = data.salario;
            return data.salario;
        }
    } catch (err) {
        console.error('Erro ao buscar salário:', err);
    }
    salariosCache[id] = null;
    return null;
}

function renderizarLista() {
    const lojaId = filtroLojaSelect.value;
    const lojaNome = estadoLojas.find(l => String(l.id) === String(lojaId))?.nome;
    if (lojaNome) {
        tituloLista.textContent = `Atendentes de ${lojaNome}`;
    } else {
        tituloLista.textContent = 'Atendentes da loja';
    }

    const termo = (buscaInput.value || '').trim().toLowerCase();
    const filtrados = estadoAtendentes.filter(a => {
        if (!termo) return true;
        return (a.nome || '').toLowerCase().includes(termo);
    });

    contagemEl.textContent = filtrados.length;
    tabelaBody.innerHTML = '';

    if (!lojaId) {
        const tr = document.createElement('tr');
        tr.className = 'row-empty';
        const td = document.createElement('td');
        td.colSpan = 4;
        td.textContent = 'Selecione uma loja para visualizar seus atendentes.';
        tr.appendChild(td);
        tabelaBody.appendChild(tr);
        return;
    }

    if (filtrados.length === 0) {
        const tr = document.createElement('tr');
        tr.className = 'row-empty';
        const td = document.createElement('td');
        td.colSpan = 4;
        td.textContent = termo
            ? 'Nenhum atendente encontrado para a busca.'
            : 'Nenhum atendente cadastrado para esta loja.';
        tr.appendChild(td);
        tabelaBody.appendChild(tr);
        return;
    }

    filtrados.forEach(at => {
        const tr = document.createElement('tr');

        const nomeTd = document.createElement('td');
        nomeTd.className = 'cell-name';
        nomeTd.textContent = at.nome || '—';

        const salarioTd = document.createElement('td');
        salarioTd.className = 'cell-currency';
        salarioTd.textContent = at.salario !== null && at.salario !== undefined
            ? formatarMoeda(at.salario)
            : '—';

        const admissaoTd = document.createElement('td');
        admissaoTd.className = 'cell-muted';
        admissaoTd.textContent = formatarDataAdmissao(at.dataAdmissao);

        const acaoTd = document.createElement('td');
        acaoTd.className = 'cell-acao';

        const btnEditar = botaoAcao('✎', 'Editar atendente', () => abrirModalEdicao(at));
        btnEditar.setAttribute('data-requer-role', 'MASTER');
        const btnSalario = botaoAcao('R$', 'Atualizar salário', () => {
            window.location.href = `/html/update-salario.html?id=${at.id}`;
        });
        btnSalario.setAttribute('data-requer-role', 'MASTER');
        const btnFerias = botaoAcao('☼', 'Histórico de férias', () => {
            window.location.href = `/html/ferias-atendente.html?id=${at.id}`;
        }, 'btn-icon-accent');
        const btnExcluir = botaoAcao('🗑', 'Excluir atendente', () => abrirModalExclusao(at), 'btn-icon-danger');
        btnExcluir.setAttribute('data-requer-role', 'MASTER');

        acaoTd.appendChild(btnEditar);
        acaoTd.appendChild(btnSalario);
        acaoTd.appendChild(btnFerias);
        acaoTd.appendChild(btnExcluir);

        tr.appendChild(nomeTd);
        tr.appendChild(salarioTd);
        tr.appendChild(admissaoTd);
        tr.appendChild(acaoTd);
        tabelaBody.appendChild(tr);
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

function abrirModalCriacao() {
    atendenteEditandoId = null;
    modalTitulo.textContent = 'Novo Atendente';
    btnConfirmar.textContent = 'Cadastrar';
    inputNome.value = '';
    inputLoja.value = filtroLojaSelect.value || '';
    inputSalario.value = '';
    inputDataAdmissao.value = '';
    inputDataAdmissao.max = new Date().toISOString().slice(0, 10);
    limparErroForm();
    modalAtendente.hidden = false;
    setTimeout(() => inputNome.focus(), 50);
}

function abrirModalEdicao(atendente) {
    atendenteEditandoId = atendente.id;
    modalTitulo.textContent = 'Editar Atendente';
    btnConfirmar.textContent = 'Salvar Alterações';
    inputNome.value = atendente.nome || '';
    inputLoja.value = atendente.lojaId || filtroLojaSelect.value || '';
    inputSalario.value = atendente.salario !== null && atendente.salario !== undefined
        ? Number(atendente.salario).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';
    inputDataAdmissao.value = atendente.dataAdmissao || '';
    inputDataAdmissao.max = new Date().toISOString().slice(0, 10);
    limparErroForm();
    modalAtendente.hidden = false;
    setTimeout(() => inputNome.focus(), 50);
}

function fecharModalAtendente() {
    modalAtendente.hidden = true;
    atendenteEditandoId = null;
}

async function salvarAtendente(event) {
    event.preventDefault();
    limparErroForm();

    const nome = inputNome.value.trim();
    const lojaId = inputLoja.value;
    const salario = parseSalario(inputSalario.value);
    const dataAdmissao = inputDataAdmissao.value;

    if (!nome || !lojaId || !inputSalario.value || !dataAdmissao) {
        mostrarErroForm('Preencha todos os campos obrigatórios.');
        return;
    }

    if (isNaN(salario) || salario <= 0) {
        mostrarErroForm('Informe um salário válido.');
        return;
    }

    const hoje = new Date().toISOString().slice(0, 10);
    if (dataAdmissao > hoje) {
        mostrarErroForm('A data de admissão não pode estar no futuro.');
        return;
    }

    btnConfirmar.disabled = true;

    try {
        const url = atendenteEditandoId
            ? `${API_BASE_URL}/atendentes/${atendenteEditandoId}`
            : `${API_BASE_URL}/atendentes`;
        const method = atendenteEditandoId ? 'PUT' : 'POST';
        const resp = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nome,
                lojaId: parseInt(lojaId),
                salario,
                dataAdmissao
            })
        });

        if (resp.ok) {
            mostrarMensagem(
                atendenteEditandoId ? 'Atendente atualizado com sucesso!' : 'Atendente cadastrado com sucesso!',
                'sucesso'
            );
            fecharModalAtendente();
            // Limpar cache de salário para o atendente alterado
            if (atendenteEditandoId) delete salariosCache[atendenteEditandoId];

            // Se a loja do filtro coincide, recarregar
            if (String(filtroLojaSelect.value) === String(lojaId)) {
                await carregarAtendentes(lojaId);
            } else if (!atendenteEditandoId) {
                // Para novo cadastro: navegar o filtro para a loja recém criada
                filtroLojaSelect.value = lojaId;
                buscaInput.disabled = false;
                await carregarAtendentes(lojaId);
            }
        } else {
            const erro = await resp.json().catch(() => null);
            mostrarErroForm(erro?.message || 'Erro ao salvar o atendente.');
        }
    } catch (err) {
        console.error('Erro:', err);
        mostrarErroForm('Erro de conexão com o servidor.');
    } finally {
        btnConfirmar.disabled = false;
    }
}

function abrirModalExclusao(atendente) {
    atendenteExcluindoId = atendente.id;
    atendenteParaExcluirEl.textContent = `"${atendente.nome}"`;
    modalExclusao.hidden = false;
}

function fecharModalExclusao() {
    modalExclusao.hidden = true;
    atendenteExcluindoId = null;
}

async function confirmarExclusao() {
    if (!atendenteExcluindoId) return;
    btnConfirmarExclusao.disabled = true;
    try {
        const resp = await fetch(`${API_BASE_URL}/atendentes/${atendenteExcluindoId}`, {
            method: 'DELETE'
        });
        if (resp.ok) {
            mostrarMensagem('Atendente excluído com sucesso!', 'sucesso');
            delete salariosCache[atendenteExcluindoId];
            fecharModalExclusao();
            await carregarAtendentes(filtroLojaSelect.value);
        } else {
            mostrarMensagem('Erro ao excluir o atendente.', 'erro');
            fecharModalExclusao();
        }
    } catch (err) {
        console.error('Erro:', err);
        mostrarMensagem('Erro de conexão com o servidor.', 'erro');
        fecharModalExclusao();
    } finally {
        btnConfirmarExclusao.disabled = false;
    }
}

filtroLojaSelect.addEventListener('change', () => {
    const lojaId = filtroLojaSelect.value;
    buscaInput.disabled = !lojaId;
    if (!lojaId) buscaInput.value = '';
    carregarAtendentes(lojaId);
});

buscaInput.addEventListener('input', renderizarLista);

btnNovoAtendente.addEventListener('click', abrirModalCriacao);
formAtendente.addEventListener('submit', salvarAtendente);
btnConfirmarExclusao.addEventListener('click', confirmarExclusao);

modalAtendente.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', fecharModalAtendente);
});
modalExclusao.querySelectorAll('[data-close-confirm]').forEach(el => {
    el.addEventListener('click', fecharModalExclusao);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!modalAtendente.hidden) fecharModalAtendente();
        if (!modalExclusao.hidden) fecharModalExclusao();
    }
});

document.addEventListener('DOMContentLoaded', carregarLojas);
