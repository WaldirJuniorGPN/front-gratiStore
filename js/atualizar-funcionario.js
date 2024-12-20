import { carregarAtendentes } from './listarAtendentes.js';

const urlParams = new URLSearchParams(window.location.search);
const funcionarioId = urlParams.get("id");

document.addEventListener("DOMContentLoaded", carregarDadosFuncionario);
document.addEventListener("DOMContentLoaded", carregarLojas);
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
    const lojaId = document.getElementById("loja").value;
    
    try {
        const response = await fetch(`http://localhost:8080/atendentes/${funcionarioId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nome, lojaId })
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
