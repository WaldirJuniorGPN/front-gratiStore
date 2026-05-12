exigirRole('MASTER');

function getLojaIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

async function carregarLoja() {
    const id = getLojaIdFromUrl();
    if (!id) return;

    try {
        const loja = await apiGet(`/lojas/${id}`);
        document.getElementById('nome').value = loja.nome;
        document.getElementById('cnpj').value = loja.cnpj;
    } catch (err) {
        console.error('Erro ao carregar dados da loja:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao carregar dados da loja.') : 'Erro de conexão com o servidor.';
        alert(msg);
    }
}

async function atualizarLoja() {
    const id = getLojaIdFromUrl();
    const nome = document.getElementById('nome').value;
    const cnpj = document.getElementById('cnpj').value;

    if (!nome || !cnpj) {
        alert('Por favor, preencha todos os campos.');
        return;
    }

    try {
        await apiPut(`/lojas/${id}`, { nome, cnpj });
        alert('Loja atualizada com sucesso!');
        window.location.href = 'cadastro-loja.html';
    } catch (err) {
        console.error('Erro ao atualizar a loja:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao atualizar a loja.') : 'Erro de conexão com o servidor.';
        alert(msg);
    }
}

document.addEventListener('DOMContentLoaded', carregarLoja);
