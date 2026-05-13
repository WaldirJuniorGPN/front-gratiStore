/**
 * Listagem paginada de usuários (TASK-06).
 *
 * Tela MASTER-only que consome `GET /usuarios?page=N&size=S&sort=nome,asc`
 * e renderiza a tabela com paginação Spring Data. Linha do próprio usuário
 * recebe destaque "você" e o botão de desativar é ocultado para evitar
 * autoexclusão acidental — a API permite, mas é UX evitar.
 *
 * Esta task entrega apenas a leitura (GET). As ações de criar/editar/desativar
 * ficam para TASKs 07 e 08 — o botão "Desativar" é renderizado aqui (com
 * `data-desativar`), mas o click handler vem na TASK-08.
 *
 * Dependências (carregar antes deste script):
 *  - js/api/config.js
 *  - js/api/erros.js
 *  - js/api/sessao.js
 *  - js/api/apiClient.js
 *  - js/auth/role-guard.js
 */

exigirRole('MASTER');

const state = {
    page: 0,
    size: 20,
    totalPages: 1,
    totalElements: 0,
    first: true,
    last: true,
    usuarioLogado: null
};

const tabelaBody = document.getElementById('corpoUsuarios');
const btnAnterior = document.getElementById('btnAnterior');
const btnProximo = document.getElementById('btnProximo');
const paginaAtualEl = document.getElementById('paginaAtual');
const footerInfo = document.getElementById('footerInfo');
const contagemTotal = document.getElementById('contagemTotal');
const pageSize = document.getElementById('pageSize');
const mensagemDiv = document.getElementById('mensagem');

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function mostrarMensagem(texto, tipo = 'erro', timeout = 4000) {
    mensagemDiv.textContent = texto;
    mensagemDiv.className = `mensagem ${tipo}`;
    mensagemDiv.hidden = false;
    if (timeout) {
        setTimeout(() => {
            mensagemDiv.hidden = true;
            mensagemDiv.className = 'mensagem';
            mensagemDiv.textContent = '';
        }, timeout);
    }
}

function renderRoleBadge(role) {
    const safe = (role || '').toLowerCase();
    const cls = safe === 'master' ? 'role-badge--master' : 'role-badge--comum';
    return `<span class="role-badge ${cls}">${escapeHtml(role || '—')}</span>`;
}

function renderLinhaUsuario(u) {
    const meuEmail = state.usuarioLogado?.email?.toLowerCase();
    const isSelf = u.email && meuEmail && u.email.toLowerCase() === meuEmail;
    const selfBadge = isSelf ? '<span class="cell-self">você</span>' : '';
    const nomeSeguro = escapeHtml(u.nome);
    const btnDesativar = isSelf
        ? ''
        : `<button type="button" class="btn-row danger" data-desativar="${u.id}" data-nome="${nomeSeguro}" aria-label="Desativar ${nomeSeguro}">Desativar</button>`;

    return `
        <tr data-id="${u.id}">
            <td data-label="ID" class="cell-id">${u.id}</td>
            <td data-label="Nome" class="cell-name">${nomeSeguro}${selfBadge}</td>
            <td data-label="E-mail" class="cell-email">${escapeHtml(u.email)}</td>
            <td data-label="Papel">${renderRoleBadge(u.role)}</td>
            <td data-label="Ações">
                <div class="acoes-row">
                    <a class="btn-row" href="/html/atualizar-usuario.html?id=${u.id}" aria-label="Editar ${nomeSeguro}">Editar</a>
                    ${btnDesativar}
                </div>
            </td>
        </tr>
    `;
}

function renderizarLista(content) {
    if (!content || content.length === 0) {
        tabelaBody.innerHTML = `<tr class="row-empty"><td colspan="5">Nenhum usuário cadastrado.</td></tr>`;
        return;
    }
    tabelaBody.innerHTML = content.map(renderLinhaUsuario).join('');
}

