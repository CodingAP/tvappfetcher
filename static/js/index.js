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
};

/**
 * switch tab programmatically
 * 
 * @param {string} tab name of the tab
 */
const setTab = tab => {
    document.querySelectorAll('.navtab').forEach(button => button.classList.remove('active'));
    document.querySelector(`#navtab-${tab}`).classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
    document.querySelector(`#tab-${tab}`).style.display = '';
};

/**
 * setups the elements of the login form
 */
const setupLogin = () => {
    document.querySelector('#login-form').addEventListener('submit', async event => {
        // reset fields
        event.preventDefault();
        document.querySelector('#login-error').textContent = '';

        // attempt to login, send a request to the api
        const password = document.querySelector('#password-input').value;
        try {
            // if successful, show dashboard (applies cookie automatically with response)
            await sendRequest('/api/login', { method: 'POST', json: { password } });
            setupDashboard();
        } catch (err) {
            // if not, show error
            console.error(err);
            document.querySelector('#login-error').textContent = err.body.message;
        }
    });

    document.querySelector('#logout-button').addEventListener('click', () => {
        // remove session token
        Cookies.remove('session');

        // show login, hide dashboard
        document.querySelector('#login').style.display = '';
        document.querySelector('#dashboard').style.display = 'none';
        document.querySelector('#userbar').style.display = 'none';
    });

    // if we are already logged in, show dashboard immediately
    if (Cookies.get('session') !== undefined) {
        setupDashboard();
    }
};

/**
 * setups the elements of the entire tab for loading/processing
 */
const setupDashboard = () => {
    // setup dashboard bar and navtab
    document.querySelector('#login').style.display = 'none';
    document.querySelector('#dashboard').style.display = '';
    document.querySelector('#userbar').style.display = 'flex';

    document.querySelectorAll('.navtab').forEach(button => {
        button.addEventListener('click', () => setTab(button.id.split('-')[1]));
    });

    // setup all tabs
    setupChannelTab();
    setupMovieTab();
    setupSeriesTab();
    setupStatusTab();
    setupSettingsTab();
}

/**
 * setups the elements of the channel tab for loading/processing
 */
const setupChannelTab = () => {
    const filterPaginator = document.querySelector('#channel-filters');
    const filterMessage = document.querySelector('#filter-message');
    const allChannelsPaginator = document.querySelector('#all-channels');
    const allChannelsMessage = document.querySelector('#all-channels-message');
    const filteredChannelsPaginator = document.querySelector('#filtered-channels');
    const filteredChannelsMessage = document.querySelector('#filtered-channels-message');

    // reload the paginator by forcing a page-change event
    const reloadPaginators = () => {
        filterMessage.textContent = '';
        filterPaginator.emit();
        allChannelsMessage.textContent = '';
        allChannelsPaginator.emit();
        filteredChannelsMessage.textContent = '';
        filteredChannelsPaginator.emit();
    };

    filterPaginator.headers = [
        { key: 'filterText', label: 'text' },
        { key: 'filterType', label: 'type' },
        { key: 'remove', label: 'remove', render: (row, div) => {
            const button = document.createElement('button');
            button.innerText = 'remove';
            button.classList.add('button-ghost');

            button.addEventListener('click', async () => {
                try {
                    await sendRequest('/api/filter', { method: 'DELETE', json: { id: row.filterId } });
                    reloadPaginators();
                } catch (err) {
                    console.error(err);
                    filterMessage.textContent = err.body.message;
                }
            });

            div.append(button);
        }},
    ];

    allChannelsPaginator.headers = [
        { key: 'image', label: 'channel', render: (row, div) => {
            const image = document.createElement('img');
            image.width = 100;
            image.height = 100;
            image.src = row.tvgLogo;

            const span = document.createElement('span');
            span.textContent = row.name;

            div.append(image, span);
        }},
    ];

    filteredChannelsPaginator.headers = [
        { key: 'image', label: 'channel', render: (row, div) => {
            const image = document.createElement('img');
            image.width = 100;
            image.height = 100;
            image.src = row.tvgLogo;

            const span = document.createElement('span');
            span.textContent = row.name;

            div.append(image, span);
        }},
    ];

    filterPaginator.addEventListener('page-change', async () => {
        try {
            const response = await sendRequest('/api/filter');
            filterPaginator.total = response.total;
            filterPaginator.data = response.filters;
            filterPaginator.render();
        } catch (err) {
            console.error(err);
            filterMessage.textContent = err.body.message;
        }
    });

    allChannelsPaginator.addEventListener('page-change', async event => {
        try {
            const response = await sendRequest('/api/channel/search', { method: 'POST', json: { ...event.detail } });
            allChannelsPaginator.total = response.total;
            allChannelsPaginator.data = response.channels;
            allChannelsPaginator.render();
        } catch (err) {
            console.error(err);
            allChannelsMessage.textContent = err.body.message;
        }
    });

    filteredChannelsPaginator.addEventListener('page-change', async event => {
        try {
            const response = await sendRequest('/api/channel/search-filtered', { method: 'POST', json: { ...event.detail } });
            filteredChannelsPaginator.total = response.total;
            filteredChannelsPaginator.data = response.channels;
            filteredChannelsPaginator.render();
        } catch (err) {
            console.error(err);
            filteredChannelsMessage.textContent = err.body.message;
        }
    });

    document.querySelector('#add-filter').addEventListener('click', async () => {
        const filterText = document.querySelector('#filter-text').value.trim();
        const filterType = document.querySelector('#filter-type').value.trim();

        await sendRequest('/api/filter', { method: 'POST', json: { filterText, filterType } });
        reloadPaginators();
    });

    // when tab is clicked, load the filters and channels
    document.querySelector('#navtab-channels').addEventListener('click', reloadPaginators);
};

