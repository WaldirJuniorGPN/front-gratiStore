(function () {
    const MOBILE_BREAKPOINT = 1024;
    const STORAGE_KEY = 'gs:sidebar:collapsed';

    document.addEventListener('DOMContentLoaded', function () {
        fetch('/html/header.html')
            .then((response) => response.text())
            .then((data) => {
                const container = document.getElementById('header-container');
                if (!container) return;
                container.innerHTML = data;
                initSidebar();
            })
            .catch((error) => console.error('Erro ao carregar o header:', error));
    });

    function initSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('sidebar-toggle');
        const overlay = document.getElementById('sidebar-overlay');
        if (!sidebar || !toggle || !overlay) return;

        markActiveLink(sidebar);
        setupGroupToggles(sidebar);
        setupSidebarToggle(sidebar, toggle, overlay);
    }

    function isDesktop() {
        return window.innerWidth >= MOBILE_BREAKPOINT;
    }

    function readStoredCollapsed() {
        try {
            return localStorage.getItem(STORAGE_KEY) === '1';
        } catch (_) {
            return false;
        }
    }

    function writeStoredCollapsed(collapsed) {
        try {
            localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
        } catch (_) { /* storage indisponível: silenciar */ }
    }

    function syncToggleState(toggle, sidebar) {
        if (isDesktop()) {
            const collapsed = document.body.classList.contains('sidebar-collapsed');
            toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            toggle.setAttribute(
                'aria-label',
                collapsed ? 'Expandir menu de navegação' : 'Recolher menu de navegação'
            );
        } else {
            const isOpen = sidebar.classList.contains('is-open');
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            toggle.setAttribute(
                'aria-label',
                isOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'
            );
        }
    }

    function normalizePath(path) {
        if (!path) return '/index.html';
        if (path === '/' || path === '') return '/index.html';
        return path;
    }

    function markActiveLink(sidebar) {
        const currentPath = normalizePath(window.location.pathname);
        const links = sidebar.querySelectorAll('.sidebar__link[data-path]');

        links.forEach((link) => {
            if (normalizePath(link.getAttribute('data-path')) === currentPath) {
                link.classList.add('is-active');
                const groupItem = link.closest('.sidebar__item--group');
                if (groupItem) {
                    groupItem.classList.add('has-active');
                    const groupBtn = groupItem.querySelector('.sidebar__group-toggle');
                    if (groupBtn) groupBtn.setAttribute('aria-expanded', 'true');
                }
            }
        });
    }

    function setupGroupToggles(sidebar) {
        const toggles = sidebar.querySelectorAll('.sidebar__group-toggle');
        toggles.forEach((btn) => {
            btn.addEventListener('click', () => {
                const expanded = btn.getAttribute('aria-expanded') === 'true';
                btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
            });
        });
    }

    function setupSidebarToggle(sidebar, toggle, overlay) {
        const openMobile = () => {
            sidebar.classList.add('is-open');
            overlay.hidden = false;
            requestAnimationFrame(() => overlay.classList.add('is-visible'));
            document.body.style.overflow = 'hidden';
            syncToggleState(toggle, sidebar);
        };

        const closeMobile = () => {
            sidebar.classList.remove('is-open');
            overlay.classList.remove('is-visible');
            const onEnd = () => {
                overlay.hidden = true;
                overlay.removeEventListener('transitionend', onEnd);
            };
            overlay.addEventListener('transitionend', onEnd);
            document.body.style.overflow = '';
            syncToggleState(toggle, sidebar);
        };

        const toggleDesktopCollapse = () => {
            const collapsed = document.body.classList.toggle('sidebar-collapsed');
            writeStoredCollapsed(collapsed);
            syncToggleState(toggle, sidebar);
        };

        // Aplica estado inicial em desktop a partir do storage
        if (isDesktop() && readStoredCollapsed()) {
            document.body.classList.add('sidebar-collapsed');
        }
        syncToggleState(toggle, sidebar);

        toggle.addEventListener('click', () => {
            if (isDesktop()) {
                toggleDesktopCollapse();
            } else {
                const isOpen = sidebar.classList.contains('is-open');
                isOpen ? closeMobile() : openMobile();
            }
        });

        overlay.addEventListener('click', closeMobile);

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
                closeMobile();
                toggle.focus();
            }
        });

        sidebar.querySelectorAll('.sidebar__link').forEach((link) => {
            link.addEventListener('click', () => {
                if (!isDesktop()) closeMobile();
            });
        });

        window.addEventListener('resize', () => {
            if (isDesktop()) {
                if (sidebar.classList.contains('is-open')) {
                    closeMobile();
                }
                document.body.classList.toggle('sidebar-collapsed', readStoredCollapsed());
            }
            syncToggleState(toggle, sidebar);
        });
    }
})();
