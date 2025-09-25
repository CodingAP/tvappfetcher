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

self.addEventListener('load', () => {
    // ~~ Auth ~~
    const loginForm = document.querySelector('#login-form');
    const loginError = document.querySelector('#login-error');
    const userbar = document.querySelector('#userbar');
    const logoutButton = document.querySelector('#logout-button');

    /**
     * loads all needed information and shows the elements of the dashboard
     */
    const showDashboard = () => {
        document.querySelector('#login').style.display = 'none';
        document.querySelector('#dashboard').style.display = '';
        userbar.style.display = 'flex';
        loadSettingsTab();
        loadStatusTab();
        // loadChannels(); loadFilters(); loadMediaList(); loadJellyfinActive(); loadJellyfinStatus();
    };

    /**
     * loads the url and timestamp of the next automatic fetch
     */
    const loadSettingsTab = async () => {
        try {
            const settingsRequest = await sendRequest('/api/settings');
            const nextFetchRequest = await sendRequest('/api/next-fetch');

            document.querySelector('#m3u-url').value = settingsRequest.url;
            document.querySelector('#channels-save-path').value = settingsRequest.channelsSavePath;
            document.querySelector('#movies-save-path').value = settingsRequest.moviesSavePath;
            document.querySelector('#series-save-path').value = settingsRequest.seriesSavePath;
            document.querySelector('#next-fetch').textContent = 'next fetch: ' + (nextFetchRequest.time || '—');
        } catch (err) {
            console.log(err);
            document.querySelector('#next-fetch').textContent = 'next fetch: —';
        }
    }

    /**
     * loads the app status
     */
    const loadStatusTab = async () => {
        try {
            const response = await sendRequest('/api/status');
            document.querySelector('#app-status').textContent = response.status || '—';
        } catch (err) {
            console.log(err);
            document.querySelector('#app-status').textContent = 'failed to load status!';
        }
    }

    loginForm.addEventListener('submit', async event => {
        // reset fields
        event.preventDefault();
        loginError.textContent = '';

        // attempt to login, send a request to the api
        const password = document.querySelector('#password-input').value;
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
        document.querySelector('#login').style.display = '';
        document.querySelector('#dashboard').style.display = 'none';
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
            document.querySelector('#tab-' + button.dataset.tab).style.display = '';
        });
    });

    // ~~ config ~~
    const fetchMessage = document.querySelector('#fetch-message');
    const settingsMessage = document.querySelector('#settings-message');

    // send config to the backend to save
    document.querySelector('#save-settings').addEventListener('click', async () => {
        const url = document.querySelector('#m3u-url').value.trim();
        const channelsSavePath = document.querySelector('#channels-save-path').value.trim();
        const moviesSavePath = document.querySelector('#movies-save-path').value.trim();
        const seriesSavePath = document.querySelector('#series-save-path').value.trim();
        
        // check to see if the inputs are valid
        settingsMessage.textContent = '';
        settingsMessage.classList.remove('error', 'success');
        if (!url) {
            settingsMessage.textContent = 'please provide a url!';
            settingsMessage.classList.add('error');
            return;
        }

        if (!channelsSavePath) {
            settingsMessage.textContent = 'please provide a data path for channels!';
            settingsMessage.classList.add('error');
            return;
        }

        if (!moviesSavePath) {
            settingsMessage.textContent = 'please provide a data path for movies!';
            settingsMessage.classList.add('error');
            return;
        }

        if (!seriesSavePath) {
            settingsMessage.textContent = 'please provide a data path for series!';
            settingsMessage.classList.add('error');
            return;
        }
        
        try {
            const response = await sendRequest('/api/settings', { method: 'POST', json: { url, channelsSavePath, moviesSavePath, seriesSavePath } });
            settingsMessage.textContent = response.message;
            settingsMessage.classList.add('success');
            loadSettingsTab();
        } catch (err) {
            console.error(err);
            settingsMessage.textContent = err.body.message;
            settingsMessage.classList.add('error');
        }
    });

    // force a fetch and update the timestamp
    document.querySelector('#fetch-now').addEventListener('click', async () => {
        try {
            const response = await sendRequest('/api/fetch');
            fetchMessage.textContent = response.message;
            loadSettingsTab();
        } catch (err) {
            console.error(err);
            fetchMessage.textContent = err.body.message;
        }
    });

    // force a create
    document.querySelector('#create-now').addEventListener('click', async () => {
        try {
            const response = await sendRequest('/api/create');
            fetchMessage.textContent = response.message;
            loadSettingsTab();
        } catch (err) {
            console.error(err);
            fetchMessage.textContent = err.body.message;
        }
    });

    // ~~ movie request ~~
    const allMoviesPaginator = document.querySelector('#all-movies');
    const allMoviesMessage = document.querySelector('#all-movies-message');

    allMoviesPaginator.headers = [
        { key: 'name', label: 'movie name' },
        { key: 'fetched', label: 'fetch', render: row => {
            const button = document.createElement('button');
            button.classList.add('button');
            if (row.fetched) {
                button.textContent = 'remove';
                button.classList.add('button-ghost');
            } else {
                button.textContent = 'fetch';
                button.classList.add('button-primary');
            }

            button.addEventListener('click', async () => {
                try {
                    await sendRequest('/api/movie/fetch', { method: 'PUT', json: { id: row.id, fetched: !row.fetched } });
                    allMoviesPaginator.emit();
                    fetchedMoviesPaginator.emit();
                } catch (err) {
                    console.error(err);
                    allMoviesMessage.textContent = err.body.message;
                }
            });

            return button;
        } },
    ];

    allMoviesPaginator.addEventListener('page-change', async event => {
        try {
            const searchText = document.querySelector('#search-movie').value;
            const response = await sendRequest('/api/movie/search', { method: 'POST', json: { search: searchText, ...event.detail, fetched: false } });
            allMoviesPaginator.total = response.total;
            allMoviesPaginator.data = response.movies;
            allMoviesPaginator.render();
        } catch (err) {
            console.error(err);
            allMoviesMessage.textContent = err.body.message;
        }
    });

    const fetchedMoviesPaginator = document.querySelector('#fetched-movies');
    const fetchedMoviesMessage = document.querySelector('#fetched-movies-message')
    fetchedMoviesPaginator.headers = [
        { key: 'name', label: 'movie name', width: '80%' },
        { key: 'fetched', label: 'Fetch', width: '80%', render: row => {
            const button = document.createElement('button');
            if (row.fetched) {
                button.textContent = 'remove';
                button.className = 'button button-ghost';
            } else {
                button.textContent = 'fetch';
                button.className = 'button button-primary';
            }

            button.addEventListener('click', async () => {
                try {
                    await sendRequest('/api/movie/fetch', { method: 'PUT', json: { id: row.id, fetched: !row.fetched } });
                    allMoviesPaginator.emit();
                    fetchedMoviesPaginator.emit();
                } catch (err) {
                    console.error(err);
                    allMoviesMessage.textContent = err.body.message;
                }
            });
            
            return button;
        } },
    ];

    fetchedMoviesPaginator.addEventListener('page-change', async event => {
        try {
            const searchText = document.querySelector('#search-movie').value;
            const response = await sendRequest('/api/movie/search', { method: 'POST', json: { search: searchText, ...event.detail, fetched: true } });
            fetchedMoviesPaginator.total = response.total;
            fetchedMoviesPaginator.data = response.movies;
            fetchedMoviesPaginator.render();
        } catch (err) {
            console.error(err);
            fetchedMoviesMessage.textContent = err.body.message;
        }
    });

    // force load the movies
    allMoviesPaginator.emit();
    fetchedMoviesPaginator.emit();

    // reload movies after search has been applied
    document.querySelector('#search-movie-button').addEventListener('click', () => {
        allMoviesPaginator.emit();
        fetchedMoviesPaginator.emit();
    });

    // ~~ tv series request ~~
    const allSeriesPaginator = document.querySelector('#all-series');
    const allSeriesMessage = document.querySelector('#all-series-message');

    allSeriesPaginator.headers = [
        { key: 'groupTitle', label: 'tv series name' },
        { key: 'fetched', label: 'fetch', render: row => {
            const button = document.createElement('button');
            button.classList.add('button');
            if (row.fetched) {
                button.textContent = 'remove';
                button.classList.add('button-ghost');
            } else {
                button.textContent = 'fetch';
                button.classList.add('button-primary');
            }

            button.addEventListener('click', async () => {
                try {
                    await sendRequest('/api/series/fetch', { method: 'PUT', json: { id: row.groupTitle, fetched: !row.fetched } });
                    allSeriesPaginator.emit();
                    fetchedSeriesPaginator.emit();
                } catch (err) {
                    console.error(err);
                    allSeriesMessage.textContent = err.body.message;
                }
            });

            return button;
        } },
    ];

    allSeriesPaginator.addEventListener('page-change', async event => {
        try {
            const searchText = document.querySelector('#search-series').value;
            const response = await sendRequest('/api/series/search', { method: 'POST', json: { search: searchText, ...event.detail, fetched: false } });
            allSeriesPaginator.total = response.total;
            allSeriesPaginator.data = response.series;
            allSeriesPaginator.render();
        } catch (err) {
            console.error(err);
            allSeriesMessage.textContent = err.body.message;
        }
    });

    const fetchedSeriesPaginator = document.querySelector('#fetched-series');
    const fetchedSeriesMessage = document.querySelector('#fetched-series-message');
    fetchedSeriesPaginator.headers = [
        { key: 'groupTitle', label: 'tv series name' },
        { key: 'fetched', label: 'fetch', render: row => {
            const button = document.createElement('button');
            if (row.fetched) {
                button.textContent = 'remove';
                button.className = 'button button-ghost';
            } else {
                button.textContent = 'fetch';
                button.className = 'button button-primary';
            }

            button.addEventListener('click', async () => {
                try {
                    await sendRequest('/api/series/fetch', { method: 'PUT', json: { id: row.groupTitle, fetched: !row.fetched } });
                    allSeriesPaginator.emit();
                    fetchedSeriesPaginator.emit();
                } catch (err) {
                    console.error(err);
                    allSeriesMessage.textContent = err.body.message;
                }
            });
            
            return button;
        } },
    ];

    fetchedSeriesPaginator.addEventListener('page-change', async event => {
        try {
            const searchText = document.querySelector('#search-series').value;
            const response = await sendRequest('/api/series/search', { method: 'POST', json: { search: searchText, ...event.detail, fetched: true } });
            fetchedSeriesPaginator.total = response.total;
            fetchedSeriesPaginator.data = response.series;
            fetchedSeriesPaginator.render();
        } catch (err) {
            console.error(err);
            fetchedSeriesMessage.textContent = err.body.message;
        }
    });

    // force load the movies
    allSeriesPaginator.emit();
    fetchedSeriesPaginator.emit();

    // reload movies after search has been applied
    document.querySelector('#search-series-button').addEventListener('click', () => {
        allSeriesPaginator.emit();
        fetchedSeriesPaginator.emit();
    });

    // ~~ app status ~~
    document.querySelector('#refresh-status').addEventListener('click', loadStatusTab);

    // show errors from non-JSON responses
    self.addEventListener('unhandledrejection', e => { console.error(e); });
});

