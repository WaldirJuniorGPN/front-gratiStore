const API_BASE_URL = 'http://localhost:8080';

const mesAnoInput = document.getElementById('mesAnoConsulta');
const lojaSelect = document.getElementById('lojaSelectConsulta');
const atendenteSelect = document.getElementById('atendenteSelectConsulta');
const buscarButton = document.getElementById('buscarPontos');
const tabela = document.getElementById('tabelaPontos');

let registrosCarregados = [];

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

async function carregarHistorico() {
    try {
        const resp = await fetch(`${API_BASE_URL}/ponto?page=0&size=1000`);
        if (resp.ok) {
            const data = await resp.json();
            return data.content || data;
        }
    } catch (err) {
        console.error('Erro ao buscar histórico:', err);
    }
    return [];
}

function renderizarTabela(registros) {
    tabela.innerHTML = '';
    if (registros.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.textContent = 'Nenhum registro encontrado';
        tr.appendChild(td);
        tabela.appendChild(tr);
        return;
    }
    const header = document.createElement('tr');
    header.innerHTML = '<th>Data</th><th>Entrada</th><th>Início Almoço</th><th>Fim Almoço</th><th>Saída</th><th>Feriado?</th><th>Ações</th>';
    tabela.appendChild(header);
    registros.forEach(r => {
        const tr = document.createElement('tr');
        if (r.feriado === 'SIM') {
            tr.classList.add('feriado');
        }
        tr.innerHTML = `
            <td>${r.data}</td>
            <td>${r.entrada || ''}</td>
            <td>${r.inicioAlmoco || ''}</td>
            <td>${r.fimAlmoco || ''}</td>
            <td>${r.saida || ''}</td>
            <td>${r.feriado}</td>
            <td>
                <button class="btn-editar" onclick="editarPonto(${r.id})">Editar</button>
                <button class="btn-excluir" onclick="excluirPonto(${r.id})">Excluir</button>
            </td>
        `;
        tabela.appendChild(tr);
    });
}

async function buscarPontos() {
    const mesAno = mesAnoInput.value;
    const atendenteId = parseInt(atendenteSelect.value);
    if (!mesAno || !atendenteId) {
        alert('Preencha todas as opções.');
        return;
    }
    const [ano, mes] = mesAno.split('-');
    const historico = await carregarHistorico();
    const registros = historico.filter(r => r.atendenteId === atendenteId && r.data.startsWith(`${ano}-${mes}`));
    registrosCarregados = registros;
    renderizarTabela(registros);
}

lojaSelect.addEventListener('change', e => carregarAtendentes(e.target.value));
buscarButton.addEventListener('click', buscarPontos);

document.addEventListener('DOMContentLoaded', carregarLojas);

async function editarPonto(id) {
    const registro = registrosCarregados.find(r => r.id === id);
    if (!registro) return;

    const entrada = prompt('Entrada', registro.entrada || '');
    if (entrada === null) return;
    const inicioAlmoco = prompt('Início do almoço', registro.inicioAlmoco || '');
    if (inicioAlmoco === null) return;
    const fimAlmoco = prompt('Fim do almoço', registro.fimAlmoco || '');
    if (fimAlmoco === null) return;
    const saida = prompt('Saída', registro.saida || '');
    if (saida === null) return;
    const feriado = prompt('Feriado? (SIM/NAO)', registro.feriado || 'NAO');
    if (feriado === null) return;

    const payload = {
        data: registro.data,
        entrada,
        inicioAlmoco,
        fimAlmoco,
        saida,
        feriado,
        atendenteId: registro.atendenteId
    };

    try {
        const resp = await fetch(`${API_BASE_URL}/ponto/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (resp.ok) {
            alert('Registro atualizado com sucesso!');
            buscarPontos();
        } else {
            alert('Erro ao atualizar registro.');
        }
    } catch (err) {
        console.error('Erro ao atualizar ponto:', err);
        alert('Erro ao atualizar ponto.');
    }
}

async function excluirPonto(id) {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;
    try {
        const resp = await fetch(`${API_BASE_URL}/ponto/${id}`, { method: 'DELETE' });
        if (resp.ok) {
            alert('Registro excluído com sucesso!');
            buscarPontos();
        } else {
            alert('Erro ao excluir registro.');
        }
    } catch (err) {
        console.error('Erro ao excluir ponto:', err);
        alert('Erro ao excluir ponto.');
    }
}

window.editarPonto = editarPonto;
window.excluirPonto = excluirPonto;
