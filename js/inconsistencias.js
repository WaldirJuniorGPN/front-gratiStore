/**
 * Tela 4 — Inconsistências do relatório (TASK-07).
 *
 * Permite tratar uma a uma as inconsistências detectadas pelo importador:
 *  - Resolver (informa os 4 horários e materializa o `PontoDiario`).
 *  - Descartar (registra motivo e não cria ponto para o dia).
 *
 * Otimizações de UX:
 *  - Chips clicáveis das batidas brutas auto-preenchem o input em foco
 *    (avançam o foco para o próximo input vazio).
 *  - Validação client-side da ordem cronológica espelha a regra do back.
 *  - 409 (já tratada por outra MASTER) vira toast informativo, não erro.
 *  - Navegação por setas ←/→ entre as tabs (acessibilidade).
 *
 * Dependências (carregar antes deste script):
 *  - apiClient.js, importacao-pontos.js (camada API — TASK-01)
 *  - toast.js, importacao-ui.js (UI compartilhada — TASK-02)
 */

exigirPermissao('importacao-pontos');

// ============================================================================
// State
// ============================================================================

const urlParams = new URLSearchParams(window.location.search);
const relatorioId = parseInt(urlParams.get('id'), 10);

let abaAtiva = STATUS_INCONSISTENCIA.PENDENTE;
let paginaCorrente = 0;
const PAGE_SIZE = 20;
let inconsistenciaSelecionada = null;   // objeto completo
let inputFocadoAtualmente = null;

const TIPO_LABEL = {
    MENOS_DE_QUATRO_BATIDAS: 'Faltam batidas',
    MAIS_DE_QUATRO_BATIDAS:  'Excesso de batidas',
    FORMATO_INVALIDO:        'Formato inválido',
    JA_EXISTE_PONTO_MANUAL:  'Conflito com manual'
};

// ============================================================================
// Refs DOM
// ============================================================================

const subtitle = document.getElementById('subtitle');
const linkVoltar = document.getElementById('linkVoltar');
const tabs = Array.from(document.querySelectorAll('.tab'));
const contagemEls = {
    PENDENTE: document.getElementById('contagemPendente'),
    RESOLVIDA: document.getElementById('contagemResolvida'),
    DESCARTADA: document.getElementById('contagemDescartada')
};
const corpo = document.getElementById('corpo');
const painelLista = document.getElementById('painelLista');
const paginacao = document.getElementById('paginacao');
const paginacaoInfo = document.getElementById('paginacaoInfo');
const paginaAtualEl = document.getElementById('paginaAtual');
const paginaTotalEl = document.getElementById('paginaTotal');
const paginaAnteriorBtn = document.getElementById('paginaAnterior');
const paginaProximaBtn = document.getElementById('paginaProxima');

// Modal Resolver
const modalResolver = document.getElementById('modalResolver');
const formResolver = document.getElementById('formResolver');
const resolverAtendenteEl = document.getElementById('resolverAtendente');
const resolverDataEl = document.getElementById('resolverData');
const resolverTipoEl = document.getElementById('resolverTipo');
const chipsResolverContainer = document.getElementById('chipsResolver');
const entradaInput = document.getElementById('entrada');
const inicioAlmocoInput = document.getElementById('inicioAlmoco');
const fimAlmocoInput = document.getElementById('fimAlmoco');
const saidaInput = document.getElementById('saida');
const observacaoInput = document.getElementById('observacao');
const observacaoCount = document.getElementById('observacaoCount');
const erroResolverEl = document.getElementById('erroResolver');
const btnConfirmarResolver = document.getElementById('btnConfirmarResolver');

const INPUTS_ORDEM = [entradaInput, inicioAlmocoInput, fimAlmocoInput, saidaInput];

// Modal Descartar
const modalDescartar = document.getElementById('modalDescartar');
const formDescartar = document.getElementById('formDescartar');
const descartarResumoEl = document.getElementById('descartarResumo');
const motivoInput = document.getElementById('motivo');
const motivoCount = document.getElementById('motivoCount');
const erroDescartarEl = document.getElementById('erroDescartar');
const btnConfirmarDescartar = document.getElementById('btnConfirmarDescartar');

