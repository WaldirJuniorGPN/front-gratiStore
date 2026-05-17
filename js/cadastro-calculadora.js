exigirPermissao('cadastro-calculadora');

const grid = document.getElementById('gridCalculadoras');
const buscaInput = document.getElementById('busca');
const contagemEl = document.getElementById('contagemCalcs');
const mensagemDiv = document.getElementById('mensagem');

const modalCalc = document.getElementById('modalCalc');
const modalTitulo = document.getElementById('modalTitulo');
const formCalc = document.getElementById('formCalc');
const erroFormulario = document.getElementById('erroFormulario');
const btnConfirmar = document.getElementById('btnConfirmar');
const btnNovaCalc = document.getElementById('btnNovaCalc');
const inputLoja = document.getElementById('loja');

const inputs = {
    nome: document.getElementById('nome'),
    loja: inputLoja,
    percentualPrimeiroColocado: document.getElementById('percentualPrimeiroColocado'),
    percentualSegundoColocado: document.getElementById('percentualSegundoColocado'),
    percentualTerceiroColocado: document.getElementById('percentualTerceiroColocado'),
    percentualDemaisColocados: document.getElementById('percentualDemaisColocados'),
    bonusPrimeiroColocado: document.getElementById('bonusPrimeiroColocado'),
    bonusSegundoColocado: document.getElementById('bonusSegundoColocado'),
    bonusTerceiroColocado: document.getElementById('bonusTerceiroColocado')
};

const modalExclusao = document.getElementById('modalExclusao');
const calcParaExcluirEl = document.getElementById('calcParaExcluir');
const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');

let estadoLojas = [];
let estadoCalcs = [];
let calcEditandoId = null;
let calcExcluindoId = null;

function formatarMoeda(valor) {
    if (valor === null || valor === undefined || isNaN(valor)) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarPercentual(valor) {
    if (valor === null || valor === undefined || isNaN(valor)) return '—';
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor * 100) + '%';
}

function decimalParaInputPercentual(valor) {
    if (valor === null || valor === undefined || isNaN(valor)) return '';
    return +(valor * 100).toFixed(4);
}

function inputPercentualParaDecimal(valor) {
    const num = parseFloat(valor);
    if (isNaN(num)) return NaN;
    return +(num / 100).toFixed(6);
}

function nomeLoja(lojaId) {
    if (!lojaId && lojaId !== 0) return '—';
    const l = estadoLojas.find(x => String(x.id) === String(lojaId));
    return l ? l.nome : '—';
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
        estadoLojas = await apiGet('/lojas/listar');
        inputLoja.innerHTML = '<option value="">Selecione uma loja</option>';
        estadoLojas.forEach((loja) => {
            const opt = document.createElement('option');
            opt.value = loja.id;
            opt.textContent = loja.nome;
            inputLoja.appendChild(opt);
        });
        renderizarLista();
    } catch (err) {
        console.error('Erro ao carregar lojas:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao carregar a lista de lojas.') : 'Erro de conexão com o servidor.';
        mostrarMensagem(msg, 'erro');
    }
}

async function carregarCalculadoras() {
    grid.innerHTML = '<p class="grid-loading">Carregando calculadoras...</p>';
    try {
        estadoCalcs = await apiGet('/calculadoras/listar');
        renderizarLista();
    } catch (err) {
        console.error('Erro ao carregar calculadoras:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao carregar a lista de calculadoras.') : 'Erro de conexão com o servidor.';
        mostrarMensagem(msg, 'erro');
        estadoCalcs = [];
        renderizarLista();
    }
}

function renderizarLista() {
    const termo = (buscaInput.value || '').trim().toLowerCase();
    const filtradas = estadoCalcs.filter(c => {
        if (!termo) return true;
        const nome = (c.nome || '').toLowerCase();
        const loja = nomeLoja(c.lojaId).toLowerCase();
        return nome.includes(termo) || loja.includes(termo);
    });

    contagemEl.textContent = filtradas.length;
    grid.innerHTML = '';

    if (filtradas.length === 0) {
        const p = document.createElement('p');
        p.className = 'grid-empty';
        p.textContent = termo
            ? 'Nenhuma calculadora encontrada para a busca.'
            : 'Nenhuma calculadora cadastrada ainda. Clique em "Nova Calculadora" para começar.';
        grid.appendChild(p);
        return;
    }

    filtradas.forEach(calc => {
        grid.appendChild(criarCard(calc));
    });
}

