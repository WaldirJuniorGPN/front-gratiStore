import { carregarAtendentes } from './listarAtendentes.js';

const urlParams = new URLSearchParams(window.location.search);
const funcionarioId = urlParams.get("id");

document.addEventListener("DOMContentLoaded", carregarDadosFuncionario);
document.getElementById("formAtualizarAtendente").addEventListener("submit", atualizarFuncionario);

async function carregarDadosFuncionario() {
    try {
        const response = await fetch(`http://localhost:8080/atendentes/${funcionarioId}`);
        if (response.ok) {
            const atendente = await response.json();
            document.getElementById("nome").value = atendente.nome;
        } else {
            document.getElementById("mensagem").innerText = "Erro ao carregar dados do funcionário.";
        }
    } catch (error) {
        document.getElementById("mensagem").innerText = "Erro de conexão com o servidor.";
        console.error("Erro:", error);
    }
}

async function atualizarFuncionario(event) {
    event.preventDefault();
    
    const nome = document.getElementById("nome").value;
    
    try {
        const response = await fetch(`http://localhost:8080/atendentes/${funcionarioId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nome })
        });
        
        if (response.ok) {
            document.getElementById("mensagem").innerText = "Funcionário atualizado com sucesso!";
        } else {
            document.getElementById("mensagem").innerText = "Erro ao atualizar o funcionário.";
        }
    } catch (error) {
        document.getElementById("mensagem").innerText = "Erro de conexão com o servidor.";
        console.error("Erro:", error);
    }
}
