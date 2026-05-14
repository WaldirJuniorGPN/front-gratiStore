exigirRole('MASTER');

const urlParams = new URLSearchParams(window.location.search);
const funcionarioId = urlParams.get('id');

document.addEventListener('DOMContentLoaded', carregarDadosFuncionario);
document.addEventListener('DOMContentLoaded', carregarLojas);
document.addEventListener('DOMContentLoaded', () => {
    const dataAdmissaoInput = document.getElementById('dataAdmissao');
    if (dataAdmissaoInput) {
        dataAdmissaoInput.max = new Date().toISOString().slice(0, 10);
    }
});
document.getElementById('formAtualizarAtendente').addEventListener('submit', atualizarFuncionario);

async function carregarDadosFuncionario() {
    try {
        const atendente = await apiGet(`/atendentes/${funcionarioId}`);
        document.getElementById('nome').value = atendente.nome;
        if (atendente.salario !== undefined && atendente.salario !== null) {
            document.getElementById('salario').value = Number(atendente.salario).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            document.getElementById('salario').value = '';
        }
        if (atendente.dataAdmissao) {
            document.getElementById('dataAdmissao').value = atendente.dataAdmissao;
        }
        const inputIdRelogio = document.getElementById('idRelogioPonto');
        if (inputIdRelogio) {
            const valor = atendente.idRelogioPonto != null ? String(atendente.idRelogioPonto) : '';
            inputIdRelogio.value = valor;
            inputIdRelogio.dataset.original = valor;
        }
    } catch (err) {
        const mensagem = err instanceof ApiError ? (err.message || 'Erro ao carregar dados do funcionário.') : 'Erro de conexão com o servidor.';
        document.getElementById('mensagem').innerText = mensagem;
        console.error('Erro:', err);
    }
}

async function atualizarFuncionario(event) {
    event.preventDefault();

    const nome = document.getElementById('nome').value;
    const lojaId = document.getElementById('loja').value;
    const salarioRaw = document.getElementById('salario').value;
    const dataAdmissao = document.getElementById('dataAdmissao').value;
    const salario = salarioRaw.replace(/\./g, '').replace(/,/g, '.');
    const inputIdRelogio = document.getElementById('idRelogioPonto');
    const valorIdRelogio = inputIdRelogio ? inputIdRelogio.value.trim() : '';
    const valorIdRelogioOriginal = inputIdRelogio ? (inputIdRelogio.dataset.original ?? '') : '';

    if (!nome || !lojaId || !salario || !dataAdmissao) {
        document.getElementById('mensagem').innerText = 'Preencha todos os campos antes de salvar.';
        return;
    }

    const hoje = new Date().toISOString().slice(0, 10);
    if (dataAdmissao > hoje) {
        document.getElementById('mensagem').innerText = 'A data de admissão não pode estar no futuro.';
        return;
    }

    if (valorIdRelogio !== '') {
        const idRelogioParsed = parseInt(valorIdRelogio, 10);
        if (!Number.isInteger(idRelogioParsed) || idRelogioParsed <= 0) {
            document.getElementById('mensagem').innerText = 'O ID do relógio de ponto deve ser um número inteiro positivo.';
            return;
        }
    }

    try {
        await apiPut(`/atendentes/${funcionarioId}`, {
            nome,
            lojaId: parseInt(lojaId, 10),
            salario: parseFloat(salario),
            dataAdmissao
        });
        await sincronizarIdRelogio(funcionarioId, valorIdRelogio, valorIdRelogioOriginal);
        if (inputIdRelogio) inputIdRelogio.dataset.original = valorIdRelogio;
        document.getElementById('mensagem').innerText = 'Funcionário atualizado com sucesso!';
    } catch (err) {
        const mensagem = err instanceof ApiError ? (err.message || 'Erro ao atualizar o funcionário.') : 'Erro de conexão com o servidor.';
        document.getElementById('mensagem').innerText = mensagem;
        console.error('Erro:', err);
    }
}

/**
 * Sincroniza o `idRelogioPonto` do atendente após o PUT principal.
 * Falha aqui não desfaz o save — vira toast de aviso/erro.
 *
 * @param {string|number} atendenteId
 * @param {string} valorAtual
 * @param {string} valorOriginal
 */
async function sincronizarIdRelogio(atendenteId, valorAtual, valorOriginal) {
    if (valorAtual === valorOriginal) return;

    if (valorAtual === '') {
        try {
            await desvincularIdRelogio(atendenteId);
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) return;
            if (typeof mostrarToast === 'function') {
                mostrarToast(
                    'Funcionário salvo, mas houve erro ao remover o ID do relógio: ' + err.message,
                    'aviso',
                    { duracaoMs: 6000 }
                );
            }
        }
        return;
    }

    const idRelogio = parseInt(valorAtual, 10);
    try {
        await vincularIdRelogio(atendenteId, idRelogio);
    } catch (err) {
        if (typeof mostrarToast !== 'function') return;
        if (err instanceof ApiError && err.status === 409) {
            mostrarToast(
                `Funcionário salvo, mas o ID ${idRelogio} já está vinculado a outro atendente. ` +
                'Edite o outro registro primeiro para liberar este ID.',
                'aviso',
                { duracaoMs: 0 }
            );
        } else {
            mostrarToast(
                'Funcionário salvo, mas falhou ao vincular o ID do relógio: ' + err.message,
                'erro',
                { duracaoMs: 6000 }
            );
        }
    }
}

async function carregarLojas() {
    try {
        const lojas = await apiGet('/lojas/listar');
        const lojaSelect = document.getElementById('loja');
        lojas.forEach((loja) => {
            const option = document.createElement('option');
            option.value = loja.id;
            option.textContent = loja.nome;
            lojaSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Erro ao carregar a lista de lojas:', err);
    }
}
