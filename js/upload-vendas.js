exigirPermissao('upload-vendas');

const storeSelect = document.getElementById('store-select');
const weeksContainer = document.getElementById('weeks-container');
const weeks = ['Primeira', 'Segunda', 'Terceira', 'Quarta', 'Quinta', 'Sexta'];

async function fetchStores() {
    try {
        const stores = await apiGet('/lojas/listar');
        populateStoreSelect(stores);
    } catch (err) {
        console.error('Erro ao buscar lojas:', err);
    }
}

function populateStoreSelect(stores) {
    stores.forEach((store) => {
        const option = document.createElement('option');
        option.value = store.id;
        option.textContent = store.nome;
        storeSelect.appendChild(option);
    });
}

function generateWeekFields() {
    weeksContainer.innerHTML = '';
    weeks.forEach((week, index) => {
        const weekDiv = document.createElement('div');
        weekDiv.className = 'week';

        const label = document.createElement('label');
        label.textContent = `${week} Semana`;
        weekDiv.appendChild(label);

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.xlsx, .xls';
        weekDiv.appendChild(fileInput);

        const button = document.createElement('button');
        button.textContent = 'Anexar';
        button.addEventListener('click', () => uploadFile(fileInput, index + 1, weekDiv));
        weekDiv.appendChild(button);

        weeksContainer.appendChild(weekDiv);
    });
}

async function uploadFile(fileInput, weekIndex, weekDiv) {
    const storeId = storeSelect.value;
    if (!storeId) {
        alert('Selecione uma loja antes de anexar.');
        return;
    }

    const file = fileInput.files[0];
    if (!file) {
        alert('Selecione um arquivo para anexar.');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const semanaSlug = `${weeks[weekIndex - 1].toLowerCase()}-semana`;

    try {
        await apiUpload(`/atendentes/upload/${semanaSlug}/${storeId}`, formData);
        weekDiv.classList.add('success');
        const fileName = document.createElement('p');
        fileName.className = 'filename';
        fileName.textContent = `Arquivo: ${file.name}`;
        weekDiv.appendChild(fileName);
    } catch (err) {
        console.error('Erro ao fazer upload:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao fazer upload.') : 'Erro ao fazer upload.';
        alert(msg);
    }
}

async function zerarValoresAtendentes() {
    const storeId = storeSelect.value;
    if (!storeId) {
        alert('Selecione uma loja antes de zerar os valores.');
        return;
    }

    const messageContainer = document.getElementById('message-container');
    messageContainer.innerHTML = '';

    try {
        await apiPatch(`/lojas/${storeId}`);
        const successMessage = document.createElement('p');
        successMessage.textContent = 'Valores dos atendentes zerados com sucesso!';
        successMessage.className = 'success-message';
        messageContainer.appendChild(successMessage);
    } catch (err) {
        console.error('Erro ao zerar valores dos atendentes:', err);
        const errorMessage = document.createElement('p');
        errorMessage.textContent = err instanceof ApiError
            ? `Erro ao zerar valores dos atendentes: ${err.message || err.status}`
            : 'Erro ao zerar valores dos atendentes. Tente novamente mais tarde.';
        errorMessage.className = 'error-message';
        messageContainer.appendChild(errorMessage);
    }
}

function initZerarButton() {
    const zerarButton = document.createElement('button');
    zerarButton.textContent = 'Zerar Valores dos Atendentes';
    zerarButton.className = 'zerar-button';
    zerarButton.setAttribute('data-requer-permissao', 'upload-vendas');
    zerarButton.addEventListener('click', zerarValoresAtendentes);

    const container = document.querySelector('.store-selection');
    const messageContainer = document.createElement('div');
    messageContainer.id = 'message-container';

    container.appendChild(zerarButton);
    container.appendChild(messageContainer);
    aplicarRoleNoDom(container);
}

window.addEventListener('DOMContentLoaded', () => {
    fetchStores();
    generateWeekFields();
    initZerarButton();
});
