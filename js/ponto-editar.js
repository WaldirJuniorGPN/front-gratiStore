const API_BASE_URL = 'http://localhost:8080';

const form = document.getElementById('formEditarPonto');
const dataInput = document.getElementById('data');
const entradaInput = document.getElementById('entrada');
const inicioAlmocoInput = document.getElementById('inicioAlmoco');
const fimAlmocoInput = document.getElementById('fimAlmoco');
const saidaInput = document.getElementById('saida');
const feriadoSelect = document.getElementById('feriado');

const params = new URLSearchParams(window.location.search);
const pontoId = params.get('id');

let atendenteId;

async function carregarPonto() {
    if (!pontoId) {
        alert('Registro não especificado');
        return;
    }
    try {
        const resp = await fetch(`${API_BASE_URL}/ponto/${pontoId}`);
        if (resp.ok) {
            const p = await resp.json();
            dataInput.value = p.data;
            entradaInput.value = p.entrada || '';
            inicioAlmocoInput.value = p.inicioAlmoco || '';
            fimAlmocoInput.value = p.fimAlmoco || '';
            saidaInput.value = p.saida || '';
            feriadoSelect.value = p.feriado || 'NAO';
            atendenteId = p.atendenteId;
        } else {
            alert('Erro ao carregar registro');
        }
    } catch (err) {
        console.error('Erro ao carregar ponto:', err);
        alert('Erro ao carregar registro');
    }
}

async function salvar(event) {
    event.preventDefault();
    const payload = {
        data: dataInput.value,
        entrada: entradaInput.value,
        inicioAlmoco: inicioAlmocoInput.value,
        fimAlmoco: fimAlmocoInput.value,
        saida: saidaInput.value,
        feriado: feriadoSelect.value,
        atendenteId: atendenteId
    };
    try {
        const resp = await fetch(`${API_BASE_URL}/ponto/${pontoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (resp.ok) {
            alert('Ponto atualizado com sucesso!');
            window.location.href = '/html/ponto-consulta.html';
        } else {
            alert('Erro ao atualizar ponto.');
        }
    } catch (err) {
        console.error('Erro ao atualizar ponto:', err);
        alert('Erro ao atualizar ponto.');
    }
}

form.addEventListener('submit', salvar);
window.addEventListener('DOMContentLoaded', carregarPonto);
