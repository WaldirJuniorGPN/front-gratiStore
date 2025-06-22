const API_BASE_URL = 'http://localhost:8080';

const form = document.getElementById('formPonto');
const monthInput = document.getElementById('mes');
const tbody = document.getElementById('historicoBody');

async function carregarHistorico() {
    tbody.innerHTML = '';
    try {
        const response = await fetch(`${API_BASE_URL}/ponto?size=1000`);
        if (response.ok) {
            const result = await response.json();
            const registros = result.content || result;
            const filtro = monthInput.value;

            registros
                .filter(r => {
                    if (!filtro) return true;
                    return r.data && r.data.startsWith(filtro);
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
    const payload = {
        data: document.getElementById('data').value,
        entrada: document.getElementById('entrada').value,
        inicioAlmoco: document.getElementById('inicioAlmoco').value,
        fimAlmoco: document.getElementById('fimAlmoco').value,
        saida: document.getElementById('saida').value,
        atendenteId: parseInt(document.getElementById('atendenteId').value)
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

document.addEventListener('DOMContentLoaded', () => {
    const now = new Date();
    monthInput.value = now.toISOString().slice(0,7);
    carregarHistorico();
});
