/**
 * Tela 3 — Detalhes do relatório de importação (TASK-06).
 *
 * Hub de revisão de uma importação. A partir desta tela a MASTER:
 *  - Vê o resumo oficial dos contadores (do snapshot do back).
 *  - Calcula "X / Y pendentes" via `totalElements` filtrado por status.
 *  - Decide o próximo passo: tratar inconsistências, vincular atendentes,
 *    ou reimportar a planilha.
 *
 * Acessada por 3 caminhos: CTA "Ver detalhes" do upload, clique numa linha
 * do histórico (Tela 1) ou URL direta (`?id={relatorioId}`).
 *
 * Dependências (carregar antes deste script):
 *  - apiClient.js, importacao-pontos.js (camada API — TASK-01)
 *  - toast.js, importacao-ui.js (UI compartilhada — TASK-02)
 */

exigirRole('MASTER');

// ============================================================================
// State
// ============================================================================

const params = new URLSearchParams(window.location.search);
const relatorioId = parseInt(params.get('id'), 10);

let pollAtivoControlador = null;   // { cancelar: () => void } — para parar o polling ao sair

// ============================================================================
// Refs DOM
// ============================================================================

const tituloEl = document.getElementById('tituloRelatorio');
const subtitleEl = document.getElementById('subtitleRelatorio');
const badgeStatusEl = document.getElementById('badgeStatus');

const conteudoPrincipal = document.getElementById('conteudoPrincipal');
const painelFalhou = document.getElementById('painelFalhou');
const falhouMensagem = document.getElementById('falhouMensagem');
const painelOrientativo = document.getElementById('painelOrientativo');
const orientativoTitulo = document.getElementById('orientativoTitulo');
const orientativoSubtitle = document.getElementById('orientativoSubtitle');

const valorPontosOk = document.getElementById('valorPontosOk');
const valorInconsistencias = document.getElementById('valorInconsistencias');
const hintInconsistencias = document.getElementById('hintInconsistencias');
const cardInconsistencias = document.getElementById('cardInconsistencias');
const ctaInconsistencias = document.getElementById('ctaInconsistencias');

const valorNaoVinculados = document.getElementById('valorNaoVinculados');
const hintNaoVinculados = document.getElementById('hintNaoVinculados');
const cardNaoVinculados = document.getElementById('cardNaoVinculados');
const ctaNaoVinculados = document.getElementById('ctaNaoVinculados');

const ctaReimportar = document.getElementById('ctaReimportar');
const avisoReimportacao = document.getElementById('aviso-reimportacao');
const btnReimportarBanner = document.getElementById('btnReimportarBanner');

// ============================================================================
// Helpers de UI
// ============================================================================

function mostrarOrientativo(titulo, subtitulo) {
    conteudoPrincipal.hidden = true;
    painelFalhou.hidden = true;
    painelOrientativo.hidden = false;
    orientativoTitulo.textContent = titulo;
    orientativoSubtitle.textContent = subtitulo;
}

function setBadgeStatus(status) {
    badgeStatusEl.innerHTML = '';
    if (typeof criarBadgeStatusImportacao === 'function') {
        badgeStatusEl.appendChild(criarBadgeStatusImportacao(status));
    } else {
        badgeStatusEl.textContent = status || '—';
    }
}

function aplicarVarianteCard(cardEl, pendentes, total) {
    cardEl.classList.remove('contador-card--ok', 'contador-card--alerta', 'contador-card--erro');
    if (total === 0) {
        cardEl.classList.add('contador-card--ok');
    } else if (pendentes === 0) {
        cardEl.classList.add('contador-card--ok');
    } else {
        cardEl.classList.add('contador-card--alerta');
    }
}

/**
 * Calcula o texto do hint conforme o pareamento `pendentes` × `total`.
 *
 * Cenários (§ "Interpretação na UI" do task):
 *   total == 0                   → "Sem pendências detectadas."
 *   pendentes == 0 && total > 0  → "Todas as N tratadas."        (verde)
 *   pendentes < total            → "X de Y ainda pendentes."
 *   pendentes == total           → "N pendentes."
 */
function textoHintContador(pendentes, total) {
    if (total === 0) return { texto: 'Sem pendências detectadas.', ok: true };
    if (pendentes === 0) return { texto: `Todas as ${total} tratadas.`, ok: true };
    if (pendentes < total) return { texto: `${pendentes} de ${total} ainda pendentes.`, ok: false };
    return { texto: `${pendentes} pendentes.`, ok: false };
}

