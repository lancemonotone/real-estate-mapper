async function copyText(text) {
  const value = text.trim();
  if (!value) throw new Error('empty');

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      /* fall through to execCommand */
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!ok) throw new Error('copy failed');
}

function setInviteCopyStatus(message) {
  const status = document.getElementById('invite-copy-status');
  if (status) status.textContent = message;
}

function initInviteCopy() {
  const section = document.querySelector('.invite-section');
  if (!section || section.dataset.inviteCopyBound === 'true') return;
  section.dataset.inviteCopyBound = 'true';

  section.addEventListener('click', async (event) => {
    const input = section.querySelector('[data-invite-url]');
    if (!(input instanceof HTMLInputElement)) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const isCopyControl =
      target === input || target.closest('[data-copy-invite]') != null;
    if (!isCopyControl) return;

    event.preventDefault();

    try {
      await copyText(input.value);
      setInviteCopyStatus('Copied to clipboard.');
      window.setTimeout(() => setInviteCopyStatus(''), 2000);
    } catch {
      setInviteCopyStatus('Could not copy. Select the link and copy manually.');
    }
  });
}

document.addEventListener('astro:page-load', initInviteCopy);
initInviteCopy();
