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
    icon.src = collapsed ? '../assets/collapse-right.png' : '../assets/collapse.png';
    icon.alt = collapsed ? 'Expand' : 'Collapse';
  }

  if (readSaved()) root.classList.add('sidebar-collapsed');

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