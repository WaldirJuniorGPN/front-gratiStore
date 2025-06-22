const API_BASE_URL = 'http://localhost:8080';

const mesAnoInput = document.getElementById('mesAno');
const lojaSelect = document.getElementById('lojaSelect');
const atendenteSelect = document.getElementById('atendenteSelect');
const calendarioContainer = document.getElementById('calendarioContainer');
const salvarButton = document.getElementById('salvarRegistros');

async function carregarLojas() {
    try {
        const resp = await fetch(`${API_BASE_URL}/lojas/listar`);
        if (resp.ok) {
            const lojas = await resp.json();
            lojas.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.id;
                opt.textContent = l.nome;
                lojaSelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Erro ao carregar lojas:', err);
    }
}

async function carregarAtendentes(lojaId) {
    atendenteSelect.innerHTML = '<option value="">Selecione</option>';
    calendarioContainer.innerHTML = '';
    if (!lojaId) return;
    try {
        const resp = await fetch(`${API_BASE_URL}/lojas/${lojaId}/atendentes`);
        if (resp.ok) {
            const atendentes = await resp.json();
            atendentes.forEach(a => {
                const opt = document.createElement('option');
                opt.value = a.id;
                opt.textContent = a.nome;
                atendenteSelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Erro ao carregar atendentes:', err);
    }
}

function gerarDiasDoMes(mes, ano) {
    const dias = [];
    const date = new Date(ano, mes - 1, 1);
    while (date.getMonth() === mes - 1) {
        dias.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return dias;
}

async function carregarHistorico(atendenteId, ano, mes) {
    try {
        const resp = await fetch(`${API_BASE_URL}/ponto?page=0&size=1000`);
        if (resp.ok) {
            const data = await resp.json();
            const lista = data.content || data;
            return lista.filter(r => r.atendenteId === atendenteId && r.data.startsWith(`${ano}-${mes}`));
        }
    } catch (err) {
        console.error('Erro ao buscar histórico:', err);
    }
    return [];
}

function criarCardDia(dataIso, registro) {
    const card = document.createElement('div');
    card.className = 'dia-card';
    card.dataset.data = dataIso;

    const [ano, mes, dia] = dataIso.split('-');
    card.innerHTML = `
        <label class="dia-label">${dia}/${mes}</label>
        <label class="campo-label">Entrada:</label>
        <input type="time" class="entrada" value="${registro?.entrada || ''}">
        <label class="campo-label">Início do Almoço:</label>
        <input type="time" class="inicio-almoco" value="${registro?.inicioAlmoco || ''}">
        <label class="campo-label">Fim do Almoço:</label>
        <input type="time" class="fim-almoco" value="${registro?.fimAlmoco || ''}">
        <label class="campo-label">Saída:</label>
        <input type="time" class="saida" value="${registro?.saida || ''}">
        <label class="feriado-label" title="Dia é feriado?">Feriado?</label>
        <select class="feriado">
            <option value="NAO">Não</option>
            <option value="SIM">Sim</option>
        </select>
    `;
    const feriadoSelect = card.querySelector('.feriado');
    feriadoSelect.value = registro?.feriado || 'NAO';
    if (feriadoSelect.value === 'SIM') card.classList.add('feriado');
    feriadoSelect.addEventListener('change', e => {
        card.classList.toggle('feriado', e.target.value === 'SIM');
    });
    return card;
}

async function exibirCalendario() {
    calendarioContainer.innerHTML = '';
    const mesAno = mesAnoInput.value;
    const atendenteId = parseInt(atendenteSelect.value);
    if (!mesAno || !atendenteId) return;
    const [ano, mes] = mesAno.split('-');
    const dias = gerarDiasDoMes(parseInt(mes), parseInt(ano));
    const historico = await carregarHistorico(atendenteId, ano, mes);
    dias.forEach(d => {
        const dataIso = d.toISOString().split('T')[0];
        const registro = historico.find(h => h.data === dataIso);
        const card = criarCardDia(dataIso, registro);
        calendarioContainer.appendChild(card);
    });
}

async function salvarPontos() {
    const cards = calendarioContainer.querySelectorAll('.dia-card');
    if (cards.length === 0) {
        alert('Nenhum dia carregado.');
        return;
    }
    salvarButton.disabled = true;
    let sucesso = 0;
    for (const card of cards) {
        const payload = {
            data: card.dataset.data,
            entrada: card.querySelector('.entrada').value,
            inicioAlmoco: card.querySelector('.inicio-almoco').value,
            fimAlmoco: card.querySelector('.fim-almoco').value,
            saida: card.querySelector('.saida').value,
            feriado: card.querySelector('.feriado').value,
            atendenteId: parseInt(atendenteSelect.value)
        };
        if (!payload.entrada || !payload.inicioAlmoco || !payload.fimAlmoco || !payload.saida) {
            continue;
        }
        try {
            const resp = await fetch(`${API_BASE_URL}/ponto`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                card.classList.add('success');
                sucesso++;
            }
        } catch (err) {
            console.error('Erro ao salvar ponto:', err);
        }
    }
    salvarButton.disabled = false;
    alert(`Registros salvos: ${sucesso}`);
}

lojaSelect.addEventListener('change', e => carregarAtendentes(e.target.value));
atendenteSelect.addEventListener('change', exibirCalendario);
mesAnoInput.addEventListener('change', exibirCalendario);
salvarButton.addEventListener('click', salvarPontos);

document.addEventListener('DOMContentLoaded', carregarLojas);
