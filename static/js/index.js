/**
 * utility fetch wrapper
 * 
 * @param {string} path path to the api
 * @param {{ body?: string, json?: object, method?: string, headers?: { [key: string]: string } }?} options metadata sent to the api
 */
const sendRequest = async (path, options = {}) => {
    // create headers from the options
    const headers = options.headers || {};
    if (options.json) headers['Content-Type'] = 'application/json';

    // get the response and content type
    const response = await fetch(path, { method: options.method || 'GET', headers, body: options.json ? JSON.stringify(options.json) : options.body });
    const contentType = response.headers.get('Content-Type') || '';
    
    // fetch either the json or the raw body
    let data = null;
    if (contentType.includes('application/json')) data = await response.json();
    else data = await response.text();
    
    // check for errors
    if (!response.ok) throw { status: response.status, body: data };
    return data;
}

/**
 * escapes a string that is sent to the backend
 * 
 * @param {string} s string to escape
 * @returns escaped string
 */
const escapeHtml = (s) => { if (!s) return ''; return String(s).replace(/[&<>\"]+/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c)); }

self.addEventListener('load', () => {
    // ~~ Auth ~~
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const userbar = document.getElementById('userbar');
    const logoutButton = document.getElementById('logout-button');

    /**
     * loads all needed information and shows the elements of the dashboard
     */
    const showDashboard = () => {
        document.getElementById('login').style.display = 'none';
        document.getElementById('dashboard').style.display = '';
        userbar.style.display = 'flex';
        loadURLandNextFetch();
        // loadChannels(); loadFilters(); loadMediaList(); loadJellyfinActive(); loadJellyfinStatus();
    };

    /**
     * loads the url and timestamp of the next automatic fetch
     */
    const loadURLandNextFetch = async () => {
        try {
            const urlRequest = await sendRequest('/api/m3u');
            const nextFetchRequest = await sendRequest('/api/next-fetch');

            document.getElementById('m3u-url').value = urlRequest.url;
            document.getElementById('next-fetch').textContent = 'next fetch: ' + (nextFetchRequest.time || '—');
        } catch (err) {
            console.log(err);
            document.getElementById('next-fetch').textContent = 'next fetch: —';
        }
    }

    loginForm.addEventListener('submit', async event => {
        // reset fields
        event.preventDefault();
        loginError.textContent = '';

        // attempt to login, send a request to the api
        const password = document.getElementById('password-input').value;
        try {
            // if successful, show dashboard (applies cookie automatically with response)
            await sendRequest('/api/login', { method: 'POST', json: { password } });
            showDashboard();
        } catch (err) {
            // if not, show error
            console.error(err);
            loginError.textContent = err.body.message;
        }
    });

    logoutButton.addEventListener('click', () => {
        // remove session token
        Cookies.remove('session');

        // show login, hide dashboard
        document.getElementById('login').style.display = '';
        document.getElementById('dashboard').style.display = 'none';
        userbar.style.display = 'none';
    });

    // if we are already logged in, show dashboard immediately
    if (Cookies.get('session') !== undefined) {
        showDashboard();
    }

    // ~~ Tabs ~~
    document.querySelectorAll('nav button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
            document.getElementById('tab-' + button.dataset.tab).style.display = '';
        });
    });

    // ~~ sources & fetch ~~
    const sourceMessage = document.getElementById('source-message');

    // send url to the backend to save
    document.getElementById('save-url').addEventListener('click', async () => {
        const url = document.getElementById('m3u-url').value.trim();
        
        // check to see if the url is valid
        sourceMessage.textContent = '';
        sourceMessage.classList.remove('error', 'success');
        if (!url) {
            sourceMessage.textContent = 'please provide a valid url';
            sourceMessage.classList.add('error');
            return;
        }
        
        try {
            const response = await sendRequest('/api/m3u', { method: 'POST', json: { url } });
            sourceMessage.textContent = response.message;
            sourceMessage.classList.add('success');
            loadURLandNextFetch(); 
            // loadChannels();
        } catch (err) {
            console.error(err);
            sourceMessage.textContent = err.body.message;
            sourceMessage.classList.add('error');
        }
    });

    // force a fetch and update the timestamp
    document.getElementById('fetch-now').addEventListener('click', async () => {
        try {
            const response = await sendRequest('/api/m3u/fetch', { method: 'POST' });
            sourceMessage.textContent = response.message;
            loadURLandNextFetch();
            // loadChannels();
        } catch (err) {
            console.error(err);
            sourceMessage.textContent = err.body.message;
        }
    });
});

// --- Channels & filters ---
const channelsList = document.getElementById('available-channels-list');
const filtersArea = document.getElementById('filtersArea');
const channelSearch = document.getElementById('channelSearch');

async function loadChannels() {
    channelsList.innerHTML = '<div class="muted small">Loading…</div>';
    try {
        const list = await api('/api/channels');
        renderChannels(list || []);
    } catch (e) { channelsList.innerHTML = '<div class="muted small">Failed to load channels.</div>' }
}

