import { carregarCalculadoras } from './listarCalculadoras.js';

document.addEventListener("DOMContentLoaded", () => {
    carregarCalculadoras();
    carregarLojas();
    document.getElementById("formCadastroCalculadora").addEventListener("submit", cadastrarCalculadora);
});

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

function formatarPercentual(valor) {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor) + '%';
}

async function carregarLojas() {
    try {
        const response = await fetch('http://localhost:8080/lojas/listar'); // Ajuste o endpoint conforme necessário
        if (response.ok) {
            const lojas = await response.json();
            const lojaSelect = document.getElementById("loja");

            lojas.forEach(loja => {
                const option = document.createElement("option");
                option.value = loja.id;
                option.textContent = loja.nome;
                lojaSelect.appendChild(option);
            });
        } else {
            console.error("Erro ao carregar a lista de lojas.");
        }
    } catch (error) {
        console.error("Erro de conexão com o servidor:", error);
    }
}

async function cadastrarCalculadora(event) {
    event.preventDefault();
    
    const calculadora = {
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
        const response = await fetch('http://localhost:8080/calculadoras', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(calculadora)
        });

        if (response.ok) {
            mostrarMensagem('Calculadora cadastrada com sucesso!', 'sucesso');
            document.getElementById('formCadastroCalculadora').reset();
            carregarCalculadoras();
        } else {
            mostrarMensagem('Erro ao cadastrar a calculadora.', 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro de conexão com o servidor.', 'erro');
    }
}

async function excluirCalculadora(id) {
    if (!confirm('Tem certeza que deseja excluir esta calculadora?')) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:8080/calculadoras/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            mostrarMensagem('Calculadora excluída com sucesso!', 'sucesso');
            carregarCalculadoras();
        } else {
            mostrarMensagem('Erro ao excluir a calculadora.', 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro de conexão com o servidor.', 'erro');
    }
}

function mostrarMensagem(texto, tipo) {
    const mensagem = document.getElementById('mensagem');
    mensagem.textContent = texto;
    mensagem.className = tipo;
    setTimeout(() => {
        mensagem.textContent = '';
        mensagem.className = '';
    }, 3000);
}

// Tornar funções globalmente acessíveis
window.excluirCalculadora = excluirCalculadora;
