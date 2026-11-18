import { fitCamera } from '../scene.js';

// ---------------------------------------------------------------------------
// Collapse and expand the controls panel and the toolbar, so the house and
// garden get more of the screen (handy on phones). The camera refits to the
// space that is left.
// ---------------------------------------------------------------------------
function collapsible(boxId, toggleId, name) {
  const box = document.getElementById(boxId);
  const toggle = document.getElementById(toggleId);
  toggle.addEventListener('click', () => {
    const collapsed = box.classList.toggle('collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? `Show the ${name}` : `Collapse the ${name}`);
    requestAnimationFrame(() => fitCamera(true));
  });
}

collapsible('panel', 'panel-toggle', 'controls');
collapsible('toolbar', 'toolbar-toggle', 'toolbar');
