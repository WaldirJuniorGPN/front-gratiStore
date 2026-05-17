/**
 * Guard de acesso por página (TASK-01 — fundação; TASK-06 — feedback de bloqueio).
 *
 * Espelha o padrão de `role-guard.js`, trocando "role" por "página":
 *  - `temPermissao(chave)` — boolean para uso condicional em templates JS.
 *  - `exigirPermissao(chave)` — se a sessão não tem a chave, manda o usuário
 *    para a tela amigável `indisponivel.html` (TASK-06) em vez de um redirect
 *    seco para a Início. Se TEM a chave, registra o tratamento de revogação
 *    no meio da sessão para esta página (ver `tratarRevogacao`).
 *  - `aplicarPermissoesNoDom(root)` — esconde elementos
 *    `[data-requer-permissao]` quando a sessão não tem a chave. Chamado
 *    automaticamente no `DOMContentLoaded` e re-invocável após renderização
 *    dinâmica (ex.: injeção do header) para reprocessar nós novos.
 *
 * A decisão sai de `temAcessoPagina()` (sessao.js): MASTER (`'*'`) sempre
 * passa; COMUM conforme as `permissoes` da sessão. Nunca lê parse de JWT.
 *
 * Revogação no meio da sessão (TASK-00 §3 / TASK-06): o MASTER pode tirar uma
 * página de um COMUM enquanto ele está logado nela. A sessão local ainda diz
 * que pode, mas a próxima chamada do endpoint distintivo recebe `403` do
 * backend. `tratarRevogacao(chave)` (chamado por `exigirPermissao` quando o
 * acesso existe) marca esta página como controlável; o listener único de
 * `gs:forbidden` em `role-guard.js` consulta `ehRevogacaoDaPaginaAtual()` e,
 * sendo o caso, chama `aplicarRevogacao()` — aviso bloqueante + saída — em vez
 * do toast (uma mensagem, não duas). NÃO registramos um segundo listener de
 * `gs:forbidden` aqui: a ordem de disparo não seria controlável e duplicaria a
 * mensagem. O `role-guard` é o ponto único; este módulo só expõe os helpers.
 *
 * "Opt-in, não mágica global": só páginas controláveis chamam
 * `exigirPermissao`. A Início (`index.js`) nunca chama — logo nunca registra
 * revogação (lá o 403 residual só remove o widget; ver TASK-03 e o flag
 * `__gsDashboardTolerante`).
 *
 * Dependências (resolvidas no momento da CHAMADA, não da carga — por isso os
 * `typeof`): sessao.js (temAcessoPagina, obterRole, obterSessao),
 * permissao-catalogo.js (paginaPorChave).
 */

/** Chave da página controlável da aba atual; `null` na Início e afins. */
window.__gsPaginaRevogavel = window.__gsPaginaRevogavel || null;

function temPermissao(chave) {
    return typeof temAcessoPagina === 'function' && temAcessoPagina(chave);
}

function exigirPermissao(chave) {
    if (!temPermissao(chave)) {
        // Uma mensagem, não duas: a tela `indisponivel.html` já é
        // auto-explicativa (cita a página, oferece saída). Não persistimos
        // `gs:toast` — um toast vermelho repetindo o que a tela diz seria
        // redundante e mais barulhento (TASK-06, "tom informativo").
        window.location.replace(
            '/html/indisponivel.html?de=' + encodeURIComponent(location.pathname)
        );
        return;
    }
    // Tem acesso agora: arma o tratamento de revogação no meio da sessão.
    tratarRevogacao(chave);
}

/**
 * Marca a página atual como controlável pela `chave`, habilitando a detecção
 * de revogação no meio da sessão. Idempotente. MASTER nunca registra: o
 * backend bypassa MASTER (nunca devolve 403), então ele jamais veria o aviso.
 * @param {string} chave Chave estável da página (ex.: `'resultados'`).
 */
function tratarRevogacao(chave) {
    if (!chave) return;
    if (typeof obterRole === 'function' && obterRole() === 'MASTER') return;
    window.__gsPaginaRevogavel = chave;
}

/**
 * Casa um caminho de requisição com um padrão do catálogo. No padrão, um
 * segmento igual a "*" é curinga de UM segmento — o padrão de vendas por loja
 * casa o caminho "/lojas/12/vendas".
 * @param {string} path Caminho da requisição (ex.: "/lojas/12/vendas").
 * @param {string} padrao Padrão vindo de `endpointsDistintivos` do catálogo.
 * @returns {boolean}
 */
function endpointCasaPadrao(path, padrao) {
    if (!path || !padrao) return false;
    const segPath = String(path).split('?')[0].split('#')[0].split('/').filter(Boolean);
    const segPad = String(padrao).split('/').filter(Boolean);
    if (segPath.length !== segPad.length) return false;
    return segPad.every((seg, i) => seg === '*' || seg.toLowerCase() === segPath[i].toLowerCase());
}

