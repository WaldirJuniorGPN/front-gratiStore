/**
 * Tela 2 — Upload da planilha de logs de comparecimento (TASK-05).
 *
 * Orquestração do fluxo:
 *  VAZIO → ARQUIVO_SELECIONADO → ENVIANDO → AGENDADA/PROCESSANDO → CONCLUIDA | FALHOU
 *
 * Implementa:
 *  - Validação client-side de extensão e tamanho (`.xls`/`.xlsx`, ≤ 10 MB).
 *  - Drag-and-drop com fallback para clique no `<label class="dropzone">`.
 *  - `agendarImportacao(file)` (POST multipart) e `pollStatus(id, { onUpdate })`.
 *  - Re-tomada do polling via `?retomar={relatorioId}` na URL (recomendação UX).
 *  - Tratamento específico de 400 (arquivo/aba inválidos) e 413 (>10 MB).
 *  - Botão de "Importar" desabilitado durante todo o processo para prevenir
 *    duplo-clique (§9.4 do guia — idempotência do upload NÃO é garantida).
 *
 * Dependências (carregar antes deste script):
 *  - apiClient.js, importacao-pontos.js (camada API — TASK-01)
 *  - toast.js, importacao-ui.js (UI compartilhada — TASK-02)
 */

exigirRole('MASTER');

// ============================================================================
// Constantes / state
// ============================================================================

const TAMANHO_MAX = 10 * 1024 * 1024; // 10 MB
const EXTENSOES_VALIDAS = ['.xls', '.xlsx'];

let arquivoSelecionado = null;
let relatorioIdEmCurso = null;
let toastFuncionariosZero = null; // referência para fechar o toast persistente, se necessário

// ============================================================================
// Refs DOM
// ============================================================================

const dropzone = document.getElementById('dropzone');
const inputArquivo = document.getElementById('inputArquivo');
const arquivoSelecionadoEl = document.getElementById('arquivoSelecionado');
const arquivoNomeEl = document.getElementById('arquivoNome');
const arquivoTamanhoEl = document.getElementById('arquivoTamanho');
const btnLimparArquivo = document.getElementById('btnLimparArquivo');
const btnImportar = document.getElementById('btnImportar');

const painelUpload = document.getElementById('painelUpload');
const painelProcessando = document.getElementById('painelProcessando');
const painelConcluido = document.getElementById('painelConcluido');
const painelFalhou = document.getElementById('painelFalhou');

const processandoSubtitle = document.getElementById('processandoSubtitle');
const previewRelatorio = document.getElementById('previewRelatorio');
const previewPeriodo = document.getElementById('previewPeriodo');
const previewFuncionarios = document.getElementById('previewFuncionarios');
const previewStatus = document.getElementById('previewStatus');

const contadoresGrid = document.getElementById('contadoresGrid');
const ctaVerDetalhes = document.getElementById('ctaVerDetalhes');
const ctaNovaImportacao = document.getElementById('ctaNovaImportacao');

const falhouMensagem = document.getElementById('falhouMensagem');
const ctaTentarNovamente = document.getElementById('ctaTentarNovamente');

// ============================================================================
// Helpers
// ============================================================================

function formatarTamanho(bytes) {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validarArquivoCliente(file) {
    if (!file) return 'Selecione um arquivo.';
    const nome = (file.name || '').toLowerCase();
    if (!EXTENSOES_VALIDAS.some(ext => nome.endsWith(ext))) {
        return 'Apenas arquivos .xls ou .xlsx são aceitos.';
    }
    if (file.size > TAMANHO_MAX) {
        return 'Arquivo muito grande — limite de 10 MB.';
    }
    return null;
}

/**
 * Renderiza o badge de status dentro de `previewStatus`, substituindo qualquer
 * conteúdo anterior. Usa o helper compartilhado (TASK-02).
 */
function setPreviewStatus(status) {
    previewStatus.innerHTML = '';
    if (typeof criarBadgeStatusImportacao === 'function') {
        previewStatus.appendChild(criarBadgeStatusImportacao(status));
    } else {
        previewStatus.textContent = status || '—';
    }
}

/**
 * Estados visuais: mostra apenas o painel correspondente, escondendo os outros.
 * @param {'VAZIO'|'ENVIANDO'|'PROCESSANDO'|'CONCLUIDO'|'FALHOU'} estado
 */
function transicionarPara(estado) {
    painelUpload.hidden = estado !== 'VAZIO';
    painelProcessando.hidden = !(estado === 'ENVIANDO' || estado === 'PROCESSANDO');
    painelConcluido.hidden = estado !== 'CONCLUIDO';
    painelFalhou.hidden = estado !== 'FALHOU';

    if (estado === 'ENVIANDO') {
        btnImportar.disabled = true;
        processandoSubtitle.textContent = 'Enviando arquivo…';
        previewRelatorio.hidden = true;
    }
}

// ============================================================================
// Seleção de arquivo + drag-and-drop
// ============================================================================

function handleArquivoEscolhido(file) {
    const erro = validarArquivoCliente(file);
    if (erro) {
        mostrarToast(erro, 'erro');
        limparArquivo();
        return;
    }
    arquivoSelecionado = file;
    arquivoNomeEl.textContent = file.name;
    arquivoTamanhoEl.textContent = formatarTamanho(file.size);
    arquivoSelecionadoEl.hidden = false;
    btnImportar.disabled = false;
}

function limparArquivo() {
    arquivoSelecionado = null;
    inputArquivo.value = '';
    arquivoSelecionadoEl.hidden = true;
    btnImportar.disabled = true;
}

inputArquivo.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) handleArquivoEscolhido(file);
});

