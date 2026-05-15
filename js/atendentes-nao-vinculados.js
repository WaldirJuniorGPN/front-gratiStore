/**
 * Tela 5 — Atendentes não-vinculados (TASK-08).
 *
 * Lista os colaboradores que apareceram na planilha mas não foram casados com
 * nenhum atendente do cadastro. Para cada um, abre um modal de vinculação com
 * autocomplete (combobox + listbox acessível) e checkbox para atualizar o
 * `idRelogioPonto` do atendente.
 *
 * Reforço UX crítico (§9.2 do guia): vincular **não cria pontos retroativos**.
 * O aviso aparece em 3 lugares (banner, modal, toast pós-sucesso) + dispara a
 * marcação cross-cutting "Reimportação pendente" (TASK-10).
 *
 * Como o backend não expõe `GET /atendentes` global, montamos a lista
 * percorrendo todas as lojas em paralelo (mesmo padrão usado por `index.js`).
 *
 * Dependências (carregar antes deste script):
 *  - apiClient.js, importacao-pontos.js (camada API — TASK-01)
 *  - toast.js, importacao-ui.js (UI compartilhada — TASK-02/TASK-10)
 */

exigirRole('MASTER');

// ============================================================================
// State
// ============================================================================

const urlParams = new URLSearchParams(window.location.search);
const relatorioId = parseInt(urlParams.get('id'), 10);

let resolvidoAtivo = false;
let paginaCorrente = 0;
const PAGE_SIZE = 20;
let naoVinculadoSelecionado = null;
let atendentesCache = null;  // lista plana de atendentes com `.nomeLoja`
let atendenteEscolhido = null;
let opcoesAtuais = [];
let opcaoAtivaIdx = -1;

// ============================================================================
// Refs DOM
// ============================================================================

const subtitle = document.getElementById('subtitle');
const linkVoltar = document.getElementById('linkVoltar');
const tabs = Array.from(document.querySelectorAll('.tab'));
const contagemPendentesEl = document.getElementById('contagemPendentes');
const contagemVinculadosEl = document.getElementById('contagemVinculados');

const corpo = document.getElementById('corpo');
const painelLista = document.getElementById('painelLista');
const paginacao = document.getElementById('paginacao');
const paginacaoInfo = document.getElementById('paginacaoInfo');
const paginaAtualEl = document.getElementById('paginaAtual');
const paginaTotalEl = document.getElementById('paginaTotal');
const paginaAnteriorBtn = document.getElementById('paginaAnterior');
const paginaProximaBtn = document.getElementById('paginaProxima');

// Modal Vincular
const modalVincular = document.getElementById('modalVincular');
const formVincular = document.getElementById('formVincular');
const vincNomeBrutoEl = document.getElementById('vincNomeBruto');
const vincIdRelogioBrutoEl = document.getElementById('vincIdRelogioBruto');
const vincDiasEl = document.getElementById('vincDias');
const atendenteBusca = document.getElementById('atendenteBusca');
const atendenteListbox = document.getElementById('atendenteListbox');
const atendenteIdHidden = document.getElementById('atendenteId');
const hintAtendente = document.getElementById('hintAtendente');
const checkboxAtualizarIdRelogio = document.getElementById('atualizarIdRelogio');
const hintAtualizarIdRelogio = document.getElementById('hintAtualizarIdRelogio');
const erroVincularEl = document.getElementById('erroVincular');
const btnConfirmarVincular = document.getElementById('btnConfirmarVincular');

// Modal tudo pronto
const modalTudoPronto = document.getElementById('modalTudoPronto');
const ctaReimportarTudo = document.getElementById('ctaReimportarTudo');

// ============================================================================
// Pré-condição
// ============================================================================

if (!Number.isFinite(relatorioId) || relatorioId <= 0) {
    subtitle.textContent = 'Relatório não informado. Volte e abra o relatório pelo histórico.';
    corpo.innerHTML = '<tr class="row-empty"><td colspan="5">Sem relatório a exibir.</td></tr>';
} else {
    linkVoltar.href = `/html/importacao-detalhes.html?id=${relatorioId}`;
    ctaReimportarTudo.href = `/html/importacao-pontos.html?reimportar=${relatorioId}`;
    inicializar();
}

