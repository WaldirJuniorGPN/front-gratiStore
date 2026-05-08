(function () {
    const MOBILE_BREAKPOINT = 1024;

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
        setupMobileDrawer(sidebar, toggle, overlay);
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

    function setupMobileDrawer(sidebar, toggle, overlay) {
        const open = () => {
            sidebar.classList.add('is-open');
            overlay.hidden = false;
            requestAnimationFrame(() => overlay.classList.add('is-visible'));
            toggle.setAttribute('aria-expanded', 'true');
            toggle.setAttribute('aria-label', 'Fechar menu de navegação');
            document.body.style.overflow = 'hidden';
        };

        const close = () => {
            sidebar.classList.remove('is-open');
            overlay.classList.remove('is-visible');
            const onEnd = () => {
                overlay.hidden = true;
                overlay.removeEventListener('transitionend', onEnd);
            };
            overlay.addEventListener('transitionend', onEnd);
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Abrir menu de navegação');
            document.body.style.overflow = '';
        };

        toggle.addEventListener('click', () => {
            const isOpen = sidebar.classList.contains('is-open');
            isOpen ? close() : open();
        });

        overlay.addEventListener('click', close);

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
                close();
                toggle.focus();
            }
        });

        sidebar.querySelectorAll('.sidebar__link').forEach((link) => {
            link.addEventListener('click', () => {
                if (window.innerWidth < MOBILE_BREAKPOINT) close();
            });
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth >= MOBILE_BREAKPOINT && sidebar.classList.contains('is-open')) {
                close();
            }
        });
    }
})();
