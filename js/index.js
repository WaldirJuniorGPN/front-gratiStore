// Função para buscar e listar todas as lojas
async function listarLojas() {
    try {
        const response = await fetch("http://localhost:8080/lojas/listar", {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        });

        if (response.ok) {
            const lojas = await response.json();
            const listaLojas = document.getElementById('listaLojas');
            listaLojas.innerHTML = '';

            lojas.forEach(loja => {
                const lojaElement = document.createElement('div');
                lojaElement.innerHTML = `
                    <strong>Nome:</strong> ${loja.nome} <br> 
                    <strong>CNPJ:</strong> ${loja.cnpj} <br>
                    <hr>
                `;
                listaLojas.appendChild(lojaElement);
            });
        } else {
            console.error("Erro ao buscar lojas.");
        }
    } catch (error) {
        console.error("Erro ao buscar lojas:", error);
    }
}


// Carregar a lista de lojas ao carregar a página
document.addEventListener('DOMContentLoaded', listarLojas);