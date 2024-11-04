const employeesContainer = document.getElementById("employees");
const prevButton = document.getElementById("prev-button");
const nextButton = document.getElementById("next-button");
const currentPageSpan = document.getElementById("current-page");

let currentPage = 1;
const employeesPerPage = 4;
let employeesData = []; // Dados dos funcionários serão carregados aqui

// Função para criar a estrutura de um funcionário
function createEmployeeCard(employeeName) {
    const employeeCard = document.createElement("div");
    employeeCard.className = "employee";

    const nameHeader = document.createElement("h3");
    nameHeader.textContent = employeeName;
    employeeCard.appendChild(nameHeader);

    for (let i = 1; i <= 6; i++) {
        const weekDiv = document.createElement("div");
        weekDiv.className = "week";

        const weekLabel = document.createElement("label");
        weekLabel.textContent = `${i}ª Semana`;
        weekDiv.appendChild(weekLabel);

        const vendasInput = document.createElement("input");
        vendasInput.type = "number";
        vendasInput.placeholder = "Vendas";
        weekDiv.appendChild(vendasInput);

        const atendimentosInput = document.createElement("input");
        atendimentosInput.type = "number";
        atendimentosInput.placeholder = "Quantidade de atendimentos";
        weekDiv.appendChild(atendimentosInput);

        // Adicionando rótulo e seletor para "Atraso"
        const atrasoLabel = document.createElement("label");
        atrasoLabel.textContent = "Atrasou:";
        atrasoLabel.style.fontWeight = "bold"; // Destacar o rótulo para maior clareza
        weekDiv.appendChild(atrasoLabel);

        const atrasoSelect = document.createElement("select");
        const optionNao = document.createElement("option");
        optionNao.value = "nao";
        optionNao.textContent = "Não";
        atrasoSelect.appendChild(optionNao);
        
        const optionSim = document.createElement("option");
        optionSim.value = "sim";
        optionSim.textContent = "Sim";
        atrasoSelect.appendChild(optionSim);

        atrasoSelect.value = "nao"; // Define "Não" como a opção padrão
        weekDiv.appendChild(atrasoSelect);

        employeeCard.appendChild(weekDiv);
    }

    const saveButtonContainer = document.createElement("div");
    saveButtonContainer.className = "save-button";
    const saveButton = document.createElement("button");
    saveButton.textContent = "Salvar";
    saveButtonContainer.appendChild(saveButton);
    employeeCard.appendChild(saveButtonContainer);

    return employeeCard;
}

// Função para carregar os funcionários na página atual
function loadEmployees() {
    employeesContainer.innerHTML = "";
    const start = (currentPage - 1) * employeesPerPage;
    const end = start + employeesPerPage;
    const employeesToShow = employeesData.slice(start, end);

    employeesToShow.forEach(employee => {
        const employeeCard = createEmployeeCard(employee);
        employeesContainer.appendChild(employeeCard);
    });

    currentPageSpan.textContent = currentPage;
}

// Função para mudar para a próxima página
function goToNextPage() {
    if (currentPage * employeesPerPage < employeesData.length) {
        currentPage++;
        loadEmployees();
    }
}

// Função para mudar para a página anterior
function goToPreviousPage() {
    if (currentPage > 1) {
        currentPage--;
        loadEmployees();
    }
}

// Eventos para os botões de navegação
nextButton.addEventListener("click", goToNextPage);
prevButton.addEventListener("click", goToPreviousPage);

// Exemplo de dados dos funcionários
employeesData = [
    "Atendente 1",
    "Atendente 2",
    "Atendente 3",
    "Atendente 4",
    "Atendente 5",
    "Atendente 6",
    "Atendente 7"
];

// Carregar a primeira página de funcionários
loadEmployees();
