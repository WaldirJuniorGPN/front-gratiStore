async function carregarCalculadoras() {
    try {
        const calculadoras = await apiGet('/calculadoras/listar');
        exibirListaCalculadoras(calculadoras);
    } catch (err) {
        console.error('Erro ao carregar a lista de calculadoras:', err);
    }
}

function exibirListaCalculadoras(calculadoras) {
    const lista = document.getElementById('listaCalculadoras');
    lista.innerHTML = '';

    calculadoras.forEach((calculadora) => {
        const item = document.createElement('li');
        item.innerHTML = `
            Nome: ${calculadora.nome};
            <button onclick="window.location.href='atualizar-calculadora.html?id=${calculadora.id}'">Editar</button>
            <button onclick="excluirCalculadora(${calculadora.id})">Excluir</button>
        `;
        lista.appendChild(item);
    });
}

async function excluirCalculadora(id) {
    try {
        await apiDelete(`/calculadoras/${id}`);
        carregarCalculadoras();
    } catch (err) {
        console.error('Erro ao excluir a calculadora:', err);
    }
}

window.excluirCalculadora = excluirCalculadora;
window.carregarCalculadoras = carregarCalculadoras;
