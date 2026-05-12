/**
 * Tela de Troca de Senha (TASK-05).
 *
 * Fluxo:
 *  1. Validações client-side: campos obrigatórios, mínimo 8 caracteres na nova
 *     senha e confirmação coincidindo (§11.6 do handoff).
 *  2. `apiPost('/auth/trocar-senha', { senhaAtual, novaSenha })`.
 *  3. Em 204: mensagem de sucesso → após 2s, `limparSessao()` + redirect para
 *     `/html/login.html`. A API não invalida o token antigo (§4.2), mas
 *     deslogamos por política do front (evita confusão e força novo login).
 *  4. Em 401: o apiClient está configurado para NÃO redirecionar para login
 *     quando o path é `/auth/trocar-senha` (ver apiClient.js). Aqui, 401
 *     significa "senhaAtual incorreta" — exibido localmente.
 *  5. Em 400: mensagem vinda do backend.
 *
 * Dependências (carregar antes deste script):
 *  - js/api/config.js
 *  - js/api/erros.js
 *  - js/api/sessao.js
 *  - js/api/apiClient.js
 */

const formTrocarSenha = document.getElementById('formTrocarSenha');
const inputSenhaAtual = document.getElementById('senhaAtual');
const inputNovaSenha = document.getElementById('novaSenha');
const inputConfirmar = document.getElementById('confirmarNovaSenha');
const erroFormulario = document.getElementById('erroFormulario');
const mensagemTrocaSenha = document.getElementById('mensagem');
const btnTrocar = document.getElementById('btnTrocar');

function mostrarMensagemTrocaSenha(texto, tipo = 'sucesso') {
    mensagemTrocaSenha.textContent = texto;
    mensagemTrocaSenha.className = `mensagem ${tipo}`;
    mensagemTrocaSenha.hidden = false;
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

function validarFormulario(senhaAtual, novaSenha, confirmarSenha) {
    if (!senhaAtual) return 'Informe sua senha atual.';
    if (!novaSenha) return 'Informe a nova senha.';
    if (novaSenha.length < 8) return 'A nova senha deve ter no mínimo 8 caracteres.';
    if (!confirmarSenha) return 'Confirme a nova senha.';
    if (novaSenha !== confirmarSenha) return 'A confirmação não confere com a nova senha.';
    if (senhaAtual === novaSenha) return 'A nova senha deve ser diferente da senha atual.';
    return null;
}

function mensagemParaErroTrocaSenha(err) {
    if (!(err instanceof ApiError)) {
        return 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.';
    }
    if (err.status === 401) {
        return 'Senha atual incorreta.';
    }
    if (err.status === 400) {
        return err.message || 'Verifique os dados informados.';
    }
    if (err.status >= 500) {
        return 'Erro inesperado. Tente novamente em instantes.';
    }
    return err.message || 'Não foi possível trocar a senha. Tente novamente.';
}

async function trocarSenha(event) {
    event.preventDefault();
    setErroFormulario(null);

    const senhaAtual = inputSenhaAtual.value;
    const novaSenha = inputNovaSenha.value;
    const confirmarSenha = inputConfirmar.value;

    const erroValidacao = validarFormulario(senhaAtual, novaSenha, confirmarSenha);
    if (erroValidacao) {
        setErroFormulario(erroValidacao);
        return;
    }

    btnTrocar.disabled = true;
    const textoOriginal = btnTrocar.textContent;
    btnTrocar.textContent = 'Salvando...';

    try {
        await apiPost('/auth/trocar-senha', { senhaAtual, novaSenha });
        formTrocarSenha.reset();
        mostrarMensagemTrocaSenha('Senha alterada com sucesso. Faça login novamente.', 'sucesso');
        setTimeout(() => {
            limparSessao();
            window.location.href = '/html/login.html';
        }, 2000);
    } catch (err) {
        console.error('Erro ao trocar senha:', err);
        setErroFormulario(mensagemParaErroTrocaSenha(err));
        btnTrocar.disabled = false;
        btnTrocar.textContent = textoOriginal;
        if (err instanceof ApiError && err.status === 401) {
            inputSenhaAtual.focus();
            inputSenhaAtual.select();
        }
    }
}

formTrocarSenha.addEventListener('submit', trocarSenha);
