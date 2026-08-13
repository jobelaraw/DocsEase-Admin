function toggleDropdown(e) {
  e.stopPropagation();
  document.getElementById('profile-dropdown').classList.toggle('show');
}
document.addEventListener('click', () => {
  document.getElementById('profile-dropdown')?.classList.remove('show');
});

window.handleSignOut = async function (e) {
  e.stopPropagation();
  const overlay = document.createElement('div');
  overlay.id = 'signout-overlay';
  overlay.innerHTML = `...`; // your spinner markup
  document.body.appendChild(overlay);
  const { auth } = await import('../Firebase/firebase-config.js');
  const { signOut } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
  await signOut(auth);
  window.location.href = '../Authentication/auth.html';
};

window.updateProfileDisplay = function (user) {
  const nameEl = document.querySelector('.user-name');
  const roleEl = document.querySelector('.user-role');
  if (nameEl) nameEl.textContent = user.displayName || user.email;
  if (roleEl) roleEl.textContent = 'Admin ✓';
};