btnLimparArquivo.addEventListener('click', (e) => {
    // O clique acontece dentro do <label>, que dispararia o file picker.
    e.preventDefault();
    e.stopPropagation();
    limparArquivo();
});

['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
        e.preventDefault();
        dropzone.classList.add('dropzone--hover');
    });
});

['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
        e.preventDefault();
        dropzone.classList.remove('dropzone--hover');
    });
});

dropzone.addEventListener('drop', e => {
    const file = e.dataTransfer?.files?.[0];
    if (file) {
        // Sincroniza o `inputArquivo.files` para que o estado fique consistente.
        try {
            const dt = new DataTransfer();
            dt.items.add(file);
            inputArquivo.files = dt.files;
        } catch {
            // Alguns browsers podem barrar DataTransfer programático — seguimos com a referência direta.
        }
        handleArquivoEscolhido(file);
    }
});

// ============================================================================
// Fluxo principal — agendar + polling
// ============================================================================

async function iniciarImportacao() {
    const erro = validarArquivoCliente(arquivoSelecionado);
    if (erro) {
        mostrarToast(erro, 'erro');
        return;
    }

    transicionarPara('ENVIANDO');

    let agendada;
    try {
        agendada = await agendarImportacao(arquivoSelecionado);
    } catch (err) {
        tratarFalhaAgendamento(err);
        return;
    }

    relatorioIdEmCurso = agendada.relatorioId;
    preencherPreview(agendada);

    if (agendada.funcionariosDetectados === 0) {
        toastFuncionariosZero = mostrarToast(
            'Atenção: a planilha não tem nenhum funcionário com batidas no período detectado. Confira se subiu o arquivo certo.',
            'aviso',
            { duracaoMs: 0 }
        );
    }

    await acompanharProcessamento(agendada.relatorioId);
}

function preencherPreview(agendada) {
    if (typeof formatarPeriodo === 'function') {
        previewPeriodo.textContent = formatarPeriodo(agendada.periodoInicio, agendada.periodoFim);
    } else {
        previewPeriodo.textContent = `${agendada.periodoInicio} a ${agendada.periodoFim}`;
    }
    previewFuncionarios.textContent = String(agendada.funcionariosDetectados ?? 0);
    setPreviewStatus(agendada.status);
    previewRelatorio.hidden = false;
}

async function acompanharProcessamento(relatorioId) {
    transicionarPara('PROCESSANDO');
    try {
        const final = await pollStatus(relatorioId, {
            onUpdate: snapshot => atualizarPainelProcessando(snapshot)
        });
        if (final.status === STATUS_IMPORTACAO.CONCLUIDA) {
            renderizarConcluido(final);
        } else {
            renderizarFalhou(final.mensagemErro || 'Erro desconhecido durante o processamento.');
        }
    } catch (timeoutErr) {
        // Timeout do polling — backend ainda pode estar processando.
        mostrarToast(timeoutErr.message || 'Tempo esgotado aguardando o processamento.', 'aviso', { duracaoMs: 0 });
        renderizarFalhou('O processamento demorou mais do que o esperado. Tente recarregar a página para checar o status.');
    }
}

function atualizarPainelProcessando(snapshot) {
    setPreviewStatus(snapshot.status);
    if (snapshot.status === STATUS_IMPORTACAO.AGENDADA) {
        processandoSubtitle.textContent = 'Na fila de processamento…';
    } else if (snapshot.status === STATUS_IMPORTACAO.PROCESSANDO) {
        processandoSubtitle.textContent = 'Lendo a planilha e cruzando com o cadastro…';
    } else if (snapshot.status === STATUS_IMPORTACAO.CONCLUIDA) {
        processandoSubtitle.textContent = 'Finalizando…';
    } else if (snapshot.status === STATUS_IMPORTACAO.FALHOU) {
        processandoSubtitle.textContent = 'Encontrei uma falha — abrindo detalhes…';
    }
}

function tratarFalhaAgendamento(err) {
    transicionarPara('VAZIO');
    btnImportar.disabled = !arquivoSelecionado;

    if (err instanceof ApiError) {
        if (err.status === 413) {
            mostrarToast('Arquivo muito grande para o servidor (máx 10 MB).', 'erro');
        } else if (err.status === 400) {
            // O back é específico: aba não encontrada, período mal formatado, etc.
            mostrarToast(err.message || 'Arquivo inválido — confira a aba "Logs Comparecimento" e a célula C3.', 'erro', { duracaoMs: 6000 });
        } else {
            mostrarToast(err.message || 'Falha ao enviar o arquivo.', 'erro');
        }
    } else {
        mostrarToast('Erro de conexão. Verifique sua internet e tente novamente.', 'erro');
    }
}

