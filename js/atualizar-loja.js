// Função para obter o parâmetro ID da URL
function getLojaIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Função para buscar os dados da loja e preencher o formulário
async function carregarLoja() {
    const id = getLojaIdFromUrl();

    if (id) {
        try {
            const response = await fetch(`http://localhost:8080/lojas/${id}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if (response.ok) {
                const loja = await response.json();
                document.getElementById('nome').value = loja.nome;
                document.getElementById('cnpj').value = loja.cnpj;
            } else {
                alert("Erro ao carregar dados da loja.");
            }
        } catch (error) {
            console.error("Erro ao carregar dados da loja:", error);
        }
    }
}

// Função para atualizar os dados da loja
async function atualizarLoja() {
    const id = getLojaIdFromUrl();
    const nome = document.getElementById('nome').value;
    const cnpj = document.getElementById('cnpj').value;

    if (nome && cnpj) {
        try {
            const response = await fetch(`http://localhost:8080/lojas/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ nome, cnpj })
            });

            if (response.ok) {
                alert("Loja atualizada com sucesso!");
                window.location.href = "cadastro-loja.html"; // Redireciona de volta para a lista de lojas
            } else {
                alert("Erro ao atualizar a loja.");
            }
        } catch (error) {
            console.error("Erro ao atualizar a loja:", error);
        }
    } else {
        alert("Por favor, preencha todos os campos.");
    }
}

// Carregar os dados da loja ao carregar a página
document.addEventListener('DOMContentLoaded', carregarLoja);
