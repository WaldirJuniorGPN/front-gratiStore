/**
 * Camada de API da feature de Importação Automatizada de Logs de Ponto.
 *
 * Centraliza todas as chamadas HTTP relacionadas à importação de planilhas de
 * comparecimento (upload), consulta de relatórios, tratamento de inconsistências
 * e vinculação de atendentes não-vinculados.
 *
 * Todas as funções usam os helpers expostos por `apiClient.js`
 * (`apiGet`, `apiPost`, `apiPatch`, `apiDelete`, `apiUpload`) — não montam
 * `fetch` direto e dependem do tratamento centralizado de 401/403/erros.
 *
 * Dependências (carregar antes deste script):
 *  - config.js
 *  - erros.js
 *  - sessao.js
 *  - apiClient.js
 *
 * Referência: `relatorios/importacao-pontos/11-guia-frontend.md` §3, §4, §5, §6, §7.
 */

// ============================================================================
// Constantes públicas (enums espelhados do backend — §5 do guia)
// ============================================================================

/**
 * Estados possíveis do processamento de uma importação (`RelatorioImportacao.status`).
 * `AGENDADA` → mensagem na fila; `PROCESSANDO` → worker parseando;
 * `CONCLUIDA` → terminou (mesmo com pendências); `FALHOU` → erro fatal.
 */
const STATUS_IMPORTACAO = Object.freeze({
    AGENDADA: 'AGENDADA',
    PROCESSANDO: 'PROCESSANDO',
    CONCLUIDA: 'CONCLUIDA',
    FALHOU: 'FALHOU'
});

/**
 * Estados terminais — usados pelo `pollStatus` como condição de parada.
 */
const STATUS_IMPORTACAO_FINAIS = Object.freeze(['CONCLUIDA', 'FALHOU']);

/**
 * Tipos de inconsistência detectados pelo worker ao processar a planilha.
 */
const TIPO_INCONSISTENCIA = Object.freeze({
    MENOS_DE_QUATRO_BATIDAS: 'MENOS_DE_QUATRO_BATIDAS',
    MAIS_DE_QUATRO_BATIDAS: 'MAIS_DE_QUATRO_BATIDAS',
    FORMATO_INVALIDO: 'FORMATO_INVALIDO',
    JA_EXISTE_PONTO_MANUAL: 'JA_EXISTE_PONTO_MANUAL'
});

/**
 * Estado de uma inconsistência. Transições válidas:
 * `PENDENTE → RESOLVIDA` ou `PENDENTE → DESCARTADA` (sem volta).
 */
const STATUS_INCONSISTENCIA = Object.freeze({
    PENDENTE: 'PENDENTE',
    RESOLVIDA: 'RESOLVIDA',
    DESCARTADA: 'DESCARTADA'
});

// ============================================================================
// Helpers internos
// ============================================================================

/**
 * Monta a query string no formato Spring Data a partir de um objeto.
 *
 * Ex.: `{ page: 0, size: 20, sort: 'dataReferencia,asc', status: 'PENDENTE' }`
 *      → `'?page=0&size=20&sort=dataReferencia,asc&status=PENDENTE'`
 *
 * Valores `undefined`, `null` e string vazia são descartados (não vão para a query).
 *
 * @param {Object<string, any>} [params]
 * @returns {string} Query string já com `?` no início, ou `''` se nenhum param.
 */
function montarQuery(params = {}) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return;
        sp.append(k, String(v));
    });
    const qs = sp.toString();
    return qs ? `?${qs}` : '';
}

/**
 * Converte a string `"08:53,12:02,12:52,12:58,17:00"` em array de horas trimadas.
 * Mantida como string no backend de propósito (§9.6 do guia — JSON achatado).
 *
 * Tolera `null`, `undefined`, string vazia e espaços extras sem quebrar.
 *
 * @param {string|null|undefined} raw
 * @returns {string[]}
 */
function splitBatidasBrutas(raw) {
    if (!raw) return [];
    return raw.split(',').map(s => s.trim()).filter(Boolean);
}

// ============================================================================
// 4.1 — Vincular idRelogioPonto em um atendente
// ============================================================================

