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

function formatarDuracao(duracao) {
    if (duracao === null || duracao === undefined || duracao === '') {
        return '';
    }

    const numeric = Number(duracao);
    if (!Number.isNaN(numeric)) {
        const sign = numeric < 0 ? '-' : '';
        const totalMinutes = Math.floor(Math.abs(numeric) / 60000000000);
        const horas = Math.floor(totalMinutes / 60);
        const minutos = totalMinutes % 60;
        return `${sign}${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
    }

    if (typeof duracao === 'string') {
        const trimmed = duracao.trim();
        const neg = trimmed.startsWith('-');
        const match = trimmed.replace(/^-/, '').match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
        if (match) {
            const horas = parseInt(match[1] || '0', 10);
            const minutos = parseInt(match[2] || '0', 10);
            const sign = neg ? '-' : '';
            return `${sign}${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
        }
    }

    return duracao;
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

    const params = new URLSearchParams({
        mes: filtro.mes,
        ano: filtro.ano,
        lojaId: filtro.lojaId
    });

    try {
        const resp = await fetch(`${API_BASE_URL}/horas-extras?${params.toString()}`, {
            method: 'GET'
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
        nomeTd.textContent = item.nomeAtendente || item.nome || item.atendente || '';

        const horasTd = document.createElement('td');
        const duracao = item.totalHorasExtras || item.horasExtras || item.horas;
        horasTd.textContent = formatarDuracao(duracao);

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