// ============================================================================
// Inicialização
// ============================================================================

function inicializar() {
    subtitle.textContent = `Relatório #${relatorioId} · colaboradores da planilha que o sistema não conseguiu casar com o cadastro.`;
    ligarTabs();
    ligarPaginacao();
    ligarModalVincular();
    ligarModalTudoPronto();
    ligarEscParaModais();
    carregarAtendentesEmBackground();
    atualizarContadoresAbas();
    recarregarPagina();
}

function ligarTabs() {
    tabs.forEach((tab, idx) => {
        tab.addEventListener('click', () => trocarAba(tab.dataset.resolvido === 'true'));
        tab.addEventListener('keydown', e => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const dir = e.key === 'ArrowRight' ? 1 : -1;
                const proximoIdx = (idx + dir + tabs.length) % tabs.length;
                tabs[proximoIdx].focus();
                trocarAba(tabs[proximoIdx].dataset.resolvido === 'true');
            }
        });
    });
}

function trocarAba(resolvido) {
    if (resolvidoAtivo === resolvido) return;
    resolvidoAtivo = resolvido;
    tabs.forEach(t => {
        const ativa = (t.dataset.resolvido === 'true') === resolvido;
        t.setAttribute('aria-selected', ativa ? 'true' : 'false');
        t.setAttribute('tabindex', ativa ? '0' : '-1');
    });
    paginaCorrente = 0;
    recarregarPagina();
}

function ligarPaginacao() {
    paginaAnteriorBtn.addEventListener('click', () => {
        if (paginaCorrente > 0) {
            paginaCorrente--;
            recarregarPagina();
        }
    });
    paginaProximaBtn.addEventListener('click', () => {
        paginaCorrente++;
        recarregarPagina();
    });
}

// ============================================================================
// Listagem
// ============================================================================

async function recarregarPagina() {
    painelLista.setAttribute('aria-busy', 'true');
    corpo.innerHTML = '<tr class="row-loading"><td colspan="5">Carregando…</td></tr>';
    paginacao.hidden = true;
    try {
        const page = await listarNaoVinculados(relatorioId, {
            resolvido: resolvidoAtivo,
            page: paginaCorrente,
            size: PAGE_SIZE,
            sort: 'qtdDiasComBatida,desc'
        });
        renderizarLinhas(page);
        renderizarPaginacao(page);
        if (resolvidoAtivo) contagemVinculadosEl.textContent = String(page.totalElements);
        else                contagemPendentesEl.textContent = String(page.totalElements);
    } catch (err) {
        if (err instanceof ApiError) {
            mostrarToast(err.message || 'Erro ao carregar não-vinculados.', 'erro');
        } else {
            mostrarToast('Sem conexão com o servidor.', 'erro');
        }
        corpo.innerHTML = '<tr class="row-empty"><td colspan="5">Erro ao carregar. Tente novamente.</td></tr>';
    } finally {
        painelLista.setAttribute('aria-busy', 'false');
    }
}

