(() => {
  const message = document.getElementById('account-message');
  const setup = document.body.dataset.setup === 'true';
  let token = new URLSearchParams(location.hash.slice(1)).get('token');
  if (setup && location.hash) history.replaceState(null, '', location.pathname);
  let csrfToken = '', nextCursor = null;
  const report = (text, failure = false) => { message.textContent = text; message.classList.toggle('error', failure); };
  async function api(path, data, method = 'POST') {
    const response = await fetch('/api/v1/' + path, {
      method, credentials: 'same-origin',
      headers: data ? {'Content-Type': 'application/json', 'X-CSRFToken': csrfToken} : {},
      body: data ? JSON.stringify(data) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'Request failed. Please try again.');
    if (result.csrf_token) csrfToken = result.csrf_token;
    return result;
  }
  async function busy(button, action) {
    button.disabled = true;
    try { await action(); } catch (error) { report(error.message, true); }
    finally { button.disabled = false; }
  }
  async function approvals(append = false) {
    const list = document.getElementById('approval-list');
    if (!append) list.replaceChildren();
    const result = await api('staff/account-approvals' + (append && nextCursor ? '?cursor=' + encodeURIComponent(nextCursor) : ''), null, 'GET');
    nextCursor = result.next_cursor;
    for (const person of result.items) {
      const row = document.createElement('div'); row.className = 'approval-row';
      const identity = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = person.first_name + ' ' + person.last_name;
      const username = document.createElement('small'); username.textContent = '@' + person.intra_username;
      identity.append(name, username);
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Approve';
      button.addEventListener('click', () => busy(button, async () => {
        await api('staff/account-approvals/' + encodeURIComponent(person.id) + '/approve', {});
        row.remove(); report('Student approved.');
        if (!list.children.length) await approvals();
      }));
      row.append(identity, button); list.append(row);
    }
    if (!list.children.length) list.textContent = 'No accounts awaiting approval.';
    document.getElementById('more-approvals').hidden = !nextCursor;
  }
  async function showSession() {
    const user = await api('me', null, 'GET');
    document.getElementById('account-entry').hidden = true;
    document.getElementById('signed-in').hidden = false;
    document.getElementById('signed-in-name').textContent = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.intra_username;
    if (user.role === 'staff') { document.getElementById('approvals').hidden = false; await approvals(); }
  }
  const ready = api('auth/csrf', null, 'GET');
  ready.catch(() => report('Unable to connect. Reload the page.', true));
  if (setup) {
    if (!token) { report('Open the setup link from your email, or request a new one.', true); document.querySelector('#complete-form button').disabled = true; }
    document.getElementById('complete-form').addEventListener('submit', event => {
      event.preventDefault(); const form = event.currentTarget;
      busy(form.querySelector('button'), async () => {
        await ready;
        const password = document.getElementById('new-password').value;
        if (password !== document.getElementById('repeat-password').value) throw new Error('Passwords do not match.');
        const result = await api('auth/setup-complete', {token, password});
        token = null; form.reset(); form.hidden = true;
        report(result.status === 'awaiting_approval' ? 'Password created and email verified. Please wait for staff approval before signing in.' : 'Your account is ready. You can sign in now.');
      });
    });
  } else {
    document.getElementById('login-form').addEventListener('submit', event => {
      event.preventDefault(); const form = event.currentTarget;
      busy(form.querySelector('button'), async () => {
        await ready;
        await api('auth/login', Object.fromEntries(new FormData(form)));
        form.reset(); report(''); await showSession();
      });
    });
    document.getElementById('request-setup').addEventListener('click', event => busy(event.currentTarget, async () => {
      await ready; const username = document.getElementById('username');
      if (!username.reportValidity()) return;
      const result = await api('auth/setup-request', {intra_username: username.value, account_type: document.getElementById('account-type').value});
      report(result.message);
    }));
    ready.then(() => showSession()).catch(() => {});
  }
  document.getElementById('logout').addEventListener('click', event => busy(event.currentTarget, async () => { await ready; await api('auth/logout', {}); location.assign('/account/'); }));
  document.getElementById('more-approvals').addEventListener('click', event => busy(event.currentTarget, () => approvals(true)));
})();
