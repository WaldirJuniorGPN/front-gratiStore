exigirRole('MASTER');

const state = {
    page: 0,
    size: 20,
    totalPages: 1,
    totalElements: 0,
    editingId: null,
    lojas: []
};

function mostrarMensagem(texto, tipo = 'erro', timeout = 4000) {
    const el = document.getElementById('mensagem');
    el.textContent = texto;
    el.className = `mensagem ${tipo}`;
    el.hidden = false;
    if (timeout) setTimeout(() => { el.hidden = true; el.className = 'mensagem'; }, timeout);
}

function setErroFormulario(texto) {
    const erro = document.getElementById('erroFormulario');
    if (texto) {
        erro.textContent = texto;
        erro.hidden = false;
    } else {
        erro.hidden = true;
        erro.textContent = '';
    }
}

async function carregarLojas() {
    try {
        state.lojas = await apiGet('/lojas/listar');
        const select = document.getElementById('lojaId');
        state.lojas.forEach((loja) => {
            const opt = document.createElement('option');
            opt.value = loja.id;
            opt.textContent = loja.nome;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Erro ao carregar lojas:', err);
    }
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderTags(d) {
    const tags = [];
    if (d.receberResumoSemanal) tags.push('<span class="tag tag-resumo">Resumo semanal</span>');
    if (d.receberAlertaUrgente) tags.push('<span class="tag tag-alerta">Alerta urgente</span>');
    return `<div class="tags">${tags.join('') || '<span class="tag tag-loja">Nenhum</span>'}</div>`;
}

function renderLoja(d) {
    if (d.lojaNome) {
        return `<span class="tag tag-loja">${escapeHtml(d.lojaNome)}</span>`;
    }
    return `<span class="tag tag-loja">Todas as lojas</span>`;
}

function renderLista(content) {
    const tbody = document.getElementById('corpoLista');
    if (!content || content.length === 0) {
        tbody.innerHTML = `<tr class="row-empty"><td colspan="5">Nenhum destinatário cadastrado ainda.</td></tr>`;
        return;
    }
    tbody.innerHTML = content.map(d => `
        <tr data-id="${d.id}" class="${state.editingId === d.id ? 'editing' : ''}">
            <td data-label="Nome" class="cell-name">${escapeHtml(d.nome)}</td>
            <td data-label="E-mail" class="cell-email">${escapeHtml(d.email)}</td>
            <td data-label="Loja">${renderLoja(d)}</td>
            <td data-label="Notificações">${renderTags(d)}</td>
            <td data-label="Ações">
                <div class="acoes-row">
                    <button class="btn-row" data-editar="${d.id}" data-requer-role="MASTER">Editar</button>
                    <button class="btn-row danger" data-excluir="${d.id}" data-requer-role="MASTER">Excluir</button>
                </div>
            </td>
        </tr>`).join('');

    tbody.querySelectorAll('[data-editar]').forEach(btn => {
        btn.addEventListener('click', () => editarDestinatario(parseInt(btn.dataset.editar, 10)));
    });
    tbody.querySelectorAll('[data-excluir]').forEach(btn => {
        btn.addEventListener('click', () => excluirDestinatario(parseInt(btn.dataset.excluir, 10)));
    });
}

function atualizarPaginacao() {
    document.getElementById('btnAnterior').disabled = state.page <= 0;
    document.getElementById('btnProximo').disabled = state.page >= state.totalPages - 1;
    document.getElementById('paginaAtual').textContent =
        `Página ${state.page + 1} de ${Math.max(state.totalPages, 1)}`;

    const info = document.getElementById('footerInfo');
    if (state.totalElements === 0) {
        info.textContent = 'Nenhum resultado encontrado.';
    } else {
        const inicio = state.page * state.size + 1;
        const fim = Math.min((state.page + 1) * state.size, state.totalElements);
        info.textContent = `Exibindo ${inicio}–${fim} de ${state.totalElements} destinatário(s).`;
    }

    const total = state.totalElements;
    document.getElementById('contagemTotal').textContent =
        total === 0 ? 'Nenhum destinatário ativo' :
        total === 1 ? '1 destinatário ativo' : `${total} destinatários ativos`;
}

async function carregarLista() {
    document.getElementById('corpoLista').innerHTML =
        `<tr class="row-loading"><td colspan="5">Carregando destinatários...</td></tr>`;
    try {
        const data = await apiGet(`/notificacoes/destinatarios?page=${state.page}&size=${state.size}&sort=nome,asc`);
        state.totalPages = data.totalPages || 1;
        state.totalElements = data.totalElements || 0;
        renderLista(data.content || []);
        atualizarPaginacao();
    } catch (err) {
        console.error('Erro ao carregar destinatários:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao carregar destinatários.') : 'Não foi possível conectar ao servidor.';
        mostrarMensagem(msg, 'erro');
    }
}

function entrarModoEdicao(d) {
    state.editingId = d.id;
    document.getElementById('formTitulo').textContent = 'Editar destinatário';
    document.getElementById('formSubtitulo').textContent = `Atualize os dados de ${d.nome}.`;
    document.getElementById('btnSalvar').textContent = 'Salvar alterações';
    document.getElementById('btnLimpar').hidden = false;

    document.getElementById('destinatarioId').value = d.id;
    document.getElementById('nome').value = d.nome || '';
    document.getElementById('email').value = d.email || '';
    document.getElementById('lojaId').value = d.lojaId ?? '';
    document.getElementById('receberResumoSemanal').checked = !!d.receberResumoSemanal;
    document.getElementById('receberAlertaUrgente').checked = !!d.receberAlertaUrgente;
    setErroFormulario(null);

    document.getElementById('formDestinatario').scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('#corpoLista tr').forEach(tr => {
        tr.classList.toggle('editing', String(tr.dataset.id) === String(d.id));
    });
}

function sairModoEdicao() {
    state.editingId = null;
    document.getElementById('formTitulo').textContent = 'Novo destinatário';
    document.getElementById('formSubtitulo').textContent = 'Preencha os campos abaixo para cadastrar um novo destinatário.';
    document.getElementById('btnSalvar').textContent = 'Cadastrar destinatário';
    document.getElementById('btnLimpar').hidden = true;
    document.getElementById('formDestinatario').reset();
    document.getElementById('destinatarioId').value = '';
    document.getElementById('receberResumoSemanal').checked = true;
    document.getElementById('receberAlertaUrgente').checked = true;
    setErroFormulario(null);
    document.querySelectorAll('#corpoLista tr.editing').forEach(tr => tr.classList.remove('editing'));
}

async function editarDestinatario(id) {
    try {
        const data = await apiGet(`/notificacoes/destinatarios/${id}`);
        entrarModoEdicao(data);
    } catch (err) {
        console.error('Erro ao carregar destinatário:', err);
        const msg = err instanceof ApiError ? (err.message || 'Não foi possível carregar o destinatário.') : 'Não foi possível conectar ao servidor.';
        mostrarMensagem(msg, 'erro');
    }
}

async function excluirDestinatario(id) {
    if (!confirm('Desativar este destinatário? Ele deixará de receber notificações.')) return;
    try {
        await apiDelete(`/notificacoes/destinatarios/${id}`);
        mostrarMensagem('Destinatário desativado com sucesso.', 'sucesso', 3500);
        if (state.editingId === id) sairModoEdicao();
        await carregarLista();
    } catch (err) {
        console.error('Erro ao desativar destinatário:', err);
        const msg = err instanceof ApiError ? (err.message || 'Não foi possível desativar o destinatário.') : 'Não foi possível conectar ao servidor.';
        mostrarMensagem(msg, 'erro');
    }
}

function montarPayload() {
    const lojaIdRaw = document.getElementById('lojaId').value;
    return {
        nome: document.getElementById('nome').value.trim(),
        email: document.getElementById('email').value.trim().toLowerCase(),
        receberResumoSemanal: document.getElementById('receberResumoSemanal').checked,
        receberAlertaUrgente: document.getElementById('receberAlertaUrgente').checked,
        lojaId: lojaIdRaw ? parseInt(lojaIdRaw, 10) : null
    };
}

function validar(payload) {
    if (!payload.nome) return 'Informe o nome do destinatário.';
    if (!payload.email) return 'Informe o e-mail do destinatário.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) return 'Informe um e-mail válido.';
    if (!payload.receberResumoSemanal && !payload.receberAlertaUrgente) {
        return 'Habilite ao menos um tipo de notificação (resumo semanal ou alerta urgente).';
    }
    return null;
}

async function salvarFormulario(event) {
    event.preventDefault();
    setErroFormulario(null);

    const payload = montarPayload();
    const erro = validar(payload);
    if (erro) {
        setErroFormulario(erro);
        return;
    }

    const id = state.editingId;

    const botao = document.getElementById('btnSalvar');
    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    try {
        if (id) {
            await apiPut(`/notificacoes/destinatarios/${id}`, payload);
        } else {
            await apiPost('/notificacoes/destinatarios', payload);
        }
        const sucesso = id ? 'Destinatário atualizado com sucesso!' : 'Destinatário cadastrado com sucesso!';
        sairModoEdicao();
        mostrarMensagem(sucesso, 'sucesso', 3500);
        await carregarLista();
    } catch (err) {
        console.error('Erro ao salvar destinatário:', err);
        const msg = err instanceof ApiError ? (err.message || 'Erro ao salvar destinatário.') : 'Não foi possível conectar ao servidor.';
        setErroFormulario(msg);
    } finally {
        botao.disabled = false;
        botao.textContent = textoOriginal;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    carregarLojas();
    carregarLista();

    document.getElementById('formDestinatario').addEventListener('submit', salvarFormulario);
    document.getElementById('btnLimpar').addEventListener('click', sairModoEdicao);

    document.getElementById('pageSize').addEventListener('change', (e) => {
        state.size = parseInt(e.target.value, 10) || 20;
        state.page = 0;
        carregarLista();
    });

    document.getElementById('btnAnterior').addEventListener('click', () => {
        if (state.page > 0) { state.page--; carregarLista(); }
    });
    document.getElementById('btnProximo').addEventListener('click', () => {
        if (state.page < state.totalPages - 1) { state.page++; carregarLista(); }
    });
});
