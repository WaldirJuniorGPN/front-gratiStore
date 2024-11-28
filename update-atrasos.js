const storeSelect = document.getElementById("store-select");
const weeksContainer = document.getElementById("weeks-container");
const weeks = ["Primeira", "Segunda", "Terceira", "Quarta", "Quinta", "Sexta"];
let employeesData = [];

// Função para carregar as semanas e seus respectivos atendentes
function loadWeeks() {
    weeksContainer.innerHTML = "";

    weeks.forEach((week, index) => {
        const weekSection = document.createElement("div");
        weekSection.className = "week-section";

        const weekHeader = document.createElement("div");
        weekHeader.className = "week-header";
        weekHeader.textContent = `${index + 1}ª Semana`;
        weekSection.appendChild(weekHeader);

        const attendeesList = document.createElement("div");
        attendeesList.className = "attendees-list";

        employeesData.forEach(employee => {
            const attendeeRow = createAttendeeRow(employee, week);
            attendeesList.appendChild(attendeeRow);
        });

        weekSection.appendChild(attendeesList);
        weeksContainer.appendChild(weekSection);
    });
}

// Função para criar a linha de um atendente
function createAttendeeRow(employee, week) {
    const row = document.createElement("div");
    row.className = "attendee-row";

    const label = document.createElement("label");
    label.textContent = employee.nome;
    row.appendChild(label);

    const select = document.createElement("select");
    select.innerHTML = `
        <option value="nao">Não</option>
        <option value="sim">Sim</option>
    `;
    select.value = "nao";
    row.appendChild(select);

    const button = document.createElement("button");
    button.textContent = "Registrar";
    button.addEventListener("click", () => {
        saveAtraso(employee.id, week, select.value, row);
    });
    row.appendChild(button);

    return row;
}

// Função para salvar os dados de atraso
async function saveAtraso(employeeId, week, atraso, row) {
    const data = {
        id: employeeId,
        atraso: atraso.toUpperCase(),
        semana: week.toUpperCase(),
    };

    try {
        const response = await fetch("http://localhost:8080/atendentes/update/atrasos", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        if (response.ok) {
            alert("Atraso registrado com sucesso!");
        } else {
            alert("Erro ao registrar atraso.");
            row.querySelector("select").classList.add("error");
        }
    } catch (error) {
        console.error("Erro ao salvar atraso:", error);
        alert("Erro ao registrar atraso.");
    }
}

// Função para buscar os atendentes de uma loja
async function fetchEmployeesByStore(storeId) {
    try {
        const response = await fetch(`http://localhost:8080/lojas/${storeId}/atendentes`);
        if (response.ok) {
            employeesData = await response.json();
            loadWeeks();
        } else {
            console.error("Erro ao buscar atendentes:", response.status);
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
    }
}

// Evento para carregar os atendentes ao selecionar uma loja
storeSelect.addEventListener("change", () => {
    const storeId = storeSelect.value;
    if (storeId) {
        fetchEmployeesByStore(storeId);
    } else {
        weeksContainer.innerHTML = "";
    }
});

// Carregar a lista de lojas
async function fetchStores() {
    try {
        const response = await fetch("http://localhost:8080/lojas/listar");
        if (response.ok) {
            const stores = await response.json();
            stores.forEach(store => {
                const option = document.createElement("option");
                option.value = store.id;
                option.textContent = store.nome;
                storeSelect.appendChild(option);
            });
        } else {
            console.error("Erro ao buscar lojas:", response.status);
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
    }
}

window.addEventListener("DOMContentLoaded", fetchStores);
