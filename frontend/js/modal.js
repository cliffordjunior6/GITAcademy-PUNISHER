/**
 * GITAcademy — modal.js
 * Reusable modal system for confirmations, alerts, forms
 */

let activeModal = null;

export function openModal(options = {}) {
  closeModal(); // close any existing

  const {
    title       = 'Confirm',
    content     = '',
    confirmText = 'Confirm',
    cancelText  = 'Cancel',
    onConfirm   = null,
    onCancel    = null,
    type        = 'default', // 'default' | 'danger' | 'success'
    size        = 'sm',      // 'sm' | 'md' | 'lg'
  } = options;

  const widths = { sm: '420px', md: '560px', lg: '720px' };
  const confirmColors = {
    default: 'background:#0d0d0f;color:#f5f0e8',
    danger:  'background:#e05555;color:white',
    success: 'background:#2d7a4f;color:white',
  };

  const overlay = document.createElement('div');
  overlay.id = 'lh-modal-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(13,13,15,.55);z-index:9000;
    display:flex;align-items:center;justify-content:center;padding:1.5rem;
    animation:fadeIn .2s ease;
  `;

  const modal = document.createElement('div');
  modal.id = 'lh-modal';
  modal.style.cssText = `
    background:white;border-radius:20px;padding:2rem;
    width:100%;max-width:${widths[size]};box-shadow:0 24px 60px rgba(13,13,15,.22);
    animation:slideUp .25s cubic-bezier(.34,1.56,.64,1);
    font-family:'DM Sans',sans-serif;position:relative;
  `;

  modal.innerHTML = `
    <button id="lh-modal-close" style="position:absolute;top:1rem;right:1rem;background:rgba(13,13,15,.06);border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;color:rgba(13,13,15,.5);">×</button>
    ${title ? `<h3 style="font-family:'Fraunces',serif;font-size:1.3rem;font-weight:900;letter-spacing:-.03em;margin-bottom:.65rem">${title}</h3>` : ''}
    <div style="font-size:.9rem;color:rgba(13,13,15,.65);line-height:1.7;margin-bottom:1.5rem">${content}</div>
    <div style="display:flex;gap:.75rem;justify-content:flex-end;flex-wrap:wrap">
      ${cancelText ? `<button id="lh-modal-cancel" style="padding:.65rem 1.4rem;border-radius:100px;border:1.5px solid rgba(13,13,15,.15);background:transparent;font-size:.875rem;font-weight:500;cursor:pointer;font-family:inherit">${cancelText}</button>` : ''}
      ${confirmText ? `<button id="lh-modal-confirm" style="padding:.65rem 1.6rem;border-radius:100px;border:none;${confirmColors[type]};font-size:.875rem;font-weight:600;cursor:pointer;font-family:inherit;transition:.2s">${confirmText}</button>` : ''}
    </div>`;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  activeModal = overlay;

  // Inject animation styles
  if (!document.getElementById('lh-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'lh-modal-styles';
    style.textContent = `
      @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    `;
    document.head.appendChild(style);
  }

  // Event listeners
  document.getElementById('lh-modal-close')?.addEventListener('click', () => { onCancel?.(); closeModal(); });
  document.getElementById('lh-modal-cancel')?.addEventListener('click', () => { onCancel?.(); closeModal(); });
  document.getElementById('lh-modal-confirm')?.addEventListener('click', () => { onConfirm?.(); closeModal(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { onCancel?.(); closeModal(); } });
  document.addEventListener('keydown', escListener);

  return modal;
}

function escListener(e) {
  if (e.key === 'Escape') closeModal();
}

export function closeModal() {
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', escListener);
  }
}

/** Shorthand: confirm dialog → returns promise<boolean> */
export function confirmModal(title, message, type = 'danger') {
  return new Promise((resolve) => {
    openModal({
      title, content: message, type,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm: () => resolve(true),
      onCancel:  () => resolve(false),
    });
  });
}

/** Shorthand: alert dialog */
export function alertModal(title, message, type = 'default') {
  return new Promise((resolve) => {
    openModal({
      title, content: message, type,
      confirmText: 'OK',
      cancelText: null,
      onConfirm: () => resolve(true),
    });
  });
}
