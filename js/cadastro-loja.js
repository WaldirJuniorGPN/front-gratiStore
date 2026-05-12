exigirRole('MASTER');

const API_BASE_URL = 'http://localhost:8080';

const tabelaBody = document.getElementById('corpoLojas');
const buscaInput = document.getElementById('busca');
const contagemEl = document.getElementById('contagemLojas');
const mensagemDiv = document.getElementById('mensagem');

const modalLoja = document.getElementById('modalLoja');
const modalTitulo = document.getElementById('modalTitulo');
const formLoja = document.getElementById('formLoja');
const inputNome = document.getElementById('nome');
const inputCnpj = document.getElementById('cnpj');
const erroFormulario = document.getElementById('erroFormulario');
const btnConfirmar = document.getElementById('btnConfirmar');
const btnNovaLoja = document.getElementById('btnNovaLoja');

const modalExclusao = document.getElementById('modalExclusao');
const lojaParaExcluirEl = document.getElementById('lojaParaExcluir');
const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');

let estadoLojas = [];
let lojaEditandoId = null;
let lojaExcluindoId = null;

function formatarCnpj(cnpj) {
    if (!cnpj) return '—';
    const limpo = String(cnpj).replace(/\D/g, '');
    if (limpo.length !== 14) return cnpj;
    return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function aplicarMascaraCnpj(valor) {
    const d = valor.replace(/\D/g, '').slice(0, 14);
    let out = '';
    if (d.length > 0) out = d.slice(0, 2);
    if (d.length > 2) out += '.' + d.slice(2, 5);
    if (d.length > 5) out += '.' + d.slice(5, 8);
    if (d.length > 8) out += '/' + d.slice(8, 12);
    if (d.length > 12) out += '-' + d.slice(12, 14);
    return out;
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
        renderizarLista();
    } catch (err) {
        console.error('Erro ao carregar lojas:', err);
        mostrarMensagem('Erro de conexão com o servidor.', 'erro');
    }
}

function renderizarLista() {
    const termo = (buscaInput.value || '').trim().toLowerCase();
    const termoDigitos = termo.replace(/\D/g, '');
    const filtradas = estadoLojas.filter(l => {
        if (!termo) return true;
        const nome = (l.nome || '').toLowerCase();
        const cnpj = String(l.cnpj || '').replace(/\D/g, '');
        return nome.includes(termo) || (termoDigitos && cnpj.includes(termoDigitos));
    });

    contagemEl.textContent = filtradas.length;
    tabelaBody.innerHTML = '';

    if (filtradas.length === 0) {
        const tr = document.createElement('tr');
        tr.className = 'row-empty';
        const td = document.createElement('td');
        td.colSpan = 3;
        td.textContent = termo
            ? 'Nenhuma loja encontrada para a busca.'
            : 'Nenhuma loja cadastrada ainda.';
        tr.appendChild(td);
        tabelaBody.appendChild(tr);
        return;
    }

    filtradas.forEach(loja => {
        const tr = document.createElement('tr');

        const nomeTd = document.createElement('td');
        nomeTd.className = 'cell-name';
        nomeTd.textContent = loja.nome || '—';

        const cnpjTd = document.createElement('td');
        cnpjTd.className = 'cell-muted';
        cnpjTd.textContent = formatarCnpj(loja.cnpj);

        const acaoTd = document.createElement('td');
        acaoTd.className = 'cell-acao';

        const btnEditar = document.createElement('button');
        btnEditar.type = 'button';
        btnEditar.className = 'btn-icon-action';
        btnEditar.title = 'Editar loja';
        btnEditar.setAttribute('aria-label', `Editar ${loja.nome}`);
        btnEditar.setAttribute('data-requer-role', 'MASTER');
        btnEditar.textContent = '✎';
        btnEditar.addEventListener('click', () => abrirModalEdicao(loja));

        const btnExcluir = document.createElement('button');
        btnExcluir.type = 'button';
        btnExcluir.className = 'btn-icon-action btn-icon-danger';
        btnExcluir.title = 'Excluir loja';
        btnExcluir.setAttribute('aria-label', `Excluir ${loja.nome}`);
        btnExcluir.setAttribute('data-requer-role', 'MASTER');
        btnExcluir.textContent = '🗑';
        btnExcluir.addEventListener('click', () => abrirModalExclusao(loja));

        acaoTd.appendChild(btnEditar);
        acaoTd.appendChild(btnExcluir);

        tr.appendChild(nomeTd);
        tr.appendChild(cnpjTd);
        tr.appendChild(acaoTd);
        tabelaBody.appendChild(tr);
    });
}

