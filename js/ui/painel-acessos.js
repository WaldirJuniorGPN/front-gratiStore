/**
 * Painel de gestão de acessos (TASK-04) — componente reaproveitável.
 *
 * Dado um `usuarioId`, carrega o catálogo de páginas + as permissões atuais do
 * usuário e renderiza uma chave liga/desliga por página, agrupada por módulo,
 * com nomes humanos. É o centro de UX da feature de restrição de acesso
 * (README "Princípio condutor" nº 1 — zero curva de aprendizado para o MASTER).
 *
 * É a MESMA peça reutilizada pela tela dedicada (`gestao-acessos.html`) e, na
 * TASK-05, embutida no cadastro/edição de usuário (`modoEmbutido`). Por isso a
 * API não acopla a `?id=` nem ao botão de salvar de nenhuma tela:
 *
 *   PainelAcessos.montar(containerEl, {
 *     usuarioId,
 *     onDirtyChange,            // (bool) → habilita/desabilita Salvar externo
 *     modoEmbutido: false,      // true quando dentro do form de usuário (TASK-05)
 *     onUsuarioNaoEncontrado    // opcional: 404 do usuário (a tela decide o redirect)
 *   }) -> { salvar(), estaSujo(), recarregar(), destruir() }
 *
 * Catálogo: vem SEMPRE do backend real via `getCatalogo()`. Diferente do guard
 * de rota/menu (TASK-01/02), esta tela NÃO degrada para o fallback estático —
 * configurar acesso com rótulos técnicos/errados é pior que não configurar
 * (TASK-04 Nota 3). Backend fora ⇒ estado de erro com botão "Tentar novamente".
 *
 * MASTER como alvo: estado somente leitura com mensagem clara — sem toggles,
 * sem salvar (o backend também rejeita o PUT — TASK-00 §B2.3 — mas a UX já
 * evita o caminho).
 *
 * Dependências (carregar antes deste script):
 *  - js/api/erros.js          (ApiError)
 *  - js/api/apiClient.js      (apiGet)
 *  - js/api/permissoes-api.js (getCatalogo, getPermissoesUsuario, salvarPermissoesUsuario)
 *  - js/ui/toast.js           (mostrarToast — opcional; degrada sem ele)
 */

