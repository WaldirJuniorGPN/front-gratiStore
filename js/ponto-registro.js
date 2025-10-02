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

function getDaysInMonthGroupedByWeek(mes, ano) {
    const weeks = [];
    const firstDayOfMonth = new Date(ano, mes - 1, 1);
    const lastDayOfMonth = new Date(ano, mes, 0);

    // Ajustar o primeiro dia da semana para domingo (0)
    let currentDay = new Date(firstDayOfMonth);
    currentDay.setDate(currentDay.getDate() - currentDay.getDay()); // Retrocede para o domingo da primeira semana

    while (currentDay <= lastDayOfMonth || currentDay.getDay() !== 0) {
        const week = [];
        for (let i = 0; i < 7; i++) {
            week.push(new Date(currentDay));
            currentDay.setDate(currentDay.getDate() + 1);
        }
        weeks.push(week);
    }
    return weeks;
}

async function carregarHistorico(atendenteId, ano, mes) {
    const registros = [];
    let page = 0;
    while (true) {
        try {
            const resp = await fetch(`${API_BASE_URL}/ponto?page=${page}&size=1000`);
            if (!resp.ok) break;
            const data = await resp.json();
            const lista = data.content || data;
            if (!Array.isArray(lista) || lista.length === 0) break;
            registros.push(...lista);
            if (data.totalPages && page >= data.totalPages - 1) break;
            page++;
        } catch (err) {
            console.error('Erro ao buscar histórico:', err);
            break;
        }
    }
    return registros.filter(r => r.atendenteId === atendenteId && r.data.startsWith(`${ano}-${mes}`));
}

function criarCardDia(dataObj, registro, mesAtual) {
    const card = document.createElement('div');
    card.className = 'dia-card';

    const dataIso = dataObj.toISOString().split('T')[0];
    card.dataset.data = dataIso;

    if (registro && registro.id) {
        card.dataset.id = registro.id;
    }

    const diaSemana = dataObj.toLocaleDateString('pt-BR', { weekday: 'short' });
    const diaFormatado = dataObj.getDate();
    const mesDoDia = dataObj.getMonth() + 1;

    // Adicionar classe para dias fora do mês atual
    if (mesDoDia !== mesAtual) {
        card.classList.add('dia-fora-mes');
    }

    card.innerHTML = `
        <label>${diaFormatado} ${diaSemana}</label>
        <input type="time" class="entrada" value="${registro?.entrada || ''}">
        <input type="time" class="inicio-almoco" value="${registro?.inicioAlmoco || registro?.incioAlmoco || ''}">
        <input type="time" class="fim-almoco" value="${registro?.fimAlmoco || ''}">
        <input type="time" class="saida" value="${registro?.saida || ''}">
        <label class="status-label">Status</label>
        <select class="status">
            <option value="COMUM">Comum</option>
            <option value="FERIADO">Feriado</option>
            <option value="ATESTADO_INTEGRAL">Atestado Integral</option>
            <option value="ATESTADO_MATUTINO">Atestado Matutino</option>
            <option value="ATESTADO_VESPERTINO">Atestado Vespertino</option>
            <option value="FOLGA">Folga</option>
            <option value="FALTA">Falta</n>
            <option value="DESCONTAR_EM_HORAS">Descontar em Horas</option>
        </select>
    `;

    if (registro && registro.id) {
        const actions = document.createElement('div');
        actions.className = 'acoes-ponto';
        actions.innerHTML = `
            <button class="btn-editar">Atualizar</button>
            <button class="btn-excluir">Deletar</button>
        `;
        const [btnAtualizar, btnDeletar] = actions.querySelectorAll('button');
        btnAtualizar.addEventListener('click', () => atualizarPonto(registro.id, card));
        btnDeletar.addEventListener('click', () => deletarPonto(registro.id, card));
        card.appendChild(actions);
    }
    const statusSelect = card.querySelector('.status');
    statusSelect.value = registro?.status || 'COMUM';
    card.classList.toggle('feriado', statusSelect.value === 'FERIADO');
    statusSelect.addEventListener('change', e => {
        card.classList.toggle('feriado', e.target.value === 'FERIADO');
    });
    return card;
}