function abrirModalCriacao() {
    lojaEditandoId = null;
    modalTitulo.textContent = 'Nova Loja';
    btnConfirmar.textContent = 'Cadastrar';
    inputNome.value = '';
    inputCnpj.value = '';
    limparErroForm();
    modalLoja.hidden = false;
    setTimeout(() => inputNome.focus(), 50);
}

function abrirModalEdicao(loja) {
    lojaEditandoId = loja.id;
    modalTitulo.textContent = 'Editar Loja';
    btnConfirmar.textContent = 'Salvar Alterações';
    inputNome.value = loja.nome || '';
    inputCnpj.value = formatarCnpj(loja.cnpj);
    limparErroForm();
    modalLoja.hidden = false;
    setTimeout(() => inputNome.focus(), 50);
}

function fecharModalLoja() {
    modalLoja.hidden = true;
    lojaEditandoId = null;
}

async function salvarLoja(event) {
    event.preventDefault();
    const nome = inputNome.value.trim();
    const cnpj = inputCnpj.value.replace(/\D/g, '');
    limparErroForm();

    if (!nome || !cnpj) {
        mostrarErroForm('Preencha todos os campos obrigatórios.');
        return;
    }

    if (cnpj.length !== 14) {
        mostrarErroForm('CNPJ deve conter 14 dígitos.');
        return;
    }

    btnConfirmar.disabled = true;

    try {
        const url = lojaEditandoId
            ? `${API_BASE_URL}/lojas/${lojaEditandoId}`
            : `${API_BASE_URL}/lojas`;
        const method = lojaEditandoId ? 'PUT' : 'POST';
        const resp = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, cnpj })
        });

        if (resp.ok) {
            mostrarMensagem(
                lojaEditandoId ? 'Loja atualizada com sucesso!' : 'Loja cadastrada com sucesso!',
                'sucesso'
            );
            fecharModalLoja();
            await carregarLojas();
        } else {
            const erro = await resp.json().catch(() => null);
            mostrarErroForm(erro?.message || 'Erro ao salvar a loja.');
        }
    } catch (err) {
        console.error('Erro:', err);
        mostrarErroForm('Erro de conexão com o servidor.');
    } finally {
        btnConfirmar.disabled = false;
    }
}

function abrirModalExclusao(loja) {
    lojaExcluindoId = loja.id;
    lojaParaExcluirEl.textContent = `"${loja.nome}"`;
    modalExclusao.hidden = false;
}

function fecharModalExclusao() {
    modalExclusao.hidden = true;
    lojaExcluindoId = null;
}

async function confirmarExclusao() {
    if (!lojaExcluindoId) return;
    btnConfirmarExclusao.disabled = true;
    try {
        const resp = await fetch(`${API_BASE_URL}/lojas/${lojaExcluindoId}`, {
            method: 'DELETE'
        });
        if (resp.ok) {
            mostrarMensagem('Loja excluída com sucesso!', 'sucesso');
            fecharModalExclusao();
            await carregarLojas();
        } else {
            mostrarMensagem('Erro ao excluir a loja.', 'erro');
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

btnNovaLoja.addEventListener('click', abrirModalCriacao);
formLoja.addEventListener('submit', salvarLoja);
btnConfirmarExclusao.addEventListener('click', confirmarExclusao);

inputCnpj.addEventListener('input', (e) => {
    e.target.value = aplicarMascaraCnpj(e.target.value);
});

buscaInput.addEventListener('input', renderizarLista);

modalLoja.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', fecharModalLoja);
});
modalExclusao.querySelectorAll('[data-close-confirm]').forEach(el => {
    el.addEventListener('click', fecharModalExclusao);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!modalLoja.hidden) fecharModalLoja();
        if (!modalExclusao.hidden) fecharModalExclusao();
    }
});

document.addEventListener('DOMContentLoaded', carregarLojas);