function renderizarLinhas(page) {
    corpo.innerHTML = '';
    if (!page.content || page.content.length === 0) {
        const mensagem = resolvidoAtivo
            ? 'Nenhum atendente foi vinculado ainda neste relatório.'
            : 'Sem atendentes pendentes — todos os colaboradores foram casados ou vinculados.';
        corpo.innerHTML = `<tr class="row-empty"><td colspan="5">${mensagem}</td></tr>`;
        return;
    }

    page.content.forEach(item => {
        const tr = document.createElement('tr');
        tr.dataset.id = item.id;

        const tdNome = document.createElement('td');
        tdNome.className = 'cell-name';
        tdNome.textContent = item.nomeBruto || '—';

        const tdIdRelogio = document.createElement('td');
        tdIdRelogio.className = 'cell-id-relogio';
        if (item.idRelogioBruto != null) {
            const code = document.createElement('code');
            code.textContent = `#${item.idRelogioBruto}`;
            tdIdRelogio.appendChild(code);
        } else {
            tdIdRelogio.textContent = '—';
            tdIdRelogio.title = 'Planilha não trouxe ID para este colaborador';
        }

        const tdDias = td(String(item.qtdDiasComBatida ?? 0), 'cell-num');

        const tdStatus = document.createElement('td');
        if (item.resolvido) {
            tdStatus.appendChild(criarBadgeStatus('Vinculado', 'badge--sucesso'));
            if (item.atendenteVinculadoId) {
                const small = document.createElement('span');
                small.className = 'cell-muted';
                small.style.marginLeft = '6px';
                small.textContent = `→ #${item.atendenteVinculadoId}`;
                tdStatus.appendChild(small);
            }
        } else {
            tdStatus.appendChild(criarBadgeStatus('Pendente', 'badge--aviso'));
        }

        const tdAcao = document.createElement('td');
        tdAcao.className = 'cell-acao';
        if (!item.resolvido) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-primary btn-sm';
            btn.textContent = 'Vincular';
            btn.addEventListener('click', () => abrirModalVincular(item));
            tdAcao.appendChild(btn);
        }

        tr.appendChild(tdNome);
        tr.appendChild(tdIdRelogio);
        tr.appendChild(tdDias);
        tr.appendChild(tdStatus);
        tr.appendChild(tdAcao);
        corpo.appendChild(tr);
    });
}

function renderizarPaginacao(page) {
    if (page.totalPages <= 1) {
        paginacao.hidden = true;
        return;
    }
    paginacao.hidden = false;
    paginaAtualEl.textContent = String(page.number + 1);
    paginaTotalEl.textContent = String(page.totalPages);
    paginacaoInfo.textContent = `${page.totalElements} no total`;
    paginaAnteriorBtn.disabled = page.first;
    paginaProximaBtn.disabled = page.last;
}

async function atualizarContadoresAbas() {
    try {
        const [pendentes, vinculados] = await Promise.all([
            listarNaoVinculados(relatorioId, { resolvido: false, page: 0, size: 1 }),
            listarNaoVinculados(relatorioId, { resolvido: true,  page: 0, size: 1 })
        ]);
        contagemPendentesEl.textContent = String(pendentes.totalElements);
        contagemVinculadosEl.textContent = String(vinculados.totalElements);
    } catch {
        /* falha silenciosa nos contadores */
    }
}

// ============================================================================
// Carregar atendentes globais (lista plana via lojas)
// ============================================================================

async function carregarAtendentesEmBackground() {
    if (atendentesCache) return atendentesCache;
    try {
        const lojas = await apiGet('/lojas/listar');
        if (!Array.isArray(lojas) || lojas.length === 0) {
            atendentesCache = [];
            return atendentesCache;
        }
        const porLoja = await Promise.all(lojas.map(loja =>
            apiGet(`/lojas/${loja.id}/atendentes`)
                .then(arr => Array.isArray(arr)
                    ? arr.map(a => ({ ...a, nomeLoja: loja.nome }))
                    : [])
                .catch(() => [])
        ));
        atendentesCache = porLoja.flat()
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
        return atendentesCache;
    } catch (err) {
        atendentesCache = [];
        if (err instanceof ApiError) {
            mostrarToast('Falha ao carregar a lista de atendentes — busca pode ficar incompleta.', 'aviso');
        }
        return atendentesCache;
    }
}

// ============================================================================
// Modal Vincular
// ============================================================================

