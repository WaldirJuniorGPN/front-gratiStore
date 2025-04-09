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

        // Adicionar botões de ação em massa
        const bulkActionsDiv = document.createElement("div");
        bulkActionsDiv.className = "bulk-actions";

        const toggleStatusButton = document.createElement("button");
        toggleStatusButton.textContent = "Alterar Todos para Sim";
        toggleStatusButton.className = "bulk-toggle";
        toggleStatusButton.addEventListener("click", () => {
            const selects = attendeesList.querySelectorAll("select");
            const newValue = toggleStatusButton.textContent.includes("Sim") ? "sim" : "nao";
            selects.forEach(select => select.value = newValue);
            toggleStatusButton.textContent = `Alterar Todos para ${newValue === "sim" ? "Não" : "Sim"}`;
        });

        const bulkRegisterButton = document.createElement("button");
        bulkRegisterButton.textContent = "Registrar Todos";
        bulkRegisterButton.className = "bulk-register";
        bulkRegisterButton.addEventListener("click", async () => {
            const rows = attendeesList.querySelectorAll(".attendee-row");
            let successCount = 0;
            let failCount = 0;

            bulkRegisterButton.disabled = true;
            bulkRegisterButton.textContent = "Registrando...";

            for (const row of rows) {
                const select = row.querySelector("select");
                const employeeId = row.dataset.employeeId;
                
                try {
                    const success = await saveAtraso(employeeId, week, select.value, row, true);
                    if (success) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (error) {
                    failCount++;
                    console.error("Erro ao registrar:", error);
                }
            }

            bulkRegisterButton.disabled = false;
            bulkRegisterButton.textContent = "Registrar Todos";
            
            alert(`Registros concluídos:\nSucesso: ${successCount}\nFalhas: ${failCount}`);
        });

        bulkActionsDiv.appendChild(toggleStatusButton);
        bulkActionsDiv.appendChild(bulkRegisterButton);
        weekHeader.appendChild(bulkActionsDiv);
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
    row.dataset.employeeId = employee.id;  // Adicionar ID do funcionário como data attribute

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
        saveAtraso(employee.id, week, select.value, row, false);
    });
    row.appendChild(button);

    return row;
}

// Função para salvar os dados de atraso
async function saveAtraso(employeeId, week, atraso, row, isBulkOperation = false) {
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
            if (!isBulkOperation) {
                alert("Atraso registrado com sucesso!");
            }
            return true;
        } else {
            if (!isBulkOperation) {
                alert("Erro ao registrar atraso.");
            }
            row.querySelector("select").classList.add("error");
            return false;
        }
    } catch (error) {
        console.error("Erro ao salvar atraso:", error);
        if (!isBulkOperation) {
            alert("Erro ao registrar atraso.");
        }
        return false;
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
