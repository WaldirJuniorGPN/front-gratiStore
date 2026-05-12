/**
 * Cliente HTTP centralizado para a API GratiStore.
 *
 * Responsabilidades:
 *  - Anexar `Authorization: Bearer <token>` em rotas não públicas.
 *  - Serializar bodies JSON automaticamente.
 *  - Padronizar tratamento de erros via `ApiError` (espelha o `StandardError` do backend).
 *  - Em `401`: limpar sessão e redirecionar para o login.
 *  - Em `403`: disparar o evento `gs:forbidden` (a UI exibe o toast — TASK-11/13).
 *  - Em `204 No Content`: devolver `null` em vez de quebrar tentando dar `resp.json()`.
 *
 * Dependências (carregar antes deste script):
 *  - config.js  (API_BASE_URL, ehRotaPublica)
 *  - erros.js   (ApiError)
 *  - sessao.js  (obterToken, limparSessao)
 *
 * Importante: nunca use `credentials: 'include'` — o backend está com
 * `allowCredentials = false` (§2.2 do handoff).
 */

/**
 * Tenta interpretar o corpo da resposta como JSON, devolvendo `null` em falha.
 * Útil porque algumas respostas de erro não vêm com body válido.
 * @param {Response} resp
 * @returns {Promise<object|null>}
 */
async function safeJson(resp) {
    try {
        return await resp.json();
    } catch {
        return null;
    }
}

/**
 * Núcleo do cliente HTTP. Não exposto diretamente — use `apiGet`, `apiPost` etc.
 * @param {string} method Método HTTP em maiúsculas.
 * @param {string} path Caminho relativo (ex.: `/lojas`).
 * @param {object|null} [body] Corpo JSON, se aplicável.
 * @returns {Promise<any>} Body parseado da resposta, ou `null` em `204`.
 * @throws {ApiError}
 */
async function request(method, path, body) {
    const url = `${API_BASE_URL}${path}`;
    const headers = { 'Content-Type': 'application/json' };

    if (!ehRotaPublica(path)) {
        const token = obterToken();
        if (token) headers.Authorization = `Bearer ${token}`;
    }

    const resp = await fetch(url, {
        method,
        headers,
        body: body !== undefined && body !== null ? JSON.stringify(body) : undefined
    });

    if (resp.status === 401) {
        const err = await safeJson(resp);
        // Em rotas públicas (ex.: /auth/login), 401 significa "credenciais inválidas",
        // não "sessão expirada" — não há sessão para limpar nem motivo para redirecionar.
        // O mesmo vale para `/auth/trocar-senha` (§4.2): 401 nesse endpoint indica que
        // a `senhaAtual` informada está incorreta, e a tela trata o erro localmente.
        if (!ehRotaPublica(path) && path !== '/auth/trocar-senha') {
            limparSessao();
            window.location.href = '/html/login.html';
        }
        throw new ApiError(401, err?.error || 'Unauthorized', err?.message || 'Sessão expirada', path);
    }

    if (resp.status === 403) {
        const err = await safeJson(resp);
        const message = err?.message || 'Você não tem permissão para essa ação.';
        document.dispatchEvent(new CustomEvent('gs:forbidden', {
            detail: { path, message, error: err?.error }
        }));
        throw new ApiError(403, err?.error || 'Forbidden', message, path);
    }

    if (!resp.ok) {
        const err = await safeJson(resp);
        throw new ApiError(resp.status, err?.error, err?.message, path);
    }

    if (resp.status === 204) return null;
    return resp.json();
}

/**
 * @param {string} path
 * @returns {Promise<any>}
 */
function apiGet(path) {
    return request('GET', path);
}

/**
 * @param {string} path
 * @param {object} [body]
 * @returns {Promise<any>}
 */
function apiPost(path, body) {
    return request('POST', path, body);
}

/**
 * @param {string} path
 * @param {object} [body]
 * @returns {Promise<any>}
 */
function apiPut(path, body) {
    return request('PUT', path, body);
}

/**
 * @param {string} path
 * @param {object} [body]
 * @returns {Promise<any>}
 */
function apiPatch(path, body) {
    return request('PATCH', path, body);
}

/**
 * @param {string} path
 * @returns {Promise<any>}
 */
function apiDelete(path) {
    return request('DELETE', path);
}
