/**
 * Guard de autorização por papel (TASK-04).
 *
 * Camada de UX que esconde/bloqueia, no front, telas e ações exclusivas de
 * `MASTER`. A segurança real continua no backend — o front só evita mostrar
 * botões que de qualquer forma retornariam 403.
 *
 * API exposta globalmente:
 *  - `exigirRole(role)` — redireciona para `/index.html` com toast persistido em
 *    sessionStorage (`gs:toast`) se a sessão não tiver a role exigida.
 *  - `temRole(role)` — boolean para uso condicional em templates JS.
 *  - `aplicarRoleNoDom(root)` — esconde elementos `[data-requer-role]` quando
 *    a role atual não bate. Chamado automaticamente no `DOMContentLoaded` e
 *    pode ser re-invocado após renderização dinâmica para reprocessar nós novos.
 *
 * Também é o ponto ÚNICO que escuta `gs:forbidden` (disparado pelo apiClient
 * em 403) e decide qual feedback sai — exatamente um por 403 (TASK-06, "uma
 * mensagem, não duas"):
 *  - Início em "modo tolerante" (`window.__gsDashboardTolerante`, gerido por
 *    `index.js` na carga do dashboard): 403 residual por revogação NÃO vira
 *    toast — o widget só some (TASK-03, princípio nº 2). Silêncio aqui.
 *  - Revogação no meio da sessão numa página controlável: delega para o
 *    `permissao-guard.js` (`ehRevogacaoDaPaginaAtual` / `aplicarRevogacao`)
 *    mostrar o aviso bloqueante com saída — sem também toastar.
 *  - Caso geral: toast com a mensagem específica do backend (cita a página —
 *    TASK-00 Apêndice C); genérico só se `message` vier vazia. Fallback
 *    `alert` em telas que ainda não carregam `toast.js`.
 *
 * É o ponto único de propósito: um segundo listener noutro módulo teria ordem
 * de disparo não-determinística e duplicaria a mensagem.
 */

function obterRoleAtual() {
    try {
        const raw = sessionStorage.getItem('gs:sessao');
        return raw ? JSON.parse(raw).role : null;
    } catch {
        return null;
    }
}

function temRole(role) {
    return obterRoleAtual() === role;
}

function exigirRole(role) {
    if (obterRoleAtual() !== role) {
        sessionStorage.setItem('gs:toast', JSON.stringify({
            tipo: 'erro',
            texto: 'Acesso negado: você não tem permissão para acessar essa tela.'
        }));
        window.location.replace('/index.html');
    }
}

function aplicarRoleNoDom(root = document) {
    root.querySelectorAll('[data-requer-role]').forEach(el => {
        const exigida = el.getAttribute('data-requer-role');
        if (!temRole(exigida)) {
            el.hidden = true;
            el.setAttribute('aria-hidden', 'true');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => aplicarRoleNoDom(document));

document.addEventListener('gs:forbidden', (event) => {
    const detail = (event && event.detail) || {};

    // Início em modo tolerante: o 403 residual de uma revogação não pode
    // assustar na tela mais segura do sistema — o widget some sozinho
    // (TASK-03 cuida disso). Nada de toast aqui.
    if (window.__gsDashboardTolerante) return;

    // Revogação no meio da sessão na própria página controlável: aviso
    // bloqueante com saída (permissao-guard), em vez do toast. A lógica de
    // página/permissão vive lá; aqui só orquestramos qual feedback sai.
    if (typeof ehRevogacaoDaPaginaAtual === 'function'
        && ehRevogacaoDaPaginaAtual(detail)) {
        if (typeof aplicarRevogacao === 'function') {
            aplicarRevogacao(window.__gsPaginaRevogavel);
        }
        return;
    }

    // Caso geral: a mensagem do backend já cita a página (TASK-00 Apêndice C).
    // Genérico só se vier vazia.
    const msg = detail.message || 'Você não tem acesso a esta página.';
    if (typeof mostrarToast === 'function') {
        mostrarToast(msg, 'erro');
    } else {
        // Fallback para telas legadas que ainda não importaram `toast.js`.
        alert(msg);
    }
});