function preencherContadores(relatorio, pendencias) {
    valorPontosOk.textContent = String(relatorio.qtdPontosOk ?? 0);

    const incPend = pendencias.inconsistenciasPendentes;
    const incTotal = pendencias.inconsistenciasTotal;
    valorInconsistencias.textContent = String(incTotal);
    const hintInc = textoHintContador(incPend, incTotal);
    hintInconsistencias.textContent = hintInc.texto;
    hintInconsistencias.classList.toggle('contador-card__hint--ok', hintInc.ok);
    aplicarVarianteCard(cardInconsistencias, incPend, incTotal);
    if (incTotal > 0) {
        ctaInconsistencias.hidden = false;
        ctaInconsistencias.href = `/html/inconsistencias.html?id=${relatorio.id}`;
    } else {
        ctaInconsistencias.hidden = true;
    }

    const nvPend = pendencias.naoVinculadosPendentes;
    const nvTotal = pendencias.naoVinculadosTotal;
    valorNaoVinculados.textContent = String(nvTotal);
    const hintNv = textoHintContador(nvPend, nvTotal);
    hintNaoVinculados.textContent = hintNv.texto;
    hintNaoVinculados.classList.toggle('contador-card__hint--ok', hintNv.ok);
    aplicarVarianteCard(cardNaoVinculados, nvPend, nvTotal);
    if (nvTotal > 0) {
        ctaNaoVinculados.hidden = false;
        ctaNaoVinculados.href = `/html/atendentes-nao-vinculados.html?id=${relatorio.id}`;
    } else {
        ctaNaoVinculados.hidden = true;
    }
}

function preencherCabecalho(relatorio) {
    tituloEl.textContent = `Importação #${relatorio.id} · ${relatorio.nomeArquivo || '—'}`;
    const periodo = formatarPeriodo(relatorio.periodoInicio, relatorio.periodoFim);
    const loja = relatorio.lojaNome ? ` · Loja: ${relatorio.lojaNome}` : '';
    subtitleEl.textContent = `Período: ${periodo}${loja}`;
    setBadgeStatus(relatorio.status);
    // `?reimportar=` (NÃO `?retomar=`): a tela de upload abre limpa, mostra o
    // contexto do relatório anterior e exige que o usuário selecione loja +
    // arquivo de novo. `?retomar=` só serve para reabrir o polling de um
    // relatório AGENDADA/PROCESSANDO — não reimporta nada.
    ctaReimportar.href = `/html/importacao-pontos.html?reimportar=${relatorio.id}`;
}

// ============================================================================
// "Reimportação pendente" — heurística sem ajuda do back (cf. task §)
// ============================================================================

/**
 * Verifica via API se há ao menos um não-vinculado já vinculado para este
 * relatório. Combinado com o cache local em sessionStorage (TASK-10), define
 * se o banner aparece.
 */
async function checarReimportacaoPendenteServidor(relatorioId) {
    try {
        const page = await listarNaoVinculados(relatorioId, { resolvido: true, page: 0, size: 1 });
        return (page?.totalElements ?? 0) > 0;
    } catch {
        // Se a checagem falha, é melhor não mostrar banner do que mostrar errado.
        return false;
    }
}

async function atualizarBannerReimportacao(relatorio) {
    if (relatorio.status !== STATUS_IMPORTACAO.CONCLUIDA) {
        avisoReimportacao.hidden = true;
        return;
    }
    const pendenteLocal = typeof temReimportacaoPendente === 'function'
        ? temReimportacaoPendente(relatorio.id)
        : false;
    const pendenteServidor = await checarReimportacaoPendenteServidor(relatorio.id);
    avisoReimportacao.hidden = !(pendenteLocal || pendenteServidor);
}

btnReimportarBanner.addEventListener('click', () => {
    window.location.href = `/html/importacao-pontos.html?reimportar=${relatorioId}`;
});

// ============================================================================
// Cálculo das pendências (X / Y) — duas chamadas paralelas via totalElements
// ============================================================================

async function calcularPendencias(relatorio) {
    const [pageIncs, pageNvs] = await Promise.all([
        listarInconsistencias(relatorio.id, { status: STATUS_INCONSISTENCIA.PENDENTE, page: 0, size: 1 }),
        listarNaoVinculados(relatorio.id, { resolvido: false, page: 0, size: 1 })
    ]);
    return {
        inconsistenciasPendentes: pageIncs?.totalElements ?? 0,
        inconsistenciasTotal:     relatorio.qtdInconsistencias ?? 0,
        naoVinculadosPendentes:   pageNvs?.totalElements ?? 0,
        naoVinculadosTotal:       relatorio.qtdAtendentesNaoVinculados ?? 0
    };
}

// ============================================================================
// Fluxos principais por estado
// ============================================================================

