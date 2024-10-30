import { carregarAtendentes } from './listarAtendentes.js';

document.addEventListener("DOMContentLoaded", carregarAtendentes);
document.getElementById("formCadastroAtendente").addEventListener("submit", cadastrarAtendente);

async function cadastrarAtendente(event) {
    event.preventDefault();
    
    const nome = document.getElementById("nome").value;
    
    try {
        const response = await fetch('http://localhost:8080/atendentes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nome })
        });
        
        if (response.ok) {
            document.getElementById("mensagem").innerText = "Atendente cadastrado com sucesso!";
            document.getElementById("nome").value = ""; // Limpar o campo de entrada
            carregarAtendentes(); // Atualizar a lista após o cadastro
        } else {
            document.getElementById("mensagem").innerText = "Erro ao cadastrar o atendente.";
        }
    } catch (error) {
        document.getElementById("mensagem").innerText = "Erro de conexão com o servidor.";
        console.error("Erro:", error);
    }
}
