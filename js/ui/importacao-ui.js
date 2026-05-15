/**
 * Helpers visuais compartilhados da feature de Importação de Pontos (TASK-02).
 *
 * Reúne primitivos que toda tela da feature reutiliza:
 *  - `criarBadgeStatusImportacao(status)` — badge colorido do `StatusImportacao`.
 *  - `criarBadgeTipoInconsistencia(tipo)` — badge colorido por gravidade do `TipoInconsistencia`.
 *  - `criarChipsBatidasBrutas(raw, { onClick })` — lista de chips a partir da string
 *    `"08:53,12:02,..."`. Quando `onClick` é informado, os chips viram `<button>`
 *    e disparam o callback (usado pelo modal Resolver — TASK-07).
 *  - `formatarPeriodo(inicioIso, fimIso)` — formata `2026-03-01`/`2026-03-31`
 *    como "01/03/2026 a 31/03/2026".
 *
 * Dependências (carregar antes deste script):
 *  - `importacao-pontos.js` (TASK-01) — usa `splitBatidasBrutas`.
 *
 * Convenção dos retornos: as funções devolvem `HTMLElement` para que cada tela
 * faça o `appendChild` no nó que faz sentido (linha de tabela, célula, badge inline).
 */

/**
 * Cria um badge `<span>` para o estado de uma importação (§5 do guia).
 *
 * @param {'AGENDADA'|'PROCESSANDO'|'CONCLUIDA'|'FALHOU'|string} status
 * @returns {HTMLSpanElement}
 */
function criarBadgeStatusImportacao(status) {
    const map = {
        AGENDADA:    { label: 'Aguardando',  cls: 'badge--info'    },
        PROCESSANDO: { label: 'Processando', cls: 'badge--info'    },
        CONCLUIDA:   { label: 'Concluída',   cls: 'badge--sucesso' },
        FALHOU:      { label: 'Falhou',      cls: 'badge--erro'    }
    };
    const cfg = map[status] || { label: status || '—', cls: 'badge--neutro' };
    const span = document.createElement('span');
    span.className = `badge ${cfg.cls}`;
    span.textContent = cfg.label;
    return span;
}

/**
 * Cria um badge `<span>` para o tipo de uma inconsistência (§5 do guia).
 * A paleta reflete a gravidade percebida: erro > aviso > info.
 *
 * @param {'MENOS_DE_QUATRO_BATIDAS'|'MAIS_DE_QUATRO_BATIDAS'|'FORMATO_INVALIDO'|'JA_EXISTE_PONTO_MANUAL'|string} tipo
 * @returns {HTMLSpanElement}
 */
function criarBadgeTipoInconsistencia(tipo) {
    const map = {
        MENOS_DE_QUATRO_BATIDAS: { label: 'Faltam batidas',      cls: 'badge--aviso' },
        MAIS_DE_QUATRO_BATIDAS:  { label: 'Excesso de batidas',  cls: 'badge--aviso' },
        FORMATO_INVALIDO:        { label: 'Formato inválido',    cls: 'badge--erro'  },
        JA_EXISTE_PONTO_MANUAL:  { label: 'Conflito com manual', cls: 'badge--info'  }
    };
    const cfg = map[tipo] || { label: tipo || '—', cls: 'badge--neutro' };
    const span = document.createElement('span');
    span.className = `badge ${cfg.cls}`;
    span.textContent = cfg.label;
    span.title = cfg.label;
    return span;
}

/**
 * Renderiza as batidas brutas como uma lista de chips.
 *
 * Quando `onClick` é informado, cada chip vira um `<button>` (acessível por teclado)
 * e dispara o callback com o valor textual do chip — usado pelo modal Resolver
 * (TASK-07) para auto-preencher o input de horário focado.
 *
 * Tolera `null`, `undefined`, string vazia e espaços extras sem quebrar.
 *
 * @param {string|null|undefined} raw String com vírgulas (ex.: `'08:53,12:02,...'`).
 * @param {{ onClick?: (valor: string, chip: HTMLElement) => void }} [opts]
 * @returns {HTMLDivElement} Container `<div class="chips-batidas">`.
 */
function criarChipsBatidasBrutas(raw, opts = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chips-batidas';

    // splitBatidasBrutas vem de TASK-01; fallback defensivo caso o script não esteja carregado.
    const split = (typeof splitBatidasBrutas === 'function')
        ? splitBatidasBrutas
        : (s) => (s ? String(s).split(',').map(v => v.trim()).filter(Boolean) : []);
    const valores = split(raw);

    if (valores.length === 0) {
        const vazio = document.createElement('span');
        vazio.className = 'chip chip--vazio';
        vazio.textContent = 'Sem batidas';
        wrapper.appendChild(vazio);
        return wrapper;
    }

    valores.forEach(v => {
        const el = opts.onClick
            ? document.createElement('button')
            : document.createElement('span');
        el.className = 'chip';
        el.textContent = v;
        if (opts.onClick) {
            el.type = 'button';
            el.title = `Usar ${v}`;
            el.addEventListener('click', () => opts.onClick(v, el));
        }
        wrapper.appendChild(el);
    });

    return wrapper;
}

