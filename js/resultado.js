// Gateada por `exigirPermissao('resultados')`. A chave `resultados` governa
// de forma COERENTE as três superfícies: item de menu, esta tela
// (`POST /resultados`) e os widgets de dashboard kpi-vendas/ranking-vendas
// (`GET /lojas/{id}/vendas`). Isto REVERTE a decisão C1/A3 (que mantinha a
// tela MASTER-only por `POST /resultados` ser `hasRole('MASTER')`): o backend
// passou a enforçar `POST /resultados` via `@RequerPagina("resultados")`.
// Ver relatorios/tasks/acesso-administrativo-configuravel/00-*.md (C5) —
// resolve, em vez de contornar, a antiga incoerência menu × página.
exigirPermissao('resultados');

const storesContainer = document.getElementById('stores');

async function fetchAllStoreResults() {
    try {
        const stores = await apiPost('/resultados');
        displayStoresResults(stores);
    } catch (err) {
        console.error('Erro ao buscar resultados:', err);
        storesContainer.innerHTML = '<p>Erro ao carregar resultados.</p>';
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

