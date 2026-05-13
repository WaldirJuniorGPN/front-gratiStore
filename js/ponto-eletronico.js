const storeSelect = document.getElementById('lojaSelect');
const dateInput = document.getElementById('data');
const attendeesContainer = document.getElementById('atendentesContainer');
const saveButton = document.getElementById('salvarRegistros');

async function carregarLojas() {
    try {
        const lojas = await apiGet('/lojas/listar');
        lojas.forEach((loja) => {
            const option = document.createElement('option');
            option.value = loja.id;
            option.textContent = loja.nome;
            storeSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Erro ao carregar lojas:', err);
    }
}

async function carregarAtendentes(lojaId) {
    attendeesContainer.innerHTML = '';
    if (!lojaId) return;

    try {
        const atendentes = await apiGet(`/lojas/${lojaId}/atendentes`);
        atendentes.forEach((a) => {
            const row = document.createElement('div');
            row.className = 'attendee-row';
            row.dataset.id = a.id;
            row.innerHTML = `
                <label>${a.nome}</label>
                <input type="time" class="entrada">
                <input type="time" class="inicio-almoco">
                <input type="time" class="fim-almoco">
                <input type="time" class="saida">
            `;
            attendeesContainer.appendChild(row);
        });
    } catch (err) {
        console.error('Erro ao carregar atendentes:', err);
    }
}

async function salvarPontos() {
    const data = dateInput.value;
    if (!data) {
        alert('Selecione a data.');
        return;
    }

    const rows = attendeesContainer.querySelectorAll('.attendee-row');
    if (rows.length === 0) {
        alert('Nenhum atendente carregado.');
        return;
    }

    saveButton.disabled = true;
    let sucesso = 0;

    for (const row of rows) {
        const payload = {
            data,
            entrada: row.querySelector('.entrada').value,
            inicioAlmoco: row.querySelector('.inicio-almoco').value,
            fimAlmoco: row.querySelector('.fim-almoco').value,
            saida: row.querySelector('.saida').value,
            atendenteId: parseInt(row.dataset.id, 10)
        };

        if (!payload.entrada || !payload.inicioAlmoco || !payload.fimAlmoco || !payload.saida) {
            continue;
        }

        try {
            await apiPost('/ponto', payload);
            row.classList.add('success');
            sucesso++;
        } catch (err) {
            console.error('Erro ao registrar ponto:', err);
        }
    }

    saveButton.disabled = false;
    alert(`Registros salvos: ${sucesso}`);
}

storeSelect.addEventListener('change', (e) => carregarAtendentes(e.target.value));
saveButton.addEventListener('click', salvarPontos);

document.addEventListener('DOMContentLoaded', carregarLojas);