function renderChannels(list) {
    const q = channelSearch.value.trim().toLowerCase();
    const filtered = list.filter(c => c.name.toLowerCase().includes(q) || (c.group || '').toLowerCase().includes(q));
    channelsList.innerHTML = '';
    if (!filtered.length) { channelsList.innerHTML = '<div class="muted small">No channels found.</div>'; return }
    const table = document.createElement('table');
    const thead = document.createElement('thead'); thead.innerHTML = '<tr><th>Name</th><th>Group</th><th>URL</th><th></th></tr>'; table.appendChild(thead);
    const tbody = document.createElement('tbody');
    filtered.forEach(ch => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${escapeHtml(ch.name)}</td><td>${escapeHtml(ch.group || '')}</td><td class="small">${escapeHtml(ch.url)}</td><td><button class="btn btn-ghost small" data-url="${escapeHtml(ch.url)}">Toggle</button></td>`;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody); channelsList.appendChild(table);
}

channelSearch.addEventListener('input', () => { loadChannels(); });

// Filters
document.getElementById('addFilter').addEventListener('click', async () => {
    const text = document.getElementById('newFilter').value.trim(); if (!text) return;
    try { await api('/api/filters', { method: 'POST', json: { filter: text } }); document.getElementById('newFilter').value = ''; loadFilters(); }
    catch (e) { console.error(e); }
});

async function loadFilters() {
    filtersArea.innerHTML = '<div class="muted small">Loading…</div>';
    try {
        const list = await api('/api/filters');
        if (!list || !list.length) { filtersArea.innerHTML = '<div class="muted small">No filters configured.</div>'; return }
        filtersArea.innerHTML = '';
        list.forEach(f => {
            const wrap = document.createElement('div'); wrap.className = 'row'; wrap.style.marginBottom = '8px';
            const p = document.createElement('div'); p.textContent = f.text; p.className = 'pill';
            const del = document.createElement('button'); del.className = 'btn btn-ghost'; del.textContent = 'Remove'; del.style.marginLeft = '8px';
            del.addEventListener('click', async () => { await api('/api/filters/' + encodeURIComponent(f.id), { method: 'DELETE' }); loadFilters(); });
            wrap.appendChild(p); wrap.appendChild(del); filtersArea.appendChild(wrap);
        });
    } catch (e) { filtersArea.innerHTML = '<div class="muted small">Failed to load filters.</div>' }
}

document.getElementById('applyFilters').addEventListener('click', async () => {
    try { await api('/api/filters/apply', { method: 'POST' }); alert('Filters applied and final M3U will be regenerated.'); }
    catch (e) { console.error(e); alert('Failed to apply filters.'); }
});

// --- Media requests ---
const mediaList = document.getElementById('mediaList');
const jellyfinActive = document.getElementById('jellyfinActive');

async function loadMediaList() {
    mediaList.innerHTML = '<div class="muted small">Loading…</div>';
    try {
        const list = await api('/api/media');
        renderMedia(list || []);
    } catch (e) { mediaList.innerHTML = '<div class="muted small">Failed to load media.</div>' }
}

function renderMedia(list) {
    mediaList.innerHTML = '';
    if (!list.length) { mediaList.innerHTML = '<div class="muted small">No media in database.</div>'; return }
    const ul = document.createElement('div'); ul.style.display = 'grid'; ul.style.gap = '8px';
    list.forEach(item => {
        const card = document.createElement('div'); card.className = 'card'; card.style.display = 'flex'; card.style.alignItems = 'center';
        card.innerHTML = `<div style="flex:1"><strong>${escapeHtml(item.title)}</strong><div class="muted small">${escapeHtml(item.type)} • ${escapeHtml(item.info || '')}</div></div>`;
        const btn = document.createElement('button'); btn.className = 'btn btn-primary'; btn.textContent = 'Request';
        btn.addEventListener('click', async () => { try { await api('/api/request', { method: 'POST', json: { id: item.id, type: item.type } }); alert('Requested ' + item.title); loadJellyfinActive(); } catch (e) { alert('Failed to request.'); } });
        card.appendChild(btn); ul.appendChild(card);
    });
    mediaList.appendChild(ul);
}

async function loadJellyfinActive() {
    jellyfinActive.innerHTML = '<div class="muted small">Loading…</div>';
    try {
        const list = await api('/api/jellyfin/active'); if (!list.length) { jellyfinActive.innerHTML = '<div class="muted small">No active items.</div>'; return };
        jellyfinActive.innerHTML = ''; list.forEach(i => { const d = document.createElement('div'); d.className = 'card small'; d.style.marginBottom = '8px'; d.innerHTML = `<strong>${escapeHtml(i.title)}</strong><div class="muted small">${escapeHtml(i.path)}</div>`; jellyfinActive.appendChild(d); });
    }
    catch (e) { jellyfinActive.innerHTML = '<div class="muted small">Failed to load.</div>' }
}

// --- Jellyfin status ---
async function loadJellyfinStatus() {
    try { const s = await api('/api/jellyfin/status'); document.getElementById('jellyfinStatus').textContent = s.status || '—'; }
    catch (e) { document.getElementById('jellyfinStatus').textContent = 'Failed to load'; }
}
document.getElementById('refreshJellyfin').addEventListener('click', loadJellyfinStatus);

// show errors from non-JSON responses
self.addEventListener('unhandledrejection', e => { console.error(e); });