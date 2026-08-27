// Helper genérico de modal + toast, usado por todas as telas.

function openModal(innerHtml) {
  closeModal();
  const overlay = el(`<div class="modal-overlay" id="modal-overlay"><div class="modal">${innerHtml}</div></div>`);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', escCloseHandler);
  return overlay.querySelector('.modal');
}

function escCloseHandler(e) {
  if (e.key === 'Escape') closeModal();
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.remove();
  document.removeEventListener('keydown', escCloseHandler);
}

function toast(msg) {
  const t = el(`<div class="toast">${escapeHtml(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