// ============================================================================
// Validação de pré-condições
// ============================================================================

if (!Number.isFinite(relatorioId) || relatorioId <= 0) {
    subtitle.textContent = 'Relatório não informado. Volte e abra o relatório pelo histórico.';
    corpo.innerHTML = '<tr class="row-empty"><td colspan="5">Sem relatório a exibir.</td></tr>';
} else {
    linkVoltar.href = `/html/importacao-detalhes.html?id=${relatorioId}`;
    inicializar();
}

// ============================================================================
// Inicialização
// ============================================================================

function inicializar() {
    subtitle.textContent = `Relatório #${relatorioId} · tratar as inconsistências detectadas pelo importador.`;
    ligarTabs();
    ligarPaginacao();
    ligarModalResolver();
    ligarModalDescartar();
    ligarEscParaModais();
    atualizarTodosOsContadores();
    recarregarPagina();
}

function ligarTabs() {
    tabs.forEach((tab, idx) => {
        tab.addEventListener('click', () => trocarAba(tab.dataset.status));
        tab.addEventListener('keydown', e => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const dir = e.key === 'ArrowRight' ? 1 : -1;
                const proximoIdx = (idx + dir + tabs.length) % tabs.length;
                tabs[proximoIdx].focus();
                trocarAba(tabs[proximoIdx].dataset.status);
            }
        });
    });
}

function trocarAba(status) {
    if (abaAtiva === status) return;
    abaAtiva = status;
    tabs.forEach(t => {
        const ativa = t.dataset.status === status;
        t.setAttribute('aria-selected', ativa ? 'true' : 'false');
        t.setAttribute('tabindex', ativa ? '0' : '-1');
    });
    paginaCorrente = 0;
    recarregarPagina();
}

function ligarPaginacao() {
    paginaAnteriorBtn.addEventListener('click', () => {
        if (paginaCorrente > 0) {
            paginaCorrente--;
            recarregarPagina();
        }
    });
    paginaProximaBtn.addEventListener('click', () => {
        paginaCorrente++;
        recarregarPagina();
    });
}

// ============================================================================
// Listagem
// ============================================================================

async function recarregarPagina() {
    painelLista.setAttribute('aria-busy', 'true');
    corpo.innerHTML = '<tr class="row-loading"><td colspan="5">Carregando inconsistências…</td></tr>';
    paginacao.hidden = true;
    try {
        const page = await listarInconsistencias(relatorioId, {
            status: abaAtiva,
            page: paginaCorrente,
            size: PAGE_SIZE,
            sort: 'dataReferencia,asc'
        });
        renderizarLinhas(page);
        renderizarPaginacao(page);
        atualizarContadorAba(abaAtiva, page.totalElements);
    } catch (err) {
        if (err instanceof ApiError) {
            mostrarToast(err.message || 'Erro ao carregar inconsistências.', 'erro');
        } else {
            mostrarToast('Sem conexão com o servidor.', 'erro');
        }
        corpo.innerHTML = '<tr class="row-empty"><td colspan="5">Erro ao carregar. Tente novamente.</td></tr>';
    } finally {
        painelLista.setAttribute('aria-busy', 'false');
    }
}

