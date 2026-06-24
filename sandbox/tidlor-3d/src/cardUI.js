// DOM overlay card modal. Accessible: role=dialog, ESC to close, focus restore,
// scrim click to dismiss. Returns an object with open(key) / close().
import { CARDS } from './cards.js';

export function createCardUI() {
  const scrim = document.createElement('div');
  scrim.className = 'ui-card-scrim';
  scrim.setAttribute('role', 'dialog');
  scrim.setAttribute('aria-modal', 'true');
  scrim.setAttribute('aria-hidden', 'true');

  const card = document.createElement('div');
  card.className = 'ui-card';
  scrim.appendChild(card);
  document.body.appendChild(scrim);

  let lastFocus = null;
  let isOpen = false;

  function close() {
    if (!isOpen) return;
    isOpen = false;
    scrim.classList.remove('open');
    scrim.setAttribute('aria-hidden', 'true');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function open(key) {
    const data = CARDS[key];
    if (!data) return;
    lastFocus = document.activeElement;
    card.style.setProperty('--accent', data.accent);
    card.innerHTML = `
      <div class="ui-card-top">
        <span class="ui-card-num">${data.num}</span>
        <h2 id="ui-card-title">${data.title}</h2>
        <button class="ui-card-close" aria-label="Close card" type="button">&times;</button>
      </div>
      ${data.html}
    `;
    scrim.setAttribute('aria-labelledby', 'ui-card-title');
    scrim.classList.add('open');
    scrim.setAttribute('aria-hidden', 'false');
    isOpen = true;
    const closeBtn = card.querySelector('.ui-card-close');
    closeBtn.addEventListener('click', close);
    closeBtn.focus();
  }

  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) close(); });

  return { open, close, get isOpen() { return isOpen; } };
}