// --- Channels & filters ---
// const channelsList = document.querySelector('#available-channels-list');
// const filtersArea = document.querySelector('#filtersArea');
// const channelSearch = document.querySelector('#channelSearch');

// async function loadChannels() {
//     channelsList.innerHTML = '<div class="muted small">Loading…</div>';
//     try {
//         const list = await api('/api/channels');
//         renderChannels(list || []);
//     } catch (e) { channelsList.innerHTML = '<div class="muted small">Failed to load channels.</div>' }
// }

// function renderChannels(list) {
//     const q = channelSearch.value.trim().toLowerCase();
//     const filtered = list.filter(c => c.name.toLowerCase().includes(q) || (c.group || '').toLowerCase().includes(q));
//     channelsList.innerHTML = '';
//     if (!filtered.length) { channelsList.innerHTML = '<div class="muted small">No channels found.</div>'; return }
//     const table = document.createElement('table');
//     const thead = document.createElement('thead'); thead.innerHTML = '<tr><th>Name</th><th>Group</th><th>URL</th><th></th></tr>'; table.appendChild(thead);
//     const tbody = document.createElement('tbody');
//     filtered.forEach(ch => {
//         const tr = document.createElement('tr');
//         tr.innerHTML = `<td>${escapeHtml(ch.name)}</td><td>${escapeHtml(ch.group || '')}</td><td class="small">${escapeHtml(ch.url)}</td><td><button class="btn btn-ghost small" data-url="${escapeHtml(ch.url)}">Toggle</button></td>`;
//         tbody.appendChild(tr);
//     });
//     table.appendChild(tbody); channelsList.appendChild(table);
// }

