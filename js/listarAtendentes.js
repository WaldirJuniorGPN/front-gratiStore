export async function carregarAtendentes(lojaId = null) {
    try {
        let url = 'http://localhost:8080/lojas';
        if (lojaId) {
            url = `${url}/${lojaId}/atendentes`;
        } else {
            return; // Se não houver loja selecionada, não carrega atendentes
        }

        const response = await fetch(url);
        if (response.ok) {
            const atendentes = await response.json();
            exibirListaAtendentes(atendentes);
        } else {
            console.error("Erro ao carregar a lista de atendentes.");
            document.getElementById("listaAtendentes").innerHTML = 
                '<p class="erro">Erro ao carregar atendentes. Por favor, tente novamente.</p>';
        }
    } catch (error) {
        console.error("Erro de conexão com o servidor:", error);
        document.getElementById("listaAtendentes").innerHTML = 
            '<p class="erro">Erro de conexão com o servidor. Por favor, verifique sua conexão.</p>';
    }
}

function exibirListaAtendentes(atendentes) {
    const lista = document.getElementById("listaAtendentes");
    lista.innerHTML = ""; // Limpar lista antes de renderizar
    
    if (atendentes.length === 0) {
        lista.innerHTML = '<p>Nenhum atendente cadastrado para esta loja.</p>';
        return;
    }

    atendentes.forEach(atendente => {
        const item = document.createElement("li");
        
        item.innerHTML = `
            <div class="atendente-info">
                <strong>${atendente.nome}</strong>
            </div>
            <div class="acoes-atendente">
                <button class="btn-editar" onclick="window.location.href='atualizar-funcionario.html?id=${atendente.id}'">
                    Editar
                </button>
                <button class="btn-excluir" onclick="excluirAtendente(${atendente.id})">
                    Excluir
                </button>
            </div>
        `;
        
        lista.appendChild(item);
    });
}

// Função para excluir o atendente
export async function excluirAtendente(id) {
    if (!confirm('Tem certeza que deseja excluir este atendente?')) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:8080/atendentes/${id}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            // Recarregar a lista com a loja atualmente selecionada
            const filtroLoja = document.getElementById('filtroLoja');
            await carregarAtendentes(filtroLoja.value);
        } else {
            alert("Erro ao excluir o atendente.");
        }
    } catch (error) {
        console.error("Erro de conexão com o servidor:", error);
        alert("Erro de conexão com o servidor ao tentar excluir o atendente.");
    }
}

// Tornar a função globalmente acessível
window.excluirAtendente = excluirAtendente;