/**
 * Decide se um `403` recém-recebido é a revogação da página controlável atual
 * (e não um 403 de outra natureza). Usado pelo listener único de
 * `gs:forbidden` no `role-guard.js`.
 *
 * Critério: o `path` do 403 casa um dos `endpointsDistintivos` da chave
 * registrada. Se o catálogo não resolver os distintivos (degradação para
 * fallback sem essa info), a página inteira é gated por esta chave — qualquer
 * 403 nela é, na prática, a revogação dela.
 *
 * @param {{path?: string}} detail `event.detail` do `gs:forbidden`.
 * @returns {boolean}
 */
function ehRevogacaoDaPaginaAtual(detail) {
    const chave = window.__gsPaginaRevogavel;
    if (!chave) return false;
    const path = detail && detail.path ? detail.path : '';
    const pagina = typeof paginaPorChave === 'function' ? paginaPorChave(chave) : null;
    const distintivos = pagina && Array.isArray(pagina.endpointsDistintivos)
        ? pagina.endpointsDistintivos
        : [];
    if (distintivos.length === 0) return true;
    return distintivos.some((e) => endpointCasaPadrao(path, e && e.padrao));
}

/**
 * Remove, best-effort, a `chave` revogada de `gs:sessao.permissoes`. A fonte
 * da verdade segue o backend; isto é só coerência de UX até o próximo login
 * (o menu não deve continuar mostrando o item depois que o usuário voltar à
 * Início). MASTER nunca chega aqui (`obterPermissoes` devolve `['*']`, que não
 * mexemos).
 * @param {string} chave
 */
function limparPermissaoLocal(chave) {
    try {
        const raw = sessionStorage.getItem('gs:sessao');
        if (!raw) return;
        const sessao = JSON.parse(raw);
        if (!sessao || !Array.isArray(sessao.permissoes)) return;
        const filtrado = sessao.permissoes.filter((c) => c !== chave);
        if (filtrado.length !== sessao.permissoes.length) {
            sessao.permissoes = filtrado;
            sessionStorage.setItem('gs:sessao', JSON.stringify(sessao));
        }
    } catch (err) {
        console.warn('Não foi possível atualizar a sessão local após revogação.', err);
    }
}

/**
 * Aviso bloqueante de revogação no meio da sessão. A página ficou inválida (o
 * backend negou o endpoint distintivo) — não deixar a pessoa presa numa tela
 * meio-carregada. Tom informativo, não acusatório: foi uma mudança de
 * configuração feita pelo administrador, não uma falha dela.
 *
 * Caminho único de saída: "Ir para o Início" (porto seguro). Antes de sair,
 * limpa a chave da sessão local para o menu não seguir mostrando o item.
 * Idempotente (não empilha overlays). Estilo inline: este aviso pode aparecer
 * em qualquer página controlável, e nem todas carregam um CSS comum.
 *
 * @param {string} chave Chave da página revogada.
 */
function aplicarRevogacao(chave) {
    if (document.getElementById('gs-revogacao-overlay')) return;
    limparPermissaoLocal(chave);

    const overlay = document.createElement('div');
    overlay.id = 'gs-revogacao-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'gs-revogacao-titulo');
    overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2000',
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:24px', 'background:rgba(15,23,42,0.45)',
        'backdrop-filter:blur(2px)', 'font-family:inherit'
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
        'background:#fff', 'border-radius:12px', 'max-width:460px', 'width:100%',
        'padding:28px 28px 24px', 'box-shadow:0 24px 60px rgba(0,0,0,0.18)',
        'text-align:center', 'color:#333333'
    ].join(';');

    const titulo = document.createElement('h2');
    titulo.id = 'gs-revogacao-titulo';
    titulo.textContent = 'Seu acesso a esta página foi alterado';
    titulo.style.cssText = 'margin:0 0 10px;font-size:1.25em;font-weight:700;color:#333333';

    const texto = document.createElement('p');
    texto.textContent = 'O administrador alterou o seu acesso a esta página. '
        + 'Para continuar, volte ao Início.';
    texto.style.cssText = 'margin:0 0 22px;color:#6B7280;font-size:0.98em;line-height:1.55';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Ir para o Início';
    btn.style.cssText = [
        'display:inline-flex', 'align-items:center', 'justify-content:center',
        'padding:11px 24px', 'border:1px solid transparent', 'border-radius:8px',
        'background-color:#6A8EAE', 'color:#fff', 'font-size:0.98em',
        'font-weight:600', 'cursor:pointer', 'font-family:inherit'
    ].join(';');
    btn.addEventListener('click', () => window.location.replace('/index.html'));

    card.appendChild(titulo);
    card.appendChild(texto);
    card.appendChild(btn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    btn.focus();
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