function criarCard(calc) {
    const card = document.createElement('article');
    card.className = 'calc-card';
    card.innerHTML = `
        <header class="calc-card-head">
            <div class="calc-card-head__info">
                <h3 class="calc-card-head__nome"></h3>
                <p class="calc-card-head__loja"></p>
            </div>
            <div class="calc-card-actions"></div>
        </header>
        <section class="calc-card-section">
            <h4 class="calc-card-section__title">Percentuais</h4>
            <div class="calc-card-grid">
                <div class="calc-stat"><span class="calc-stat__label">1º</span><span class="calc-stat__value" data-pct1></span></div>
                <div class="calc-stat"><span class="calc-stat__label">2º</span><span class="calc-stat__value" data-pct2></span></div>
                <div class="calc-stat"><span class="calc-stat__label">3º</span><span class="calc-stat__value" data-pct3></span></div>
                <div class="calc-stat"><span class="calc-stat__label">Demais</span><span class="calc-stat__value" data-pctd></span></div>
            </div>
        </section>
        <section class="calc-card-section">
            <h4 class="calc-card-section__title">Bônus adicional</h4>
            <div class="calc-card-grid calc-card-grid--three">
                <div class="calc-stat"><span class="calc-stat__label">1º</span><span class="calc-stat__value" data-bn1></span></div>
                <div class="calc-stat"><span class="calc-stat__label">2º</span><span class="calc-stat__value" data-bn2></span></div>
                <div class="calc-stat"><span class="calc-stat__label">3º</span><span class="calc-stat__value" data-bn3></span></div>
            </div>
        </section>
    `;

    card.querySelector('.calc-card-head__nome').textContent = calc.nome || '—';
    card.querySelector('.calc-card-head__loja').textContent = nomeLoja(calc.lojaId);
    card.querySelector('[data-pct1]').textContent = formatarPercentual(calc.percentualPrimeiroColocado);
    card.querySelector('[data-pct2]').textContent = formatarPercentual(calc.percentualSegundoColocado);
    card.querySelector('[data-pct3]').textContent = formatarPercentual(calc.percentualTerceiroColocado);
    card.querySelector('[data-pctd]').textContent = formatarPercentual(calc.percentualDemaisColocados);
    card.querySelector('[data-bn1]').textContent = formatarMoeda(calc.bonusPrimeiroColocado);
    card.querySelector('[data-bn2]').textContent = formatarMoeda(calc.bonusSegundoColocado);
    card.querySelector('[data-bn3]').textContent = formatarMoeda(calc.bonusTerceiroColocado);

    const acoes = card.querySelector('.calc-card-actions');
    const btnEditar = botaoAcao('✎', 'Editar calculadora', () => abrirModalEdicao(calc));
    btnEditar.setAttribute('data-requer-permissao', 'cadastro-calculadora');
    const btnExcluir = botaoAcao('🗑', 'Excluir calculadora', () => abrirModalExclusao(calc), 'btn-icon-danger');
    btnExcluir.setAttribute('data-requer-permissao', 'cadastro-calculadora');
    acoes.appendChild(btnEditar);
    acoes.appendChild(btnExcluir);

    return card;
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
    calcEditandoId = null;
    modalTitulo.textContent = 'Nova Calculadora';
    btnConfirmar.textContent = 'Cadastrar';
    formCalc.reset();
    limparErroForm();
    modalCalc.hidden = false;
    setTimeout(() => inputs.nome.focus(), 50);
}

function abrirModalEdicao(calc) {
    calcEditandoId = calc.id;
    modalTitulo.textContent = 'Editar Calculadora';
    btnConfirmar.textContent = 'Salvar Alterações';
    inputs.nome.value = calc.nome || '';
    inputs.loja.value = calc.lojaId || '';
    inputs.percentualPrimeiroColocado.value = decimalParaInputPercentual(calc.percentualPrimeiroColocado);
    inputs.percentualSegundoColocado.value = decimalParaInputPercentual(calc.percentualSegundoColocado);
    inputs.percentualTerceiroColocado.value = decimalParaInputPercentual(calc.percentualTerceiroColocado);
    inputs.percentualDemaisColocados.value = decimalParaInputPercentual(calc.percentualDemaisColocados);
    inputs.bonusPrimeiroColocado.value = calc.bonusPrimeiroColocado ?? '';
    inputs.bonusSegundoColocado.value = calc.bonusSegundoColocado ?? '';
    inputs.bonusTerceiroColocado.value = calc.bonusTerceiroColocado ?? '';
    limparErroForm();
    modalCalc.hidden = false;
    setTimeout(() => inputs.nome.focus(), 50);
}

