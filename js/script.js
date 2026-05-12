async function salvarLoja() {
    const nome = document.getElementById('nome').value;
    const cnpj = document.getElementById('cnpj').value;

    if (!nome || !cnpj) {
        alert('Por favor, preencha todos os campos.');
        return;
    }

    try {
        const data = await apiPost('/lojas', { nome, cnpj });
        alert(`Loja ${data.nome} salva com sucesso!`);
        document.getElementById('nome').value = '';
        document.getElementById('cnpj').value = '';
        listarLojas();
    } catch (err) {
        console.error('Erro ao salvar a loja:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao salvar a loja.') : 'Erro de conexão com o servidor.';
        alert(msg);
    }
}

async function listarLojas() {
    try {
        const lojas = await apiGet('/lojas/listar');
        const listaLojas = document.getElementById('listaLojas');
        listaLojas.innerHTML = '';
        lojas.forEach((loja) => {
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
    } catch (err) {
        console.error('Erro ao buscar lojas:', err);
    }
}

document.addEventListener('DOMContentLoaded', listarLojas);

function salvarFuncionario() {
    const nomeFuncionario = document.getElementById('nomeFuncionario').value;
    const nomeLoja = document.getElementById('nomeLoja').value;

    if (nomeFuncionario && nomeLoja) {
        alert(`Funcionário ${nomeFuncionario} da loja ${nomeLoja} salvo com sucesso!`);
    } else {
        alert('Por favor, preencha todos os campos.');
    }
}

function salvarVendas() {
    const loja = document.getElementById('lojaSelecionada').value;
    const semana = document.getElementById('semana').value;
    const vendas = document.querySelectorAll('.vendaInput');
    const atrasos = document.querySelectorAll('.atrasoSelect');

    const vendasData = [];
    vendas.forEach((venda, index) => {
        vendasData.push({
            funcionario: venda.dataset.funcionario,
            vendas: venda.value,
            atraso: atrasos[index].value
        });
    });

    if (loja && semana && vendasData.length > 0) {
        alert(`Vendas da semana ${semana} da loja ${loja} salvas com sucesso!`);
        console.log(vendasData);
    } else {
        alert('Por favor, preencha todos os campos.');
    }
}

async function excluirLoja(id) {
    if (!confirm('Tem certeza que deseja excluir esta loja?')) return;

    try {
        await apiDelete(`/lojas/${id}`);
        alert('Loja excluída com sucesso!');
        listarLojas();
    } catch (err) {
        console.error('Erro ao excluir a loja:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao excluir a loja.') : 'Erro de conexão com o servidor.';
        alert(msg);
    }
}

function editarLoja(id) {
    window.location.href = `atualizar-loja.html?id=${id}`;
}

document.addEventListener('DOMContentLoaded', function () {
    const vendasContainer = document.getElementById('vendasContainer');
    if (!vendasContainer) return;
    const funcionarios = ['Funcionário 1', 'Funcionário 2', 'Funcionário 3'];

    funcionarios.forEach((funcionario) => {
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

function mostrarResultados() {
    const tabela = document.getElementById('tabelaResultados');
    if (!tabela) return;
    const tabelaResultados = tabela.getElementsByTagName('tbody')[0];

    const resultados = [
        { funcionario: 'Funcionário 1', vendas: 120, gratificacao: 1000, bonus: 200 },
        { funcionario: 'Funcionário 2', vendas: 90, gratificacao: 800, bonus: 150 },
        { funcionario: 'Funcionário 3', vendas: 60, gratificacao: 600, bonus: 100 },
        { funcionario: 'Funcionário 4', vendas: 40, gratificacao: 400, bonus: 50 }
    ];

    resultados.forEach((resultado) => {
        const novaLinha = tabelaResultados.insertRow();
        novaLinha.insertCell(0).textContent = resultado.funcionario;
        novaLinha.insertCell(1).textContent = resultado.vendas;
        novaLinha.insertCell(2).textContent = resultado.gratificacao;
        novaLinha.insertCell(3).textContent = resultado.bonus;
    });
}

document.addEventListener('DOMContentLoaded', function () {
    mostrarResultados();
});
