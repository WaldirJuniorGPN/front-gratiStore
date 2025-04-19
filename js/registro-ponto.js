document.addEventListener('DOMContentLoaded', () => {
    const monthYearInput = document.getElementById('month-year');
    const pontoTbody = document.getElementById('ponto-tbody');
    
    // Set default value to current month
    const today = new Date();
    monthYearInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    // Update table when month changes
    monthYearInput.addEventListener('change', generateTable);
    
    // Initial table generation
    generateTable();
    
    function generateTable() {
        const [year, month] = monthYearInput.value.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        
        pontoTbody.innerHTML = '';
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dayOfWeek = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            
            const row = document.createElement('tr');
            if (isWeekend) row.classList.add('weekend');
            
            const formattedDate = date.toLocaleDateString('pt-BR');
            
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${dayOfWeek}</td>
                <td><input type="text" class="time-input" maxlength="4" ${isWeekend ? 'disabled' : ''} data-type="entrada"></td>
                <td><input type="text" class="time-input" maxlength="4" ${isWeekend ? 'disabled' : ''} data-type="inicioAlmoco"></td>
                <td><input type="text" class="time-input" maxlength="4" ${isWeekend ? 'disabled' : ''} data-type="fimAlmoco"></td>
                <td><input type="text" class="time-input" maxlength="4" ${isWeekend ? 'disabled' : ''} data-type="saida"></td>
                <td class="actions">
                    <button class="btn-save" ${isWeekend ? 'disabled' : ''} onclick="savePonto(this)">Salvar</button>
                </td>
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
});

async function savePonto(button) {
    const row = button.closest('tr');
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
        alert('Por favor, preencha todos os horários corretamente');
        return;
    }
    
    const [day, month, year] = date.split('/');
    
    const pontoData = {
        data: `${year}-${month}-${day}`,
        entrada: timeValues.entrada,
        inicioAlmoco: timeValues.inicioAlmoco,
        fimAlmoco: timeValues.fimAlmoco,
        saida: timeValues.saida,
        atendenteId: "1" // Você deve substituir isso pelo ID do atendente logado
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
            button.textContent = 'Salvo';
            button.disabled = true;
            inputs.forEach(input => input.disabled = true);
        } else {
            const error = await response.json();
            alert(`Erro ao salvar: ${error.message}`);
        }
    } catch (error) {
        alert('Erro ao salvar o ponto. Por favor, tente novamente.');
        console.error('Erro:', error);
    }
} 