/**
 * Formata um par de datas ISO (`YYYY-MM-DD`) como "DD/MM/YYYY a DD/MM/YYYY".
 *
 * Não usa `new Date()` para evitar o bug clássico de timezone (parser interpreta
 * `YYYY-MM-DD` como UTC e em fusos negativos o dia "anda" para trás).
 *
 * @param {string} inicioIso
 * @param {string} fimIso
 * @returns {string}
 */
function formatarPeriodo(inicioIso, fimIso) {
    const fmt = (iso) => {
        if (!iso || typeof iso !== 'string') return '—';
        const partes = iso.split('-');
        if (partes.length !== 3) return iso;
        const [ano, mes, dia] = partes;
        return `${dia}/${mes}/${ano}`;
    };
    return `${fmt(inicioIso)} a ${fmt(fimIso)}`;
}

// ============================================================================
// Cross-cutting (TASK-10) — flag "Reimportação pendente" em sessionStorage
// ============================================================================

/**
 * Chave única em `sessionStorage` onde guardamos o `Set` de relatórios com
 * vínculos resolvidos que ainda não foram reimportados — usado para mostrar o
 * banner "Reimportação pendente" na Tela 3 (TASK-06) sem depender de uma
 * chamada extra ao backend a cada navegação.
 *
 * @internal
 */
const GS_KEY_REIMPORTACAO = 'gs:reimportacao-pendente';

/**
 * Lê o `Set` de IDs marcados como "reimportação pendente" da sessão atual.
 *
 * @returns {Set<number>}
 * @internal
 */
function lerSetReimportacao() {
    try {
        const raw = sessionStorage.getItem(GS_KEY_REIMPORTACAO);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
}

/**
 * Persiste o `Set` de IDs marcados.
 *
 * @param {Set<number>} set
 * @internal
 */
function gravarSetReimportacao(set) {
    try {
        sessionStorage.setItem(GS_KEY_REIMPORTACAO, JSON.stringify([...set]));
    } catch {
        /* sessionStorage indisponível (modo privado restrito): silenciar */
    }
}

/**
 * Marca um relatório como pendente de reimportação. Disparado pela Tela 5
 * (TASK-08) após qualquer `vincularNaoVinculado` bem-sucedido.
 *
 * @param {number} relatorioId
 */
function marcarReimportacaoPendente(relatorioId) {
    const set = lerSetReimportacao();
    set.add(Number(relatorioId));
    gravarSetReimportacao(set);
}

/**
 * Remove a marcação. Disparado pela Tela 2 (TASK-05) quando uma reimportação
 * conclui com sucesso.
 *
 * @param {number} relatorioId
 */
function limparReimportacaoPendente(relatorioId) {
    const set = lerSetReimportacao();
    set.delete(Number(relatorioId));
    gravarSetReimportacao(set);
}

/**
 * Consultor síncrono — útil para condicionar UI sem precisar bater na API.
 *
 * @param {number} relatorioId
 * @returns {boolean}
 */
function temReimportacaoPendente(relatorioId) {
    return lerSetReimportacao().has(Number(relatorioId));
}

// ============================================================================
// Cross-cutting (TASK-10) — distinção entre ApiError e queda de rede
// ============================================================================

/**
 * Mostra um toast adequado ao tipo do erro lançado por uma chamada da camada
 * de API:
 *  - `ApiError` → usa `err.message` (vem do back).
 *  - Qualquer outro (TypeError de fetch sem rede, CORS) → mensagem amigável
 *    sinalizando falta de conexão.
 *
 * Não engole o erro: re-lança para o chamador decidir se aborta o fluxo.
 *
 * @param {unknown} err
 * @param {string} [contexto] Verbo da ação ("vincular", "resolver"…) usado no
 *   fallback quando o `ApiError.message` é vazio.
 * @returns {never}
 */
function reportarErroRede(err, contexto = 'concluir a ação') {
    if (typeof ApiError !== 'undefined' && err instanceof ApiError) {
        mostrarToast(err.message || `Erro ao ${contexto}.`, 'erro');
    } else {
        mostrarToast('Sem conexão com o servidor. Verifique sua internet.', 'erro');
    }
    throw err;
}
