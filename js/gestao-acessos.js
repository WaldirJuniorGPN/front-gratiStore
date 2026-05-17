/**
 * Tela dedicada de gestão de acessos (TASK-04).
 *
 * Configurar acesso é ação administrativa: MASTER-only (Apêndice A.2 da
 * TASK-00) — `exigirRole('MASTER')` no topo, igual a `usuarios.js` /
 * `atualizar-usuario.js`. Lê `?id=` da URL (mesma validação de
 * `atualizar-usuario.js`); id inválido → mensagem + redirect para
 * `usuarios.html`.
 *
 * O trabalho de UI é todo do componente reaproveitável `PainelAcessos`
 * (`js/ui/painel-acessos.js`) — esta tela só resolve o `id`, monta o
 * componente e guarda a navegação "Voltar" quando há alterações não salvas.
 *
 * Dependências (carregar antes deste script):
 *  - js/api/config.js
 *  - js/api/erros.js
 *  - js/api/sessao.js
 *  - js/api/apiClient.js
 *  - js/api/permissoes-api.js
 *  - js/ui/toast.js
 *  - js/ui/painel-acessos.js
 *  - js/auth/role-guard.js
 */

exigirRole('MASTER');

const REDIRECT_DELAY_MS = 2000;
const URL_LISTAGEM = '/html/usuarios.html';

const mensagemDiv = document.getElementById('mensagem');
const painelContainer = document.getElementById('painelAcessos');
const btnVoltar = document.getElementById('btnVoltar');

let painelApi = null;

function mostrarMensagem(texto, tipo = 'erro') {
    mensagemDiv.textContent = texto;
    mensagemDiv.className = `mensagem ${tipo}`;
    mensagemDiv.hidden = false;
}

function irParaListagem(delay = 0) {
    if (delay > 0) {
        setTimeout(() => { window.location.href = URL_LISTAGEM; }, delay);
    } else {
        window.location.href = URL_LISTAGEM;
    }
}

/** Mesma validação de `atualizar-usuario.js`: id ausente/não-inteiro/<1 → null. */
function obterIdValido() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('id');
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return parsed;
}

function voltarParaUsuarios() {
    if (painelApi && painelApi.estaSujo()) {
        const ok = window.confirm('Você tem alterações não salvas. Sair mesmo assim?');
        if (!ok) return;
        // Marca o componente como destruído para não disparar o
        // `beforeunload` por cima do confirm que o usuário já respondeu.
        if (typeof painelApi.destruir === 'function') painelApi.destruir();
    }
    irParaListagem();
}

document.addEventListener('DOMContentLoaded', () => {
    btnVoltar.addEventListener('click', voltarParaUsuarios);

    const id = obterIdValido();
    if (id === null) {
        mostrarMensagem('ID de usuário inválido ou ausente na URL.', 'erro');
        irParaListagem(REDIRECT_DELAY_MS);
        return;
    }

    painelApi = PainelAcessos.montar(painelContainer, {
        usuarioId: id,
        onUsuarioNaoEncontrado: () => {
            mostrarMensagem('Usuário não encontrado ou inativo. Voltando para a lista…', 'erro');
            irParaListagem(REDIRECT_DELAY_MS);
        }
    });
});
