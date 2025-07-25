// Configuração de IP do servidor e ajuste de endpoints
(function() {
    const DEFAULT_IP = 'localhost';

    function getServerIp() {
        return localStorage.getItem('server_ip') || DEFAULT_IP;
    }

    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        if (typeof url === 'string') {
            url = url.replace('localhost', getServerIp());
        } else if (url && url.url) {
            url = new Request(url.url.replace('localhost', getServerIp()), url);
        }
        return originalFetch(url, options);
    };

    window.addEventListener('DOMContentLoaded', () => {
        const button = document.getElementById('config-button');
        const panel = document.getElementById('config-panel');
        const save = document.getElementById('save-ip');
        const ipInput = document.getElementById('server-ip');

        if (button && panel && save && ipInput) {
            button.addEventListener('click', () => {
                panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
                ipInput.value = localStorage.getItem('server_ip') || '';
            });

            save.addEventListener('click', () => {
                const ip = ipInput.value.trim();
                if (ip) {
                    localStorage.setItem('server_ip', ip);
                } else {
                    localStorage.removeItem('server_ip');
                }
                panel.style.display = 'none';
            });
        }
    });
})();
