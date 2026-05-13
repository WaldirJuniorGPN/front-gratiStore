/**
 * Banner "altere a senha padrão" (TASK-11).
 *
 * Exibe um aviso persistente no topo das páginas protegidas quando o usuário
 * logado é o MASTER default semeado pelo backend (handoff §9). Como a API não
 * expõe se a senha já foi trocada, a heurística é puramente o e-mail default.
 *
 * O markup do banner vive em `html/header.html`; este script só popula o
 * conteúdo e decide se mostra ou esconde. O `header.js` chama
 * `inicializarBannerSenhaPadrao()` após injetar o header no DOM.
 */

const CHAVE_DISPENSAR_BANNER_SENHA = 'gs:banner-senha-default-dispensado';

function deveExibirBannerSenhaPadrao() {
    const sessao = (typeof obterSessao === 'function') ? obterSessao() : null;
    if (!sessao) return false;
    if (sessao.role !== 'MASTER') return false;
    const emailDefault = (typeof EMAIL_MASTER_DEFAULT !== 'undefined')
        ? EMAIL_MASTER_DEFAULT
        : 'master@gratistore.local';
    if (sessao.email !== emailDefault) return false;
    if (sessionStorage.getItem(CHAVE_DISPENSAR_BANNER_SENHA) === '1') return false;
    return true;
}

function inicializarBannerSenhaPadrao() {
    const banner = document.getElementById('banner-senha-padrao');
    if (!banner) return;

    if (!deveExibirBannerSenhaPadrao()) {
        banner.hidden = true;
        return;
    }

    banner.innerHTML = `
        <span class="banner-senha-icone" aria-hidden="true">⚠️</span>
        <div class="banner-senha-conteudo">
            <strong>Você ainda está usando a senha padrão do administrador.</strong>
            <span>Por segurança, troque sua senha agora mesmo.</span>
        </div>
        <div class="banner-senha-acoes">
            <a href="/html/trocar-senha.html" class="btn btn-primary">Trocar senha</a>
            <button type="button" class="btn-banner-dispensar" id="btnDispensarBannerSenha">
                Dispensar por hoje
            </button>
        </div>
    `;
    banner.hidden = false;

    const btnDispensar = document.getElementById('btnDispensarBannerSenha');
    if (btnDispensar) {
        btnDispensar.addEventListener('click', () => {
            sessionStorage.setItem(CHAVE_DISPENSAR_BANNER_SENHA, '1');
            banner.hidden = true;
        });
    }
}