function ligarModalVincular() {
    modalVincular.querySelectorAll('[data-fechar-vincular]').forEach(el => {
        el.addEventListener('click', fecharModalVincular);
    });

    atendenteBusca.addEventListener('input', onBuscaInput);
    atendenteBusca.addEventListener('keydown', onBuscaKeydown);
    atendenteBusca.addEventListener('focus', () => {
        if (atendenteBusca.value.trim().length >= 2) onBuscaInput();
    });
    atendenteBusca.addEventListener('blur', () => {
        // Pequeno delay para o click no listbox ter chance de disparar antes do blur fechar.
        setTimeout(() => esconderListbox(), 120);
    });

    formVincular.addEventListener('submit', submitVincular);
}

function abrirModalVincular(item) {
    naoVinculadoSelecionado = item;
    atendenteEscolhido = null;
    atendenteIdHidden.value = '';
    atendenteBusca.value = '';
    erroVincularEl.hidden = true;
    erroVincularEl.textContent = '';

    vincNomeBrutoEl.textContent = item.nomeBruto || '—';
    vincIdRelogioBrutoEl.innerHTML = '';
    if (item.idRelogioBruto != null) {
        const code = document.createElement('code');
        code.textContent = `#${item.idRelogioBruto}`;
        vincIdRelogioBrutoEl.appendChild(code);
    } else {
        vincIdRelogioBrutoEl.textContent = '—';
    }
    vincDiasEl.textContent = String(item.qtdDiasComBatida ?? 0);

    atualizarHintAtualizarIdRelogioInicial();
    hintAtendente.textContent = 'Digite ao menos 2 letras para buscar.';
    esconderListbox();

    modalVincular.hidden = false;
    setTimeout(() => atendenteBusca.focus(), 60);
}

function fecharModalVincular() {
    modalVincular.hidden = true;
    naoVinculadoSelecionado = null;
    atendenteEscolhido = null;
    esconderListbox();
}

async function onBuscaInput() {
    const termo = atendenteBusca.value.trim().toLowerCase();
    atendenteEscolhido = null;
    atendenteIdHidden.value = '';
    atualizarHintAtualizarIdRelogioInicial();

    if (termo.length < 2) {
        opcoesAtuais = [];
        opcaoAtivaIdx = -1;
        esconderListbox();
        hintAtendente.textContent = 'Digite ao menos 2 letras para buscar.';
        return;
    }

    await carregarAtendentesEmBackground();
    opcoesAtuais = (atendentesCache || [])
        .filter(a => (a.nome || '').toLowerCase().includes(termo))
        .slice(0, 12);
    opcaoAtivaIdx = opcoesAtuais.length > 0 ? 0 : -1;
    renderizarListbox();
}

function renderizarListbox() {
    atendenteListbox.innerHTML = '';
    if (opcoesAtuais.length === 0) {
        const li = document.createElement('li');
        li.className = 'is-vazio';
        li.textContent = 'Nenhum atendente encontrado.';
        atendenteListbox.appendChild(li);
        atendenteListbox.hidden = false;
        atendenteBusca.setAttribute('aria-expanded', 'true');
        hintAtendente.textContent = 'Tente outro termo — busca por trecho do nome.';
        return;
    }
    opcoesAtuais.forEach((a, idx) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.id = `atendente-opt-${a.id}`;
        li.dataset.id = a.id;
        li.dataset.idx = String(idx);
        if (idx === opcaoAtivaIdx) li.setAttribute('aria-selected', 'true');

        const nome = document.createElement('span');
        nome.className = 'autocomplete__nome';
        nome.textContent = a.nome || '—';
        if (a.nomeLoja) {
            const loja = document.createElement('span');
            loja.className = 'autocomplete__loja';
            loja.textContent = `· ${a.nomeLoja}`;
            nome.appendChild(loja);
        }
        li.appendChild(nome);

        if (a.idRelogioPonto != null) {
            const badge = document.createElement('span');
            badge.className = 'badge badge--info badge--info-small';
            badge.textContent = `Relógio #${a.idRelogioPonto}`;
            li.appendChild(badge);
        }

        li.addEventListener('mousedown', e => {
            // mousedown (não click) para evitar que o blur do input feche antes.
            e.preventDefault();
            selecionarAtendentePorIdx(idx);
        });
        atendenteListbox.appendChild(li);
    });
    atendenteListbox.hidden = false;
    atendenteBusca.setAttribute('aria-expanded', 'true');
    atualizarActiveDescendant();
    hintAtendente.textContent = `${opcoesAtuais.length} resultado(s). Use ↑/↓ para navegar, Enter para escolher.`;
}