function fecharModalCalc() {
    modalCalc.hidden = true;
    calcEditandoId = null;
}

async function salvarCalc(event) {
    event.preventDefault();
    limparErroForm();

    const dados = {
        nome: inputs.nome.value.trim(),
        lojaId: inputs.loja.value ? parseInt(inputs.loja.value) : null,
        percentualPrimeiroColocado: inputPercentualParaDecimal(inputs.percentualPrimeiroColocado.value),
        percentualSegundoColocado: inputPercentualParaDecimal(inputs.percentualSegundoColocado.value),
        percentualTerceiroColocado: inputPercentualParaDecimal(inputs.percentualTerceiroColocado.value),
        percentualDemaisColocados: inputPercentualParaDecimal(inputs.percentualDemaisColocados.value),
        bonusPrimeiroColocado: parseFloat(inputs.bonusPrimeiroColocado.value),
        bonusSegundoColocado: parseFloat(inputs.bonusSegundoColocado.value),
        bonusTerceiroColocado: parseFloat(inputs.bonusTerceiroColocado.value)
    };

    if (!dados.nome || !dados.lojaId) {
        mostrarErroForm('Preencha o nome e selecione uma loja.');
        return;
    }

    const camposNumericos = [
        'percentualPrimeiroColocado', 'percentualSegundoColocado',
        'percentualTerceiroColocado', 'percentualDemaisColocados',
        'bonusPrimeiroColocado', 'bonusSegundoColocado', 'bonusTerceiroColocado'
    ];
    for (const campo of camposNumericos) {
        if (isNaN(dados[campo]) || dados[campo] < 0) {
            mostrarErroForm('Todos os percentuais e bônus devem ser números válidos (≥ 0).');
            return;
        }
    }

    btnConfirmar.disabled = true;

    try {
        if (calcEditandoId) {
            await apiPut(`/calculadoras/${calcEditandoId}`, dados);
        } else {
            await apiPost('/calculadoras', dados);
        }
        mostrarMensagem(
            calcEditandoId ? 'Calculadora atualizada com sucesso!' : 'Calculadora cadastrada com sucesso!',
            'sucesso'
        );
        fecharModalCalc();
        await carregarCalculadoras();
    } catch (err) {
        console.error('Erro:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao salvar a calculadora.') : 'Erro de conexão com o servidor.';
        mostrarErroForm(msg);
    } finally {
        btnConfirmar.disabled = false;
    }
}

function abrirModalExclusao(calc) {
    calcExcluindoId = calc.id;
    calcParaExcluirEl.textContent = `"${calc.nome}"`;
    modalExclusao.hidden = false;
}

function fecharModalExclusao() {
    modalExclusao.hidden = true;
    calcExcluindoId = null;
}

async function confirmarExclusao() {
    if (!calcExcluindoId) return;
    btnConfirmarExclusao.disabled = true;
    try {
        await apiDelete(`/calculadoras/${calcExcluindoId}`);
        mostrarMensagem('Calculadora excluída com sucesso!', 'sucesso');
        fecharModalExclusao();
        await carregarCalculadoras();
    } catch (err) {
        console.error('Erro:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao excluir a calculadora.') : 'Erro de conexão com o servidor.';
        mostrarMensagem(msg, 'erro');
        fecharModalExclusao();
    } finally {
        btnConfirmarExclusao.disabled = false;
    }
}

btnNovaCalc.addEventListener('click', abrirModalCriacao);
formCalc.addEventListener('submit', salvarCalc);
btnConfirmarExclusao.addEventListener('click', confirmarExclusao);
buscaInput.addEventListener('input', renderizarLista);

modalCalc.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', fecharModalCalc);
});
modalExclusao.querySelectorAll('[data-close-confirm]').forEach(el => {
    el.addEventListener('click', fecharModalExclusao);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!modalCalc.hidden) fecharModalCalc();
        if (!modalExclusao.hidden) fecharModalExclusao();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    carregarCalculadoras();
    carregarLojas();
});
