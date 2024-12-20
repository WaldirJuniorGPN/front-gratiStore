function getCalculadoraIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

async function carregarCalculadora() {
    const id = getCalculadoraIdFromUrl();

    if (id) {
        try {
            const response = await fetch (`http://localhost:8080/calculadoras/${id}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if (response.ok) {
                const calculadora = await response.json();
                document.getElementById('nome').value = calculadora.nome;
                document.getElementById('percentualPrimeiroColocado').value = calculadora.percentualPrimeiroColocado;
                document.getElementById('percentualSegundoColocado').value = calculadora.percentualSegundoColocado;
                document.getElementById('percentualTerceiroColocado').value = calculadora.percentualTerceiroColocado;
                document.getElementById('percentualDemaisColocados').value = calculadora.percentualDemaisColocados;
                document.getElementById('bonusPrimeiroColocado').value = calculadora.bonusPrimeiroColocado;
                document.getElementById('bonusSegundoColocado').value = calculadora.bonusSegundoColocado;
                document.getElementById('bonusTerceiroColocado').value = calculadora.bonusTerceiroColocado;
            } else {
                alert("Erro ao carregar dados da Calculadora");
            }
        } catch (error) {
            console.error("Erro ao carregar dados da calculadora", error)
        }
    }
}

async function atualizarCalculadora() {
    const id = getCalculadoraIdFromUrl();
    const nome = document.getElementById('nome').value;
    const percentualPrimeiroColocado = parseFloat(document.getElementById('percentualPrimeiroColocado').value);
    const percentualSegundoColocado = parseFloat(document.getElementById('percentualSegundoColocado').value);
    const percentualTerceiroColocado = parseFloat(document.getElementById('percentualTerceiroColocado').value);
    const percentualDemaisColocados = parseFloat(document.getElementById('percentualDemaisColocados').value);
    const bonusPrimeiroColocado = parseFloat(document.getElementById('bonusPrimeiroColocado').value);
    const bonusSegundoColocado = parseFloat(document.getElementById('bonusSegundoColocado').value);
    const bonusTerceiroColocado = parseFloat(document.getElementById('bonusTerceiroColocado').value);
    const lojaId = document.getElementById("loja").value;

    try {
        const response = await fetch(`http://localhost:8080/calculadoras/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                nome,
                percentualPrimeiroColocado,
                percentualSegundoColocado,
                percentualTerceiroColocado,
                percentualDemaisColocados,
                bonusPrimeiroColocado,
                bonusSegundoColocado,
                bonusTerceiroColocado,
                lojaId
            })
        });

        if (response.ok) {
            alert("Calculadora atualizada com sucesso!");
            window.location.href = "cadastro-calculadora.html";
        } else {
            alert("Erro ao atualizar a calculadora.");
        }
    } catch (error) {
        console.error("Erro ao atualizar a calculadora", error);
    }
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

document.addEventListener('DOMContentLoaded', carregarCalculadora);
document.addEventListener('DOMContentLoaded', carregarLojas);