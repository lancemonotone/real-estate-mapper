function copyInviteUrl(input) {
  const url = input.value.trim();
  if (!url) return Promise.reject(new Error('empty'));

  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(url);
  }

  input.focus();
  input.select();
  const ok = document.execCommand('copy');
  input.setSelectionRange(0, 0);
  if (!ok) return Promise.reject(new Error('copy failed'));
  return Promise.resolve();
}

function setInviteCopyStatus(message) {
  const status = document.getElementById('invite-copy-status');
  if (status) status.textContent = message;
}

function bindInviteCopy(root) {
  const input = root.querySelector('[data-invite-url]');
  if (!(input instanceof HTMLInputElement)) return;

  const copy = async () => {
    try {
      await copyInviteUrl(input);
      setInviteCopyStatus('Copied to clipboard.');
      window.setTimeout(() => setInviteCopyStatus(''), 2000);
    } catch {
      setInviteCopyStatus('Could not copy. Select the link and copy manually.');
    }
  };

  root.querySelector('[data-copy-invite]')?.addEventListener('click', copy);
  input.addEventListener('click', copy);
}

const inviteCopyRoot = document.getElementById('invite-copy');
if (inviteCopyRoot) bindInviteCopy(inviteCopyRoot);
