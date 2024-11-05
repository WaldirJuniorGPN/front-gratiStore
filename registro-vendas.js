const employeesContainer = document.getElementById("employees");
const leftArrow = document.getElementById("left-arrow");
const rightArrow = document.getElementById("right-arrow");
const storeSelect = document.getElementById("store-select");

let visibleWeeks = [1, 2, 3, 4]; // Semanas visíveis por padrão
let employeesData = []; // Dados dos funcionários serão carregados dinamicamente
const totalWeeks = 6;

// Função para criar a estrutura de um funcionário com semanas dinâmicas
function createEmployeeCard(employee, weeksToShow) {
    const employeeCard = document.createElement("div");
    employeeCard.className = "employee";
    employeeCard.setAttribute("data-id", employee.id);

    const nameHeader = document.createElement("h3");
    nameHeader.textContent = employee.nome;
    employeeCard.appendChild(nameHeader);

    const weeksContainer = document.createElement("div");
    weeksContainer.className = "weeks-container";

    weeksToShow.forEach(week => {
        const weekDiv = document.createElement("div");
        weekDiv.className = "week";

        const weekLabel = document.createElement("label");
        weekLabel.textContent = `${week}ª Semana`;
        weekDiv.appendChild(weekLabel);

        // Input para vendas
        const vendasInput = document.createElement("input");
        vendasInput.type = "number";
        vendasInput.placeholder = "Vendas";
        vendasInput.value = employee[`vendasSemana${week}`] || ""; // Carrega valor salvo ou vazio
        vendasInput.addEventListener("input", () => {
            employee[`vendasSemana${week}`] = vendasInput.value;
        });
        weekDiv.appendChild(vendasInput);

        // Input para atendimentos
        const atendimentosInput = document.createElement("input");
        atendimentosInput.type = "number";
        atendimentosInput.placeholder = "Atendimentos";
        atendimentosInput.value = employee[`atendimentosSemana${week}`] || ""; // Carrega valor salvo ou vazio
        atendimentosInput.addEventListener("input", () => {
            employee[`atendimentosSemana${week}`] = atendimentosInput.value;
        });
        weekDiv.appendChild(atendimentosInput);

        // Select para atraso
        const atrasoLabel = document.createElement("label");
        atrasoLabel.textContent = "Atrasou:";
        atrasoLabel.style.fontWeight = "bold";
        weekDiv.appendChild(atrasoLabel);

        const atrasoSelect = document.createElement("select");
        atrasoSelect.innerHTML = `
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
        `;
        atrasoSelect.value = employee[`atrasoSemana${week}`] || "nao"; // Carrega valor salvo ou "não" por padrão
        atrasoSelect.addEventListener("change", () => {
            employee[`atrasoSemana${week}`] = atrasoSelect.value;
        });
        weekDiv.appendChild(atrasoSelect);

        weeksContainer.appendChild(weekDiv);
    });

    employeeCard.appendChild(weeksContainer);

    const saveButtonContainer = document.createElement("div");
    saveButtonContainer.className = "save-button";
    const saveButton = document.createElement("button");
    saveButton.textContent = "Salvar";
    saveButton.addEventListener("click", () => saveEmployeeData(employee));
    saveButtonContainer.appendChild(saveButton);
    employeeCard.appendChild(saveButtonContainer);

    return employeeCard;
}

// Função para carregar os funcionários com as semanas visíveis
function loadEmployees() {
    employeesContainer.innerHTML = "";

    employeesData.forEach(employee => {
        const employeeCard = createEmployeeCard(employee, visibleWeeks);
        employeesContainer.appendChild(employeeCard);
    });
}

