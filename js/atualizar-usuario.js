/**
 * Edição e desativação (soft-delete) de usuário — TASK-08 + TASK-05.
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
 *  4. Submit (um único botão "Salvar alterações") — TASK-05, salvamento
 *     coordenado em até dois passos independentes:
 *       a) `PUT /usuarios/{id}` com `{ nome, role }` — como antes.
 *       b) Se a role final é COMUM e a seção "Acessos" está suja:
 *          `painelApi.salvar()` (`PUT /usuarios/{id}/permissoes`).
 *     Sucesso só quando ambos OK; falha no passo (b) NÃO desfaz (a) — a tela
 *     reporta especificamente o que faltou e preserva o que foi configurado.
 *  5. Desativar → `confirm` + `DELETE /usuarios/{id}`.
 *
 * Seção "Acessos" (TASK-05): o mesmo componente `PainelAcessos` da TASK-04,
 * montado em `modoEmbutido`. Reage ao select de role sem novo round-trip
 * (`definirRoleVisivel`): MASTER colapsa para a faixa "acesso total"; COMUM
 * reexibe os toggles. A regra do "último MASTER" continua intocada (quando
 * MASTER único, o select COMUM já fica desabilitado e nem chega aqui).
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
 *  - js/api/permissoes-api.js   (catálogo + permissões — usado pelo painel)
 *  - js/ui/toast.js             (feedback do painel; degrada sem ele)
 *  - js/ui/painel-acessos.js    (componente reaproveitável da TASK-04)
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
const painelAcessosWrapper = document.getElementById('painelAcessosWrapper');
const painelContainer = document.getElementById('painelAcessos');

let painelApi = null;

const state = {
    id: null,
    roleOriginal: null,
    isLastMaster: false,
    acessosSujos: false
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

/**
 * Monta a seção "Acessos" embutida (TASK-05) reusando o componente da TASK-04.
 * O próprio painel decide o que renderizar pela role real do usuário (faixa
 * "acesso total" para MASTER, toggles para COMUM); aqui só o ligamos ao select
 * de role e à coordenação de salvamento. Idempotente.
 */
function montarPainelAcessos() {
    if (painelApi) return;
    painelAcessosWrapper.hidden = false;
    painelApi = PainelAcessos.montar(painelContainer, {
        usuarioId: state.id,
        modoEmbutido: true,
        onDirtyChange: (sujo) => { state.acessosSujos = sujo; },
        onUsuarioNaoEncontrado: () => {
            mostrarMensagem('Usuário não encontrado ou já inativo.', 'erro');
            redirecionarParaListagem(2000);
        }
    });
}

async function carregarUsuario() {
    try {
        const usuario = await apiGet(`/usuarios/${state.id}`);
        preencherFormulario(usuario);
        painelFormulario.hidden = false;
        montarPainelAcessos();

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

function restaurarBotoes(textoSalvar) {
    btnSalvar.disabled = false;
    if (!state.isLastMaster) btnDesativar.disabled = false;
    btnSalvar.textContent = textoSalvar;
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

    // Passo 1 — nome/role (como antes). Falha aqui: nada foi persistido,
    // erro inline no form, sem mexer na seção de acessos.
    try {
        await apiPut(`/usuarios/${state.id}`, { nome, role });
    } catch (err) {
        console.error('Erro ao atualizar usuário:', err);
        setErroFormulario(mensagemParaErro(err, 'Não foi possível atualizar o usuário.'));
        restaurarBotoes(textoOriginal);
        if (err instanceof ApiError && err.status === 404) {
            redirecionarParaListagem(2000);
        }
        return;
    }

    // Passo 2 — acessos: só quando a role final é COMUM e a seção está suja.
    // `painelApi.estaSujo()` já devolve false quando a role efetiva é MASTER,
    // mas checamos `role` também para deixar a intenção explícita.
    if (role === 'COMUM' && painelApi && painelApi.estaSujo()) {
        try {
            await painelApi.salvar();
        } catch (err) {
            // Nome/role JÁ foram persistidos no passo 1 — não redirecionar
            // nem desfazer; reportar só o que faltou, preservando os toggles.
            console.error('Erro ao salvar acessos:', err);
            mostrarMensagem(
                'Nome e papel foram salvos, mas os acessos não puderam ser salvos. ' +
                'Revise a seção “Acessos” abaixo e clique em salvar novamente.',
                'erro'
            );
            restaurarBotoes(textoOriginal);
            return;
        }
    }

    // Sucesso só quando ambos os passos terminaram OK.
    mostrarMensagem('Usuário atualizado com sucesso!', 'sucesso');
    redirecionarParaListagem();
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

// Reatividade ao select de role (TASK-05): MASTER colapsa a seção para a
// faixa "acesso total"; COMUM reexibe os toggles. Valores fora de
// MASTER/COMUM (placeholder) são ignorados pelo próprio componente.
selectRole.addEventListener('change', () => {
    if (painelApi) painelApi.definirRoleVisivel(selectRole.value);
});
