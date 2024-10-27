// Função para salvar loja
async function salvarLoja() {
    const nome = document.getElementById('nome').value;
    const cnpj = document.getElementById('cnpj').value;

    if (nome && cnpj) {
        try {
            const response = await fetch("http://localhost:8080/lojas", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ nome, cnpj })
            });

            if (response.ok) {
                const data = await response.json();
                alert(`Loja ${data.nome} salva com sucesso!`);
                
                // Limpar os campos após o salvamento
                document.getElementById('nome').value = '';
                document.getElementById('cnpj').value = '';
                
                // Atualizar a lista de lojas
                listarLojas();
            } else {
                alert("Erro ao salvar a loja. Verifique os dados e tente novamente.");
            }
        } catch (error) {
            console.error("Erro ao salvar a loja:", error);
            alert("Erro de conexão com o servidor.");
        }
    } else {
        alert("Por favor, preencha todos os campos.");
    }
}

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
                    <button onclick="editarLoja(${loja.id})">Editar</button>
                    <button onclick="excluirLoja(${loja.id})">Excluir</button>
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


// Função para salvar funcionário
function salvarFuncionario() {
    const nomeFuncionario = document.getElementById('nomeFuncionario').value;
    const nomeLoja = document.getElementById('nomeLoja').value;

    if(nomeFuncionario && nomeLoja) {
        alert(`Funcionário ${nomeFuncionario} da loja ${nomeLoja} salvo com sucesso!`);
        // Lógica para salvar o funcionário na API pode ser implementada aqui
    } else {
        alert('Por favor, preencha todos os campos.');
    }
}

// Função para salvar vendas
function salvarVendas() {
    const loja = document.getElementById('lojaSelecionada').value;
    const semana = document.getElementById('semana').value;
    const vendas = document.querySelectorAll('.vendaInput');
    const atrasos = document.querySelectorAll('.atrasoSelect');
    
    let vendasData = [];
    vendas.forEach((venda, index) => {
        const atraso = atrasos[index].value;
        vendasData.push({ 
            funcionario: venda.dataset.funcionario, 
            vendas: venda.value, 
            atraso: atraso 
        });
    });

    if(loja && semana && vendasData.length > 0) {
        alert(`Vendas da semana ${semana} da loja ${loja} salvas com sucesso!`);
        console.log(vendasData);
        // Lógica para salvar vendas na API pode ser implementada aqui
    } else {
        alert('Por favor, preencha todos os campos.');
    }
}

// Função para excluir loja
async function excluirLoja(id) {
    if (confirm("Tem certeza que deseja excluir esta loja?")) {
        try {
            const response = await fetch(`http://localhost:8080/lojas/${id}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if (response.ok) {
                alert("Loja excluída com sucesso!");
                listarLojas(); // Atualizar a lista de lojas
            } else {
                alert("Erro ao excluir a loja.");
            }
        } catch (error) {
            console.error("Erro ao excluir a loja:", error);
        }
    }
}

// Função para redirecionar para a página de edição com o ID da loja
function editarLoja(id) {
    window.location.href = `atualizar-loja.html?id=${id}`;
}


// Exemplo de como você pode gerar os campos dinamicamente (a ser adaptado para seu backend)
document.addEventListener('DOMContentLoaded', function() {
    const vendasContainer = document.getElementById('vendasContainer');
    const funcionarios = ['Funcionário 1', 'Funcionário 2', 'Funcionário 3']; // Isso pode vir da sua API

    funcionarios.forEach(funcionario => {
        const div = document.createElement('div');
        div.innerHTML = `
            <label>${funcionario}</label>
            <input type="number" class="vendaInput" data-funcionario="${funcionario}" placeholder="Vendas">
            <label for="atraso">Atraso:</label>
            <select class="atrasoSelect" name="atraso">
                <option value="não" selected>Não</option>
                <option value="sim">Sim</option>
            </select>
        `;
        vendasContainer.appendChild(div);
    });
});


// Função para exibir os resultados de gratificação
function mostrarResultados() {
    const tabelaResultados = document.getElementById('tabelaResultados').getElementsByTagName('tbody')[0];
    
    // Exemplo de dados que você pode receber da API (esses dados podem vir da API via fetch)
    const resultados = [
        { funcionario: 'Funcionário 1', vendas: 120, gratificacao: 1000, bonus: 200 },
        { funcionario: 'Funcionário 2', vendas: 90, gratificacao: 800, bonus: 150 },
        { funcionario: 'Funcionário 3', vendas: 60, gratificacao: 600, bonus: 100 },
        { funcionario: 'Funcionário 4', vendas: 40, gratificacao: 400, bonus: 50 }
    ];

    resultados.forEach(resultado => {
        const novaLinha = tabelaResultados.insertRow();
        const celulaFuncionario = novaLinha.insertCell(0);
        const celulaVendas = novaLinha.insertCell(1);
        const celulaGratificacao = novaLinha.insertCell(2);
        const celulaBonus = novaLinha.insertCell(3);

        celulaFuncionario.textContent = resultado.funcionario;
        celulaVendas.textContent = resultado.vendas;
        celulaGratificacao.textContent = resultado.gratificacao;
        celulaBonus.textContent = resultado.bonus;
    });
}

// Quando a página carrega, mostrar os resultados
document.addEventListener('DOMContentLoaded', function() {
    mostrarResultados();
});