// channelSearch.addEventListener('input', () => { loadChannels(); });

// // Filters
// document.querySelector('#addFilter').addEventListener('click', async () => {
//     const text = document.querySelector('#newFilter').value.trim(); if (!text) return;
//     try { await api('/api/filters', { method: 'POST', json: { filter: text } }); document.querySelector('#newFilter').value = ''; loadFilters(); }
//     catch (e) { console.error(e); }
// });

// async function loadFilters() {
//     filtersArea.innerHTML = '<div class="muted small">Loading…</div>';
//     try {
//         const list = await api('/api/filters');
//         if (!list || !list.length) { filtersArea.innerHTML = '<div class="muted small">No filters configured.</div>'; return }
//         filtersArea.innerHTML = '';
//         list.forEach(f => {
//             const wrap = document.createElement('div'); wrap.className = 'row'; wrap.style.marginBottom = '8px';
//             const p = document.createElement('div'); p.textContent = f.text; p.className = 'pill';
//             const del = document.createElement('button'); del.className = 'btn btn-ghost'; del.textContent = 'Remove'; del.style.marginLeft = '8px';
//             del.addEventListener('click', async () => { await api('/api/filters/' + encodeURIComponent(f.id), { method: 'DELETE' }); loadFilters(); });
//             wrap.appendChild(p); wrap.appendChild(del); filtersArea.appendChild(wrap);
//         });
//     } catch (e) { filtersArea.innerHTML = '<div class="muted small">Failed to load filters.</div>' }
// }

// document.querySelector('#applyFilters').addEventListener('click', async () => {
//     try { await api('/api/filters/apply', { method: 'POST' }); alert('Filters applied and final M3U will be regenerated.'); }
//     catch (e) { console.error(e); alert('Failed to apply filters.'); }
// });