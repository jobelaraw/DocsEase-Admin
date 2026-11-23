import('./review-badge.js');

(function () {
  var KEY = 'gabayan_sidebar_collapsed';
  var root = document.documentElement;

  function readSaved() {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }
  function save(collapsed) {
    try { localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch (e) {}
  }
  function syncIcon(collapsed) {
    var icon = document.getElementById('collapse-icon') ||
               document.querySelector('.btn-collapse img');
    if (!icon) return;
    icon.src = collapsed ? '../assets/collapse-right.svg' : '../assets/collapse.svg';
    icon.alt = collapsed ? 'Expand' : 'Collapse';
  }

  if (readSaved()) root.classList.add('sidebar-collapsed');

  // Show super-admin nav items on first paint
  try {
    if (sessionStorage.getItem('docsease_role_hint') === 'super_admin') {
      root.classList.add('is-super-admin');
    }
  } catch (e) {}

  // Turn off sidebar animations during page load
  root.classList.add('preload');
  window.addEventListener('load', function () {
    requestAnimationFrame(function () { root.classList.remove('preload'); });
  });

  document.addEventListener('DOMContentLoaded', function () {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    var collapsed = root.classList.contains('sidebar-collapsed');
    sidebar.classList.toggle('collapsed', collapsed);
    syncIcon(collapsed);
  });

  window.toggleSidebar = function () {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    var collapsed = !sidebar.classList.contains('collapsed');
    sidebar.classList.toggle('collapsed', collapsed);
    root.classList.toggle('sidebar-collapsed', collapsed);
    syncIcon(collapsed);
    save(collapsed);
  };
})();