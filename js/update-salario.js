exigirRole('MASTER');

const lojaSelect = document.getElementById('loja-select');
const atendenteSelect = document.getElementById('atendente-select');
const salarioAtualSpan = document.getElementById('salario-atual');
const form = document.getElementById('form-salario');

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

async function carregarLojas() {
    try {
        const lojas = await apiGet('/lojas/listar');
        lojas.forEach((loja) => {
            const option = document.createElement('option');
            option.value = loja.id;
            option.textContent = loja.nome;
            lojaSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Erro ao carregar lojas:', err);
    }
}

async function carregarAtendentes(lojaId) {
    atendenteSelect.innerHTML = '<option value="">Selecione um atendente</option>';
    salarioAtualSpan.textContent = 'R$ 0,00';
    document.getElementById('novo-salario').value = '';
    atendenteSelect.disabled = true;

    if (!lojaId) return;

    try {
        const atendentes = await apiGet(`/lojas/${lojaId}/atendentes`);
        atendentes.forEach((a) => {
            const option = document.createElement('option');
            option.value = a.id;
            option.textContent = a.nome;
            atendenteSelect.appendChild(option);
        });
        atendenteSelect.disabled = false;
    } catch (err) {
        console.error('Erro ao carregar atendentes:', err);
    }
}

async function buscarSalario(atendenteId) {
    salarioAtualSpan.textContent = 'Carregando...';
    try {
        const data = await apiGet(`/atendentes/salario/${atendenteId}`);
        salarioAtualSpan.textContent = formatarMoeda(data.salario);
    } catch (err) {
        salarioAtualSpan.textContent = 'Erro';
        console.error('Erro ao buscar salário:', err);
    }
}

async function atualizarSalario(event) {
    event.preventDefault();

    const atendenteId = atendenteSelect.value;
    const salarioRaw = document.getElementById('novo-salario').value;
    const salario = salarioRaw.replace(/\./g, '').replace(/,/g, '.');

    if (!atendenteId || !salario) {
        document.getElementById('mensagem').textContent = 'Preencha todos os campos.';
        return;
    }

    const payload = {
        id: parseInt(atendenteId, 10),
        salario: parseFloat(salario)
    };

    try {
        await apiPatch('/atendentes/update/salario', payload);
        document.getElementById('mensagem').textContent = 'Salário atualizado com sucesso!';
        await buscarSalario(atendenteId);
        document.getElementById('novo-salario').value = '';
    } catch (err) {
        const msg = err instanceof ApiError ? (err.message || 'Erro ao atualizar salário.') : 'Erro de conexão com o servidor.';
        document.getElementById('mensagem').textContent = msg;
        console.error('Erro ao atualizar salário:', err);
    }
}

lojaSelect.addEventListener('change', (e) => carregarAtendentes(e.target.value));
atendenteSelect.addEventListener('change', (e) => {
    const id = e.target.value;
    if (id) {
        buscarSalario(id);
    } else {
        salarioAtualSpan.textContent = 'R$ 0,00';
    }
});
form.addEventListener('submit', atualizarSalario);

window.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const atendenteParam = params.get('id');

    await carregarLojas();

    if (atendenteParam) {
        try {
            const data = await apiGet(`/atendentes/${atendenteParam}`);
            lojaSelect.value = data.lojaId;
            await carregarAtendentes(data.lojaId);
            atendenteSelect.value = atendenteParam;
            await buscarSalario(atendenteParam);
        } catch (err) {
            console.error('Erro ao carregar atendente:', err);
        }
    }
});
