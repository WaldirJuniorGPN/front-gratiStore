/**
 * Guard de acesso por página (TASK-01 — fundação de permissões).
 *
 * Espelha exatamente o padrão de `role-guard.js`, trocando "role" por "página":
 *  - `temPermissao(chave)` — boolean para uso condicional em templates JS.
 *  - `exigirPermissao(chave)` — redireciona para `/index.html` com toast
 *    persistido em `sessionStorage` (`gs:toast`) se a sessão não tiver a chave.
 *  - `aplicarPermissoesNoDom(root)` — esconde elementos
 *    `[data-requer-permissao]` quando a sessão não tem a chave. Chamado
 *    automaticamente no `DOMContentLoaded` e re-invocável após renderização
 *    dinâmica (ex.: injeção do header) para reprocessar nós novos.
 *
 * A decisão sai de `temAcessoPagina()` (sessao.js): MASTER (`'*'`) sempre
 * passa; COMUM conforme as `permissoes` da sessão. Nunca lê parse de JWT.
 *
 * Reuso deliberado: o canal `gs:toast` (sessionStorage) já é consumido por
 * `toast.js` no destino — não reimplementar toast. O listener global de
 * `gs:forbidden` (403) já existe em `role-guard.js`; NÃO duplicar aqui
 * (TASK-06 refina a mensagem).
 *
 * Dependências (carregar antes deste script, depois do JS de página NÃO):
 *  - sessao.js  (temAcessoPagina)
 */

function temPermissao(chave) {
    return typeof temAcessoPagina === 'function' && temAcessoPagina(chave);
}

function exigirPermissao(chave) {
    if (!temPermissao(chave)) {
        sessionStorage.setItem('gs:toast', JSON.stringify({
            tipo: 'erro',
            texto: 'Esta página não está disponível para o seu acesso.'
        }));
        window.location.replace('/index.html');
    }
}

function aplicarPermissoesNoDom(root = document) {
    root.querySelectorAll('[data-requer-permissao]').forEach(el => {
        const chave = el.getAttribute('data-requer-permissao');
        if (!temPermissao(chave)) {
            el.hidden = true;
            el.setAttribute('aria-hidden', 'true');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => aplicarPermissoesNoDom(document));
