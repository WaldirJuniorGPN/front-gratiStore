/**
 * Edição e desativação (soft-delete) de usuário — TASK-08.
 *
 * Fluxo:
 *  1. Lê `?id=` da URL; se inválido → mensagem + redirect para usuarios.html.
 *  2. `GET /usuarios/{id}` para popular o form (nome, email read-only, role).
 *  3. Conta `MASTER`s ativos (primeira página) para antecipar a regra do
 *     "último MASTER" (§5.4 / §5.5):
 *       - Se o usuário em edição é o único MASTER:
 *         · desabilita botão "Desativar usuário",
 *         · desabilita a opção `COMUM` no select de role,
 *         · exibe banner de alerta.
 *  4. Submit → `PUT /usuarios/{id}` com `{ nome, role }`.
 *  5. Desativar → `confirm` + `DELETE /usuarios/{id}`.
 *
 * Tratamento de respostas (§7 do handoff):
 *  - 200 (PUT) → "Usuário atualizado" + redirect 1,5s.
 *  - 204 (DELETE) → "Usuário desativado" + redirect 1,5s.
 *  - 400 → mostra `message` direto (cobre "último master" e validações).
 *  - 404 → "Usuário não encontrado ou já inativo." + redirect.
 *  - 401/403 → tratados pelo apiClient.
 *
 * Dependências (carregar antes deste script):
 *  - js/api/config.js
 *  - js/api/erros.js
 *  - js/api/sessao.js
 *  - js/api/apiClient.js
 *  - js/auth/role-guard.js
 */

exigirRole('MASTER');

const ROLES_VALIDOS = ['MASTER', 'COMUM'];
const REDIRECT_DELAY_MS = 1500;

const painelFormulario = document.getElementById('painelFormulario');
const formUsuario = document.getElementById('formUsuario');
const inputNome = document.getElementById('nome');
const inputEmail = document.getElementById('email');
const selectRole = document.getElementById('role');
const erroFormulario = document.getElementById('erroFormulario');
const mensagemDiv = document.getElementById('mensagem');
const btnSalvar = document.getElementById('btnSalvar');
const btnDesativar = document.getElementById('btnDesativar');
const alertaMaster = document.getElementById('alertaMaster');

const state = {
    id: null,
    roleOriginal: null,
    isLastMaster: false
};

function mostrarMensagem(texto, tipo = 'sucesso') {
    mensagemDiv.textContent = texto;
    mensagemDiv.className = `mensagem ${tipo}`;
    mensagemDiv.hidden = false;
}

function setErroFormulario(texto) {
    if (texto) {
        erroFormulario.textContent = texto;
        erroFormulario.hidden = false;
    } else {
        erroFormulario.hidden = true;
        erroFormulario.textContent = '';
    }
}

function redirecionarParaListagem(delay = REDIRECT_DELAY_MS) {
    setTimeout(() => {
        window.location.href = '/html/usuarios.html';
    }, delay);
}

function obterIdValido() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('id');
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return parsed;
}

function mensagemParaErro(err, fallback) {
    if (!(err instanceof ApiError)) {
        return 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.';
    }
    if (err.status === 400) return err.message || 'Verifique os dados informados.';
    if (err.status === 404) return 'Usuário não encontrado ou já inativo.';
    if (err.status >= 500) return 'Erro inesperado. Tente novamente em instantes.';
    return err.message || fallback;
}

async function contarMastersAtivos() {
    // O endpoint não filtra por role, então puxamos uma página grande e contamos
    // localmente (UX-only; o backend continua sendo a fonte de verdade — §5.4/§5.5).
    try {
        const data = await apiGet('/usuarios?page=0&size=100&sort=role,asc');
        const lista = data?.content || [];
        return lista.filter(u => u.role === 'MASTER' && u.ativo !== false).length;
    } catch (err) {
        // Falha no count não pode bloquear a edição — o backend ainda valida.
        console.warn('Falha ao contar MASTERs ativos:', err);
        return null;
    }
}

function aplicarBloqueioUltimoMaster() {
    state.isLastMaster = true;
    alertaMaster.hidden = false;
    btnDesativar.disabled = true;
    btnDesativar.title = 'Este é o único administrador ativo.';
    const optCom = selectRole.querySelector('option[value="COMUM"]');
    if (optCom) {
        optCom.disabled = true;
        optCom.textContent += ' — indisponível (único MASTER)';
    }
}

