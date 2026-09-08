document.querySelectorAll('.menu-button').forEach((button) => {
  const menu = document.getElementById(button.getAttribute('aria-controls'));
  if (!menu) return;
  const closeMenu = () => { button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-label', 'Open site menu'); menu.hidden = true; };
  button.addEventListener('click', () => { const isOpen = button.getAttribute('aria-expanded') === 'true'; if (isOpen) closeMenu(); else { button.setAttribute('aria-expanded', 'true'); button.setAttribute('aria-label', 'Close site menu'); menu.hidden = false; } });
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeMenu(); button.focus(); } });
  document.addEventListener('click', (event) => { if (!button.contains(event.target) && !menu.contains(event.target)) closeMenu(); });
});