// ============================================================================
// Renderização de estados finais
// ============================================================================

function renderizarConcluido(snapshot) {
    contadoresGrid.innerHTML = '';
    contadoresGrid.appendChild(criarContador({
        label: 'Pontos OK',
        valor: snapshot.qtdPontosOk ?? 0,
        variante: 'ok'
    }));
    contadoresGrid.appendChild(criarContador({
        label: 'Inconsistências',
        valor: snapshot.qtdInconsistencias ?? 0,
        variante: (snapshot.qtdInconsistencias ?? 0) > 0 ? 'aviso' : 'ok',
        href: (snapshot.qtdInconsistencias ?? 0) > 0
            ? `/html/inconsistencias.html?id=${snapshot.id}`
            : null,
        cta: (snapshot.qtdInconsistencias ?? 0) > 0 ? 'Tratar pendências →' : null
    }));
    contadoresGrid.appendChild(criarContador({
        label: 'Não-vinculados',
        valor: snapshot.qtdAtendentesNaoVinculados ?? 0,
        variante: (snapshot.qtdAtendentesNaoVinculados ?? 0) > 0 ? 'erro' : 'ok',
        href: (snapshot.qtdAtendentesNaoVinculados ?? 0) > 0
            ? `/html/atendentes-nao-vinculados.html?id=${snapshot.id}`
            : null,
        cta: (snapshot.qtdAtendentesNaoVinculados ?? 0) > 0 ? 'Resolver vínculos →' : null
    }));

    ctaVerDetalhes.href = `/html/importacao-detalhes.html?id=${snapshot.id}`;
    transicionarPara('CONCLUIDO');
}

/**
 * Cria um card de contador. Quando `href` é informado, o card vira `<a>` clicável.
 * @param {object} opts
 * @param {string} opts.label
 * @param {number} opts.valor
 * @param {'ok'|'aviso'|'info'|'erro'} opts.variante
 * @param {string} [opts.href]
 * @param {string} [opts.cta]
 * @returns {HTMLElement}
 */
function criarContador({ label, valor, variante, href, cta }) {
    const card = document.createElement(href ? 'a' : 'div');
    card.className = `contador-card contador-card--${variante}`;
    if (href) card.href = href;

    const valorEl = document.createElement('span');
    valorEl.className = 'contador-card__valor';
    valorEl.textContent = String(valor);

    const labelEl = document.createElement('span');
    labelEl.className = 'contador-card__label';
    labelEl.textContent = label;

    card.appendChild(valorEl);
    card.appendChild(labelEl);

    if (cta) {
        const ctaEl = document.createElement('span');
        ctaEl.className = 'contador-card__cta';
        ctaEl.textContent = cta;
        card.appendChild(ctaEl);
    }

    return card;
}

function renderizarFalhou(mensagem) {
    falhouMensagem.textContent = mensagem;
    transicionarPara('FALHOU');
}

// ============================================================================
// Retomada via URL (?retomar={relatorioId})
// ============================================================================

async function retomarSeNecessario() {
    const params = new URLSearchParams(window.location.search);
    const retomarId = params.get('retomar');
    if (!retomarId) return;

    const id = parseInt(retomarId, 10);
    if (!Number.isFinite(id) || id <= 0) return;

    relatorioIdEmCurso = id;
    transicionarPara('ENVIANDO');
    processandoSubtitle.textContent = 'Reabrindo importação em andamento…';

    try {
        const snapshot = await consultarRelatorio(id);
        preencherPreview({
            periodoInicio: snapshot.periodoInicio,
            periodoFim: snapshot.periodoFim,
            funcionariosDetectados: '—', // o GET de relatório não traz este campo
            status: snapshot.status
        });
        if (snapshot.status === STATUS_IMPORTACAO.CONCLUIDA) {
            renderizarConcluido(snapshot);
            return;
        }
        if (snapshot.status === STATUS_IMPORTACAO.FALHOU) {
            renderizarFalhou(snapshot.mensagemErro || 'Erro desconhecido durante o processamento.');
            return;
        }
        await acompanharProcessamento(id);
    } catch (err) {
        const msg = err instanceof ApiError
            ? (err.message || 'Não foi possível retomar essa importação.')
            : 'Erro de conexão ao retomar a importação.';
        mostrarToast(msg, 'erro');
        transicionarPara('VAZIO');
    }
}

// ============================================================================
// Wire-up
// ============================================================================

btnImportar.addEventListener('click', iniciarImportacao);

ctaNovaImportacao.addEventListener('click', () => {
    relatorioIdEmCurso = null;
    limparArquivo();
    transicionarPara('VAZIO');
});

ctaTentarNovamente.addEventListener('click', () => {
    // Mantém o arquivo selecionado para que a MASTER possa simplesmente reclicar Importar.
    transicionarPara('VAZIO');
    btnImportar.disabled = !arquivoSelecionado;
});

document.addEventListener('DOMContentLoaded', retomarSeNecessario);
