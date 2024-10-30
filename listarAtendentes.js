export async function carregarAtendentes() {
    try {
        const response = await fetch('http://localhost:8080/atendentes/listar');
        if (response.ok) {
            const atendentes = await response.json();
            exibirListaAtendentes(atendentes);
        } else {
            console.error("Erro ao carregar a lista de atendentes.");
        }
    } catch (error) {
        console.error("Erro de conexão com o servidor:", error);
    }
}

function exibirListaAtendentes(atendentes) {
    const lista = document.getElementById("listaAtendentes");
    lista.innerHTML = ""; // Limpar lista antes de renderizar
    
    atendentes.forEach(atendente => {
        const item = document.createElement("li");
        item.innerHTML = `
            Nome: ${atendente.nome}
            <button onclick="window.location.href='atualizar-funcionario.html?id=${atendente.id}'">Editar</button>
            <button onclick="excluirAtendente(${atendente.id})">Excluir</button>
        `;
        lista.appendChild(item);
    });
}

// Função para excluir o atendente
export async function excluirAtendente(id) {
    try {
        const response = await fetch(`http://localhost:8080/atendentes/${id}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            carregarAtendentes(); // Atualizar a lista após a exclusão
        } else {
            console.error("Erro ao excluir o atendente.");
        }
    } catch (error) {
        console.error("Erro de conexão com o servidor:", error);
    }
}

// Tornar a função globalmente acessível
window.excluirAtendente = excluirAtendente;