const PainelAcessos = (function () {

    /** Chave da página inicial: nunca é bloqueável (destino de fallback —
     *  TASK-00 Apêndice A nota sobre `inicio`). Não vira toggle, mas é
     *  preservada no conjunto salvo se já estiver liberada. */
    const CHAVE_INICIO = 'inicio';

    /* ----------------------------- utilidades ----------------------------- */

    function el(tag, props, filhos) {
        const node = document.createElement(tag);
        if (props) {
            Object.entries(props).forEach(([k, v]) => {
                if (v == null) return;
                if (k === 'class') node.className = v;
                else if (k === 'text') node.textContent = v;
                else if (k === 'html') node.innerHTML = v;
                else if (k.startsWith('aria') || k === 'role' || k === 'hidden' || k === 'id' || k === 'type' || k === 'for') {
                    node.setAttribute(k, v);
                } else if (k.startsWith('data-')) {
                    node.setAttribute(k, v);
                } else {
                    node[k] = v;
                }
            });
        }
        (Array.isArray(filhos) ? filhos : filhos != null ? [filhos] : [])
            .forEach(f => node.appendChild(typeof f === 'string' ? document.createTextNode(f) : f));
        return node;
    }

    function setsIguais(a, b) {
        if (a.size !== b.size) return false;
        for (const x of a) if (!b.has(x)) return false;
        return true;
    }

    /** Normaliza para busca tolerante: minúsculas e sem acento.
     *  `̀-ͯ` = bloco Unicode "Combining Diacritical Marks". */
    function normalizar(txt) {
        return String(txt || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '');
    }

    function primeiroNome(nomeCompleto) {
        const partes = String(nomeCompleto || '').trim().split(/\s+/).filter(Boolean);
        return partes[0] || 'o usuário';
    }

    /* ------------------------------- montar ------------------------------- */

    function montar(container, opts) {
        if (!container) throw new Error('PainelAcessos.montar: container é obrigatório.');
        const o = opts || {};

        const estado = {
            usuarioId: o.usuarioId,
            modoEmbutido: !!o.modoEmbutido,
            onDirtyChange: typeof o.onDirtyChange === 'function' ? o.onDirtyChange : null,
            onUsuarioNaoEncontrado: typeof o.onUsuarioNaoEncontrado === 'function' ? o.onUsuarioNaoEncontrado : null,
            container,
            catalogo: null,
            usuario: null,            // { nome, email }
            role: null,
            paginasToggle: [],        // páginas do catálogo, exceto `inicio`
            grupos: [],               // grupos com ao menos uma página de toggle
            preservadas: new Set(),   // chaves do usuário fora do universo de toggles (ex.: `inicio`)
            salvoSet: new Set(),      // conjunto efetivo do último estado salvo
            atualSet: new Set(),      // seleção atual (apenas chaves de toggle)
            filtro: '',
            salvando: false,
            destruido: false,
            refs: {}
        };

        function conjuntoEfetivo() {
            const s = new Set(estado.atualSet);
            estado.preservadas.forEach(k => s.add(k));
            return s;
        }

        function estaSujo() {
            return !setsIguais(conjuntoEfetivo(), estado.salvoSet);
        }

        function notificarSujo() {
            const sujo = estaSujo();
            if (estado.onDirtyChange) estado.onDirtyChange(sujo);
            atualizarBarraAcao();
            return sujo;
        }

        /* --------------------------- guarda de saída --------------------- */

        function aoSairDaPagina(e) {
            if (estado.destruido) return;
            if (estaSujo()) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        }
        window.addEventListener('beforeunload', aoSairDaPagina);

        /* ------------------------------ estados -------------------------- */

        function limpar() {
            container.innerHTML = '';
            estado.refs = {};
        }

        function renderCarregando() {
            limpar();
            container.appendChild(
                el('div', { class: 'pa-estado', role: 'status', 'aria-live': 'polite' },
                    'Carregando lista de páginas e acessos…')
            );
        }

        function renderErroCatalogo() {
            limpar();
            const bloco = el('div', { class: 'pa-estado pa-estado--erro', role: 'alert' });
            bloco.appendChild(el('p', { class: 'pa-estado__msg',
                text: 'Não foi possível carregar a lista de páginas. Tente novamente.' }));
            const btn = el('button', {
                type: 'button', class: 'btn btn-primary',
                onclick: () => carregar()
            }, 'Tentar novamente');
            bloco.appendChild(btn);
            container.appendChild(bloco);
        }

        function renderUsuarioNaoEncontrado() {
            limpar();
            container.appendChild(
                el('div', { class: 'pa-estado pa-estado--erro', role: 'alert' },
                    el('p', { class: 'pa-estado__msg',
                        text: 'Usuário não encontrado ou inativo.' }))
            );
            if (estado.onUsuarioNaoEncontrado) estado.onUsuarioNaoEncontrado();
        }

        function renderCabecalhoUsuario() {
            const nome = estado.usuario?.nome || `Usuário #${estado.usuarioId}`;
            const email = estado.usuario?.email || '';
            const head = el('div', { class: 'pa-usuario' });
            head.appendChild(el('span', { class: 'pa-usuario__rotulo', text: 'Acessos de' }));
            head.appendChild(el('strong', { class: 'pa-usuario__nome', text: nome }));
            if (email) head.appendChild(el('span', { class: 'pa-usuario__email', text: `(${email})` }));
            return head;
        }

        function renderMaster() {
            limpar();
            const painel = el('div', { class: 'pa pa--master' });
            painel.appendChild(renderCabecalhoUsuario());
            const faixa = el('div', { class: 'pa-faixa-master', role: 'note' });
            faixa.appendChild(el('span', { class: 'pa-faixa-master__icone', 'aria-hidden': 'true', text: '★' }));
            const txt = el('div');
            txt.appendChild(el('p', { class: 'pa-faixa-master__titulo',
                text: 'Este é um usuário MASTER: tem acesso total a todas as páginas.' }));
            txt.appendChild(el('p', { class: 'pa-faixa-master__sub',
                text: 'Não há acessos a configurar — administradores enxergam o sistema inteiro.' }));
            faixa.appendChild(txt);
            painel.appendChild(faixa);
            container.appendChild(painel);
            // Em modo embutido, garante que o Salvar externo fique desabilitado.
            if (estado.onDirtyChange) estado.onDirtyChange(false);
        }

        /* --------------------------- render COMUM ------------------------ */

        function chaveSegura(chave) {
            return String(chave).replace(/[^a-z0-9_-]/gi, '_');
        }

        function renderComum() {
            limpar();
            const painel = el('div', { class: 'pa' });

            // Cabeçalho: nome do usuário + busca + contador
            const topo = el('div', { class: 'pa-topo' });
            topo.appendChild(renderCabecalhoUsuario());

            const linhaBusca = el('div', { class: 'pa-busca-linha' });
            const busca = el('input', {
                type: 'search', class: 'pa-busca',
                placeholder: 'Buscar página…',
                'aria-label': 'Buscar página por nome ou descrição'
            });
            busca.addEventListener('input', () => {
                estado.filtro = busca.value;
                aplicarFiltro();
            });
            const contador = el('span', {
                class: 'pa-contador', 'aria-live': 'polite'
            });
            linhaBusca.appendChild(busca);
            linhaBusca.appendChild(contador);
            topo.appendChild(linhaBusca);
            painel.appendChild(topo);

            estado.refs.contador = contador;

            // Região viva (oculta) para anunciar o resultado da busca.
            const buscaLive = el('span', { class: 'sr-only', 'aria-live': 'polite' });
            painel.appendChild(buscaLive);
            estado.refs.buscaLive = buscaLive;

            // Grupos + páginas
            const grupos = el('div', { class: 'pa-grupos' });
            estado.grupos.forEach(g => grupos.appendChild(renderGrupo(g)));
            painel.appendChild(grupos);
            estado.refs.grupos = grupos;

            // Pré-visualização
            painel.appendChild(renderPreview());

            // Barra de ação (badge sujo + Descartar/Salvar)
            painel.appendChild(renderBarraAcao());

            container.appendChild(painel);

            sincronizarToggles();
            atualizarContador();
            atualizarPreview();
            atualizarBarraAcao();
        }

        function renderGrupo(grupo) {
            const tituloId = `pa-grp-${chaveSegura(grupo.chave)}`;
            const det = el('details', { class: 'pa-grupo', 'data-grupo': grupo.chave });
            det.open = true;

            const sum = el('summary', { class: 'pa-grupo__cab' });
            sum.appendChild(el('span', { class: 'pa-grupo__titulo', id: tituloId, text: grupo.rotulo }));

            const btnGrupo = el('button', {
                type: 'button', class: 'btn btn-secondary pa-grupo__acao'
            }, 'Liberar tudo do grupo');
            btnGrupo.addEventListener('click', (ev) => {
                // Dentro de <summary>: impedir que o clique abra/feche o grupo.
                ev.preventDefault();
                ev.stopPropagation();
                alternarGrupo(grupo);
            });
            sum.appendChild(btnGrupo);
            det.appendChild(sum);

            const lista = el('div', {
                class: 'pa-grupo__lista', role: 'group', 'aria-labelledby': tituloId
            });
            estado.paginasToggle
                .filter(p => p.grupo === grupo.chave)
                .forEach(p => lista.appendChild(renderPagina(p)));
            det.appendChild(lista);

            // refs para filtro/estado do botão do grupo
            (estado.refs.gruposNodes || (estado.refs.gruposNodes = [])).push({
                grupo, det, btnGrupo
            });
            return det;
        }

        function renderPagina(pagina) {
            const cid = chaveSegura(pagina.chave);
            const lbId = `pa-lb-${cid}`;
            const dsId = `pa-ds-${cid}`;

            const row = el('div', {
                class: 'pa-pagina', 'data-chave': pagina.chave,
                'data-busca': normalizar(`${pagina.rotulo} ${pagina.descricao || ''}`)
            });

            const sw = el('button', {
                type: 'button', class: 'pa-switch', role: 'switch',
                id: `pa-sw-${cid}`, 'aria-checked': 'false',
                'aria-labelledby': lbId,
                'aria-describedby': pagina.descricao ? dsId : null
            });
            sw.appendChild(el('span', { class: 'pa-switch__trilho' },
                el('span', { class: 'pa-switch__bolinha' })));

            const texto = el('div', { class: 'pa-pagina__texto' });
            texto.appendChild(el('span', { class: 'pa-pagina__rotulo', id: lbId, text: pagina.rotulo }));
            if (pagina.descricao) {
                texto.appendChild(el('span', { class: 'pa-pagina__desc', id: dsId, text: pagina.descricao }));
            }

            row.appendChild(sw);
            row.appendChild(texto);

            // Clique em qualquer ponto da linha alterna (label + switch). O
            // <button role="switch"> cobre teclado (Espaço/Enter) nativamente.
            row.addEventListener('click', () => alternarPagina(pagina.chave));

            (estado.refs.paginasNodes || (estado.refs.paginasNodes = [])).push({ pagina, row, sw });
            return row;
        }

        function renderPreview() {
            const det = el('details', { class: 'pa-preview' });
            // Aberto por padrão: ligar a configuração ao efeito real é o item
            // de maior retorno de UX desta tela (TASK-04 Nota 2).
            det.open = true;
            const nome = primeiroNome(estado.usuario?.nome);
            det.appendChild(el('summary', { class: 'pa-preview__cab',
                text: `Pré-visualização: o que ${nome} vai ver` }));
            const corpo = el('div', { class: 'pa-preview__corpo' });
            det.appendChild(corpo);
            estado.refs.preview = corpo;
            return det;
        }

        function renderBarraAcao() {
            const barra = el('div', { class: 'pa-barra' });
            const badge = el('span', { class: 'pa-barra__badge', 'aria-live': 'polite' });
            barra.appendChild(badge);
            estado.refs.badge = badge;

            if (!estado.modoEmbutido) {
                const acoes = el('div', { class: 'pa-barra__acoes' });
                const btnDescartar = el('button', {
                    type: 'button', class: 'btn btn-secondary'
                }, 'Descartar');
                btnDescartar.addEventListener('click', descartar);
                const btnSalvar = el('button', {
                    type: 'button', class: 'btn btn-primary'
                }, 'Salvar');
                btnSalvar.addEventListener('click', () => { salvar(); });
                acoes.appendChild(btnDescartar);
                acoes.appendChild(btnSalvar);
                barra.appendChild(acoes);
                estado.refs.btnDescartar = btnDescartar;
                estado.refs.btnSalvar = btnSalvar;
            }
            return barra;
        }

        /* ----------------------------- interação ------------------------- */

        function alternarPagina(chave) {
            if (estado.atualSet.has(chave)) estado.atualSet.delete(chave);
            else estado.atualSet.add(chave);
            sincronizarToggles();
            atualizarContador();
            atualizarPreview();
            notificarSujo();
        }

        function alternarGrupo(grupo) {
            const doGrupo = estado.paginasToggle.filter(p => p.grupo === grupo.chave);
            const todasLiberadas = doGrupo.every(p => estado.atualSet.has(p.chave));
            doGrupo.forEach(p => {
                if (todasLiberadas) estado.atualSet.delete(p.chave);
                else estado.atualSet.add(p.chave);
            });
            sincronizarToggles();
            atualizarContador();
            atualizarPreview();
            notificarSujo();
        }

        function descartar() {
            if (!estaSujo()) return;
            const ok = window.confirm('Descartar todas as alterações não salvas?');
            if (!ok) return;
            recomputarDe(estado.salvoSet);
            sincronizarToggles();
            atualizarContador();
            atualizarPreview();
            notificarSujo();
        }

        /* --------------------------- sincronização ----------------------- */

        function sincronizarToggles() {
            (estado.refs.paginasNodes || []).forEach(({ pagina, row, sw }) => {
                const on = estado.atualSet.has(pagina.chave);
                sw.setAttribute('aria-checked', on ? 'true' : 'false');
                row.classList.toggle('is-on', on);
            });
            (estado.refs.gruposNodes || []).forEach(({ grupo, btnGrupo }) => {
                const doGrupo = estado.paginasToggle.filter(p => p.grupo === grupo.chave);
                const todas = doGrupo.length > 0 && doGrupo.every(p => estado.atualSet.has(p.chave));
                btnGrupo.textContent = todas ? 'Bloquear tudo do grupo' : 'Liberar tudo do grupo';
            });
        }

        function atualizarContador() {
            if (!estado.refs.contador) return;
            const n = estado.paginasToggle.length;
            const x = estado.paginasToggle.filter(p => estado.atualSet.has(p.chave)).length;
            estado.refs.contador.textContent = `${x} de ${n} liberadas`;
        }

        function atualizarPreview() {
            const corpo = estado.refs.preview;
            if (!corpo) return;
            corpo.innerHTML = '';

            const menu = el('ul', { class: 'pa-preview__menu' });
            // "Início" sempre aparece (nunca é bloqueável — destino de fallback).
            menu.appendChild(el('li', { class: 'pa-preview__item pa-preview__item--fixo', text: 'Início' }));

            let algum = false;
            estado.grupos.forEach(g => {
                const liberadas = estado.paginasToggle
                    .filter(p => p.grupo === g.chave && estado.atualSet.has(p.chave));
                if (liberadas.length === 0) return;
                algum = true;
                const grpItem = el('li', { class: 'pa-preview__grupo' });
                grpItem.appendChild(el('span', { class: 'pa-preview__grupo-rotulo', text: g.rotulo }));
                const sub = el('ul', { class: 'pa-preview__submenu' });
                liberadas.forEach(p => sub.appendChild(
                    el('li', { class: 'pa-preview__item', text: p.rotulo })));
                grpItem.appendChild(sub);
                menu.appendChild(grpItem);
            });

            corpo.appendChild(menu);
            if (!algum) {
                corpo.appendChild(el('p', { class: 'pa-preview__vazio',
                    text: 'Fora a tela inicial, nenhuma página está liberada — o menu mostrará apenas "Início".' }));
            }
        }

        function atualizarBarraAcao() {
            const sujo = estaSujo();
            const badge = estado.refs.badge;
            if (badge) {
                if (sujo) {
                    const qtd = contarAlteracoes();
                    badge.textContent = qtd === 1
                        ? '1 alteração não salva'
                        : `${qtd} alterações não salvas`;
                    badge.classList.add('is-sujo');
                } else {
                    badge.textContent = 'Tudo salvo';
                    badge.classList.remove('is-sujo');
                }
            }
            if (estado.refs.btnSalvar) {
                estado.refs.btnSalvar.disabled = !sujo || estado.salvando;
            }
            if (estado.refs.btnDescartar) {
                estado.refs.btnDescartar.disabled = !sujo || estado.salvando;
            }
        }

        function contarAlteracoes() {
            const efetivo = conjuntoEfetivo();
            let n = 0;
            efetivo.forEach(k => { if (!estado.salvoSet.has(k)) n++; });
            estado.salvoSet.forEach(k => { if (!efetivo.has(k)) n++; });
            return n;
        }

        function aplicarFiltro() {
            const termo = normalizar(estado.filtro).trim();
            let visiveis = 0;
            (estado.refs.paginasNodes || []).forEach(({ row }) => {
                const casa = !termo || row.getAttribute('data-busca').includes(termo);
                row.hidden = !casa;
                if (casa) visiveis++;
            });
            // Esconde grupos sem nenhuma página visível para não deixar
            // cabeçalho "vazio" (princípio nº 2: nunca parecer quebrado).
            (estado.refs.gruposNodes || []).forEach(({ grupo, det }) => {
                const algum = estado.paginasToggle
                    .filter(p => p.grupo === grupo.chave)
                    .some(p => {
                        const node = (estado.refs.paginasNodes || [])
                            .find(n => n.pagina.chave === p.chave);
                        return node && !node.row.hidden;
                    });
                det.hidden = !algum;
            });
            if (estado.refs.buscaLive) {
                estado.refs.buscaLive.textContent = termo
                    ? (visiveis === 0
                        ? 'Nenhuma página encontrada'
                        : `${visiveis} ${visiveis === 1 ? 'página encontrada' : 'páginas encontradas'}`)
                    : '';
            }
        }

        /* ------------------------------ carga ---------------------------- */

        function recomputarDe(conjunto) {
            const universo = new Set(estado.paginasToggle.map(p => p.chave));
            estado.atualSet = new Set([...conjunto].filter(k => universo.has(k)));
            estado.preservadas = new Set([...conjunto].filter(k => !universo.has(k)));
            estado.salvoSet = new Set(conjunto);
        }

        function prepararCatalogo(catalogo) {
            estado.catalogo = catalogo;
            const paginas = Array.isArray(catalogo.paginas) ? catalogo.paginas : [];
            estado.paginasToggle = paginas.filter(p => p.chave !== CHAVE_INICIO);

            const gruposCat = Array.isArray(catalogo.grupos) ? catalogo.grupos : [];
            const comPaginas = new Set(estado.paginasToggle.map(p => p.grupo));
            estado.grupos = gruposCat.filter(g => comPaginas.has(g.chave));
            // Defensivo: páginas cujo `grupo` não existe na lista de grupos
            // não podem sumir — agrupa o resto em "Outras páginas".
            const conhecidos = new Set(estado.grupos.map(g => g.chave));
            const orfas = estado.paginasToggle.some(p => !conhecidos.has(p.grupo));
            if (orfas) {
                estado.paginasToggle.forEach(p => {
                    if (!conhecidos.has(p.grupo)) p.grupo = '__outras__';
                });
                estado.grupos.push({ chave: '__outras__', rotulo: 'Outras páginas' });
            }
        }

        async function carregar() {
            if (estado.destruido) return;
            renderCarregando();

            // 1) Catálogo real (obrigatório — sem fallback técnico aqui).
            let catalogo;
            try {
                catalogo = await getCatalogo();
                if (!catalogo || !Array.isArray(catalogo.paginas)) {
                    throw new Error('Catálogo em formato inesperado.');
                }
            } catch (err) {
                console.error('Falha ao carregar o catálogo de páginas:', err);
                renderErroCatalogo();
                return;
            }
            prepararCatalogo(catalogo);

            // 2) Permissões do usuário + dados (nome/email) para o cabeçalho.
            let perm, usuario;
            try {
                [perm, usuario] = await Promise.all([
                    getPermissoesUsuario(estado.usuarioId),
                    apiGet(`/usuarios/${estado.usuarioId}`)
                ]);
            } catch (err) {
                if (err instanceof ApiError && err.status === 404) {
                    renderUsuarioNaoEncontrado();
                    return;
                }
                console.error('Falha ao carregar acessos do usuário:', err);
                renderErroCatalogo();
                return;
            }

            estado.usuario = { nome: usuario?.nome, email: usuario?.email };
            estado.role = perm?.role || usuario?.role || null;

            if (estado.role === 'MASTER') {
                renderMaster();
                return;
            }

            const permissoes = Array.isArray(perm?.permissoes) ? perm.permissoes : [];
            recomputarDe(new Set(permissoes));
            renderComum();
        }

        /* ------------------------------ salvar --------------------------- */

        async function salvar() {
            if (estado.role === 'MASTER') {
                return Promise.reject(new Error('Usuário MASTER não tem acessos a configurar.'));
            }
            if (!estaSujo() || estado.salvando) return Promise.resolve(false);

            estado.salvando = true;
            atualizarBarraAcao();
            const chaves = [...conjuntoEfetivo()];

            try {
                const resp = await salvarPermissoesUsuario(estado.usuarioId, chaves);
                // O backend devolve o estado já aplicado — fonte da verdade.
                const aplicadas = Array.isArray(resp?.permissoes) ? resp.permissoes : chaves;
                recomputarDe(new Set(aplicadas));
                estado.salvando = false;
                sincronizarToggles();
                atualizarContador();
                atualizarPreview();
                notificarSujo();
                const nome = estado.usuario?.nome || 'usuário';
                if (typeof mostrarToast === 'function') {
                    mostrarToast(`Acessos de ${nome} atualizados.`, 'sucesso');
                }
                return true;
            } catch (err) {
                estado.salvando = false;
                atualizarBarraAcao();
                console.error('Falha ao salvar acessos:', err);
                if (err instanceof ApiError && err.status === 404) {
                    if (typeof mostrarToast === 'function') {
                        mostrarToast('Usuário não encontrado ou inativo.', 'erro');
                    }
                    if (estado.onUsuarioNaoEncontrado) estado.onUsuarioNaoEncontrado();
                } else if (err instanceof ApiError && err.status === 400) {
                    // Chave inválida ou alvo MASTER — mostra a mensagem do backend.
                    if (typeof mostrarToast === 'function') {
                        mostrarToast(err.message || 'Não foi possível salvar os acessos.', 'erro');
                    }
                } else if (!(err instanceof ApiError) || (err.status !== 401 && err.status !== 403)) {
                    // 401/403 já tratados globalmente pelo apiClient.
                    if (typeof mostrarToast === 'function') {
                        mostrarToast('Não foi possível salvar os acessos. Tente novamente.', 'erro');
                    }
                }
                throw err;
            }
        }

        function destruir() {
            estado.destruido = true;
            window.removeEventListener('beforeunload', aoSairDaPagina);
            limpar();
        }

        // Início
        carregar();

        return {
            salvar,
            estaSujo,
            recarregar: carregar,
            destruir
        };
    }

    return { montar };
})();

window.PainelAcessos = PainelAcessos;