/**
 * setups the elements of the movie tab for loading/processing
 */
const setupMovieTab = () => {
    const allMoviesPaginator = document.querySelector('#all-movies');
    const allMoviesMessage = document.querySelector('#all-movies-message');
    const fetchedMoviesPaginator = document.querySelector('#fetched-movies');
    const fetchedMoviesMessage = document.querySelector('#fetched-movies-message');

    // reload the paginator by forcing a page-change event
    const reloadPaginators = () => {
        allMoviesPaginator.emit();
        allMoviesMessage.textContent = '';
        fetchedMoviesPaginator.emit();
        fetchedMoviesMessage.textContent = '';
    };

    allMoviesPaginator.headers = [
        { key: 'image', label: 'movie', render: (row, div) => {
            const image = document.createElement('img');
            image.width = 68;
            image.height = 100;
            image.src = row.tvgLogo;

            const span = document.createElement('span');
            span.textContent = row.name;

            div.append(image, span);
        }},
        { key: 'fetched', label: 'fetch', render: (row, div) => {
            const button = document.createElement('button');

            button.textContent = row.fetched ? 'remove' : 'fetch';
            button.classList.add('button', row.fetched ? 'button-ghost' : 'button-primary');

            button.addEventListener('click', async () => {
                try {
                    await sendRequest('/api/movie/fetch', { method: 'PUT', json: { id: row.id, fetched: !row.fetched } });
                    reloadPaginators();
                } catch (err) {
                    console.error(err);
                    allSeriesMessage.textContent = err.body.message;
                }
            });

            div.append(button);
        }},
    ];

    fetchedMoviesPaginator.headers = [
        { key: 'image', label: 'movie', render: (row, div) => {
            const image = document.createElement('img');
            image.width = 68;
            image.height = 100;
            image.src = row.tvgLogo;

            const span = document.createElement('span');
            span.textContent = row.name;

            div.append(image, span);
        }},
        { key: 'fetched', label: 'fetch', render: (row, div) => {
            const button = document.createElement('button');

            button.textContent = row.fetched ? 'remove' : 'fetch';
            button.classList.add('button', row.fetched ? 'button-ghost' : 'button-primary');

            button.addEventListener('click', async () => {
                try {
                    await sendRequest('/api/movie/fetch', { method: 'PUT', json: { id: row.id, fetched: !row.fetched } });
                    reloadPaginators();
                } catch (err) {
                    console.error(err);
                    allSeriesMessage.textContent = err.body.message;
                }
            });

            div.append(button);
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

    // when tab is clicked, load the movies
    document.querySelector('#navtab-movies').addEventListener('click', reloadPaginators);

    // reload movies after search has been applied
    document.querySelector('#search-movie-button').addEventListener('click', reloadPaginators);
};

/**
 * setups the elements of the series tab for loading/processing
 */
const setupSeriesTab = () => {
    const allSeriesPaginator = document.querySelector('#all-series');
    const allSeriesMessage = document.querySelector('#all-series-message');
    const fetchedSeriesPaginator = document.querySelector('#fetched-series');
    const fetchedSeriesMessage = document.querySelector('#fetched-series-message');

    // reload the paginator by forcing a page-change event
    const reloadPaginators = () => {
        allSeriesPaginator.emit();
        allSeriesMessage.textContent = '';
        fetchedSeriesPaginator.emit();
        fetchedSeriesMessage.textContent = '';
    };

    // create headers for name and fetch button for all series paginator
    allSeriesPaginator.headers = [
        { key: 'groupTitle', label: 'tv series name' },
        { key: 'fetched', label: 'fetch', render: (row, div) => {
            const button = document.createElement('button');

            button.textContent = row.fetched ? 'remove' : 'fetch';
            button.classList.add('button', row.fetched ? 'button-ghost' : 'button-primary');

            button.addEventListener('click', async () => {
                try {
                    await sendRequest('/api/series/fetch', { method: 'PUT', json: { id: row.groupTitle, fetched: !row.fetched } });
                    reloadPaginators();
                } catch (err) {
                    console.error(err);
                    allSeriesMessage.textContent = err.body.message;
                }
            });

            div.append(button);
        } },
    ];

    // create headers for name and fetch button for fetched series paginator
    fetchedSeriesPaginator.headers = [
        { key: 'groupTitle', label: 'tv series name' },
        { key: 'fetched', label: 'fetch', render: (row, div) => {
            const button = document.createElement('button');

            button.textContent = row.fetched ? 'remove' : 'fetch';
            button.classList.add('button', row.fetched ? 'button-ghost' : 'button-primary');

            button.addEventListener('click', async () => {
                try {
                    await sendRequest('/api/series/fetch', { method: 'PUT', json: { id: row.groupTitle, fetched: !row.fetched } });
                    reloadPaginators();
                } catch (err) {
                    console.error(err);
                    fetchedSeriesPaginator.textContent = err.body.message;
                }
            });
            
            div.append(button);
        } },
    ];

    // get paginated data for all series
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

    // get paginated data for fetched series
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

    // when tab is clicked, load the series
    document.querySelector('#navtab-series').addEventListener('click', reloadPaginators);

    // reload movies after search has been applied
    document.querySelector('#search-series-button').addEventListener('click', reloadPaginators);
};

/**
 * setups the elements of the status tab for loading/processing
 */
const setupStatusTab = () => {
    const loadStatus = async () => {
        try {
            const response = await sendRequest('/api/status');
            document.querySelector('#app-status').textContent = response.status || '—';
        } catch (err) {
            console.log(err);
            document.querySelector('#app-status').textContent = 'failed to load status!';
        }
    }

    // when tab or refresh button is clicked, load the newest status
    document.querySelector('#navtab-status').addEventListener('click', loadStatus);
    document.querySelector('#refresh-status').addEventListener('click', loadStatus);
};

/**
 * setups the elements of the settings tab for loading/processing
 */
const setupSettingsTab = () => {
    /**
     * loads the url and timestamp of the next automatic fetch
     */
    const loadSettings = async () => {
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

    const fetchMessage = document.querySelector('#fetch-message');
    const settingsMessage = document.querySelector('#settings-message');

    // send setting to the backend to save
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
            loadSettings();
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
            loadSettings();
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
            loadSettings();
        } catch (err) {
            console.error(err);
            fetchMessage.textContent = err.body.message;
        }
    });

    document.querySelector('#navtab-settings').addEventListener('click', loadSettings);
};

self.addEventListener('load', () => {
    setupLogin();

    // show errors from non-JSON responses
    self.addEventListener('unhandledrejection', e => { console.error(e); });
});