/**
 * Vincula um `idRelogioPonto` ao atendente (§4.1 do guia).
 *
 * @param {number} atendenteId ID do atendente no cadastro.
 * @param {number} idRelogio ID do colaborador no relógio biométrico (obrigatório, positivo).
 * @returns {Promise<object>} `AtendenteResponse` atualizado.
 * @throws {ApiError} 400 (ID inválido), 404 (atendente inexistente), 409 (idRelogio já em uso).
 */
function vincularIdRelogio(atendenteId, idRelogio) {
    return apiPatch(`/atendentes/${atendenteId}/id-relogio`, { idRelogio });
}

// ============================================================================
// 4.2 — Desvincular idRelogioPonto (idempotente)
// ============================================================================

/**
 * Remove o vínculo de `idRelogioPonto` de um atendente (§4.2 do guia).
 * É idempotente: se o atendente não tinha vínculo, é no-op.
 *
 * @param {number} atendenteId
 * @returns {Promise<null>} `204 No Content`.
 */
function desvincularIdRelogio(atendenteId) {
    return apiDelete(`/atendentes/${atendenteId}/id-relogio`);
}

// ============================================================================
// 4.3 — Upload da planilha (agendamento da importação)
// ============================================================================

/**
 * Agenda a importação de uma planilha de logs de comparecimento (§4.3 do guia,
 * complementado pelo doc 12 — escopo de loja).
 *
 * O upload retorna `202 Accepted` imediatamente — o processamento real roda em
 * fila no backend. Use `pollStatus(relatorioId)` para acompanhar o progresso.
 *
 * Importante: o `idRelogioPonto` é **local a cada loja** — duas lojas distintas
 * podem ter atendentes diferentes com o mesmo ID no relógio. Por isso a loja
 * de destino é obrigatória no upload (`@RequestParam lojaId` no back).
 *
 * @param {File} arquivo Arquivo `.xls` ou `.xlsx` selecionado pelo usuário.
 * @param {number} lojaId ID da loja de destino da planilha (obrigatório, positivo).
 * @returns {Promise<object>} `ImportacaoAgendadaResponse`
 *   `{ relatorioId, status, periodoInicio, periodoFim, funcionariosDetectados }`.
 * @throws {ApiError} 400 (arquivo inválido/aba ausente/período ilegível; lojaId
 *   ausente ou loja inexistente), 413 (>10 MB).
 */
function agendarImportacao(arquivo, lojaId) {
    const formData = new FormData();
    formData.append('arquivo', arquivo);
    formData.append('lojaId', String(lojaId));
    // `apiUpload` default é PATCH (uso histórico do upload de vendas).
    // Aqui é POST — não esquecer o 3º argumento.
    return apiUpload('/importacoes/logs-comparecimento', formData, 'POST');
}

// ============================================================================
// 4.4 — Consultar status/contadores de um relatório
// ============================================================================

/**
 * Consulta o snapshot atual de um relatório de importação (§4.4 do guia).
 *
 * @param {number} relatorioId
 * @returns {Promise<object>} `RelatorioImportacaoResponse`.
 */
function consultarRelatorio(relatorioId) {
    return apiGet(`/importacoes/logs-comparecimento/${relatorioId}`);
}

// ============================================================================
// Helper de polling de status (essencial para a UX do upload)
// ============================================================================

/**
 * Faz polling do status de um relatório até atingir um estado final
 * (`CONCLUIDA` ou `FALHOU`) ou esgotar o timeout.
 *
 * Importante: o timeout NÃO para o backend — só desiste do polling. A tela
 * deve oferecer um botão "Recarregar" caso o usuário queira consultar de novo
 * manualmente após o erro.
 *
 * @param {number} relatorioId
 * @param {object} [opts]
 * @param {number} [opts.intervaloMs=2500] Intervalo entre polls (recomendação do guia: 2-3s).
 * @param {number} [opts.timeoutMs=300000] Tempo máximo total (default 5 minutos).
 * @param {(snapshot: object) => void} [opts.onUpdate] Callback chamado a cada poll
 *   com o último snapshot — use para atualizar a UI em tempo real (transição
 *   `AGENDADA → PROCESSANDO → CONCLUIDA`).
 * @returns {Promise<object>} Snapshot final do `RelatorioImportacaoResponse`.
 * @throws {Error} Se o timeout for atingido antes do estado final (mensagem amigável).
 */