async function desativarUsuario(id, nome, botao) {
    const confirmou = window.confirm(
        `Tem certeza que deseja desativar "${nome}"?\n\n` +
        `O usuário não poderá mais fazer login no sistema.`
    );
    if (!confirmou) return;

    botao.disabled = true;
    const textoOriginal = botao.textContent;
    botao.textContent = 'Desativando...';

    try {
        await apiDelete(`/usuarios/${id}`);
        mostrarMensagem(`Usuário "${nome}" desativado.`, 'sucesso');
        carregarUsuarios();
    } catch (err) {
        console.error('Erro ao desativar usuário:', err);
        // 400 cobre a regra do último MASTER ativo (§5.5) — exibe a mensagem do
        // backend direto. Outros erros caem no fallback genérico.
        let texto;
        if (err instanceof ApiError) {
            texto = err.status === 400
                ? (err.message || 'Operação não permitida.')
                : err.status === 404
                    ? 'Usuário não encontrado ou já inativo.'
                    : (err.message || 'Falha ao desativar usuário.');
        } else {
            texto = 'Erro de conexão. Tente novamente.';
        }
        mostrarMensagem(texto, 'erro');
        botao.disabled = false;
        botao.textContent = textoOriginal;
    }
}

tabelaBody.addEventListener('click', (event) => {
    const botao = event.target.closest('[data-desativar]');
    if (!botao) return;
    const id = botao.getAttribute('data-desativar');
    const nome = botao.getAttribute('data-nome') || 'este usuário';
    desativarUsuario(id, nome, botao);
});

function renderizarErro(err) {
    const detalhe = err instanceof ApiError && err.message ? ` (${err.message})` : '';
    tabelaBody.innerHTML = `
        <tr class="row-empty">
            <td colspan="5">
                Não foi possível carregar a lista${escapeHtml(detalhe)}.
                <button type="button" class="btn btn-secondary btn-retry" id="btnTentarNovamente">Tentar de novo</button>
            </td>
        </tr>
    `;
    document.getElementById('btnTentarNovamente').addEventListener('click', carregarUsuarios);
}

function atualizarPaginacao() {
    btnAnterior.disabled = state.first;
    btnProximo.disabled = state.last;
    paginaAtualEl.textContent = `Página ${state.page + 1} de ${Math.max(state.totalPages, 1)}`;

    if (state.totalElements === 0) {
        footerInfo.textContent = 'Nenhum resultado.';
        contagemTotal.textContent = 'Nenhum usuário ativo';
        return;
    }

    const inicio = state.page * state.size + 1;
    const fim = Math.min((state.page + 1) * state.size, state.totalElements);
    footerInfo.textContent = `Exibindo ${inicio}–${fim} de ${state.totalElements} usuário(s).`;
    contagemTotal.textContent = state.totalElements === 1
        ? '1 usuário ativo'
        : `${state.totalElements} usuários ativos`;
}

async function carregarUsuarios() {
    tabelaBody.innerHTML = `<tr class="row-loading"><td colspan="5">Carregando usuários...</td></tr>`;
    try {
        const data = await apiGet(`/usuarios?page=${state.page}&size=${state.size}&sort=nome,asc`);
        state.totalPages = data.totalPages ?? 1;
        state.totalElements = data.totalElements ?? 0;
        state.first = data.first ?? (state.page === 0);
        state.last = data.last ?? (state.page + 1 >= state.totalPages);
        renderizarLista(data.content || []);
        atualizarPaginacao();
    } catch (err) {
        console.error('Erro ao carregar usuários:', err);
        // 403 não deveria ocorrer (exigirRole('MASTER') já bloqueia), mas se ocorrer
        // — ex.: papel mudou no backend após o login — voltamos ao /index.html.
        if (err instanceof ApiError && err.status === 403) {
            window.location.replace('/index.html');
            return;
        }
        renderizarErro(err);
        atualizarPaginacao();
    }
}

btnAnterior.addEventListener('click', () => {
    if (state.first) return;
    state.page--;
    carregarUsuarios();
});

btnProximo.addEventListener('click', () => {
    if (state.last) return;
    state.page++;
    carregarUsuarios();
});

pageSize.addEventListener('change', (e) => {
    state.size = parseInt(e.target.value, 10) || 20;
    state.page = 0;
    carregarUsuarios();
});

document.addEventListener('DOMContentLoaded', () => {
    state.usuarioLogado = obterUsuario();
    carregarUsuarios();
});
