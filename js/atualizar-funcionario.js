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

    if (!nome || !lojaId || !salario || !dataAdmissao) {
        document.getElementById('mensagem').innerText = 'Preencha todos os campos antes de salvar.';
        return;
    }

    const hoje = new Date().toISOString().slice(0, 10);
    if (dataAdmissao > hoje) {
        document.getElementById('mensagem').innerText = 'A data de admissão não pode estar no futuro.';
        return;
    }

    try {
        await apiPut(`/atendentes/${funcionarioId}`, {
            nome,
            lojaId: parseInt(lojaId, 10),
            salario: parseFloat(salario),
            dataAdmissao
        });
        document.getElementById('mensagem').innerText = 'Funcionário atualizado com sucesso!';
    } catch (err) {
        const mensagem = err instanceof ApiError ? (err.message || 'Erro ao atualizar o funcionário.') : 'Erro de conexão com o servidor.';
        document.getElementById('mensagem').innerText = mensagem;
        console.error('Erro:', err);
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