async function pollStatus(relatorioId, opts = {}) {
    const { intervaloMs = 2500, timeoutMs = 300000, onUpdate } = opts;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const snapshot = await consultarRelatorio(relatorioId);
        if (typeof onUpdate === 'function') onUpdate(snapshot);
        if (STATUS_IMPORTACAO_FINAIS.includes(snapshot.status)) {
            return snapshot;
        }
        await new Promise(resolve => setTimeout(resolve, intervaloMs));
    }
    throw new Error('O processamento demorou mais do que o esperado. Atualize a página para checar o status novamente.');
}

// ============================================================================
// TASK-00 — Listagem paginada de relatórios
// ============================================================================

/**
 * Lista relatórios de importação paginados (TASK-00, guia §8.1).
 *
 * Endpoint exposto pelo backend depois da TASK-00. Ordenação default
 * `inputDate,desc` (mais recentes primeiro) — espelha o método de repositório
 * `findAllByOrderByInputDateDesc`.
 *
 * @param {{ page?: number, size?: number, sort?: string }} [opts]
 * @returns {Promise<object>} `SpringPage<RelatorioImportacaoResponse>`.
 */
function listarRelatorios(opts = {}) {
    const params = {
        page: opts.page ?? 0,
        size: opts.size ?? 20,
        sort: opts.sort ?? 'inputDate,desc'
    };
    return apiGet(`/importacoes/logs-comparecimento${montarQuery(params)}`);
}

// ============================================================================
// 4.5 — Listar inconsistências do relatório
// ============================================================================

/**
 * Lista inconsistências de um relatório, filtradas por status (§4.5 do guia).
 *
 * Default `status=PENDENTE` (o que a MASTER quer ver na tela operacional)
 * e `sort=dataReferencia,asc` (do dia mais antigo ao mais recente) — o
 * controller do backend não tem ordenação default (§9.14 do guia), então
 * sempre passar `sort` torna a UI determinística.
 *
 * @param {number} relatorioId
 * @param {object} [opts]
 * @param {'PENDENTE'|'RESOLVIDA'|'DESCARTADA'} [opts.status='PENDENTE']
 * @param {number} [opts.page=0]
 * @param {number} [opts.size=20]
 * @param {string} [opts.sort='dataReferencia,asc']
 * @returns {Promise<object>} `SpringPage<InconsistenciaResponse>`.
 */
function listarInconsistencias(relatorioId, opts = {}) {
    const params = {
        status: opts.status ?? STATUS_INCONSISTENCIA.PENDENTE,
        page: opts.page ?? 0,
        size: opts.size ?? 20,
        sort: opts.sort ?? 'dataReferencia,asc'
    };
    return apiGet(`/importacoes/${relatorioId}/inconsistencias${montarQuery(params)}`);
}

// ============================================================================
// 4.6 — Resolver inconsistência (informar as 4 horas corretas)
// ============================================================================

/**
 * Resolve uma inconsistência informando os 4 horários do `PontoDiario` (§4.6 do guia).
 *
 * Os 4 horários são obrigatórios e devem estar em ordem estrita:
 * `entrada < inicioAlmoco < fimAlmoco < saida`. Fora de ordem → 400.
 *
 * Após sucesso a inconsistência muda para `RESOLVIDA` e o `qtdInconsistencias`
 * do relatório **não decrementa** (é snapshot do momento da importação).
 *
 * @param {number} relatorioId
 * @param {number} inconsistenciaId
 * @param {object} payload
 * @param {string} payload.entrada HH:mm:ss
 * @param {string} payload.inicioAlmoco HH:mm:ss
 * @param {string} payload.fimAlmoco HH:mm:ss
 * @param {string} payload.saida HH:mm:ss
 * @param {string} [payload.observacao] Opcional, até 500 caracteres.
 * @returns {Promise<object>} `InconsistenciaResponse` atualizado.
 * @throws {ApiError} 400 (horários fora de ordem), 409 (já resolvida/descartada).
 */
