import { carregarAtendentes } from './listarAtendentes.js';

document.addEventListener("DOMContentLoaded", () => {
    carregarAtendentes();
    carregarLojas(); // Carregar as lojas ao carregar a página
});
document.getElementById("formCadastroAtendente").addEventListener("submit", cadastrarAtendente);

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

async function cadastrarAtendente(event) {
    event.preventDefault();
    
    const nome = document.getElementById("nome").value;
    const lojaId = document.getElementById("loja").value; // Obter o ID da loja selecionada

    try {
        const response = await fetch('http://localhost:8080/atendentes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nome, lojaId }) // Enviar o ID da loja junto com o nome do atendente
        });
        
        if (response.ok) {
            document.getElementById("mensagem").innerText = "Atendente cadastrado com sucesso!";
            document.getElementById("nome").value = ""; // Limpar o campo de entrada
            document.getElementById("loja").value = ""; // Resetar o campo de seleção
            carregarAtendentes(); // Atualizar a lista após o cadastro
        } else {
            document.getElementById("mensagem").innerText = "Erro ao cadastrar o atendente.";
        }
    } catch (error) {
        document.getElementById("mensagem").innerText = "Erro de conexão com o servidor.";
        console.error("Erro:", error);
    }
}
