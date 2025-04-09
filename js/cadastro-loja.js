document.addEventListener('DOMContentLoaded', () => {
    carregarLojas();
    document.getElementById('formCadastroLoja').addEventListener('submit', cadastrarLoja);
});

async function carregarLojas() {
    try {
        const response = await fetch('http://localhost:8080/lojas/listar');
        if (response.ok) {
            const lojas = await response.json();
            const listaLojas = document.getElementById('listaLojas');
            listaLojas.innerHTML = '';

            lojas.forEach(loja => {
                const lojaElement = document.createElement('div');
                lojaElement.className = 'loja-item';
                lojaElement.innerHTML = `
                    <div class="loja-info">
                        <span class="nome">${loja.nome}</span>
                        <span class="cnpj">CNPJ: ${loja.cnpj}</span>
                    </div>
                    <div class="acoes-loja">
                        <button class="btn-editar" onclick="window.location.href='atualizar-loja.html?id=${loja.id}'">
                            Editar
                        </button>
                        <button class="btn-excluir" onclick="excluirLoja(${loja.id})">
                            Excluir
                        </button>
                    </div>
                `;
                listaLojas.appendChild(lojaElement);
            });
        } else {
            console.error('Erro ao carregar lojas');
            mostrarMensagem('Erro ao carregar a lista de lojas.', 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro de conexão com o servidor.', 'erro');
    }
}

async function cadastrarLoja(event) {
    event.preventDefault();
    
    const nome = document.getElementById('nome').value;
    const cnpj = document.getElementById('cnpj').value;

    if (!nome || !cnpj) {
        mostrarMensagem('Por favor, preencha todos os campos.', 'erro');
        return;
    }

    try {
        const response = await fetch('http://localhost:8080/lojas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nome, cnpj })
        });

        if (response.ok) {
            mostrarMensagem('Loja cadastrada com sucesso!', 'sucesso');
            document.getElementById('nome').value = '';
            document.getElementById('cnpj').value = '';
            carregarLojas();
        } else {
            mostrarMensagem('Erro ao cadastrar a loja.', 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro de conexão com o servidor.', 'erro');
    }
}

async function excluirLoja(id) {
    if (!confirm('Tem certeza que deseja excluir esta loja?')) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:8080/lojas/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            mostrarMensagem('Loja excluída com sucesso!', 'sucesso');
            carregarLojas();
        } else {
            mostrarMensagem('Erro ao excluir a loja.', 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro de conexão com o servidor.', 'erro');
    }
}

function mostrarMensagem(texto, tipo) {
    const mensagem = document.getElementById('mensagem');
    mensagem.textContent = texto;
    mensagem.className = tipo;
    setTimeout(() => {
        mensagem.textContent = '';
        mensagem.className = '';
    }, 3000);
}

// Tornar a função globalmente acessível
window.excluirLoja = excluirLoja; 