function renderizarLinhas(page) {
    corpo.innerHTML = '';
    if (!page.content || page.content.length === 0) {
        const mensagem = mensagemVaziaPorAba();
        corpo.innerHTML = `<tr class="row-empty"><td colspan="5">${mensagem}</td></tr>`;
        return;
    }
    page.content.forEach(inc => {
        const tr = document.createElement('tr');
        tr.dataset.id = inc.id;

        const tdData = td(formatarData(inc.dataReferencia));
        const tdAtendente = td(inc.atendenteNome || '—');
        tdAtendente.classList.add('cell-name');

        const tdTipo = document.createElement('td');
        tdTipo.appendChild(criarBadgeTipoInconsistencia(inc.tipo));

        const tdBatidas = document.createElement('td');
        tdBatidas.className = 'cell-batidas';
        tdBatidas.appendChild(criarChipsBatidasBrutas(inc.batidasBrutas));

        const tdAcao = document.createElement('td');
        tdAcao.className = 'cell-acao';

        if (inc.status === STATUS_INCONSISTENCIA.PENDENTE) {
            const btnResolver = document.createElement('button');
            btnResolver.type = 'button';
            btnResolver.className = 'btn-icon-action btn-icon-accent';
            btnResolver.title = 'Resolver e criar ponto';
            btnResolver.setAttribute('aria-label', 'Resolver inconsistência');
            btnResolver.textContent = '✓';
            btnResolver.addEventListener('click', () => abrirModalResolver(inc));
            tdAcao.appendChild(btnResolver);

            const btnDescartar = document.createElement('button');
            btnDescartar.type = 'button';
            btnDescartar.className = 'btn-icon-action btn-icon-danger';
            btnDescartar.title = 'Descartar (sem criar ponto)';
            btnDescartar.setAttribute('aria-label', 'Descartar inconsistência');
            btnDescartar.textContent = '✕';
            btnDescartar.addEventListener('click', () => abrirModalDescartar(inc));
            tdAcao.appendChild(btnDescartar);
        } else {
            const span = document.createElement('span');
            span.className = 'cell-status-tratado';
            const rotulo = inc.status === STATUS_INCONSISTENCIA.RESOLVIDA ? '✓ Resolvida' : '✕ Descartada';
            span.innerHTML = `<strong>${rotulo}</strong>`;
            const obs = inc.status === STATUS_INCONSISTENCIA.RESOLVIDA
                ? inc.observacaoResolucao
                : inc.motivoDescartar;
            if (obs) span.title = obs;
            tdAcao.appendChild(span);
        }

        tr.appendChild(tdData);
        tr.appendChild(tdAtendente);
        tr.appendChild(tdTipo);
        tr.appendChild(tdBatidas);
        tr.appendChild(tdAcao);
        corpo.appendChild(tr);
    });
}

function mensagemVaziaPorAba() {
    if (abaAtiva === STATUS_INCONSISTENCIA.PENDENTE) {
        return 'Nenhuma inconsistência pendente — tudo tratado neste relatório!';
    }
    if (abaAtiva === STATUS_INCONSISTENCIA.RESOLVIDA) {
        return 'Nenhuma inconsistência foi resolvida até o momento.';
    }
    return 'Nenhuma inconsistência foi descartada.';
}

function renderizarPaginacao(page) {
    if (page.totalPages <= 1) {
        paginacao.hidden = true;
        return;
    }
    paginacao.hidden = false;
    paginaAtualEl.textContent = String(page.number + 1);
    paginaTotalEl.textContent = String(page.totalPages);
    paginacaoInfo.textContent = `${page.totalElements} no total`;
    paginaAnteriorBtn.disabled = page.first;
    paginaProximaBtn.disabled = page.last;
}

function atualizarContadorAba(status, total) {
    if (contagemEls[status]) contagemEls[status].textContent = String(total);
}

async function atualizarTodosOsContadores() {
    try {
        const [p, r, d] = await Promise.all([
            listarInconsistencias(relatorioId, { status: STATUS_INCONSISTENCIA.PENDENTE,   page: 0, size: 1 }),
            listarInconsistencias(relatorioId, { status: STATUS_INCONSISTENCIA.RESOLVIDA,  page: 0, size: 1 }),
            listarInconsistencias(relatorioId, { status: STATUS_INCONSISTENCIA.DESCARTADA, page: 0, size: 1 })
        ]);
        atualizarContadorAba(STATUS_INCONSISTENCIA.PENDENTE,   p.totalElements);
        atualizarContadorAba(STATUS_INCONSISTENCIA.RESOLVIDA,  r.totalElements);
        atualizarContadorAba(STATUS_INCONSISTENCIA.DESCARTADA, d.totalElements);
    } catch {
        /* falha silenciosa nos contadores das outras tabs — não bloqueia a tela */
    }
}

