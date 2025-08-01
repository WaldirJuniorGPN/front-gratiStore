const API_BASE_URL = 'http://localhost:8080';

const mesAnoInput = document.getElementById('mesAnoConsulta');
const lojaSelect = document.getElementById('lojaSelectConsulta');
const atendenteSelect = document.getElementById('atendenteSelectConsulta');
const buscarButton = document.getElementById('buscarPontos');
const tabela = document.getElementById('tabelaPontos');

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
    return registros;
}

function renderizarTabela(registros) {
    tabela.innerHTML = '';
    if (registros.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
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
        tr.dataset.id = r.id;
        tr.dataset.atendenteId = r.atendenteId;
        tr.dataset.data = r.data;
        tr.dataset.entrada = r.entrada || '';
        tr.dataset.inicioAlmoco = r.inicioAlmoco || '';
        tr.dataset.fimAlmoco = r.fimAlmoco || '';
        tr.dataset.saida = r.saida || '';
        tr.dataset.feriado = r.feriado;
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
            <td class="acoes-ponto">
                <button class="btn-editar">Atualizar</button>
                <button class="btn-excluir">Deletar</button>
            </td>
        `;
        const [btnEditar, btnExcluir] = tr.querySelectorAll('button');
        btnEditar.addEventListener('click', () => editarLinha(tr));
        btnExcluir.addEventListener('click', () => deletarPonto(r.id, tr));
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
    renderizarTabela(registros);
}

lojaSelect.addEventListener('change', e => carregarAtendentes(e.target.value));
buscarButton.addEventListener('click', buscarPontos);

function editarLinha(tr) {
    const editing = tr.dataset.editing === 'true';
    const btnEditar = tr.querySelector('.btn-editar');
    if (!editing) {
        tr.dataset.editing = 'true';
        const valores = {
            data: tr.dataset.data,
            entrada: tr.dataset.entrada,
            inicioAlmoco: tr.dataset.inicioAlmoco,
            fimAlmoco: tr.dataset.fimAlmoco,
            saida: tr.dataset.saida,
            feriado: tr.dataset.feriado
        };
        tr.cells[0].innerHTML = `<input type="date" class="edit-data" value="${valores.data}">`;
        tr.cells[1].innerHTML = `<input type="time" class="edit-entrada" value="${valores.entrada}">`;
        tr.cells[2].innerHTML = `<input type="time" class="edit-inicio-almoco" value="${valores.inicioAlmoco}">`;
        tr.cells[3].innerHTML = `<input type="time" class="edit-fim-almoco" value="${valores.fimAlmoco}">`;
        tr.cells[4].innerHTML = `<input type="time" class="edit-saida" value="${valores.saida}">`;
        tr.cells[5].innerHTML = `<select class="edit-feriado"><option value="NAO">Não</option><option value="SIM">Sim</option></select>`;
        tr.cells[5].querySelector('select').value = valores.feriado;
        btnEditar.textContent = 'Salvar';
        const btnCancelar = document.createElement('button');
        btnCancelar.textContent = 'Cancelar';
        btnCancelar.className = 'btn-cancelar';
        btnCancelar.style.backgroundColor = '#6c757d';
        btnCancelar.style.color = '#fff';
        btnCancelar.style.border = 'none';
        btnCancelar.style.borderRadius = '4px';
        btnCancelar.style.cursor = 'pointer';
        btnCancelar.style.padding = '6px 12px';
        btnCancelar.addEventListener('click', () => cancelarEdicao(tr));
        tr.querySelector('.acoes-ponto').appendChild(btnCancelar);
    } else {
        atualizarPonto(tr.dataset.id, tr);
    }
}

function cancelarEdicao(tr) {
    tr.dataset.editing = 'false';
    tr.querySelector('.btn-editar').textContent = 'Atualizar';
    const btnCancelar = tr.querySelector('.btn-cancelar');
    if (btnCancelar) btnCancelar.remove();
    tr.cells[0].textContent = tr.dataset.data;
    tr.cells[1].textContent = tr.dataset.entrada;
    tr.cells[2].textContent = tr.dataset.inicioAlmoco;
    tr.cells[3].textContent = tr.dataset.fimAlmoco;
    tr.cells[4].textContent = tr.dataset.saida;
    tr.cells[5].textContent = tr.dataset.feriado;
}

async function atualizarPonto(id, tr) {
    const payload = {
        data: tr.querySelector('.edit-data').value,
        entrada: tr.querySelector('.edit-entrada').value,
        inicioAlmoco: tr.querySelector('.edit-inicio-almoco').value,
        fimAlmoco: tr.querySelector('.edit-fim-almoco').value,
        saida: tr.querySelector('.edit-saida').value,
        feriado: tr.querySelector('.edit-feriado').value,
        atendenteId: parseInt(tr.dataset.atendenteId)
    };
    try {
        const resp = await fetch(`${API_BASE_URL}/ponto/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (resp.ok) {
            tr.dataset.data = payload.data;
            tr.dataset.entrada = payload.entrada;
            tr.dataset.inicioAlmoco = payload.inicioAlmoco;
            tr.dataset.fimAlmoco = payload.fimAlmoco;
            tr.dataset.saida = payload.saida;
            tr.dataset.feriado = payload.feriado;
            tr.cells[0].textContent = payload.data;
            tr.cells[1].textContent = payload.entrada;
            tr.cells[2].textContent = payload.inicioAlmoco;
            tr.cells[3].textContent = payload.fimAlmoco;
            tr.cells[4].textContent = payload.saida;
            tr.cells[5].textContent = payload.feriado;
            tr.classList.toggle('feriado', payload.feriado === 'SIM');
            tr.querySelector('.btn-editar').textContent = 'Atualizar';
            const btnCancelar = tr.querySelector('.btn-cancelar');
            if (btnCancelar) btnCancelar.remove();
            tr.dataset.editing = 'false';
            alert('Ponto atualizado com sucesso');
        } else {
            alert('Erro ao atualizar ponto');
        }
    } catch (err) {
        console.error('Erro ao atualizar ponto:', err);
    }
}

async function deletarPonto(id, tr) {
    if (!confirm('Deseja realmente excluir este ponto?')) return;
    try {
        const resp = await fetch(`${API_BASE_URL}/ponto/${id}`, {
            method: 'DELETE'
        });
        if (resp.ok) {
            tr.remove();
        } else {
            alert('Erro ao excluir ponto');
        }
    } catch (err) {
        console.error('Erro ao excluir ponto:', err);
    }
}

document.addEventListener('DOMContentLoaded', carregarLojas);