function resolverInconsistencia(relatorioId, inconsistenciaId, payload) {
    return apiPost(
        `/importacoes/${relatorioId}/inconsistencias/${inconsistenciaId}/resolver`,
        payload
    );
}

// ============================================================================
// 4.7 — Descartar inconsistência sem gerar PontoDiario
// ============================================================================

/**
 * Descarta uma inconsistência informando o motivo (§4.7 do guia).
 *
 * Usar quando as batidas vieram por engano (férias, atestado, falha do relógio)
 * e a MASTER decidiu **não** criar ponto para aquele dia.
 *
 * @param {number} relatorioId
 * @param {number} inconsistenciaId
 * @param {{ motivo: string }} payload `motivo` obrigatório (não-vazio), até 500 chars.
 * @returns {Promise<object>} `InconsistenciaResponse` com `status='DESCARTADA'`.
 * @throws {ApiError} 400 (motivo ausente/vazio), 409 (já resolvida/descartada).
 */
function descartarInconsistencia(relatorioId, inconsistenciaId, payload) {
    return apiPost(
        `/importacoes/${relatorioId}/inconsistencias/${inconsistenciaId}/descartar`,
        payload
    );
}

// ============================================================================
// 4.8 — Listar atendentes não-vinculados do relatório
// ============================================================================

/**
 * Lista atendentes não-vinculados (paginado) de um relatório (§4.8 do guia).
 *
 * São colaboradores que apareceram na planilha mas o sistema não conseguiu
 * casar com nenhum atendente cadastrado.
 *
 * Omita `resolvido` para listar todos (resolvidos e pendentes). Para a tela
 * operacional, passe `resolvido: false`.
 *
 * @param {number} relatorioId
 * @param {object} [opts]
 * @param {boolean} [opts.resolvido] Filtra por estado de tratamento. Omitir = todos.
 * @param {number} [opts.page=0]
 * @param {number} [opts.size=20]
 * @param {string} [opts.sort='qtdDiasComBatida,desc'] Mais batidas primeiro
 *   (ajuda a MASTER a priorizar quem vincular primeiro).
 * @returns {Promise<object>} `SpringPage<AtendenteNaoVinculadoResponse>`.
 */
function listarNaoVinculados(relatorioId, opts = {}) {
    const params = {
        resolvido: opts.resolvido,
        page: opts.page ?? 0,
        size: opts.size ?? 20,
        sort: opts.sort ?? 'qtdDiasComBatida,desc'
    };
    return apiGet(
        `/importacoes/${relatorioId}/atendentes-nao-vinculados${montarQuery(params)}`
    );
}

// ============================================================================
// 4.9 — Vincular um não-vinculado a um atendente existente
// ============================================================================

/**
 * Vincula um registro de "não-vinculado" a um atendente do cadastro (§4.9 do guia).
 *
 * Atenção UX: o vínculo **não retroaliva** os pontos do dia importado. Para
 * que as batidas virem `PontoDiario`, a MASTER precisa **reimportar a planilha**
 * depois. A tela deve reforçar isso (toast + CTA).
 *
 * O flag `atualizarIdRelogio` só tem efeito se o atendente alvo ainda não tem
 * `idRelogioPonto` setado e o registro tinha `idRelogioBruto`. Caso contrário
 * é ignorado silenciosamente (NÃO sobrescreve).
 *
 * @param {number} relatorioId
 * @param {number} naoVinculadoId
 * @param {object} payload
 * @param {number} payload.atendenteId ID do atendente do cadastro (obrigatório, positivo).
 * @param {boolean} [payload.atualizarIdRelogio=false] Se `true`, tenta auto-preencher
 *   o `idRelogioPonto` do atendente para casamento determinístico em importações futuras.
 * @returns {Promise<object>} `AtendenteNaoVinculadoResponse` atualizado.
 * @throws {ApiError} 400 (atendente inexistente/registro de outro relatório), 409 (já vinculado).
 */
function vincularNaoVinculado(relatorioId, naoVinculadoId, payload) {
    return apiPost(
        `/importacoes/${relatorioId}/atendentes-nao-vinculados/${naoVinculadoId}/vincular`,
        payload
    );
}
