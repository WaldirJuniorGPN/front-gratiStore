exigirPermissao('horas-extras');

const lojaSelect = document.getElementById('loja-select');
const calcularBtn = document.getElementById('calcular-btn');
const buscarBtn = document.getElementById('buscar-btn');
const tabelaBody = document.querySelector('#tabela-resultados tbody');
const mensagemDiv = document.getElementById('mensagem');

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

function formatarDuracao(isoDuration) {
    if (!isoDuration) return '';
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return isoDuration;
    const horas = parseInt(match[1] || '0', 10);
    const minutos = parseInt(match[2] || '0', 10);
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

function mostrarMensagem(texto, tipo = 'erro', timeout = 4000) {
    if (!mensagemDiv) return;
    mensagemDiv.textContent = texto;
    mensagemDiv.className = `mensagem ${tipo}`;
    mensagemDiv.hidden = false;
    if (timeout) {
        setTimeout(() => {
            mensagemDiv.hidden = true;
            mensagemDiv.className = 'mensagem';
            mensagemDiv.textContent = '';
        }, timeout);
    }
}

async function carregarLojas() {
    try {
        const lojas = await apiGet('/lojas/listar');
        lojas.forEach((loja) => {
            const opt = document.createElement('option');
            opt.value = loja.id;
            opt.textContent = loja.nome;
            lojaSelect.appendChild(opt);
        });
    } catch (err) {
        console.error('Erro ao carregar lojas:', err);
    }
}

function obterFiltro() {
    const mesAno = document.getElementById('mes-ano').value;
    const lojaId = parseInt(lojaSelect.value);
    if (!mesAno || !lojaId) {
        return null;
    }
    const [ano, mes] = mesAno.split('-');
    return { mes: parseInt(mes), ano: parseInt(ano), lojaId };
}

async function calcularHorasExtras() {
    const filtro = obterFiltro();
    if (!filtro) {
        alert('Preencha mês/ano e loja.');
        return;
    }
    try {
        await apiPost('/horas-extras/calcular', filtro);
        mostrarMensagem('Cálculo realizado com sucesso!', 'sucesso');
        await buscarResultados();
    } catch (err) {
        console.error('Erro ao calcular horas extras:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao calcular horas extras.') : 'Erro ao calcular horas extras.';
        mostrarMensagem(msg, 'erro');
    }
}

async function buscarResultados() {
    const filtro = obterFiltro();
    if (!filtro) {
        alert('Preencha mês/ano e loja.');
        return;
    }

    const params = new URLSearchParams({
        mes: filtro.mes,
        ano: filtro.ano,
        lojaId: filtro.lojaId
    });

    try {
        const resultados = await apiGet(`/horas-extras?${params.toString()}`);
        renderizarTabela(resultados);
    } catch (err) {
        console.error('Erro ao buscar resultados:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao buscar resultados.') : 'Erro ao buscar resultados.';
        mostrarMensagem(msg, 'erro');
    }
}

function renderizarTabela(dados) {
    tabelaBody.innerHTML = '';
    if (!dados || dados.length === 0) {
        const tr = document.createElement('tr');
        tr.className = 'row-empty';
        const td = document.createElement('td');
        td.colSpan = 5;
        td.textContent = 'Nenhum resultado encontrado para o período selecionado.';
        tr.appendChild(td);
        tabelaBody.appendChild(tr);
        return;
    }
    dados.forEach(item => {
        const tr = document.createElement('tr');

        const nomeTd = document.createElement('td');
        nomeTd.textContent = item.nomeAtendente || item.nome || item.atendente || '';

        const horas50Td = document.createElement('td');
        const duracao50 = item.totalHorasExtras50PorCento ?? item.totalHorasExtras ?? item.horasExtras50 ?? item.horas50;
        horas50Td.textContent = formatarDuracao(duracao50);

        const valor50Td = document.createElement('td');
        const valor50 = item.valorAReceber50PorCento ?? item.valor50 ?? 0;
        valor50Td.textContent = formatarMoeda(valor50);

        const horas100Td = document.createElement('td');
        const duracao100 = item.totalHorasExtras100PorCento ?? item.horasExtras100 ?? item.horas100;
        horas100Td.textContent = formatarDuracao(duracao100);

        const valor100Td = document.createElement('td');
        const valor100 = item.valorAReceber100PorCento ?? item.valor100 ?? 0;
        valor100Td.textContent = formatarMoeda(valor100);

        tr.appendChild(nomeTd);
        tr.appendChild(horas50Td);
        tr.appendChild(valor50Td);
        tr.appendChild(horas100Td);
        tr.appendChild(valor100Td);

        tabelaBody.appendChild(tr);
    });
}

calcularBtn.addEventListener('click', calcularHorasExtras);
buscarBtn.addEventListener('click', buscarResultados);

window.addEventListener('DOMContentLoaded', carregarLojas);
