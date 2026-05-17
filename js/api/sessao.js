/**
 * Gerenciamento da sessão do usuário autenticado.
 *
 * O token JWT é opaco para o front (§3.2 do handoff): nunca tentar fazer parse local.
 * Usar sempre os campos vindos no `LoginResponse` (email, nome, role, expiraEm,
 * `permissoes`). Decisão de acesso por página lê `permissoes` da sessão — nunca
 * o JWT (TASK-01 / TASK-00 §B2).
 *
 * Armazenamento: `sessionStorage` sob a chave `gs:sessao`.
 * `sessionStorage` foi escolhido sobre `localStorage` para limitar exposição a XSS
 * (§11.1 do handoff). Para "manter logado por dias" no futuro, basta trocar
 * `sessionStorage` por `localStorage` neste arquivo.
 */

const SESSAO_STORAGE_KEY = 'gs:sessao';

/**
 * Persiste a resposta do `/auth/login` na sessão.
 * @param {object} loginResponse Corpo completo retornado pelo endpoint de login.
 */
function salvarSessao(loginResponse) {
    sessionStorage.setItem(SESSAO_STORAGE_KEY, JSON.stringify(loginResponse));
}

/**
 * @returns {object|null} A sessão armazenada ou `null` se o usuário não está autenticado.
 */
function obterSessao() {
    const raw = sessionStorage.getItem(SESSAO_STORAGE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (err) {
        console.warn('Sessão armazenada está corrompida; limpando.', err);
        sessionStorage.removeItem(SESSAO_STORAGE_KEY);
        return null;
    }
}

/**
 * @returns {string|null} O token JWT, ou `null` se não houver sessão.
 */
function obterToken() {
    const sessao = obterSessao();
    return sessao ? sessao.token || null : null;
}

/**
 * @returns {{ email: string, nome: string, role: string }|null}
 */
function obterUsuario() {
    const sessao = obterSessao();
    if (!sessao) return null;
    return {
        email: sessao.email,
        nome: sessao.nome,
        role: sessao.role
    };
}

/**
 * @returns {'MASTER'|'COMUM'|null}
 */
function obterRole() {
    const sessao = obterSessao();
    return sessao ? sessao.role || null : null;
}

/**
 * Chaves de página liberadas para o usuário da sessão atual.
 *
 * `MASTER` nunca depende de `permissoes`: `role === 'MASTER'` ⇒ `['*']`. Essa
 * salvaguarda é deliberada — blinda contra o pior cenário (um bug no backfill
 * de permissões trancando justamente o admin que configura tudo).
 *
 * @returns {string[]} chaves liberadas; MASTER → `['*']`; sem sessão → `[]`.
 */
function obterPermissoes() {
    const s = obterSessao();
    if (!s) return [];
    if (s.role === 'MASTER') return ['*'];
    return Array.isArray(s.permissoes) ? s.permissoes : [];
}

/**
 * Indica se a sessão atual tem acesso a uma página pela chave do catálogo.
 * MASTER (`'*'`) sempre `true`.
 * @param {string} chave Chave estável da página (ex.: `'resultados'`).
 * @returns {boolean}
 */
function temAcessoPagina(chave) {
    const p = obterPermissoes();
    return p.includes('*') || p.includes(chave);
}

/**
 * Remove a sessão armazenada (usado no logout e em respostas 401).
 */
function limparSessao() {
    sessionStorage.removeItem(SESSAO_STORAGE_KEY);
}

/**
 * Compara `expiraEm` com o relógio do navegador.
 * @returns {boolean} `true` se já passou da data de expiração; `false` caso contrário (inclusive sem sessão).
 */
function estaExpirada() {
    const sessao = obterSessao();
    if (!sessao || !sessao.expiraEm) return false;
    const expiracao = Date.parse(sessao.expiraEm);
    if (Number.isNaN(expiracao)) return false;
    return Date.now() > expiracao;
}
