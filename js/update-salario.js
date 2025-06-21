const API_BASE_URL = 'http://localhost:8080';

const lojaSelect = document.getElementById('loja-select');
const atendenteSelect = document.getElementById('atendente-select');
const salarioAtualSpan = document.getElementById('salario-atual');
const form = document.getElementById('form-salario');

// Formata valor para moeda brasileira
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// Carrega lojas para o select
async function carregarLojas() {
    try {
        const response = await fetch(`${API_BASE_URL}/lojas/listar`);
        if (response.ok) {
            const lojas = await response.json();
            lojas.forEach(loja => {
                const option = document.createElement('option');
                option.value = loja.id;
                option.textContent = loja.nome;
                lojaSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar lojas:', error);
    }
}

// Carrega atendentes de uma loja selecionada
async function carregarAtendentes(lojaId) {
    atendenteSelect.innerHTML = '<option value="">Selecione um atendente</option>';
    salarioAtualSpan.textContent = 'R$ 0,00';
    document.getElementById('novo-salario').value = '';
    atendenteSelect.disabled = true;

    if (!lojaId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/lojas/${lojaId}/atendentes`);
        if (response.ok) {
            const atendentes = await response.json();
            atendentes.forEach(a => {
                const option = document.createElement('option');
                option.value = a.id;
                option.textContent = a.nome;
                atendenteSelect.appendChild(option);
            });
            atendenteSelect.disabled = false;
        }
    } catch (error) {
        console.error('Erro ao carregar atendentes:', error);
    }
}

// Busca o salário do atendente
async function buscarSalario(atendenteId) {
    salarioAtualSpan.textContent = 'Carregando...';
    try {
        const response = await fetch(`${API_BASE_URL}/atendentes/salario/${atendenteId}`);
        if (response.ok) {
            const data = await response.json();
            salarioAtualSpan.textContent = formatarMoeda(data.salario);
        } else {
            salarioAtualSpan.textContent = 'Erro';
        }
    } catch (error) {
        salarioAtualSpan.textContent = 'Erro';
        console.error('Erro ao buscar salário:', error);
    }
}

// Atualiza o salário usando PATCH
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
        id: parseInt(atendenteId),
        salario: parseFloat(salario)
    };

    try {
        const response = await fetch(`${API_BASE_URL}/atendentes/update/salario`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            document.getElementById('mensagem').textContent = 'Salário atualizado com sucesso!';
            await buscarSalario(atendenteId);
            document.getElementById('novo-salario').value = '';
        } else {
            document.getElementById('mensagem').textContent = 'Erro ao atualizar salário.';
        }
    } catch (error) {
        document.getElementById('mensagem').textContent = 'Erro de conexão com o servidor.';
        console.error('Erro ao atualizar salário:', error);
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
            const resp = await fetch(`${API_BASE_URL}/atendentes/${atendenteParam}`);
            if (resp.ok) {
                const data = await resp.json();
                lojaSelect.value = data.lojaId;
                await carregarAtendentes(data.lojaId);
                atendenteSelect.value = atendenteParam;
                await buscarSalario(atendenteParam);
            }
        } catch (e) {
            console.error('Erro ao carregar atendente:', e);
        }
    }
});