async function renderizarConcluida(relatorio) {
    conteudoPrincipal.hidden = false;
    painelFalhou.hidden = true;
    painelOrientativo.hidden = true;
    preencherCabecalho(relatorio);

    let pendencias;
    try {
        pendencias = await calcularPendencias(relatorio);
    } catch (err) {
        // Mostra os cards mesmo sem pendências calculadas — degrade gracefully.
        pendencias = {
            inconsistenciasPendentes: relatorio.qtdInconsistencias ?? 0,
            inconsistenciasTotal:     relatorio.qtdInconsistencias ?? 0,
            naoVinculadosPendentes:   relatorio.qtdAtendentesNaoVinculados ?? 0,
            naoVinculadosTotal:       relatorio.qtdAtendentesNaoVinculados ?? 0
        };
        if (err instanceof ApiError) {
            mostrarToast(err.message || 'Não foi possível detalhar as pendências.', 'aviso');
        }
    }
    preencherContadores(relatorio, pendencias);
    conteudoPrincipal.setAttribute('aria-busy', 'false');

    await atualizarBannerReimportacao(relatorio);
}

function renderizarFalhou(relatorio) {
    conteudoPrincipal.hidden = true;
    painelFalhou.hidden = false;
    painelOrientativo.hidden = true;
    preencherCabecalho(relatorio);
    falhouMensagem.textContent = relatorio.mensagemErro || 'Erro desconhecido durante o processamento.';
    avisoReimportacao.hidden = true;
}

function renderizarEmProcessamento(relatorio) {
    conteudoPrincipal.hidden = false;
    painelFalhou.hidden = true;
    painelOrientativo.hidden = true;
    preencherCabecalho(relatorio);
    const periodo = formatarPeriodo(relatorio.periodoInicio, relatorio.periodoFim);
    const loja = relatorio.lojaNome ? ` · Loja: ${relatorio.lojaNome}` : '';
    const sufixo = relatorio.status === STATUS_IMPORTACAO.AGENDADA
        ? ' · Na fila de processamento…'
        : ' · Lendo a planilha…';
    subtitleEl.textContent = `Período: ${periodo}${loja}${sufixo}`;

    // Mantém os contadores como "—" enquanto processa.
    valorPontosOk.textContent = '—';
    valorInconsistencias.textContent = '—';
    valorNaoVinculados.textContent = '—';
    hintInconsistencias.textContent = 'Aguardando o processamento…';
    hintNaoVinculados.textContent = 'Aguardando o processamento…';
    ctaInconsistencias.hidden = true;
    ctaNaoVinculados.hidden = true;
    conteudoPrincipal.setAttribute('aria-busy', 'true');
}

// ============================================================================
// Polling para AGENDADA / PROCESSANDO
// ============================================================================

async function acompanharProcessamento(relatorio) {
    renderizarEmProcessamento(relatorio);
    let cancelado = false;
    pollAtivoControlador = { cancelar: () => { cancelado = true; } };
    try {
        const final = await pollStatus(relatorio.id, {
            onUpdate: snapshot => {
                if (cancelado) return;
                if (snapshot.status === STATUS_IMPORTACAO.CONCLUIDA ||
                    snapshot.status === STATUS_IMPORTACAO.FALHOU) {
                    return;
                }
                renderizarEmProcessamento(snapshot);
            }
        });
        if (cancelado) return;
        if (final.status === STATUS_IMPORTACAO.CONCLUIDA) {
            await renderizarConcluida(final);
        } else {
            renderizarFalhou(final);
        }
    } catch (err) {
        if (cancelado) return;
        mostrarToast(err.message || 'Timeout aguardando o processamento.', 'aviso', { duracaoMs: 0 });
    } finally {
        pollAtivoControlador = null;
    }
}

// ============================================================================
// Entrada
// ============================================================================

async function carregar() {
    if (!Number.isFinite(relatorioId) || relatorioId <= 0) {
        mostrarOrientativo(
            'ID do relatório não informado',
            'Para ver os detalhes de uma importação, abra-a pelo histórico ou pelo link compartilhado.'
        );
        return;
    }

    try {
        const relatorio = await consultarRelatorio(relatorioId);
        if (relatorio.status === STATUS_IMPORTACAO.CONCLUIDA) {
            await renderizarConcluida(relatorio);
            return;
        }
        if (relatorio.status === STATUS_IMPORTACAO.FALHOU) {
            renderizarFalhou(relatorio);
            return;
        }
        // AGENDADA / PROCESSANDO → começa polling.
        await acompanharProcessamento(relatorio);
    } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
            mostrarOrientativo(
                'Relatório não encontrado',
                `Não encontramos a importação #${relatorioId}. Pode ter sido removida ou o link está incorreto.`
            );
            return;
        }
        if (err instanceof ApiError) {
            mostrarToast(err.message || 'Erro ao carregar o relatório.', 'erro');
        } else {
            mostrarToast('Sem conexão com o servidor. Verifique sua internet.', 'erro');
        }
        mostrarOrientativo(
            'Não foi possível carregar este relatório',
            'Tente novamente em alguns instantes.'
        );
    }
}

window.addEventListener('beforeunload', () => {
    pollAtivoControlador?.cancelar();
});

carregar();