// ============================================================================
// Modal Resolver
// ============================================================================

function ligarModalResolver() {
    modalResolver.querySelectorAll('[data-fechar-resolver]').forEach(el => {
        el.addEventListener('click', fecharModalResolver);
    });

    INPUTS_ORDEM.forEach(input => {
        input.addEventListener('focus', e => { inputFocadoAtualmente = e.target; });
    });

    observacaoInput.addEventListener('input', () => {
        observacaoCount.textContent = String(observacaoInput.value.length);
    });

    formResolver.addEventListener('submit', submitResolver);
}

function abrirModalResolver(inc) {
    inconsistenciaSelecionada = inc;
    inputFocadoAtualmente = null;
    erroResolverEl.hidden = true;
    erroResolverEl.textContent = '';

    resolverAtendenteEl.textContent = inc.atendenteNome || '—';
    resolverDataEl.textContent = formatarData(inc.dataReferencia);
    resolverTipoEl.textContent = TIPO_LABEL[inc.tipo] || inc.tipo || '—';

    chipsResolverContainer.innerHTML = '';
    chipsResolverContainer.appendChild(
        criarChipsBatidasBrutas(inc.batidasBrutas, { onClick: preencherDeChip })
    );

    INPUTS_ORDEM.forEach(i => { i.value = ''; });
    observacaoInput.value = '';
    observacaoCount.textContent = '0';

    modalResolver.hidden = false;
    setTimeout(() => entradaInput.focus(), 60);
}

function fecharModalResolver() {
    modalResolver.hidden = true;
    inconsistenciaSelecionada = null;
    inputFocadoAtualmente = null;
}

function preencherDeChip(valor) {
    const alvo = inputFocadoAtualmente || encontrarPrimeiroVazio();
    if (!alvo) return;
    alvo.value = valor.length === 5 ? valor : valor.slice(0, 5);
    const proximo = proximoInputVazio(alvo);
    if (proximo) {
        proximo.focus();
    } else {
        alvo.blur();
        inputFocadoAtualmente = null;
    }
}

function encontrarPrimeiroVazio() {
    return INPUTS_ORDEM.find(el => !el.value);
}

function proximoInputVazio(atual) {
    const idx = INPUTS_ORDEM.indexOf(atual);
    for (let i = idx + 1; i < INPUTS_ORDEM.length; i++) {
        if (!INPUTS_ORDEM[i].value) return INPUTS_ORDEM[i];
    }
    return null;
}

function validarOrdem(entrada, inicioAlmoco, fimAlmoco, saida) {
    if (!entrada || !inicioAlmoco || !fimAlmoco || !saida) {
        return 'Preencha os 4 horários antes de salvar.';
    }
    if (entrada >= inicioAlmoco) return 'A entrada deve ser antes do início do almoço.';
    if (inicioAlmoco >= fimAlmoco) return 'O início do almoço deve ser antes do fim do almoço.';
    if (fimAlmoco >= saida) return 'O fim do almoço deve ser antes da saída.';
    return null;
}

async function submitResolver(event) {
    event.preventDefault();
    if (!inconsistenciaSelecionada) return;

    const entrada = entradaInput.value;
    const inicioAlmoco = inicioAlmocoInput.value;
    const fimAlmoco = fimAlmocoInput.value;
    const saida = saidaInput.value;

    const erroOrdem = validarOrdem(entrada, inicioAlmoco, fimAlmoco, saida);
    if (erroOrdem) {
        mostrarErroForm(erroOrdem, 'resolver');
        return;
    }

    const obs = observacaoInput.value.trim();
    const payload = {
        entrada:      entrada + ':00',
        inicioAlmoco: inicioAlmoco + ':00',
        fimAlmoco:    fimAlmoco + ':00',
        saida:        saida + ':00'
    };
    if (obs) payload.observacao = obs;

    btnConfirmarResolver.disabled = true;
    try {
        await resolverInconsistencia(relatorioId, inconsistenciaSelecionada.id, payload);
        mostrarToast('Inconsistência resolvida — ponto diário criado.', 'sucesso');
        fecharModalResolver();
        await Promise.all([recarregarPagina(), atualizarTodosOsContadores()]);
    } catch (err) {
        tratarErroAcao(err, 'resolver');
    } finally {
        btnConfirmarResolver.disabled = false;
    }
}

