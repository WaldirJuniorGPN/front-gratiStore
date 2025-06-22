const API_BASE_URL = 'http://localhost:8080';

const form = document.getElementById('formPonto');
const monthInput = document.getElementById('mes');
const tbody = document.getElementById('historicoBody');
const storeSelect = document.getElementById('lojaSelect');
const attendeeSelect = document.getElementById('atendenteSelect');

async function carregarLojas() {
    try {
        const response = await fetch(`${API_BASE_URL}/lojas/listar`);
        if (response.ok) {
            const lojas = await response.json();
            storeSelect.innerHTML = '<option value="">Selecione</option>';
            lojas.forEach(loja => {
                const option = document.createElement('option');
                option.value = loja.id;
                option.textContent = loja.nome;
                storeSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar lojas:', error);
    }
}

async function carregarAtendentes(lojaId) {
    attendeeSelect.innerHTML = '<option value="">Carregando...</option>';
    attendeeSelect.disabled = true;
    if (!lojaId) {
        attendeeSelect.innerHTML = '<option value="">Selecione uma loja primeiro</option>';
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/lojas/${lojaId}/atendentes`);
        if (response.ok) {
            const atendentes = await response.json();
            attendeeSelect.innerHTML = '<option value="">Selecione</option>';
            atendentes.forEach(a => {
                const option = document.createElement('option');
                option.value = a.id;
                option.textContent = a.nome;
                attendeeSelect.appendChild(option);
            });
            attendeeSelect.disabled = false;
        } else {
            attendeeSelect.innerHTML = '<option value="">Nenhum atendente encontrado</option>';
        }
    } catch (error) {
        console.error('Erro ao carregar atendentes:', error);
        attendeeSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

async function carregarHistorico() {
    tbody.innerHTML = '';
    try {
        const response = await fetch(`${API_BASE_URL}/ponto?size=1000`);
        if (response.ok) {
            const result = await response.json();
            const registros = result.content || result;
            const filtroMes = monthInput.value;
            const atendenteId = attendeeSelect.value;

            registros
                .filter(r => {
                    if (atendenteId && r.atendenteId != atendenteId) return false;
                    if (!filtroMes) return true;
                    return r.data && r.data.startsWith(filtroMes);
                })
                .forEach(r => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${r.data || ''}</td>
                        <td>${r.entrada || ''}</td>
                        <td>${r.inicioAlmoco || ''}</td>
                        <td>${r.fimAlmoco || ''}</td>
                        <td>${r.saida || ''}</td>
                        <td>${r.atendenteId || ''}</td>
                    `;
                    tbody.appendChild(tr);
                });
        }
    } catch (error) {
        console.error('Erro ao carregar historico:', error);
    }
}

async function registrarPonto(event) {
    event.preventDefault();
    const atendenteId = attendeeSelect.value;
    if (!atendenteId) {
        alert('Selecione o atendente.');
        return;
    }
    const payload = {
        data: document.getElementById('data').value,
        entrada: document.getElementById('entrada').value,
        inicioAlmoco: document.getElementById('inicioAlmoco').value,
        fimAlmoco: document.getElementById('fimAlmoco').value,
        saida: document.getElementById('saida').value,
        atendenteId: parseInt(atendenteId)
    };

    try {
        const response = await fetch(`${API_BASE_URL}/ponto`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            alert('Ponto registrado com sucesso!');
            form.reset();
            carregarHistorico();
        } else {
            alert('Erro ao registrar ponto.');
        }
    } catch (error) {
        console.error('Erro ao registrar ponto:', error);
        alert('Erro ao registrar ponto.');
    }
}

form.addEventListener('submit', registrarPonto);
monthInput.addEventListener('change', carregarHistorico);
storeSelect.addEventListener('change', event => {
    carregarAtendentes(event.target.value);
    tbody.innerHTML = '';
});
attendeeSelect.addEventListener('change', carregarHistorico);

document.addEventListener('DOMContentLoaded', () => {
    const now = new Date();
    monthInput.value = now.toISOString().slice(0,7);
    carregarLojas();
});
