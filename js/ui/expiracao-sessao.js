/**
 * Aviso proativo de expiração de sessão (TASK-12).
 *
 * Agenda dois timers a partir do `expiraEm` retornado por `POST /auth/login`:
 *   - aviso  : exibe o modal #modal-expiracao 5 min antes da expiração
 *   - logout : limpa a sessão e redireciona para /html/login.html?expirou=1
 *
 * O markup do modal vive em `html/header.html`; este script só agenda os
 * timers e controla a visibilidade. O `header.js` chama
 * `inicializarTimerExpiracao()` após injetar o header no DOM, em toda página
 * protegida.
 *
 * Drift de relógio (§11.3 do handoff): se o relógio local estiver atrasado, o
 * `apiClient` (TASK-01) trata o 401 do servidor; se estiver adiantado, o
 * logout local apenas antecipa o redirect — ambos caminhos são seguros.
 */

const AVISO_MIN_MS = 5 * 60 * 1000;

let timerAvisoExpiracao = null;
let timerLogoutExpiracao = null;
let handlersExpiracaoLigados = false;

function limparTimersExpiracao() {
    if (timerAvisoExpiracao !== null) {
        clearTimeout(timerAvisoExpiracao);
        timerAvisoExpiracao = null;
    }
    if (timerLogoutExpiracao !== null) {
        clearTimeout(timerLogoutExpiracao);
        timerLogoutExpiracao = null;
    }
}

function fazerLogoutPorExpiracao() {
    limparTimersExpiracao();
    if (typeof limparSessao === 'function') {
        limparSessao();
    } else {
        sessionStorage.removeItem('gs:sessao');
    }
    window.location.replace('/html/login.html?expirou=1');
}

function fecharModalExpiracao() {
    const modal = document.getElementById('modal-expiracao');
    if (!modal) return;
    modal.hidden = true;
}

function exibirModalExpiracao() {
    const modal = document.getElementById('modal-expiracao');
    if (!modal) return;
    modal.hidden = false;

    const btnFechar = modal.querySelector('button[data-fechar-expiracao]');
    if (btnFechar) {
        btnFechar.focus();
    }
}

function ligarHandlersModalExpiracao() {
    if (handlersExpiracaoLigados) return;
    const modal = document.getElementById('modal-expiracao');
    if (!modal) return;

    modal.querySelectorAll('[data-fechar-expiracao]').forEach((el) => {
        el.addEventListener('click', fecharModalExpiracao);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (modal.hidden) return;
        fecharModalExpiracao();
    });

    // O botão "Sair" do header dispara logout manual; cancelar os timers
    // evita que o modal apareça depois que a sessão já foi descartada.
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', limparTimersExpiracao);
    }

    window.addEventListener('beforeunload', limparTimersExpiracao);

    handlersExpiracaoLigados = true;
}

function inicializarTimerExpiracao() {
    limparTimersExpiracao();
    ligarHandlersModalExpiracao();

    const sessao = (typeof obterSessao === 'function')
        ? obterSessao()
        : null;
    if (!sessao || !sessao.expiraEm) return;

    const expira = Date.parse(sessao.expiraEm);
    if (!Number.isFinite(expira)) return;

    const msAteLogout = expira - Date.now();
    if (msAteLogout <= 0) {
        fazerLogoutPorExpiracao();
        return;
    }

    const msAteAviso = msAteLogout - AVISO_MIN_MS;
    if (msAteAviso > 0) {
        timerAvisoExpiracao = setTimeout(exibirModalExpiracao, msAteAviso);
    } else {
        exibirModalExpiracao();
    }

    timerLogoutExpiracao = setTimeout(fazerLogoutPorExpiracao, msAteLogout);
}
