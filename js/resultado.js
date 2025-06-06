const API_BASE_URL = 'http://localhost:8080';
const storesContainer = document.getElementById("stores");

// Função para buscar os resultados de todas as lojas usando POST
async function fetchAllStoreResults() {
    try {
        const response = await fetch(`${API_BASE_URL}/resultados`, {
            method: "POST", // Define o método como POST
            headers: {
                "Content-Type": "application/json"
            }
        });
        
        if (response.ok) {
            const stores = await response.json();
            displayStoresResults(stores);
        } else {
            console.error("Erro ao buscar resultados:", response.status);
            storesContainer.innerHTML = "<p>Erro ao carregar resultados.</p>";
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
        storesContainer.innerHTML = "<p>Erro ao carregar resultados.</p>";
    }
}

// Função para formatar números no formato de moeda brasileira
function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2
    }).format(value);
}

// Função para exibir os resultados de cada loja
function displayStoresResults(stores) {
    storesContainer.innerHTML = "";

    stores.forEach(store => {
        const storeCard = document.createElement("div");
        storeCard.className = "store";

        const storeName = document.createElement("h2");
        storeName.textContent = store.nome;
        storeCard.appendChild(storeName);

        const atendentesContainer = document.createElement("div");
        atendentesContainer.className = "atendentes-container";

        store.atendentes.forEach(atendente => {
            const atendenteCard = document.createElement("div");
            atendenteCard.className = "atendente";

            const atendenteName = document.createElement("h3");
            atendenteName.textContent = atendente.nome;
            atendenteCard.appendChild(atendenteName);

            const vendas = document.createElement("p");
            vendas.textContent = `Vendas: ${formatCurrency(atendente.vendasTotais)}`;
            atendenteCard.appendChild(vendas);

            const gratificacao = document.createElement("p");
            gratificacao.textContent = `Gratificação: ${formatCurrency(atendente.gratificacao)}`;
            atendenteCard.appendChild(gratificacao);

            const bonus = document.createElement("p");
            bonus.textContent = `Bônus: ${formatCurrency(atendente.bonus)}`;
            atendenteCard.appendChild(bonus);

            atendentesContainer.appendChild(atendenteCard);
        });

        storeCard.appendChild(atendentesContainer);

        const total = document.createElement("p");
        total.className = "total";
        total.textContent = `Total de Vendas: ${formatCurrency(store.totalVendas)}`;
        storeCard.appendChild(total);

        storesContainer.appendChild(storeCard);
    });
}


// Carregar a lista de lojas ao carregar a página
window.addEventListener("DOMContentLoaded", fetchAllStoreResults);

