/**
 * Catálogo de páginas (TASK-01 — fundação de permissões).
 *
 * Fonte única da verdade vinda do backend (`GET /permissoes/catalogo`, TASK-00
 * §B1): mapeia `chave ↔ rota`, agrupa por módulo e diz quais widgets do
 * dashboard pertencem a cada página. Front e back leem o MESMO catálogo —
 * nada de lista hardcoded duplicada (a divergência entre os dois lados é a
 * causa nº 1 de bug em feature de permissão — ver README §"pegadinha central").
 *
 * Cache: o catálogo é buscado UMA vez por aba e persistido em
 * `sessionStorage['gs:catalogo']`; navegações seguintes (full reload) leem do
 * cache, sem novo round-trip. A cópia em memória evita refetch dentro da mesma
 * página, inclusive sob chamadas concorrentes (promessa em voo compartilhada).
 *
 * Fallback estático (`FALLBACK_CATALOGO`): espelha o Apêndice A da TASK-00
 * (rota → chave + widgets). Usado SOMENTE se o `GET` falhar, e é mantido só em
 * memória (não persiste) para que a próxima página volte a tentar o backend.
 * Ele NÃO carrega rótulos bonitos — é o mínimo para o guard de rota/menu não
 * "vazar" (mostrar tudo por engano). A UI de configuração (TASK-04) exige o
 * catálogo real e deve exibir erro se ele faltar.
 *
 * Degradação segura / fail-open de UX: se nem o fallback resolver a rota
 * atual, o guard de rota (TASK-02) NÃO bloqueia. Isso é intencional — a
 * fronteira de segurança real é o `403` do backend (TASK-00 §B3). Travar a
 * navegação por uma falha de catálogo seria pior experiência sem nenhum ganho
 * de segurança; e nunca "abrir tudo" indevidamente porque o fallback restringe
 * pelas chaves conhecidas.
 *
 * Dependências (carregar antes deste script):
 *  - config.js     (API_BASE_URL, ehRotaPublica)
 *  - erros.js      (ApiError)
 *  - sessao.js     (obterToken)
 *  - apiClient.js  (apiGet)
 */

const CATALOGO_STORAGE_KEY = 'gs:catalogo';

/**
 * Espelho estático do Apêndice A da TASK-00 (páginas controláveis A.1 +
 * endpoints base A.3) e do Apêndice B (widgets). Rótulos propositalmente
 * técnicos: o fallback existe para o guard não vazar, não para a UI bonita.
 * @type {{versao: string, grupos: object[], paginas: object[], endpointsBase: object[]}}
 */