// Função para salvar os dados do atendente
async function saveEmployeeData(employee) {
    const data = {
        vendasPrimeiraSemana: parseFloat(employee.vendasSemana1.replace(",", ".")) || 0.00,
        atrasoPrimeiraSemana: employee.atrasoSemana1 || "nao",
        vendasSegundaSemana: parseFloat(employee.vendasSemana2.replace(",", ".")) || 0.00,
        atrasoSegundaSemana: employee.atrasoSemana2 || "nao",
        vendasTerceiraSemana: parseFloat(employee.vendasSemana3.replace(",", ".")) || 0.00,
        atrasoTerceiraSemana: employee.atrasoSemana3 || "nao",
        vendasQuartaSemana: parseFloat(employee.vendasSemana4.replace(",", ".")) || 0.00,
        atrasoQuartaSemana: employee.atrasoSemana4 || "nao",
        vendasQuintaSemana: parseFloat(employee.vendasSemana5.replace(",", ".")) || 0.00,
        atrasoQuintaSemana: employee.atrasoSemana5 || "nao",
        vendasSextaSemana: parseFloat(employee.vendasSemana6.replace(",", ".")) || 0.00,
        atrasoSextaSemana: employee.atrasoSemana6 || "nao",
    };

    try {
        const response = await fetch(`http://localhost:8080/atendentes/${employee.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const employeeCard = document.querySelector(`.employee[data-id="${employee.id}"]`);
            employeeCard.classList.add("success"); // Adiciona a classe 'success' ao retângulo do atendente
        } else {
            console.error("Erro ao salvar dados:", response.status);
            alert("Erro ao salvar os dados.");
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
        alert("Erro ao salvar os dados.");
    }
}

// Função para atualizar a visibilidade das setas
function updateArrows() {
    leftArrow.style.display = visibleWeeks[0] > 1 ? "block" : "none";
    rightArrow.style.display = visibleWeeks[visibleWeeks.length - 1] < totalWeeks ? "block" : "none";
}

// Função para avançar uma semana (oculta a primeira e mostra a próxima)
function goToNextWeek() {
    if (visibleWeeks[visibleWeeks.length - 1] < totalWeeks) {
        visibleWeeks.shift();
        visibleWeeks.push(visibleWeeks[visibleWeeks.length - 1] + 1);
        loadEmployees();
        updateArrows();
    }
}

// Função para retroceder uma semana (oculta a última e mostra a anterior)
function goToPreviousWeek() {
    if (visibleWeeks[0] > 1) {
        visibleWeeks.pop();
        visibleWeeks.unshift(visibleWeeks[0] - 1);
        loadEmployees();
        updateArrows();
    }
}

// Função para buscar a lista de lojas e preencher o dropdown
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

// Função para popular o campo de seleção com as lojas
function populateStoreSelect(stores) {
    stores.forEach(store => {
        const option = document.createElement("option");
        option.value = store.id;
        option.textContent = store.nome;
        storeSelect.appendChild(option);
    });
}

// Função para buscar os atendentes de uma loja específica
async function fetchEmployeesByStore(storeId) {
    try {
        const response = await fetch(`http://localhost:8080/lojas/${storeId}/atendentes`);
        if (response.ok) {
            const employees = await response.json();
            employeesData = employees.map(employee => ({
                ...employee,
                // Inicializa as semanas se ainda não existirem
                vendasSemana1: employee.vendasSemana1 || "",
                vendasSemana2: employee.vendasSemana2 || "",
                vendasSemana3: employee.vendasSemana3 || "",
                vendasSemana4: employee.vendasSemana4 || "",
                vendasSemana5: employee.vendasSemana5 || "",
                vendasSemana6: employee.vendasSemana6 || "",
                atrasoSemana1: employee.atrasoSemana1 || "",
                atrasoSemana2: employee.atrasoSemana2 || "nao",
                atrasoSemana3: employee.atrasoSemana3 || "nao",
                atrasoSemana4: employee.atrasoSemana4 || "nao",
                atrasoSemana5: employee.atrasoSemana5 || "nao",
                atrasoSemana6: employee.atrasoSemana6 || "nao",
            }));
            visibleWeeks = [1, 2, 3, 4];
            loadEmployees();
            updateArrows();
        } else {
            console.error("Erro ao buscar atendentes:", response.status);
            employeesContainer.innerHTML = "<p>Erro ao carregar atendentes.</p>";
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
        employeesContainer.innerHTML = "<p>Erro ao carregar atendentes.</p>";
    }
}

// Evento para detectar a seleção de uma loja e buscar os atendentes
storeSelect.addEventListener("change", () => {
    const selectedStoreId = storeSelect.value;
    if (selectedStoreId) {
        fetchEmployeesByStore(selectedStoreId);
    } else {
        employeesContainer.innerHTML = "";
    }
});

// Eventos para as setas de navegação
rightArrow.addEventListener("click", goToNextWeek);
leftArrow.addEventListener("click", goToPreviousWeek);

// Carregar a lista de lojas ao carregar a página
window.addEventListener("DOMContentLoaded", fetchStores);
