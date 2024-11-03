export async function carregarCalculadoras() {
    try {
        const response = await fetch('http://localhost:8080/calculadoras/listar');
        if (response.ok) {
            const calculadoras = await response.json();
            exibirListaCalculadoras(calculadoras);
        } else {
            console.error("Erro ao carregar a lista de calculadoras");
        }
    } catch (error) {
        console.error("Erro de conexão com o servidor:", error)
    }
    
    
}

function exibirListaCalculadoras(calculadoras) {
    const lista = document.getElementById("listaCalculadoras");
    lista.innerHTML = "";

    calculadoras.forEach(calculadora => {
        const item = document.createElement("li");

        item.innerHTML = `
            Nome: ${calculadora.nome};
            <button onclick="window.location.href='atualizar-calculadora.html?id=${calculadora.id}'">Editar</button>
            <button onclick="excluirCalculadora(${calculadora.id})">Excluir</button>
        `;
        
        lista.appendChild(item);
    });
}

export async function excluirCalculadora(id) {
    try {
        const response = await fetch(`http://localhost:8080/calculadoras/${id}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            carregarCalculadoras();
        } else {
            console.error("Erro ao excluir a calculadora");
        }
    } catch (error) {
        console.error("Erro de conexão com o servidor:", error);
    }
}

window.excluirCalculadora = excluirCalculadora;