const FALLBACK_CATALOGO = {
    versao: 'fallback',
    grupos: [
        { chave: 'operacao', rotulo: 'operacao' },
        { chave: 'ponto', rotulo: 'ponto' },
        { chave: 'ferias', rotulo: 'ferias' }
    ],
    paginas: [
        {
            chave: 'inicio',
            rotulo: 'inicio',
            descricao: '',
            grupo: 'operacao',
            rota: '/index.html',
            endpointsDistintivos: [],
            widgetsDashboard: []
        },
        {
            chave: 'registro-vendas',
            rotulo: 'registro-vendas',
            descricao: '',
            grupo: 'operacao',
            rota: '/html/registro-vendas.html',
            endpointsDistintivos: [
                { metodo: 'PATCH', padrao: '/atendentes/*' }
            ],
            widgetsDashboard: []
        },
        {
            chave: 'resultados',
            rotulo: 'resultados',
            descricao: '',
            grupo: 'operacao',
            rota: '/html/resultado.html',
            endpointsDistintivos: [
                { metodo: 'POST', padrao: '/resultados' },
                { metodo: 'GET', padrao: '/lojas/*/vendas' }
            ],
            widgetsDashboard: ['kpi-vendas', 'ranking-vendas']
        },
        {
            chave: 'upload-vendas',
            rotulo: 'upload-vendas',
            descricao: '',
            grupo: 'operacao',
            rota: '/html/upload-vendas.html',
            endpointsDistintivos: [
                { metodo: 'PATCH', padrao: '/atendentes/upload/*' },
                { metodo: 'PATCH', padrao: '/lojas/*' }
            ],
            widgetsDashboard: []
        },
        {
            chave: 'horas-extras',
            rotulo: 'horas-extras',
            descricao: '',
            grupo: 'operacao',
            rota: '/html/horas-extras.html',
            endpointsDistintivos: [
                { metodo: 'POST', padrao: '/horas-extras/calcular' },
                { metodo: 'GET', padrao: '/horas-extras' }
            ],
            widgetsDashboard: []
        },
        {
            chave: 'ponto-registro',
            rotulo: 'ponto-registro',
            descricao: '',
            grupo: 'ponto',
            rota: '/html/ponto-registro.html',
            endpointsDistintivos: [
                { metodo: 'POST', padrao: '/ponto' },
                { metodo: 'PUT', padrao: '/ponto/*' },
                { metodo: 'DELETE', padrao: '/ponto/*' },
                { metodo: 'GET', padrao: '/ponto' }
            ],
            widgetsDashboard: []
        },
        {
            chave: 'ponto-consulta',
            rotulo: 'ponto-consulta',
            descricao: '',
            grupo: 'ponto',
            rota: '/html/ponto-consulta.html',
            endpointsDistintivos: [
                { metodo: 'GET', padrao: '/ponto' },
                { metodo: 'PUT', padrao: '/ponto/*' },
                { metodo: 'DELETE', padrao: '/ponto/*' }
            ],
            widgetsDashboard: []
        },
        {
            chave: 'ponto-eletronico',
            rotulo: 'ponto-eletronico',
            descricao: '',
            grupo: 'ponto',
            rota: '/html/ponto-eletronico.html',
            endpointsDistintivos: [
                { metodo: 'POST', padrao: '/ponto' }
            ],
            widgetsDashboard: []
        },
        {
            chave: 'ferias-painel',
            rotulo: 'ferias-painel',
            descricao: '',
            grupo: 'ferias',
            rota: '/html/ferias-dashboard.html',
            endpointsDistintivos: [
                { metodo: 'GET', padrao: '/ferias/dashboard' },
                { metodo: 'GET', padrao: '/ferias/relatorio/pdf' }
            ],
            widgetsDashboard: ['ferias-mini']
        },
        {
            chave: 'ferias-lista',
            rotulo: 'ferias-lista',
            descricao: '',
            grupo: 'ferias',
            rota: '/html/ferias-lista.html',
            endpointsDistintivos: [
                { metodo: 'GET', padrao: '/ferias' },
                { metodo: 'GET', padrao: '/ferias/atendente/*' }
            ],
            widgetsDashboard: []
        },
        {
            chave: 'ferias-relatorio-loja',
            rotulo: 'ferias-relatorio-loja',
            descricao: '',
            grupo: 'ferias',
            rota: '/html/ferias-relatorio-loja.html',
            endpointsDistintivos: [
                { metodo: 'GET', padrao: '/ferias/loja/*' },
                { metodo: 'GET', padrao: '/ferias/relatorio/pdf' }
            ],
            widgetsDashboard: []
        }
    ],
    endpointsBase: [
        { metodo: 'GET', padrao: '/lojas/listar' },
        { metodo: 'GET', padrao: '/lojas/*/atendentes' },
        { metodo: 'GET', padrao: '/calculadoras/listar' },
        { metodo: 'GET', padrao: '/lojas/*' },
        { metodo: 'GET', padrao: '/lojas/cnpj/*' },
        { metodo: 'GET', padrao: '/atendentes/*' },
        { metodo: 'GET', padrao: '/atendentes/salario/*' },
        { metodo: 'POST', padrao: '/auth/trocar-senha' }
    ]
};

/** Cópia em memória do catálogo vigente (real ou fallback). */
let catalogoMemoria = null;

/** Promessa de carga em voo, compartilhada entre chamadas concorrentes. */
let catalogoPromessa = null;

/**
 * Normaliza uma rota para comparação tolerante: descarta query/hash, trata
 * `/` e vazio como `/index.html` e ignora caixa.
 * @param {string} rota
 * @returns {string}
 */
function normalizarRota(rota) {
    if (!rota) return '';
    let r = String(rota).split('?')[0].split('#')[0];
    if (r === '/' || r === '') r = '/index.html';
    return r.toLowerCase();
}