async function exibirCalendario() {
    calendarioContainer.innerHTML = '';
    const mesAno = mesAnoInput.value;
    const atendenteId = parseInt(atendenteSelect.value);
    if (!mesAno || !atendenteId) return;

    const [anoStr, mesStr] = mesAno.split('-');
    const ano = parseInt(anoStr);
    const mes = parseInt(mesStr);

    const weeks = getDaysInMonthGroupedByWeek(mes, ano);
    const historico = await carregarHistorico(atendenteId, anoStr, mesStr);

    const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const headerRow = document.createElement('div');
    headerRow.className = 'week-header-row';
    diasDaSemana.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = day;
        headerRow.appendChild(dayHeader);
    });
    calendarioContainer.appendChild(headerRow);

    weeks.forEach(week => {
        const weekRow = document.createElement('div');
        weekRow.className = 'week-row';
        week.forEach(day => {
            const dataIso = day.toISOString().split('T')[0];
            const registro = historico.find(h => h.data === dataIso);
            const card = criarCardDia(day, registro, mes);
            weekRow.appendChild(card);
        });
        calendarioContainer.appendChild(weekRow);
    });
}

async function salvarPontos() {
    const cards = calendarioContainer.querySelectorAll('.dia-card:not(.dia-fora-mes)'); // Salvar apenas dias do mês atual
    if (cards.length === 0) {
        alert('Nenhum dia carregado ou selecionado para o mês atual.');
        return;
    }
    salvarButton.disabled = true;
    let sucesso = 0;
    for (const card of cards) {
        const entradaVal = card.querySelector('.entrada').value;
        const inicioVal = card.querySelector('.inicio-almoco').value;
        const fimVal = card.querySelector('.fim-almoco').value;
        const saidaVal = card.querySelector('.saida').value;
        const statusVal = card.querySelector('.status').value;

        const allEmpty = !entradaVal && !inicioVal && !fimVal && !saidaVal;
        if (statusVal === 'COMUM') {
            if (allEmpty) {
                continue; // usuário não interagiu com este dia
            }
            if (!entradaVal || !inicioVal || !fimVal || !saidaVal) {
                // Se for COMUM e horários incompletos, não salva, mas não impede outros
                console.warn(`Horários incompletos para o dia ${card.dataset.data}. Não será salvo.`);
                continue;
            }
        }

        const payload = {
            data: card.dataset.data,
            entrada: entradaVal || null,
            inicioAlmoco: inicioVal || null,
            fimAlmoco: fimVal || null,
            saida: saidaVal || null,
            status: statusVal,
            atendenteId: parseInt(atendenteSelect.value)
        };

        try {
            const resp = await fetch(`${API_BASE_URL}/ponto`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                card.classList.add('success');
                sucesso++;
            } else {
                console.error(`Erro ao salvar ponto para ${card.dataset.data}:`, resp.statusText);
            }
        } catch (err) {
            console.error('Erro ao salvar ponto:', err);
        }
    }
    salvarButton.disabled = false;
    alert(`Registros salvos: ${sucesso}`);
    exibirCalendario(); // Recarregar calendário para refletir as mudanças
}

async function atualizarPonto(id, card) {
    const payload = {
        data: card.dataset.data,
        entrada: card.querySelector('.entrada').value || null,
        inicioAlmoco: card.querySelector('.inicio-almoco').value || null,
        fimAlmoco: card.querySelector('.fim-almoco').value || null,
        saida: card.querySelector('.saida').value || null,
        status: card.querySelector('.status').value,
        atendenteId: parseInt(atendenteSelect.value)
    };
    try {
        const resp = await fetch(`${API_BASE_URL}/ponto/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (resp.ok) {
            alert('Ponto atualizado com sucesso');
            card.classList.add('success');
        } else {
            alert('Erro ao atualizar ponto');
        }
    } catch (err) {
        console.error('Erro ao atualizar ponto:', err);
    }
}

async function deletarPonto(id, card) {
    if (!confirm('Deseja realmente excluir este ponto?')) return;
    try {
        const resp = await fetch(`${API_BASE_URL}/ponto/${id}`, {
            method: 'DELETE'
        });
        if (resp.ok) {
            card.remove();
        } else {
            alert('Erro ao excluir ponto');
        }
    } catch (err) {
        console.error('Erro ao excluir ponto:', err);
    }
}

lojaSelect.addEventListener('change', e => carregarAtendentes(e.target.value));
atendenteSelect.addEventListener('change', exibirCalendario);
mesAnoInput.addEventListener('change', exibirCalendario);
salvarButton.addEventListener('click', salvarPontos);

document.addEventListener('DOMContentLoaded', () => {
    carregarLojas();
    // Definir o mês/ano atual como padrão
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    mesAnoInput.value = `${year}-${month}`;
});

