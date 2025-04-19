document.addEventListener('DOMContentLoaded', () => {
    const monthYearInput = document.getElementById('month-year');
    const pontoTbody = document.getElementById('ponto-tbody');
    const bulkRegisterButton = document.getElementById('bulk-register');
    const storeSelect = document.getElementById('store-select');
    const employeeSelect = document.getElementById('employee-select');
    
    let selectedEmployeeId = null;
    
    // Função para mostrar notificações
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Forçar um reflow para reiniciar a animação
        notification.style.display = 'block';
        notification.style.opacity = '1';
        
        // Remover após a animação
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }
    
    // Set default value to current month
    const today = new Date();
    monthYearInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    // Load stores on page load
    fetchStores();
    
    // Event listeners
    storeSelect.addEventListener('change', handleStoreChange);
    employeeSelect.addEventListener('change', handleEmployeeChange);
    monthYearInput.addEventListener('change', generateTable);
    bulkRegisterButton.addEventListener('click', bulkRegister);
    
    // Initial table generation
    generateTable();
    
    async function fetchStores() {
        try {
            const response = await fetch('http://localhost:8080/lojas/listar');
            if (response.ok) {
                const stores = await response.json();
                storeSelect.innerHTML = '<option value="">Selecione uma loja</option>';
                stores.forEach(store => {
                    const option = document.createElement('option');
                    option.value = store.id;
                    option.textContent = store.nome;
                    storeSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar lojas:', error);
        }
    }
    
    async function handleStoreChange() {
        const storeId = storeSelect.value;
        employeeSelect.innerHTML = '<option value="">Selecione um atendente</option>';
        employeeSelect.disabled = true;
        selectedEmployeeId = null;
        
        if (storeId) {
            try {
                const response = await fetch(`http://localhost:8080/lojas/${storeId}/atendentes`);
                if (response.ok) {
                    const employees = await response.json();
                    employees.forEach(employee => {
                        const option = document.createElement('option');
                        option.value = employee.id;
                        option.textContent = employee.nome;
                        employeeSelect.appendChild(option);
                    });
                    employeeSelect.disabled = false;
                }
            } catch (error) {
                console.error('Erro ao carregar atendentes:', error);
            }
        }
    }
    
    function handleEmployeeChange() {
        const oldEmployeeId = selectedEmployeeId;
        selectedEmployeeId = parseInt(employeeSelect.value, 10);
        bulkRegisterButton.disabled = !selectedEmployeeId;
        
        if (oldEmployeeId && selectedEmployeeId && oldEmployeeId !== selectedEmployeeId) {
            // Limpar todos os campos de input quando um novo atendente é selecionado
            const inputs = document.querySelectorAll('.time-input');
            inputs.forEach(input => {
                input.value = '';
                input.disabled = false;
                input.style.borderColor = '#ddd';
            });
            
            // Regenerar a tabela para garantir que está tudo limpo
            generateTable();
            
            // Mostrar notificação
            showNotification('Campos limpos para o novo atendente');
        }
    }
    
    async function bulkRegister() {
        if (!selectedEmployeeId) {
            alert('Por favor, selecione um atendente');
            return;
        }
        
        const rows = pontoTbody.querySelectorAll('tr');
        let successCount = 0;
        let failCount = 0;
        
        bulkRegisterButton.disabled = true;
        bulkRegisterButton.textContent = 'Registrando...';
        
        for (const row of rows) {
            const inputs = row.querySelectorAll('.time-input');
            if (Array.from(inputs).every(input => input.value)) {
                try {
                    await savePonto(row, true);
                    successCount++;
                } catch (error) {
                    failCount++;
                    console.error('Erro ao registrar:', error);
                }
            }
        }
        
        bulkRegisterButton.disabled = false;
        bulkRegisterButton.textContent = 'Registrar Todos';
        
        alert(`Registros concluídos:\nSucesso: ${successCount}\nFalhas: ${failCount}`);
    }
    
    function generateTable() {
        const [year, month] = monthYearInput.value.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        
        pontoTbody.innerHTML = '';
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dayOfWeek = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date);
            const isSunday = date.getDay() === 0;
            
            const row = document.createElement('tr');
            if (isSunday) row.classList.add('sunday');
            
            const formattedDate = date.toLocaleDateString('pt-BR');
            
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${dayOfWeek}</td>
                <td><input type="text" class="time-input" maxlength="4" ${isSunday ? 'disabled' : ''} data-type="entrada"></td>
                <td><input type="text" class="time-input" maxlength="4" ${isSunday ? 'disabled' : ''} data-type="inicioAlmoco"></td>
                <td><input type="text" class="time-input" maxlength="4" ${isSunday ? 'disabled' : ''} data-type="fimAlmoco"></td>
                <td><input type="text" class="time-input" maxlength="4" ${isSunday ? 'disabled' : ''} data-type="saida"></td>
            `;
            
            pontoTbody.appendChild(row);
        }
        
        // Add time input formatting to all time inputs
        document.querySelectorAll('.time-input').forEach(input => {
            input.addEventListener('input', formatTimeInput);
        });
    }
    
    function formatTimeInput(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length >= 3) {
            const hours = value.slice(0, 2);
            const minutes = value.slice(2, 4);
            
            if (parseInt(hours) > 23) value = '23' + minutes;
            if (parseInt(minutes) > 59) value = hours + '59';
            
            if (value.length === 4) {
                value = value.replace(/(\d{2})(\d{2})/, '$1:$2');
            }
        }
        
        e.target.value = value;
    }
    
    async function savePonto(row, isBulkOperation = false) {
        const date = row.cells[0].textContent;
        const inputs = row.querySelectorAll('.time-input');
        
        const timeValues = {};
        let isValid = true;
        
        inputs.forEach(input => {
            const value = input.value;
            if (!value || value.length < 4) {
                isValid = false;
                input.style.borderColor = 'red';
                return;
            }
            
            const [hours, minutes] = value.includes(':') 
                ? value.split(':') 
                : [value.slice(0, 2), value.slice(2)];
                
            timeValues[input.dataset.type] = `${hours}:${minutes}`;
        });
        
        if (!isValid) {
            if (!isBulkOperation) {
                alert('Por favor, preencha todos os horários corretamente');
            }
            throw new Error('Horários inválidos');
        }
        
        const [day, month, year] = date.split('/');
        
        const pontoData = {
            data: `${year}-${month}-${day}`,
            entrada: timeValues.entrada,
            inicioAlmoco: timeValues.inicioAlmoco,
            fimAlmoco: timeValues.fimAlmoco,
            saida: timeValues.saida,
            atendenteId: selectedEmployeeId
        };
        
        try {
            const response = await fetch('http://localhost:8080/ponto', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(pontoData)
            });
            
            if (response.ok) {
                inputs.forEach(input => input.disabled = true);
            } else {
                const error = await response.json();
                if (!isBulkOperation) {
                    alert(`Erro ao salvar: ${error.message}`);
                }
                throw new Error(error.message);
            }
        } catch (error) {
            if (!isBulkOperation) {
                alert('Erro ao salvar o ponto. Por favor, tente novamente.');
            }
            throw error;
        }
    }
}); 