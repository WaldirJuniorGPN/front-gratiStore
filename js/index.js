const API_BASE_URL = 'http://localhost:8080';

// Função para formatar valor em reais
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// Função para buscar o total de vendas de uma loja
async function buscarTotalVendas(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/lojas/${id}/vendas`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        });

        if (response.ok) {
            const data = await response.json();
            return data.valor || 0;
        }
        return 0;
    } catch (error) {
        console.error("Erro ao buscar total de vendas:", error);
        return 0;
    }
}

// Função para buscar e listar todas as lojas
async function listarLojas() {
    try {
        const response = await fetch(`${API_BASE_URL}/lojas/listar`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        });

        if (response.ok) {
            const lojas = await response.json();
            const listaLojas = document.getElementById('listaLojas');
            listaLojas.innerHTML = '';

            for (const loja of lojas) {
                const totalVendas = await buscarTotalVendas(loja.id);
                const lojaElement = document.createElement('div');
                lojaElement.className = 'loja-item';
                lojaElement.innerHTML = `
                    <div class="loja-info">
                        <strong>Nome:</strong> ${loja.nome}<br>
                        <strong>CNPJ:</strong> ${loja.cnpj}
                    </div>
                    <div class="loja-total">
                        Total Vendido:<br>
                        <span class="valor">${formatarMoeda(totalVendas)}</span>
                    </div>
                `;
                listaLojas.appendChild(lojaElement);
            }
        } else {
            console.error("Erro ao buscar lojas.");
        }
    } catch (error) {
        console.error("Erro ao buscar lojas:", error);
    }
}

// Carregar a lista de lojas ao carregar a página
document.addEventListener('DOMContentLoaded', listarLojas);