function preencherFormulario(usuario) {
    inputNome.value = usuario.nome || '';
    inputEmail.value = usuario.email || '';
    selectRole.value = ROLES_VALIDOS.includes(usuario.role) ? usuario.role : '';
    state.roleOriginal = usuario.role;
}

async function carregarUsuario() {
    try {
        const usuario = await apiGet(`/usuarios/${state.id}`);
        preencherFormulario(usuario);
        painelFormulario.hidden = false;

        if (usuario.role === 'MASTER') {
            const total = await contarMastersAtivos();
            if (total === 1) {
                aplicarBloqueioUltimoMaster();
            }
        }
    } catch (err) {
        console.error('Erro ao carregar usuário:', err);
        if (err instanceof ApiError && err.status === 404) {
            mostrarMensagem('Usuário não encontrado ou já inativo.', 'erro');
            redirecionarParaListagem(2000);
            return;
        }
        mostrarMensagem(mensagemParaErro(err, 'Não foi possível carregar o usuário.'), 'erro');
    }
}

function validarFormulario(nome, role) {
    if (!nome) return 'Informe o nome do usuário.';
    if (!role) return 'Selecione o papel do usuário.';
    if (!ROLES_VALIDOS.includes(role)) return 'Papel inválido.';
    if (state.isLastMaster && role === 'COMUM') {
        return 'Este é o único administrador ativo e não pode ser rebaixado.';
    }
    return null;
}

async function salvarUsuario(event) {
    event.preventDefault();
    setErroFormulario(null);

    const nome = inputNome.value.trim();
    const role = selectRole.value;

    const erroValidacao = validarFormulario(nome, role);
    if (erroValidacao) {
        setErroFormulario(erroValidacao);
        return;
    }

    btnSalvar.disabled = true;
    btnDesativar.disabled = true;
    const textoOriginal = btnSalvar.textContent;
    btnSalvar.textContent = 'Salvando...';

    try {
        await apiPut(`/usuarios/${state.id}`, { nome, role });
        mostrarMensagem('Usuário atualizado com sucesso!', 'sucesso');
        redirecionarParaListagem();
    } catch (err) {
        console.error('Erro ao atualizar usuário:', err);
        setErroFormulario(mensagemParaErro(err, 'Não foi possível atualizar o usuário.'));
        btnSalvar.disabled = false;
        if (!state.isLastMaster) btnDesativar.disabled = false;
        btnSalvar.textContent = textoOriginal;
        if (err instanceof ApiError && err.status === 404) {
            redirecionarParaListagem(2000);
        }
    }
}

async function desativarUsuario() {
    if (btnDesativar.disabled) return;

    const nome = inputNome.value.trim() || 'este usuário';
    const confirmou = window.confirm(
        `Tem certeza que deseja desativar "${nome}"?\n\n` +
        `O usuário não poderá mais fazer login no sistema.`
    );
    if (!confirmou) return;

    btnDesativar.disabled = true;
    btnSalvar.disabled = true;
    const textoOriginal = btnDesativar.textContent;
    btnDesativar.textContent = 'Desativando...';
    setErroFormulario(null);

    try {
        await apiDelete(`/usuarios/${state.id}`);
        mostrarMensagem('Usuário desativado com sucesso!', 'sucesso');
        redirecionarParaListagem();
    } catch (err) {
        console.error('Erro ao desativar usuário:', err);
        setErroFormulario(mensagemParaErro(err, 'Não foi possível desativar o usuário.'));
        btnDesativar.disabled = false;
        btnSalvar.disabled = false;
        btnDesativar.textContent = textoOriginal;
        if (err instanceof ApiError && err.status === 404) {
            redirecionarParaListagem(2000);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    state.id = obterIdValido();
    if (state.id === null) {
        mostrarMensagem('ID de usuário inválido ou ausente na URL.', 'erro');
        redirecionarParaListagem(2000);
        return;
    }
    carregarUsuario();
});

formUsuario.addEventListener('submit', salvarUsuario);
btnDesativar.addEventListener('click', desativarUsuario);
