/**
 * Configuração base da API GratiStore.
 *
 * Esta é a ÚNICA referência ao host do backend no app inteiro.
 * Alterar `API_BASE_URL` aqui impacta todas as chamadas HTTP.
 */

const API_BASE_URL = 'http://localhost:8080';

/**
 * Rotas que NÃO devem receber o header `Authorization`.
 * A comparação é feita por prefixo, então `/swagger-ui` cobre `/swagger-ui/index.html` etc.
 */
const ROTAS_PUBLICAS = [
    '/auth/login',
    '/v3/api-docs',
    '/swagger-ui',
    '/swagger-ui.html'
];

/**
 * Indica se o `path` informado bate com alguma rota pública.
 * @param {string} path Caminho relativo (ex.: `/auth/login`).
 * @returns {boolean}
 */
function ehRotaPublica(path) {
    if (!path) return false;
    return ROTAS_PUBLICAS.some(rota => path === rota || path.startsWith(`${rota}/`) || path.startsWith(`${rota}?`));
}
