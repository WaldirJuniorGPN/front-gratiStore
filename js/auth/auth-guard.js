/**
 * Guard de autenticação (TASK-03).
 *
 * Este script DEVE ser carregado de forma síncrona no `<head>` de toda página
 * protegida, antes de qualquer outro JS. Ele bloqueia a renderização até decidir
 * se o usuário tem sessão válida; caso contrário, redireciona para o login antes
 * que qualquer conteúdo protegido seja pintado (evita "flash" de tela protegida).
 *
 * A verificação local de `expiraEm` é UX (§11.3 do handoff). A segurança real
 * vem do backend, que rejeita tokens expirados com 401 — o apiClient (TASK-01)
 * trata isso fazendo logout e redirect.
 */
(function () {
  const LOGIN_URL = '/html/login.html';
  const KEY = 'gs:sessao';

  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return redirect();

    const sessao = JSON.parse(raw);
    if (!sessao || !sessao.token) return redirect();

    if (sessao.expiraEm) {
      const expira = Date.parse(sessao.expiraEm);
      if (Number.isFinite(expira) && Date.now() >= expira) {
        sessionStorage.removeItem(KEY);
        return redirect();
      }
    }
  } catch (_) {
    return redirect();
  }

  function redirect() {
    const destino = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`${LOGIN_URL}?next=${destino}`);
  }
})();
