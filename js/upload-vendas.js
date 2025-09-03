const storeSelect = document.getElementById("store-select");
const weeksContainer = document.getElementById("weeks-container");
const weeks = ["Primeira", "Segunda", "Terceira", "Quarta", "Quinta", "Sexta"];

// Função para popular a lista de lojas
async function fetchStores() {
    try {
        const response = await fetch("http://localhost:8080/lojas/listar");
        if (response.ok) {
            const stores = await response.json();
            populateStoreSelect(stores);
        } else {
            console.error("Erro ao buscar lojas:", response.status);
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
    }
}

function populateStoreSelect(stores) {
    stores.forEach(store => {
        const option = document.createElement("option");
        option.value = store.id;
        option.textContent = store.nome;
        storeSelect.appendChild(option);
    });
}

// Função para gerar os campos de upload por semana
function generateWeekFields() {
    weeksContainer.innerHTML = "";
    weeks.forEach((week, index) => {
        const weekDiv = document.createElement("div");
        weekDiv.className = "week";

        const label = document.createElement("label");
        label.textContent = `${week} Semana`;
        weekDiv.appendChild(label);

        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept=".xlsx, .xls";
        weekDiv.appendChild(fileInput);

        const button = document.createElement("button");
        button.textContent = "Anexar";
        button.addEventListener("click", () => uploadFile(fileInput, index + 1, weekDiv));
        weekDiv.appendChild(button);

        weeksContainer.appendChild(weekDiv);
    });
}

// Função para realizar o upload
async function uploadFile(fileInput, weekIndex, weekDiv) {
    const storeId = storeSelect.value;
    if (!storeId) {
        alert("Selecione uma loja antes de anexar.");
        return;
    }

    const file = fileInput.files[0];
    if (!file) {
        alert("Selecione um arquivo para anexar.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch(`http://localhost:8080/atendentes/upload/${weeks[weekIndex - 1].toLowerCase()}-semana/${storeId}`, {
            method: "PATCH",
            body: formData
        });

        if (response.ok) {
            weekDiv.classList.add("success");
            const fileName = document.createElement("p");
            fileName.className = "filename";
            fileName.textContent = `Arquivo: ${file.name}`;
            weekDiv.appendChild(fileName);
        } else {
            console.error("Erro ao fazer upload:", response.status);
            alert("Erro ao fazer upload.");
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
        alert("Erro ao fazer upload.");
    }
}

// Função para zerar valores dos atendentes
async function zerarValoresAtendentes() {
    const storeId = storeSelect.value;
    if (!storeId) {
        alert("Selecione uma loja antes de zerar os valores.");
        return;
    }

    try {
        const response = await fetch(`http://localhost:8080/lojas/${storeId}`, {
            method: "PATCH"
        });

        const messageContainer = document.getElementById("message-container");
        messageContainer.innerHTML = "";

        if (response.ok) {
            const successMessage = document.createElement("p");
            successMessage.textContent = "Valores dos atendentes zerados com sucesso!";
            successMessage.className = "success-message";
            messageContainer.appendChild(successMessage);
        } else {
            const errorMessage = document.createElement("p");
            errorMessage.textContent = `Erro ao zerar valores dos atendentes: ${response.status}`;
            errorMessage.className = "error-message";
            messageContainer.appendChild(errorMessage);
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
        const messageContainer = document.getElementById("message-container");
        messageContainer.innerHTML = "";
        const errorMessage = document.createElement("p");
        errorMessage.textContent = "Erro ao zerar valores dos atendentes. Tente novamente mais tarde.";
        errorMessage.className = "error-message";
        messageContainer.appendChild(errorMessage);
    }
}

// Inicializar botão de zerar valores
function initZerarButton() {
    const zerarButton = document.createElement("button");
    zerarButton.textContent = "Zerar Valores dos Atendentes";
    zerarButton.className = "zerar-button";
    zerarButton.addEventListener("click", zerarValoresAtendentes);

    const container = document.querySelector(".store-selection");
    const messageContainer = document.createElement("div");
    messageContainer.id = "message-container";

    container.appendChild(zerarButton);
    container.appendChild(messageContainer);
}

// Chamada inicial
window.addEventListener("DOMContentLoaded", () => {
    fetchStores();
    generateWeekFields();
    initZerarButton();
});