/**
 * Valida a forma mínima de um catálogo (precisa ter `paginas[]`).
 * @param {*} c
 * @returns {boolean}
 */
function catalogoValido(c) {
    return !!c && typeof c === 'object' && Array.isArray(c.paginas);
}

/**
 * Melhor catálogo disponível AGORA, de forma síncrona, na ordem:
 * memória → `sessionStorage` → fallback estático.
 *
 * O guard de rota/menu (TASK-02) precisa decidir no carregamento da página,
 * antes do `await`. Se uma página anterior já cacheou o catálogo real, ele
 * está disponível aqui; na primeiríssima página da aba, cai no fallback
 * (suficiente para não vazar) enquanto `carregarCatalogo()` aquece o cache.
 * O fallback NUNCA é gravado em memória aqui, para não impedir o refresh.
 * @returns {object}
 */
function obterCatalogoSync() {
    if (catalogoMemoria) return catalogoMemoria;
    try {
        const raw = sessionStorage.getItem(CATALOGO_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (catalogoValido(parsed)) {
                catalogoMemoria = parsed;
                return catalogoMemoria;
            }
        }
    } catch (err) {
        console.warn('Catálogo em cache corrompido; descartando.', err);
        sessionStorage.removeItem(CATALOGO_STORAGE_KEY);
    }
    return FALLBACK_CATALOGO;
}

/**
 * Garante que o catálogo real do backend foi carregado e cacheado uma vez por
 * aba. Idempotente e seguro sob concorrência. Nunca rejeita: em falha de rede
 * loga um aviso e resolve com o fallback estático (degradação segura).
 * @returns {Promise<object>}
 */
function carregarCatalogo() {
    if (catalogoMemoria) return Promise.resolve(catalogoMemoria);
    if (catalogoPromessa) return catalogoPromessa;

    catalogoPromessa = (async () => {
        try {
            const raw = sessionStorage.getItem(CATALOGO_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (catalogoValido(parsed)) {
                    catalogoMemoria = parsed;
                    return catalogoMemoria;
                }
                sessionStorage.removeItem(CATALOGO_STORAGE_KEY);
            }
        } catch (err) {
            console.warn('Catálogo em cache corrompido; recarregando do backend.', err);
            sessionStorage.removeItem(CATALOGO_STORAGE_KEY);
        }

        try {
            const catalogo = await apiGet('/permissoes/catalogo');
            if (!catalogoValido(catalogo)) {
                throw new Error('Catálogo do backend em formato inesperado.');
            }
            catalogoMemoria = catalogo;
            try {
                sessionStorage.setItem(CATALOGO_STORAGE_KEY, JSON.stringify(catalogo));
            } catch (errStore) {
                console.warn('Não foi possível cachear o catálogo na sessão.', errStore);
            }
            return catalogo;
        } catch (err) {
            console.warn('Catálogo do backend indisponível; usando fallback estático.', err);
            // Só em memória (não persiste): a próxima página volta a tentar o backend.
            catalogoMemoria = FALLBACK_CATALOGO;
            return FALLBACK_CATALOGO;
        }
    })();

    return catalogoPromessa;
}

/**
 * @returns {object[]} páginas do catálogo vigente.
 */
function catalogoPaginas() {
    const c = obterCatalogoSync();
    return Array.isArray(c.paginas) ? c.paginas : [];
}

/**
 * @returns {object[]} grupos/módulos do catálogo vigente.
 */
function gruposCatalogo() {
    const c = obterCatalogoSync();
    return Array.isArray(c.grupos) ? c.grupos : [];
}

/**
 * @param {string} chave Chave estável da página.
 * @returns {object|null} entrada do catálogo, ou `null` se não houver.
 */
function paginaPorChave(chave) {
    if (!chave) return null;
    return catalogoPaginas().find(p => p.chave === chave) || null;
}

/**
 * @param {string} pathname Caminho da página (ex.: `/html/resultado.html`).
 * @returns {object|null} entrada do catálogo cuja `rota` casa, ou `null`.
 */
function paginaPorRota(pathname) {
    const alvo = normalizarRota(pathname);
    if (!alvo) return null;
    return catalogoPaginas().find(p => normalizarRota(p.rota) === alvo) || null;
}
