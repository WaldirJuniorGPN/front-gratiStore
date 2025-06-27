const API_BASE_URL = 'http://localhost:8080';

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

async function carregarLojas() {
    try {
        const resp = await fetch(`${API_BASE_URL}/lojas/listar`);
        if (resp.ok) {
            const lojas = await resp.json();
            lojas.forEach(loja => {
                const opt = document.createElement('option');
                opt.value = loja.id;
                opt.textContent = loja.nome;
                lojaSelect.appendChild(opt);
            });
        }
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
        const resp = await fetch(`${API_BASE_URL}/horas-extras/calcular`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filtro)
        });
        if (resp.ok) {
            mensagemDiv.textContent = 'Cálculo realizado com sucesso!';
            await buscarResultados();
        } else {
            mensagemDiv.textContent = 'Erro ao calcular horas extras.';
        }
    } catch (err) {
        console.error('Erro ao calcular horas extras:', err);
        mensagemDiv.textContent = 'Erro ao calcular horas extras.';
    }
}

async function buscarResultados() {
    const filtro = obterFiltro();
    if (!filtro) {
        alert('Preencha mês/ano e loja.');
        return;
    }
    try {
        const resp = await fetch(`${API_BASE_URL}/horas-extras`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filtro)
        });
        if (resp.ok) {
            const resultados = await resp.json();
            renderizarTabela(resultados);
        } else {
            mensagemDiv.textContent = 'Erro ao buscar resultados.';
        }
    } catch (err) {
        console.error('Erro ao buscar resultados:', err);
        mensagemDiv.textContent = 'Erro ao buscar resultados.';
    }
}

function renderizarTabela(dados) {
    tabelaBody.innerHTML = '';
    if (!dados || dados.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 3;
        td.textContent = 'Nenhum resultado encontrado';
        tr.appendChild(td);
        tabelaBody.appendChild(tr);
        return;
    }
    dados.forEach(item => {
        const tr = document.createElement('tr');
        const nomeTd = document.createElement('td');
        nomeTd.textContent = item.nome || item.atendente || '';
        const horasTd = document.createElement('td');
        horasTd.textContent = item.horasExtras || item.horas || '';
        const valorTd = document.createElement('td');
        const valor = item.valorAReceber || item.valor || item.total;
        valorTd.textContent = formatarMoeda(valor);
        tr.appendChild(nomeTd);
        tr.appendChild(horasTd);
        tr.appendChild(valorTd);
        tabelaBody.appendChild(tr);
    });
}

calcularBtn.addEventListener('click', calcularHorasExtras);
buscarBtn.addEventListener('click', buscarResultados);

window.addEventListener('DOMContentLoaded', carregarLojas);