function esconderListbox() {
    atendenteListbox.hidden = true;
    atendenteListbox.innerHTML = '';
    atendenteBusca.setAttribute('aria-expanded', 'false');
    atendenteBusca.removeAttribute('aria-activedescendant');
}

function atualizarActiveDescendant() {
    Array.from(atendenteListbox.querySelectorAll('li[role="option"]')).forEach((li, idx) => {
        if (idx === opcaoAtivaIdx) li.setAttribute('aria-selected', 'true');
        else li.removeAttribute('aria-selected');
    });
    const ativo = atendenteListbox.querySelector('li[aria-selected="true"]');
    if (ativo) {
        atendenteBusca.setAttribute('aria-activedescendant', ativo.id);
        ativo.scrollIntoView({ block: 'nearest' });
    } else {
        atendenteBusca.removeAttribute('aria-activedescendant');
    }
}

function onBuscaKeydown(e) {
    if (atendenteListbox.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        onBuscaInput();
        return;
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (opcoesAtuais.length === 0) return;
        opcaoAtivaIdx = (opcaoAtivaIdx + 1) % opcoesAtuais.length;
        atualizarActiveDescendant();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (opcoesAtuais.length === 0) return;
        opcaoAtivaIdx = (opcaoAtivaIdx - 1 + opcoesAtuais.length) % opcoesAtuais.length;
        atualizarActiveDescendant();
    } else if (e.key === 'Enter') {
        if (opcaoAtivaIdx >= 0 && opcaoAtivaIdx < opcoesAtuais.length) {
            e.preventDefault();
            selecionarAtendentePorIdx(opcaoAtivaIdx);
        }
    } else if (e.key === 'Escape') {
        if (!atendenteListbox.hidden) {
            e.preventDefault();
            esconderListbox();
        }
    }
}

function selecionarAtendentePorIdx(idx) {
    const a = opcoesAtuais[idx];
    if (!a) return;
    atendenteEscolhido = a;
    atendenteIdHidden.value = String(a.id);
    atendenteBusca.value = a.nomeLoja ? `${a.nome} — ${a.nomeLoja}` : (a.nome || '');
    esconderListbox();
    atualizarHintAtualizarIdRelogio(a);
    hintAtendente.textContent = 'Atendente selecionado. Pronto para vincular.';
}

function atualizarHintAtualizarIdRelogioInicial() {
    // Estado neutro enquanto nenhum atendente foi selecionado.
    if (!naoVinculadoSelecionado) return;
    const idRelogioBruto = naoVinculadoSelecionado.idRelogioBruto;
    if (idRelogioBruto == null) {
        checkboxAtualizarIdRelogio.checked = false;
        checkboxAtualizarIdRelogio.disabled = true;
        hintAtualizarIdRelogio.textContent = 'Planilha não trouxe ID do relógio para este colaborador — nada a atualizar.';
    } else {
        checkboxAtualizarIdRelogio.disabled = false;
        checkboxAtualizarIdRelogio.checked = true;
        hintAtualizarIdRelogio.innerHTML = `Vincular ID <code>#${idRelogioBruto}</code> ao atendente para casamento automático em importações futuras.`;
    }
}

