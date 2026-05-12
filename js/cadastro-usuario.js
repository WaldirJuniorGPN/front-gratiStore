/**
 * Cadastro de Usuário (TASK-07).
 *
 * Tela MASTER-only que consome `POST /usuarios`. Valida campos no client
 * (nome, email, senha >= 8, role), submete e trata respostas:
 *  - 201 → sucesso + redirect para `usuarios.html`.
 *  - 400 → exibe `message` (validações concatenadas pelo backend).
 *  - 409 → "Já existe usuário ativo com esse e-mail" (texto fixo — o
 *          `error` do envelope ainda menciona CNPJ por motivos históricos;
 *          §7 do handoff).
 *  - 401/403 → tratado pelo apiClient (toast/redirect).
 *
 * Política de segurança da senha:
 *  - O backend nunca devolve hash em respostas (teste
 *    `respostaNuncaDeveExporHashDaSenha` garante).
 *  - O front limpa o campo `senha` imediatamente após o submit,
 *    inclusive em caso de erro, para evitar manter o valor em memória.
 *  - Logs de erro NUNCA incluem o body enviado.
 *
 * Dependências (carregar antes deste script):
 *  - js/api/config.js
 *  - js/api/erros.js
 *  - js/api/sessao.js
 *  - js/api/apiClient.js
 *  - js/auth/role-guard.js
 */

exigirRole('MASTER');

const formUsuario = document.getElementById('formUsuario');
const inputNome = document.getElementById('nome');
const inputEmail = document.getElementById('email');
const inputSenha = document.getElementById('senha');
const selectRole = document.getElementById('role');
const erroFormulario = document.getElementById('erroFormulario');
const mensagemCadastro = document.getElementById('mensagem');
const btnCadastrar = document.getElementById('btnCadastrar');
const btnToggleSenha = document.getElementById('btnToggleSenha');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES_VALIDOS = ['MASTER', 'COMUM'];

function mostrarMensagem(texto, tipo = 'sucesso') {
    mensagemCadastro.textContent = texto;
    mensagemCadastro.className = `mensagem ${tipo}`;
    mensagemCadastro.hidden = false;
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

function validarFormulario(nome, email, senha, role) {
    if (!nome) return 'Informe o nome do usuário.';
    if (!email) return 'Informe o e-mail.';
    if (!EMAIL_REGEX.test(email)) return 'E-mail em formato inválido.';
    if (!senha) return 'Informe uma senha.';
    if (senha.length < 8) return 'A senha deve ter no mínimo 8 caracteres.';
    if (!role) return 'Selecione o papel do usuário.';
    if (!ROLES_VALIDOS.includes(role)) return 'Papel inválido.';
    return null;
}

function mensagemParaErroCadastro(err) {
    if (!(err instanceof ApiError)) {
        return 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.';
    }
    if (err.status === 409) {
        // O `message` do backend traz o detalhe correto (e-mail), mas o `error`
        // ainda menciona CNPJ historicamente. Usamos texto fixo para UX consistente.
        return 'Já existe usuário ativo com esse e-mail.';
    }
    if (err.status === 400) {
        return err.message || 'Verifique os dados informados.';
    }
    if (err.status >= 500) {
        return 'Erro inesperado. Tente novamente em instantes.';
    }
    // 401/403 já são tratados no apiClient (limpa sessão / dispara gs:forbidden).
    return err.message || 'Não foi possível cadastrar o usuário. Tente novamente.';
}

function alternarVisibilidadeSenha() {
    const exibindo = inputSenha.type === 'text';
    inputSenha.type = exibindo ? 'password' : 'text';
    btnToggleSenha.setAttribute('aria-pressed', exibindo ? 'false' : 'true');
    btnToggleSenha.setAttribute('aria-label', exibindo ? 'Mostrar senha' : 'Ocultar senha');
    btnToggleSenha.textContent = exibindo ? 'Mostrar' : 'Ocultar';
}

async function cadastrarUsuario(event) {
    event.preventDefault();
    setErroFormulario(null);

    const nome = inputNome.value.trim();
    const email = inputEmail.value.trim();
    const senha = inputSenha.value;
    const role = selectRole.value;

    const erroValidacao = validarFormulario(nome, email, senha, role);
    if (erroValidacao) {
        setErroFormulario(erroValidacao);
        return;
    }

    btnCadastrar.disabled = true;
    const textoOriginal = btnCadastrar.textContent;
    btnCadastrar.textContent = 'Cadastrando...';

    try {
        await apiPost('/usuarios', { nome, email, senha, role });
        // Limpa o campo de senha imediatamente, mesmo em caso de sucesso.
        inputSenha.value = '';
        formUsuario.reset();
        mostrarMensagem('Usuário criado com sucesso!', 'sucesso');
        setTimeout(() => {
            window.location.href = '/html/usuarios.html';
        }, 1500);
    } catch (err) {
        // Limpa o campo de senha imediatamente em caso de erro também,
        // para não manter o valor em memória (§ Notas do TASK-07).
        inputSenha.value = '';
        // NUNCA logar o body — pode conter a senha digitada.
        console.error('Erro ao cadastrar usuário:', err?.status, err?.error);
        setErroFormulario(mensagemParaErroCadastro(err));
        btnCadastrar.disabled = false;
        btnCadastrar.textContent = textoOriginal;
        if (err instanceof ApiError && err.status === 409) {
            inputEmail.focus();
            inputEmail.select();
        }
    }
}

formUsuario.addEventListener('submit', cadastrarUsuario);
btnToggleSenha.addEventListener('click', alternarVisibilidadeSenha);
