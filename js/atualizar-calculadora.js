exigirPermissao('cadastro-calculadora');

function getCalculadoraIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

async function carregarCalculadora() {
    const id = getCalculadoraIdFromUrl();
    if (!id) return;

    try {
        const calculadora = await apiGet(`/calculadoras/${id}`);
        document.getElementById('nome').value = calculadora.nome;
        document.getElementById('percentualPrimeiroColocado').value = calculadora.percentualPrimeiroColocado;
        document.getElementById('percentualSegundoColocado').value = calculadora.percentualSegundoColocado;
        document.getElementById('percentualTerceiroColocado').value = calculadora.percentualTerceiroColocado;
        document.getElementById('percentualDemaisColocados').value = calculadora.percentualDemaisColocados;
        document.getElementById('bonusPrimeiroColocado').value = calculadora.bonusPrimeiroColocado;
        document.getElementById('bonusSegundoColocado').value = calculadora.bonusSegundoColocado;
        document.getElementById('bonusTerceiroColocado').value = calculadora.bonusTerceiroColocado;
    } catch (err) {
        console.error('Erro ao carregar dados da calculadora:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao carregar dados da calculadora.') : 'Erro de conexão com o servidor.';
        alert(msg);
    }
}

async function atualizarCalculadora() {
    const id = getCalculadoraIdFromUrl();
    const body = {
        nome: document.getElementById('nome').value,
        percentualPrimeiroColocado: parseFloat(document.getElementById('percentualPrimeiroColocado').value),
        percentualSegundoColocado: parseFloat(document.getElementById('percentualSegundoColocado').value),
        percentualTerceiroColocado: parseFloat(document.getElementById('percentualTerceiroColocado').value),
        percentualDemaisColocados: parseFloat(document.getElementById('percentualDemaisColocados').value),
        bonusPrimeiroColocado: parseFloat(document.getElementById('bonusPrimeiroColocado').value),
        bonusSegundoColocado: parseFloat(document.getElementById('bonusSegundoColocado').value),
        bonusTerceiroColocado: parseFloat(document.getElementById('bonusTerceiroColocado').value),
        lojaId: document.getElementById('loja').value
    };

    try {
        await apiPut(`/calculadoras/${id}`, body);
        alert('Calculadora atualizada com sucesso!');
        window.location.href = 'cadastro-calculadora.html';
    } catch (err) {
        console.error('Erro ao atualizar a calculadora:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao atualizar a calculadora.') : 'Erro de conexão com o servidor.';
        alert(msg);
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

document.addEventListener('DOMContentLoaded', carregarCalculadora);
document.addEventListener('DOMContentLoaded', carregarLojas);
