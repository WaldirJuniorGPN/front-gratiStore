async function carregarAtendentes(lojaId = null) {
    if (!lojaId) return;

    try {
        const atendentes = await apiGet(`/lojas/${lojaId}/atendentes`);
        exibirListaAtendentes(atendentes);
    } catch (err) {
        console.error('Erro ao carregar a lista de atendentes:', err);
        document.getElementById('listaAtendentes').innerHTML =
            '<p class="erro">Erro ao carregar atendentes. Por favor, tente novamente.</p>';
    }
}

async function exibirListaAtendentes(atendentes) {
    const lista = document.getElementById('listaAtendentes');
    lista.innerHTML = '';

    if (atendentes.length === 0) {
        lista.innerHTML = '<p>Nenhum atendente cadastrado para esta loja.</p>';
        return;
    }

    for (const atendente of atendentes) {
        const item = document.createElement('li');
        const salario = await obterSalario(atendente.id);
        const admissao = formatarDataAdmissao(atendente.dataAdmissao);

        item.innerHTML = `
            <div class="atendente-info">
                <strong>${atendente.nome}</strong>
                <span class="atendente-meta">
                    <span class="salario">${salario !== null ? formatarMoeda(salario) : 'Salário N/A'}</span>
                    ${admissao ? `<span class="admissao">Admissão: ${admissao}</span>` : ''}
                </span>
            </div>
            <div class="acoes-atendente">
                <button class="btn-editar" onclick="window.location.href='atualizar-funcionario.html?id=${atendente.id}'">Editar</button>
                <button class="btn-salario" onclick="window.location.href='update-salario.html?id=${atendente.id}'">Salário</button>
                <button class="btn-ferias" onclick="window.location.href='ferias-atendente.html?id=${atendente.id}'">Férias</button>
                <button class="btn-excluir" onclick="excluirAtendente(${atendente.id})">Excluir</button>
            </div>
        `;
        lista.appendChild(item);
    }
}

function formatarDataAdmissao(iso) {
    if (!iso) return null;
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
}

async function obterSalario(id) {
    try {
        const data = await apiGet(`/atendentes/salario/${id}`);
        return data?.salario ?? null;
    } catch (err) {
        console.error('Erro ao buscar salário:', err);
        return null;
    }
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

async function excluirAtendente(id) {
    if (!confirm('Tem certeza que deseja excluir este atendente?')) return;

    try {
        await apiDelete(`/atendentes/${id}`);
        const filtroLoja = document.getElementById('filtroLoja');
        await carregarAtendentes(filtroLoja.value);
    } catch (err) {
        console.error('Erro ao excluir o atendente:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao excluir o atendente.') : 'Erro de conexão com o servidor.';
        alert(msg);
    }
}

window.excluirAtendente = excluirAtendente;
window.carregarAtendentes = carregarAtendentes;