function atualizarHintAtualizarIdRelogio(atendente) {
    if (!naoVinculadoSelecionado) return;
    const idRelogioBruto = naoVinculadoSelecionado.idRelogioBruto;

    if (idRelogioBruto == null) {
        checkboxAtualizarIdRelogio.checked = false;
        checkboxAtualizarIdRelogio.disabled = true;
        hintAtualizarIdRelogio.textContent = 'Planilha não trouxe ID do relógio para este colaborador — nada a atualizar.';
        return;
    }
    if (atendente && atendente.idRelogioPonto != null) {
        checkboxAtualizarIdRelogio.checked = false;
        checkboxAtualizarIdRelogio.disabled = true;
        hintAtualizarIdRelogio.innerHTML = `Atendente já tem ID <code>#${atendente.idRelogioPonto}</code>. Para trocar, edite o atendente primeiro (remover, depois reatribuir).`;
        return;
    }
    checkboxAtualizarIdRelogio.disabled = false;
    checkboxAtualizarIdRelogio.checked = true;
    hintAtualizarIdRelogio.innerHTML = `Vincular ID <code>#${idRelogioBruto}</code> ao atendente para casamento automático em importações futuras.`;
}

async function submitVincular(event) {
    event.preventDefault();
    if (!naoVinculadoSelecionado) return;
    const atendenteId = parseInt(atendenteIdHidden.value, 10);
    if (!Number.isFinite(atendenteId) || atendenteId <= 0) {
        mostrarErroForm('Selecione um atendente da lista de sugestões.');
        return;
    }
    btnConfirmarVincular.disabled = true;
    try {
        await vincularNaoVinculado(relatorioId, naoVinculadoSelecionado.id, {
            atendenteId,
            atualizarIdRelogio: checkboxAtualizarIdRelogio.checked
        });
        if (typeof marcarReimportacaoPendente === 'function') {
            marcarReimportacaoPendente(relatorioId);
        }
        fecharModalVincular();
        await Promise.all([recarregarPagina(), atualizarContadoresAbas()]);
        mostrarToast(
            'Vínculo criado. As batidas só virarão ponto após reimportar a planilha.',
            'sucesso',
            {
                duracaoMs: 8000,
                acaoTexto: 'Reimportar agora',
                onAcao: () => {
                    window.location.href = `/html/importacao-pontos.html?reimportar=${relatorioId}`;
                }
            }
        );
        await verificarTudoPronto();
    } catch (err) {
        tratarErroVincular(err);
    } finally {
        btnConfirmarVincular.disabled = false;
    }
}

async function verificarTudoPronto() {
    try {
        const page = await listarNaoVinculados(relatorioId, { resolvido: false, page: 0, size: 1 });
        if (page.totalElements === 0) abrirModalTudoPronto();
    } catch {
        /* silencia — o toast principal já avisa */
    }
}

function mostrarErroForm(mensagem) {
    erroVincularEl.textContent = mensagem;
    erroVincularEl.hidden = false;
}

function tratarErroVincular(err) {
    if (!(err instanceof ApiError)) {
        mostrarToast('Sem conexão com o servidor.', 'erro');
        return;
    }
    if (err.status === 409) {
        mostrarToast(
            'Este registro já foi vinculado por outro usuário. Lista atualizada.',
            'info'
        );
        fecharModalVincular();
        recarregarPagina();
        atualizarContadoresAbas();
        return;
    }
    mostrarErroForm(err.message || 'Erro ao vincular.');
}

// ============================================================================
// Modal "Tudo pronto"
// ============================================================================

function ligarModalTudoPronto() {
    modalTudoPronto.querySelectorAll('[data-fechar-tudo-pronto]').forEach(el => {
        el.addEventListener('click', () => { modalTudoPronto.hidden = true; });
    });
}

function abrirModalTudoPronto() {
    modalTudoPronto.hidden = false;
}

// ============================================================================
// Esc → fecha modais
// ============================================================================

function ligarEscParaModais() {
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (!modalVincular.hidden && atendenteListbox.hidden) fecharModalVincular();
        if (!modalTudoPronto.hidden) modalTudoPronto.hidden = true;
    });
}

// ============================================================================
// Helpers
// ============================================================================

function td(texto, classe) {
    const el = document.createElement('td');
    if (classe) el.className = classe;
    el.textContent = texto ?? '—';
    return el;
}

function criarBadgeStatus(texto, classe) {
    const span = document.createElement('span');
    span.className = `badge ${classe}`;
    span.textContent = texto;
    return span;
}
