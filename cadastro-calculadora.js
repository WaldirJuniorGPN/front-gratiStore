import { carregarCalculadoras } from './listarCalculadoras.js';

document.addEventListener("DOMContentLoaded", () => {
    carregarCalculadoras();
    carregarLojas();
});

document.getElementById("formCadastroCalculadora").addEventListener("submit", cadastrarCalculadora);

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

    const nome = document.getElementById("nome").value;
    const percentualPrimeiroColocado = document.getElementById("percentualPrimeiroColocado").value;
    const percentualSegundoColocado = document.getElementById("percentualSegundoColocado").value;
    const percentualTerceiroColocado = document.getElementById("percentualTerceiroColocado").value;
    const percentualDemaisColocados = document.getElementById("percentualDemaisColocados").value;
    const bonusPrimeiroColocado = document.getElementById("bonusPrimeiroColocado").value;
    const bonusSegundoColocado = document.getElementById("bonusSegundoColocado").value;
    const bonusTerceiroColocado = document.getElementById("bonusTerceiroColocado").value;
    const lojaId = document.getElementById("loja").value;

    try {
        const response = await fetch('http://localhost:8080/calculadoras', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({nome,
                percentualPrimeiroColocado,
                percentualSegundoColocado,
                percentualTerceiroColocado,
                percentualDemaisColocados,
                bonusPrimeiroColocado,
                bonusSegundoColocado,
                bonusTerceiroColocado,
                lojaId})
        });

        if (response.ok) {
            document.getElementById("mensagem").innerText = "Calculadora cadastrada com sucesso!"
            document.getElementById("nome").value = "";
            document.getElementById("percentualPrimeiroColocado").value = "";
            document.getElementById("percentualSegundoColocado").value = "";
            document.getElementById("percentualTerceiroColocado").value = "";
            document.getElementById("percentualDemaisColocados").value = "";
            document.getElementById("bonusPrimeiroColocado").value = "";
            document.getElementById("bonusSegundoColocado").value = "";
            document.getElementById("bonusTerceiroColocado").value = "";
            document.getElementById("loja").value = "";

            carregarCalculadoras();
        } else {
            document.getElementById("mensagem").innerText = "Erro ao cadastrar calculadora.";
        }
    } catch (error) {
        document.getElementById("mensagem").innerText = "Erro de conexão com o servidor.";
        console.error("Erro:", error);
    }
}