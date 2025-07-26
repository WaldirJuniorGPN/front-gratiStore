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

async function exibirListaAtendentes(atendentes) {
    const lista = document.getElementById("listaAtendentes");
    lista.innerHTML = ""; // Limpar lista antes de renderizar
    
    if (atendentes.length === 0) {
        lista.innerHTML = '<p>Nenhum atendente cadastrado para esta loja.</p>';
        return;
    }

    for (const atendente of atendentes) {
        const item = document.createElement("li");

        const salario = await obterSalario(atendente.id);

        item.innerHTML = `
            <div class="atendente-info">
                <strong>${atendente.nome}</strong> - <span class="salario">${salario !== null ? formatarMoeda(salario) : 'N/A'}</span>
            </div>
            <div class="acoes-atendente">
                <button class="btn-editar" onclick="window.location.href='atualizar-funcionario.html?id=${atendente.id}'">
                    Editar
                </button>
                <button class="btn-salario" onclick="window.location.href='update-salario.html?id=${atendente.id}'">
                    Salário
                </button>
                <button class="btn-excluir" onclick="excluirAtendente(${atendente.id})">
                    Excluir
                </button>
            </div>
        `;

        lista.appendChild(item);
    }
}

async function obterSalario(id) {
    try {
        const response = await fetch(`http://localhost:8080/atendentes/salario/${id}`);
        if (response.ok) {
            const data = await response.json();
            return data.salario;
        }
    } catch (error) {
        console.error("Erro ao buscar salário:", error);
    }
    return null;
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
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

