/**
 * Tela 1 — Histórico de Importações (TASK-09).
 *
 * Lista paginada de todas as importações já realizadas, ordenadas por
 * `inputDate,desc` (mais recente primeiro). Entry-point de auditoria — a MASTER
 * vem por aqui pelo menu lateral para reabrir importações antigas e continuar
 * tratando pendências.
 *
 * UX:
 *  - Linha inteira clicável (e focável via Tab + Enter) leva à Tela 3.
 *  - O botão "→" também leva ao mesmo destino sem propagar o click duplo.
 *  - Estado vazio mostra orientação + CTA para "Nova importação".
 *  - Tolerante: se o endpoint da TASK-00 ainda não estiver no back, mostra
 *    uma mensagem específica em vez de quebrar.
 *
 * Dependências (carregar antes deste script):
 *  - apiClient.js, importacao-pontos.js (camada API — TASK-01)
 *  - toast.js, importacao-ui.js (UI compartilhada — TASK-02)
 */

exigirRole('MASTER');

// ============================================================================
// State
// ============================================================================

const urlParams = new URLSearchParams(window.location.search);
let paginaCorrente = parseInt(urlParams.get('page') || '0', 10);
const pageSize = parseInt(urlParams.get('size') || '20', 10);

// ============================================================================
// Refs DOM
// ============================================================================

const corpo = document.getElementById('corpo');
const contagemTotal = document.getElementById('contagemTotal');
const paginacao = document.getElementById('paginacao');
const paginacaoInfo = document.getElementById('paginacaoInfo');
const paginaAtualEl = document.getElementById('paginaAtual');
const paginaTotalEl = document.getElementById('paginaTotal');
const paginaAnteriorBtn = document.getElementById('paginaAnterior');
const paginaProximaBtn = document.getElementById('paginaProxima');

// ============================================================================
// Inicialização
// ============================================================================

ligarPaginacao();
carregar();

function ligarPaginacao() {
    paginaAnteriorBtn.addEventListener('click', () => {
        if (paginaCorrente > 0) {
            paginaCorrente--;
            atualizarUrl();
            carregar();
        }
    });
    paginaProximaBtn.addEventListener('click', () => {
        paginaCorrente++;
        atualizarUrl();
        carregar();
    });
}

function atualizarUrl() {
    const next = new URLSearchParams(window.location.search);
    next.set('page', String(paginaCorrente));
    next.set('size', String(pageSize));
    const url = `${window.location.pathname}?${next.toString()}`;
    window.history.replaceState({}, '', url);
}

// ============================================================================
// Carregamento
// ============================================================================

async function carregar() {
    corpo.innerHTML = '<tr class="row-loading"><td colspan="8">Carregando histórico…</td></tr>';
    paginacao.hidden = true;

    try {
        const page = await listarRelatorios({
            page: paginaCorrente,
            size: pageSize,
            sort: 'inputDate,desc'
        });
        contagemTotal.textContent = String(page.totalElements);
        if (!page.content || page.content.length === 0) {
            renderizarVazio();
            return;
        }
        renderizarLinhas(page.content);
        renderizarPaginacao(page);
    } catch (err) {
        contagemTotal.textContent = '—';
        if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
            // Provável: a TASK-00 (endpoint backend) ainda não foi entregue.
            corpo.innerHTML = `
                <tr class="row-empty row-empty-cta"><td colspan="8">
                    <span class="empty-titulo">Histórico indisponível</span>
                    <span class="empty-desc">O endpoint de listagem (TASK-00 do backend) ainda não está disponível neste ambiente. Tente novamente quando o back expor a rota.</span>
                    <a class="btn btn-primary" href="/html/importacao-pontos.html">Importar nova planilha</a>
                </td></tr>`;
            return;
        }
        if (err instanceof ApiError) {
            mostrarToast(err.message || 'Erro ao carregar o histórico.', 'erro');
        } else {
            mostrarToast('Sem conexão com o servidor. Verifique sua internet.', 'erro');
        }
        corpo.innerHTML = '<tr class="row-empty"><td colspan="8">Erro ao carregar. Tente novamente.</td></tr>';
    }
}

function renderizarVazio() {
    corpo.innerHTML = `
        <tr class="row-empty row-empty-cta"><td colspan="8">
            <span class="empty-titulo">Nenhuma importação realizada ainda</span>
            <span class="empty-desc">Suba a primeira planilha do relógio biométrico para começar a usar a feature.</span>
            <a class="btn btn-primary" href="/html/importacao-pontos.html">Importar nova planilha</a>
        </td></tr>`;
}

function renderizarLinhas(relatorios) {
    corpo.innerHTML = '';
    relatorios.forEach(r => {
        const tr = document.createElement('tr');
        tr.tabIndex = 0;
        tr.className = 'row-clicavel';
        tr.dataset.id = r.id;
        tr.setAttribute('role', 'button');
        tr.setAttribute('aria-label', `Abrir detalhes da importação #${r.id}`);
        tr.addEventListener('click', () => abrirDetalhes(r.id));
        tr.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                abrirDetalhes(r.id);
            }
        });

        tr.appendChild(td(`#${r.id}`, 'cell-muted col-id'));
        tr.appendChild(td(r.nomeArquivo || '—', 'cell-name'));
        tr.appendChild(td(r.lojaNome || '—', 'cell-name'));
        tr.appendChild(td(formatarPeriodo(r.periodoInicio, r.periodoFim), 'col-periodo'));

        const tdStatus = document.createElement('td');
        tdStatus.appendChild(criarBadgeStatusImportacao(r.status));
        tr.appendChild(tdStatus);

        tr.appendChild(td(String(r.qtdPontosOk ?? 0), 'cell-num col-pontos-ok'));

        const pend = (r.qtdInconsistencias ?? 0) + (r.qtdAtendentesNaoVinculados ?? 0);
        const tdPend = document.createElement('td');
        tdPend.className = 'cell-num';
        if (pend === 0) {
            tdPend.classList.add('cell-resumo-ok');
            tdPend.textContent = '✓';
            tdPend.title = 'Sem pendências';
        } else {
            tdPend.classList.add('cell-pendencias');
            tdPend.textContent = String(pend);
            tdPend.title = `${r.qtdInconsistencias ?? 0} inconsistência(s) + ${r.qtdAtendentesNaoVinculados ?? 0} não-vinculado(s)`;
        }
        tr.appendChild(tdPend);

        const tdAcao = document.createElement('td');
        tdAcao.className = 'cell-acao';
        const btnAbrir = document.createElement('a');
        btnAbrir.className = 'btn-icon-action btn-link';
        btnAbrir.title = 'Abrir detalhes';
        btnAbrir.setAttribute('aria-label', `Abrir detalhes da importação #${r.id}`);
        btnAbrir.textContent = '→';
        btnAbrir.href = `/html/importacao-detalhes.html?id=${r.id}`;
        btnAbrir.addEventListener('click', e => e.stopPropagation());
        tdAcao.appendChild(btnAbrir);
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

// ============================================================================
// Helpers
// ============================================================================

function abrirDetalhes(id) {
    window.location.href = `/html/importacao-detalhes.html?id=${id}`;
}

function td(texto, classe) {
    const el = document.createElement('td');
    if (classe) el.className = classe;
    el.textContent = texto ?? '—';
    return el;
}
