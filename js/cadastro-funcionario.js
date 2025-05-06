import { carregarAtendentes } from './listarAtendentes.js';

document.addEventListener("DOMContentLoaded", () => {
    carregarLojas();
});

document.getElementById("formCadastroAtendente").addEventListener("submit", cadastrarAtendente);

async function carregarLojas() {
    try {
        const response = await fetch('http://localhost:8080/lojas/listar');
        if (response.ok) {
            const lojas = await response.json();
            preencherSelectLojas(lojas, "loja"); // Select do formulário
            preencherSelectLojas(lojas, "filtroLoja"); // Select do filtro
        } else {
            console.error("Erro ao carregar a lista de lojas.");
        }
    } catch (error) {
        console.error("Erro de conexão com o servidor:", error);
    }
}

function preencherSelectLojas(lojas, selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Selecione uma loja</option>';

    lojas.forEach(loja => {
        const option = document.createElement("option");
        option.value = loja.id;
        option.textContent = loja.nome;
        select.appendChild(option);
    });
}

// Adicionar evento de mudança no filtro de loja
document.getElementById("filtroLoja").addEventListener("change", (event) => {
    const lojaId = event.target.value;
    if (lojaId) {
        carregarAtendentes(lojaId);
    } else {
        document.getElementById("listaAtendentes").innerHTML = 
            '<p>Selecione uma loja para ver seus atendentes.</p>';
    }
});

async function cadastrarAtendente(event) {
    event.preventDefault();
    
    const nome = document.getElementById("nome").value;
    const lojaId = document.getElementById("loja").value;
    const salarioRaw = document.getElementById("salario").value;
    // Normaliza o valor: remove pontos de milhar, troca vírgula decimal por ponto
    const salario = salarioRaw
        .replace(/\./g, "")   // remove todos os pontos
        .replace(/,/g, ".");  // troca vírgula por ponto

    if (!nome || !lojaId || !salario) {
        document.getElementById("mensagem").innerText = "Por favor, preencha todos os campos.";
        return;
    }

    try {
        const response = await fetch('http://localhost:8080/atendentes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                nome, 
                lojaId: parseInt(lojaId), 
                salario: parseFloat(salario)
            })
        });
        
        if (response.ok) {
            document.getElementById("mensagem").innerText = "Atendente cadastrado com sucesso!";
            document.getElementById("nome").value = "";
            document.getElementById("loja").value = "";
            document.getElementById("salario").value = "";
            
            // Atualizar a lista se a loja do filtro for a mesma do cadastro
            const filtroLojaId = document.getElementById("filtroLoja").value;
            if (filtroLojaId === lojaId) {
                carregarAtendentes(lojaId);
            }
        } else {
            document.getElementById("mensagem").innerText = "Erro ao cadastrar o atendente.";
        }
    } catch (error) {
        document.getElementById("mensagem").innerText = "Erro de conexão com o servidor.";
        console.error("Erro:", error);
    }
}
