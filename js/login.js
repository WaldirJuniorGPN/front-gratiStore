/**
 * Tela de Login.
 *
 * Fluxo:
 *  1. Valida client-side e-mail e senha.
 *  2. Chama `POST /auth/login` via apiClient.
 *  3. Em sucesso, persiste a sessão e redireciona para /index.html.
 *  4. Em erro, exibe mensagem genérica (§11.5 do handoff — nunca diferenciar
 *     "e-mail inexistente" de "senha incorreta").
 *
 * Dependências (carregar antes deste script):
 *  - js/api/config.js
 *  - js/api/erros.js
 *  - js/api/sessao.js
 *  - js/api/apiClient.js
 */

const formLogin = document.getElementById('formLogin');
const inputEmail = document.getElementById('email');
const inputSenha = document.getElementById('senha');
const btnEntrar = document.getElementById('btnEntrar');
const mensagemDiv = document.getElementById('mensagem');

function mostrarMensagem(texto, tipo = 'erro') {
    mensagemDiv.textContent = texto;
    mensagemDiv.className = `mensagem ${tipo}`;
    mensagemDiv.hidden = false;
}

function limparMensagem() {
    mensagemDiv.hidden = true;
    mensagemDiv.className = 'mensagem';
    mensagemDiv.textContent = '';
}

function emailValido(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

function mensagemParaErro(err) {
    if (!(err instanceof ApiError)) {
        return 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.';
    }
    if (err.status === 401) {
        return 'E-mail ou senha inválidos.';
    }
    if (err.status === 400) {
        return err.message || 'Verifique os dados informados.';
    }
    if (err.status >= 500) {
        return 'Erro inesperado. Tente novamente em instantes.';
    }
    return err.message || 'Não foi possível entrar. Tente novamente.';
}

async function entrar(event) {
    event.preventDefault();
    limparMensagem();

    const email = inputEmail.value.trim();
    const senha = inputSenha.value;

    if (!email || !emailValido(email)) {
        mostrarMensagem('Informe um e-mail válido.', 'erro');
        inputEmail.focus();
        return;
    }
    if (!senha) {
        mostrarMensagem('Informe sua senha.', 'erro');
        inputSenha.focus();
        return;
    }

    btnEntrar.disabled = true;
    const textoOriginal = btnEntrar.textContent;
    btnEntrar.textContent = 'Entrando...';

    try {
        const loginResponse = await apiPost('/auth/login', { email, senha });
        salvarSessao(loginResponse);
        window.location.href = '/index.html';
    } catch (err) {
        console.error('Erro no login:', err);
        mostrarMensagem(mensagemParaErro(err), 'erro');
        btnEntrar.disabled = false;
        btnEntrar.textContent = textoOriginal;
        inputSenha.focus();
        inputSenha.select();
    }
}

formLogin.addEventListener('submit', entrar);

document.addEventListener('DOMContentLoaded', () => {
    inputEmail.focus();
});