// ============================================================================
// Modal Descartar
// ============================================================================

function ligarModalDescartar() {
    modalDescartar.querySelectorAll('[data-fechar-descartar]').forEach(el => {
        el.addEventListener('click', fecharModalDescartar);
    });
    motivoInput.addEventListener('input', () => {
        motivoCount.textContent = String(motivoInput.value.length);
    });
    formDescartar.addEventListener('submit', submitDescartar);
}

function abrirModalDescartar(inc) {
    inconsistenciaSelecionada = inc;
    erroDescartarEl.hidden = true;
    erroDescartarEl.textContent = '';

    const nome = inc.atendenteNome || '—';
    descartarResumoEl.textContent = `${nome} em ${formatarData(inc.dataReferencia)}`;
    motivoInput.value = '';
    motivoCount.textContent = '0';

    modalDescartar.hidden = false;
    setTimeout(() => motivoInput.focus(), 60);
}

function fecharModalDescartar() {
    modalDescartar.hidden = true;
    inconsistenciaSelecionada = null;
}

async function submitDescartar(event) {
    event.preventDefault();
    if (!inconsistenciaSelecionada) return;

    const motivo = motivoInput.value.trim();
    if (!motivo) {
        mostrarErroForm('Informe o motivo do descarte.', 'descartar');
        return;
    }

    btnConfirmarDescartar.disabled = true;
    try {
        await descartarInconsistencia(relatorioId, inconsistenciaSelecionada.id, { motivo });
        mostrarToast('Inconsistência descartada.', 'sucesso');
        fecharModalDescartar();
        await Promise.all([recarregarPagina(), atualizarTodosOsContadores()]);
    } catch (err) {
        tratarErroAcao(err, 'descartar');
    } finally {
        btnConfirmarDescartar.disabled = false;
    }
}

// ============================================================================
// Tratamento de erro padronizado
// ============================================================================

function mostrarErroForm(mensagem, contexto) {
    const alvo = contexto === 'resolver' ? erroResolverEl : erroDescartarEl;
    alvo.textContent = mensagem;
    alvo.hidden = false;
}

function tratarErroAcao(err, contexto) {
    if (!(err instanceof ApiError)) {
        mostrarToast('Sem conexão com o servidor.', 'erro');
        return;
    }
    if (err.status === 409) {
        mostrarToast(
            'Esta inconsistência já foi tratada por outro usuário. Lista atualizada.',
            'info'
        );
        fecharModalResolver();
        fecharModalDescartar();
        Promise.all([recarregarPagina(), atualizarTodosOsContadores()]);
        return;
    }
    mostrarErroForm(err.message || `Erro ao ${contexto}.`, contexto);
}

// ============================================================================
// Esc fecha modais (acessibilidade)
// ============================================================================

function ligarEscParaModais() {
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (!modalResolver.hidden) fecharModalResolver();
        if (!modalDescartar.hidden) fecharModalDescartar();
    });
}

// ============================================================================
// Helpers
// ============================================================================

function td(texto, classe) {
    const el = document.createElement('td');
    if (classe) el.className = classe;
    el.textContent = texto ?? '—';
    return el;
}

function formatarData(iso) {
    if (!iso) return '—';
    const partes = String(iso).split('-');
    if (partes.length !== 3) return iso;
    const [ano, mes, dia] = partes;
    return `${dia}/${mes}/${ano}`;
}
