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
 * Também escuta `gs:forbidden` (disparado pelo apiClient em 403) e exibe um
 * aviso simples — o toast estilizado virá em TASK-09/11.
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
    const msg = event?.detail?.message || 'Você não tem permissão para essa operação.';
    // Placeholder — substituir por toast estilizado em TASK-09/11.
    alert(msg);
});
