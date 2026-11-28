/* GaBayan admin shell: the sidebar and top bar shared by every admin page.
 *
 * Loaded as a classic <script> in <head> (not a module) so <app-sidebar> and
 * <app-topbar> are defined before the body is parsed and render on first paint.
 * The menu comes from NAV below; pages never contain sidebar markup.
 * js/core/session.js confirms the signed-in admin and calls GaBayan.applySession().
 */

(function () {
  'use strict';

  var root = document.documentElement;
  var KEYS = {
    session: 'gabayan_session',
    collapsed: 'gabayan_sidebar_collapsed',
    badge: 'gabayan_badge_'
  };

  // Every sidebar entry, in order. superAdminOnly entries are never drawn for
  // normal admins, nor while the role is still unknown (fail closed).
  var NAV = [
    { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'dashboard.svg' },
    { id: 'services', label: 'Service Management', href: 'service-management.html', icon: 'service_mngment.svg', adminHref: 'office' },
    { id: 'map', label: 'Map Management', href: 'map-management.html', icon: 'map_mngment.svg', superAdminOnly: true },
    { id: 'analytics', label: 'Analytics', href: 'analytics.html', icon: 'analytics.svg' },
    { id: 'review', label: 'Review Queue', href: 'review-queue.html', icon: 'review_queue.svg', superAdminOnly: true, badge: 'pending' },
    { id: 'accounts', label: 'Account Management', href: 'account-management.html', icon: 'account_management.svg', superAdminOnly: true },
    { id: 'activity', label: 'Activity Log', href: 'activity-log.html', icon: 'activity_log.svg' }
  ];

  // Pages only a Super Admin may open, and where a normal admin is sent instead.
  var SUPER_ADMIN_PAGES = {
    'service-management.html': 'office',
    'map-management.html': 'dashboard.html',
    'review-queue.html': 'dashboard.html',
    'account-management.html': 'dashboard.html'
  };

  var AVATARS = [
    'profileimage_male1.jpg', 'profileimage_male2.jpg', 'profileimage_male3.jpg', 'profileimage_male4.jpg',
    'profileimage_female1.jpg', 'profileimage_female2.jpg', 'profileimage_female3.jpg', 'profileimage_female4.jpg'
  ];
  var DEFAULT_AVATAR = 'assets/user_profile.png';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function read(storage, key) {
    try { return storage.getItem(key); } catch (e) { return null; }
  }

  function write(storage, key, value) {
    try {
      if (value == null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch (e) { /* storage unavailable */ }
  }

  // ---------- Session hint (confirmed and refreshed by js/core/session.js) ----------
  function readSession() {
    try { return JSON.parse(read(localStorage, KEYS.session)) || null; } catch (e) { return null; }
  }

  function saveSession(session) {
    write(localStorage, KEYS.session, session ? JSON.stringify(session) : null);
  }

  function isSuperAdmin(session) {
    return !!session && session.role === 'super_admin';
  }

  function officeHref(session) {
    return session && session.officeId
      ? 'office-services.html?officeId=' + encodeURIComponent(session.officeId)
      : 'office-services.html';
  }

  // Stored photo URLs may point at an old host; the built-in avatars are matched by file name.
  function avatarSrc(url) {
    if (!url) return DEFAULT_AVATAR;
    var file = String(url).split('/').pop().split('?')[0];
    if (AVATARS.indexOf(file) !== -1 || file === 'user_profile.png') return 'assets/' + file;
    return /^https:\/\//.test(url) ? url : DEFAULT_AVATAR;
  }

  // ---------- Sidebar ----------
  function navLinks(session, active) {
    var superAdmin = isSuperAdmin(session);
    return NAV.filter(function (item) {
      return !item.superAdminOnly || superAdmin;
    }).map(function (item) {
      var href = item.adminHref === 'office' && session && !superAdmin ? officeHref(session) : item.href;
      var isActive = item.id === active;
      var badge = '';
      if (item.badge) {
        var count = Number(read(sessionStorage, KEYS.badge + item.badge)) || 0;
        badge = '<span class="nav-badge" data-badge="' + item.badge + '"' + (count ? '' : ' hidden') + '>' +
          (count > 99 ? '99+' : (count || '')) + '</span>';
      }
      return '<a href="' + esc(href) + '" class="nav-item' + (isActive ? ' active" aria-current="page' : '') + '" title="' + esc(item.label) + '">' +
        '<span class="nav-icon"><img src="assets/' + item.icon + '" alt="" /></span>' +
        '<span class="nav-label">' + esc(item.label) + '</span>' + badge +
        '</a>';
    }).join('');
  }

  class AppSidebar extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;
      this.classList.add('sidebar');
      this.setAttribute('aria-label', 'Main menu');
      this.render(readSession());
    }

    render(session) {
      var collapsed = root.classList.contains('sidebar-collapsed');
      this.innerHTML =
        '<div class="sidebar-logo">' +
          '<div class="logo-icon"><img src="assets/logo.png" alt="GaBayan logo" /></div>' +
          '<div class="logo-text"><img src="assets/docsease_text.png" alt="GaBayan" class="brand-img" /></div>' +
        '</div>' +
        '<div class="sidebar-nav-container"><nav class="sidebar-nav">' + navLinks(session, this.getAttribute('active')) + '</nav></div>' +
        '<div class="sidebar-bottom">' +
          '<button type="button" class="btn-collapse" data-collapse title="' + (collapsed ? 'Expand' : 'Collapse') + ' sidebar">' +
            '<img src="assets/' + (collapsed ? 'collapse-right.svg' : 'collapse.svg') + '" alt="' + (collapsed ? 'Expand' : 'Collapse') + '" />' +
          '</button>' +
        '</div>';
      this.querySelector('[data-collapse]').addEventListener('click', toggleSidebar);
    }
  }

  // ---------- Top bar ----------
  function profileButton(session) {
    var superAdmin = isSuperAdmin(session);
    var name = superAdmin ? 'Super Admin' : (session && session.name) || 'Loading...';
    var role = superAdmin ? 'Profile' : 'Admin ✓';
    return '<button type="button" class="user-profile" data-profile-toggle aria-haspopup="menu" aria-expanded="false">' +
      '<span class="user-info"><span class="user-name">' + esc(name) + '</span><span class="user-role">' + esc(role) + '</span></span>' +
      '<span class="user-avatar' + (superAdmin ? ' is-super-admin' : '') + '"><img src="' + esc(avatarSrc(session && session.photoURL)) + '" alt="Your profile" /></span>' +
      '</button>';
  }

  function backButton(el, session) {
    var href = el.getAttribute('back');
    if (!href) return '';
    var onlyFor = el.getAttribute('back-role');
    if (onlyFor === 'super_admin' && !isSuperAdmin(session)) return '';
    return '<a class="btn-back" data-back href="' + esc(href) + '">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>' +
      esc(el.getAttribute('back-label') || 'Back') + '</a>';
  }

  class AppTopbar extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;
      this.classList.add('topbar');
      var session = readSession();

      // Page content placed inside <app-topbar> is parsed after this runs;
      // CSS `order` keeps these at the start and end of the bar.
      this._start = document.createElement('div');
      this._start.className = 'topbar-start';
      this.prepend(this._start);

      this._profile = document.createElement('div');
      this._profile.className = 'topbar-profile';
      this.append(this._profile);
      this.render(session);
    }

    render(session) {
      this._start.innerHTML =
        '<button type="button" class="btn-menu" data-menu aria-label="Open menu">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>' +
        '</button>' + backButton(this, session);
      this._start.querySelector('[data-menu]').addEventListener('click', openDrawer);
      // Only redraw the profile button when the admin's details changed
      // (js/components/profile-menu.js listens on the document, so nothing to re-wire).
      var key = JSON.stringify(session);
      if (this._profile.dataset.session !== key) {
        this._profile.innerHTML = profileButton(session);
        this._profile.dataset.session = key;
      }
    }
  }

  // ---------- Sidebar state ----------
  function toggleSidebar() {
    var collapsed = !root.classList.contains('sidebar-collapsed');
    root.classList.toggle('sidebar-collapsed', collapsed);
    write(localStorage, KEYS.collapsed, collapsed ? '1' : '0');
    document.querySelectorAll('app-sidebar [data-collapse]').forEach(function (btn) {
      btn.title = (collapsed ? 'Expand' : 'Collapse') + ' sidebar';
      var img = btn.querySelector('img');
      img.src = 'assets/' + (collapsed ? 'collapse-right.svg' : 'collapse.svg');
      img.alt = collapsed ? 'Expand' : 'Collapse';
    });
  }

  var backdrop = null;
  function openDrawer() {
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      backdrop.addEventListener('click', closeDrawer);
      document.body.appendChild(backdrop);
    }
    root.classList.add('sidebar-open');
  }

  function closeDrawer() {
    root.classList.remove('sidebar-open');
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });

  // ---------- Public API for page modules ----------
  function applySession(session) {
    saveSession(session);
    root.classList.toggle('is-super-admin', isSuperAdmin(session));
    document.querySelectorAll('app-sidebar').forEach(function (el) { if (el.render) el.render(session); });
    document.querySelectorAll('app-topbar').forEach(function (el) { if (el.render) el.render(session); });
  }

  function setBadge(name, count) {
    write(sessionStorage, KEYS.badge + name, String(count || 0));
    document.querySelectorAll('[data-badge="' + name + '"]').forEach(function (el) {
      el.textContent = count > 99 ? '99+' : String(count || '');
      el.hidden = !count;
      el.setAttribute('aria-label', count + ' pending request' + (count === 1 ? '' : 's'));
    });
  }

  function currentPage() {
    return location.pathname.split('/').pop() || 'index.html';
  }

  window.GaBayan = {
    NAV: NAV,
    SUPER_ADMIN_PAGES: SUPER_ADMIN_PAGES,
    AVATARS: AVATARS,
    readSession: readSession,
    saveSession: saveSession,
    applySession: applySession,
    officeHref: officeHref,
    avatarSrc: avatarSrc,
    setBadge: setBadge,
    toggleSidebar: toggleSidebar,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    currentPage: currentPage,
    hasFreshAccess: hasFreshAccess
  };

  var SESSION_FRESH_MS = 10 * 60 * 1000;

  function hasFreshAccess() {
    var session = readSession();
    if (!session || session.status !== 'active') return false;
    if (Date.now() - (session.savedAt || 0) >= SESSION_FRESH_MS) return false;
    var needsSuper = SUPER_ADMIN_PAGES[currentPage()] !== undefined;
    return !needsSuper || isSuperAdmin(session);
  }

  if (!/(^|\/)(login(\.html)?)?$/.test(location.pathname) && !hasFreshAccess()) {
    root.style.opacity = '0';
  }

  // Before first paint: collapsed state and the cached role.
  if (read(localStorage, KEYS.collapsed) === '1') root.classList.add('sidebar-collapsed');
  if (isSuperAdmin(readSession())) root.classList.add('is-super-admin');

  // No sidebar animation while the page loads
  root.classList.add('preload');
  window.addEventListener('load', function () {
    requestAnimationFrame(function () { root.classList.remove('preload'); });
  });

  customElements.define('app-sidebar', AppSidebar);
  customElements.define('app-topbar', AppTopbar);
})();