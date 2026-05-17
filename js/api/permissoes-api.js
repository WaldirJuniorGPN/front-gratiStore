/**
 * Camada de API de permissões (TASK-01 — fundação de permissões).
 *
 * Wrappers finos sobre o cliente HTTP central — nunca `fetch` direto. Espelham
 * o contrato da TASK-00:
 *  - `getCatalogo()`                       → §B1  `GET  /permissoes/catalogo`
 *  - `getPermissoesUsuario(id)`            → §B2.2 `GET  /usuarios/{id}/permissoes`
 *  - `salvarPermissoesUsuario(id, chaves)` → §B2.3 `PUT  /usuarios/{id}/permissoes`
 *
 * O `PUT` substitui o conjunto inteiro (estado completo, não delta — evita
 * race entre dois MASTER e simplifica o painel da TASK-04). Erros (`400` chave
 * inválida / alvo MASTER, `404`, `401/403`) sobem como `ApiError` e são
 * tratados pela tela que chamou.
 *
 * Dependências (carregar antes deste script):
 *  - apiClient.js  (apiGet, apiPut)
 */

function getCatalogo() {
    return apiGet('/permissoes/catalogo');
}

function getPermissoesUsuario(id) {
    return apiGet(`/usuarios/${id}/permissoes`);
}

function salvarPermissoesUsuario(id, chaves) {
    return apiPut(`/usuarios/${id}/permissoes`, { permissoes: chaves });
}
