// Asks before leaving a page with unsaved changes: any link (sidebar, back button),
// the browser's Back button, and closing or reloading the tab.
//
//   const guard = guardUnsavedChanges(() => form.hasChanges());
//   guard.release();               // after saving, leave freely
//   await guard.leave('page.html') // navigate, asking first if needed
import { confirm } from './toast.js';

export function guardUnsavedChanges(hasChanges, {
  title = 'Leave without saving?',
  msg = 'Your changes will not be saved if you leave this page.'
} = {}) {
  let released = false;
  const dirty = () => !released && hasChanges();
  const ask = () => confirm({ type: 'warning', title, msg, confirmText: 'Leave', cancelText: 'Stay' });

  document.addEventListener('click', async (e) => {
    const link = e.target.closest('a[href]');
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || link.target === '_blank') return;
    if (link.getAttribute('href').startsWith('#') || !dirty()) return;
    e.preventDefault();
    if (await ask()) {
      released = true;
      location.href = link.href;
    }
  }, true);

  // Browser Back: keep one extra history entry so the page can ask first.
  history.pushState({ gabayanGuard: true }, '', location.href);
  window.addEventListener('popstate', async () => {
    if (released) return;
    if (!hasChanges()) {
      released = true;
      history.back();
      return;
    }
    history.pushState({ gabayanGuard: true }, '', location.href);
    if (await ask()) {
      released = true;
      history.go(-2);
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  return {
    release() {
      released = true;
    },
    async leave(url) {
      if (dirty() && !(await ask())) return false;
      released = true;
      location.href = url;
      return true;
    }
  };
}
