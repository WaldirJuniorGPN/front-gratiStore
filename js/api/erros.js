/**
 * Erro padronizado emitido pelo apiClient.
 *
 * Espelha o envelope `StandardError` retornado pela API (§7 do handoff):
 * `{ status, error, message, path, timestamp }`.
 *
 * A UI deve preferir `message` para o usuário e `error` para classificação
 * (ex.: `error === 'Unauthorized'`, `error === 'Validation'`).
 */
class ApiError extends Error {
    /**
     * @param {number} status Código HTTP (401, 403, 404, 422...).
     * @param {string} [error] Classificação textual vinda do backend (`Unauthorized`, `Validation`...).
     * @param {string} [message] Mensagem amigável para o usuário.
     * @param {string} [path] Caminho da requisição que originou o erro.
     */
    constructor(status, error, message, path) {
        super(message || error || `Erro HTTP ${status}`);
        this.name = 'ApiError';
        this.status = status;
        this.error = error;
        this.path = path;
    }
}
