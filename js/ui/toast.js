/**
 * Toast central da aplicação (TASK-02).
 *
 * Substitui `alert()` para feedback não-bloqueante de sucesso, info, aviso e erro.
 * É o canal padrão para retornar `StandardError.message` (§6 do guia de front)
 * e para anunciar transições silenciosas (ex.: "vínculo feito", "reimportação pendente").
 *
 * API pública global:
 *  - `mostrarToast(texto, tipo, opts)` — exibe um toast.
 *
 * Sem dependências externas. Pode ser carregado em qualquer página que tenha o
 * `<link rel="stylesheet" href="/css/toast.css">` correspondente.
 *
 * Acessibilidade:
 *  - Tipos sucesso/info/aviso: `role="status" aria-live="polite"`.
 *  - Tipo erro: `role="alert" aria-live="assertive"`.
 *  - Botão de fechar com `aria-label` textual.
 */

const TOAST_CONTAINER_ID = 'gs-toast-container';
const TOAST_MAX_SIMULTANEOS = 5;

/**
 * Cria (uma vez) o container fixo dos toasts e devolve a referência.
 * @returns {HTMLElement}
 */
function obterContainerToast() {
    let container = document.getElementById(TOAST_CONTAINER_ID);
    if (container) return container;
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.className = 'gs-toast-container';
    document.body.appendChild(container);
    return container;
}

/**
 * Remove o toast mais antigo se já houver `TOAST_MAX_SIMULTANEOS` na tela.
 * Garante que a fila não cresça indefinidamente.
 * @param {HTMLElement} container
 */
function aplicarLimiteFila(container) {
    while (container.children.length >= TOAST_MAX_SIMULTANEOS) {
        container.firstElementChild?.remove();
    }
}

/**
 * Exibe um toast não-bloqueante.
 *
 * @param {string} texto Mensagem a exibir.
 * @param {'sucesso'|'erro'|'info'|'aviso'} [tipo='info']
 * @param {object} [opts]
 * @param {number} [opts.duracaoMs=4000] Tempo até auto-dismiss. `0` torna o toast persistente
 *   (fechável apenas pelo X) — útil para avisos críticos como "reimportação pendente".
 * @param {string} [opts.acaoTexto] Texto de botão de ação opcional (ex.: "Reimportar agora").
 * @param {() => void} [opts.onAcao] Callback do botão de ação. Após disparado, o toast é fechado.
 * @returns {HTMLElement} O elemento criado, caso a tela precise interagir manualmente.
 */
function mostrarToast(texto, tipo = 'info', opts = {}) {
    const { duracaoMs = 4000, acaoTexto, onAcao } = opts;
    const container = obterContainerToast();
    aplicarLimiteFila(container);

    const toast = document.createElement('div');
    toast.className = `gs-toast gs-toast--${tipo}`;
    if (tipo === 'erro') {
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
    } else {
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
    }

    const conteudo = document.createElement('div');
    conteudo.className = 'gs-toast__texto';
    conteudo.textContent = texto;
    toast.appendChild(conteudo);

    let temporizador = null;
    const fechar = () => {
        if (temporizador) {
            clearTimeout(temporizador);
            temporizador = null;
        }
        if (!toast.isConnected) return;
        toast.classList.add('gs-toast--saindo');
        // Espera a animação de saída antes de remover do DOM.
        setTimeout(() => toast.remove(), 180);
    };

    if (acaoTexto && typeof onAcao === 'function') {
        const btnAcao = document.createElement('button');
        btnAcao.type = 'button';
        btnAcao.className = 'gs-toast__acao';
        btnAcao.textContent = acaoTexto;
        btnAcao.addEventListener('click', () => {
            try { onAcao(); } finally { fechar(); }
        });
        toast.appendChild(btnAcao);
    }

    const btnFechar = document.createElement('button');
    btnFechar.type = 'button';
    btnFechar.className = 'gs-toast__fechar';
    btnFechar.setAttribute('aria-label', 'Fechar notificação');
    btnFechar.innerHTML = '&times;';
    btnFechar.addEventListener('click', fechar);
    toast.appendChild(btnFechar);

    container.appendChild(toast);

    if (duracaoMs > 0) {
        temporizador = setTimeout(fechar, duracaoMs);
    }

    return toast;
}
