// Tiny UI helpers: toast, modal, popover, escaping.
import { icon } from './icons.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

let toastRoot;
export function toast(msg, kind = 'info', ms = 2600) {
  if (!toastRoot) {
    toastRoot = h('<div class="toast-root" role="status" aria-live="polite"></div>');
    document.body.appendChild(toastRoot);
  }
  const el = h(`<div class="toast ${kind}">${esc(msg)}</div>`);
  toastRoot.appendChild(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

/** Show a modal. `body` is an HTML string; returns { el, close }. */
export function modal({ title, body, wide = false, onClose }) {
  const el = h(`
    <div class="modal-back">
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close title="ปิด">${icon('close')}</button></div>
        <div class="modal-body">${body}</div>
      </div>
    </div>`);
  const close = () => {
    el.remove();
    document.removeEventListener('keydown', onKey, true);
    onClose && onClose();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  el.addEventListener('mousedown', (e) => {
    if (e.target === el) close();
  });
  el.querySelector('[data-close]').onclick = close;
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(el);
  return { el, close };
}

export function confirmDialog(message, okLabel = 'ตกลง', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title: 'ยืนยัน',
      body: `<p class="confirm-msg">${esc(message)}</p>
        <div class="modal-actions"><button class="btn" data-no>ยกเลิก</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(okLabel)}</button></div>`,
      onClose: () => !done && resolve(false),
    });
    m.el.querySelector('[data-no]').onclick = () => m.close();
    m.el.querySelector('[data-yes]').onclick = () => {
      done = true;
      m.close();
      resolve(true);
    };
  });
}

export function promptDialog(title, value = '') {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title,
      body: `<input class="input full" data-v value="${esc(value)}" />
        <div class="modal-actions"><button class="btn" data-no>ยกเลิก</button><button class="btn primary" data-yes>ตกลง</button></div>`,
      onClose: () => !done && resolve(null),
    });
    const inp = m.el.querySelector('[data-v]');
    inp.focus();
    inp.select();
    const ok = () => {
      done = true;
      const v = inp.value;
      m.close();
      resolve(v);
    };
    inp.onkeydown = (e) => e.key === 'Enter' && ok();
    m.el.querySelector('[data-no]').onclick = () => m.close();
    m.el.querySelector('[data-yes]').onclick = ok;
  });
}

// ---------- popover ----------
let pop = null;
export function closePopover() {
  if (pop) {
    pop.el.remove();
    document.removeEventListener('mousedown', pop.outside, true);
    document.removeEventListener('keydown', pop.key, true);
    const cb = pop.onClose;
    pop = null;
    cb && cb();
  }
}
export function popoverOpen(key) {
  return !!pop && pop.id === key;
}

/** Open a popover anchored to `anchor`. Returns the popover element. */
export function popover(anchor, html, { key, className = '', onClose, align = 'left' } = {}) {
  closePopover();
  const el = h(`<div class="popover ${className}">${html}</div>`);
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  const pw = el.offsetWidth;
  const ph = el.offsetHeight;
  let left = align === 'right' ? r.right - pw : r.left;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  let top = r.bottom + 6;
  if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
  if (top + ph > window.innerHeight - 8) top = Math.max(8, window.innerHeight - ph - 8);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  const outside = (e) => {
    if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover();
  };
  const keyH = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closePopover();
    }
  };
  setTimeout(() => document.addEventListener('mousedown', outside, true));
  document.addEventListener('keydown', keyH, true);
  pop = { el, outside, key: keyH, id: key, onClose };
  return el;
}
export function currentPopoverId() {
  return pop ? pop.id : null;
}
