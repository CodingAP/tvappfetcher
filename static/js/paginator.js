/**
 * item-paginator web component
 */
class ItemPaginator extends HTMLElement {
    #data = [];
    #headers = [];
    #pageSize = 10;
    #current = 0;
    #maxPagesInControls = 3;
    total = 0;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.shadowRoot.innerHTML = `
            <style>
                .paginator {
                    width: 100%;
                    max-height: 500px;
                    overflow-y: auto;
                }

                .paginator-table {
                    border-collapse: collapse;
                    width: calc(100% - 30px);
                    margin-left: 15px;
                    margin-bottom: 10px;
                }

                th,
                td {
                    border: 1px solid light-dark(var(--muted-light), var(--muted-dark));
                    padding: 6px 10px;
                    text-align: center;
                    width: auto;
                }

                th {
                    background: var(--primary);
                    color: var(--bg-light);
                }

                thead, tbody, tr {
                    display: table;
                    width: 100%;
                    table-layout: fixed;
                }

                .button {
                    display: inline-block;
                    padding: 10px 14px;
                    border-radius: 10px;
                    border: 0;
                    cursor: pointer;
                    font-weight: 600;
                }

                .button-primary {
                    background: var(--primary);
                    color: white;
                }

                .button-ghost {
                    background: transparent;
                    border: 1px solid light-dark(var(--muted-light), var(--muted-dark));
                }

                .page-controls {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 6px;
                    flex-direction: column;
                }

                .page {
                    font-size: 12px;
                    min-width: 2.5em;
                    text-align: center;
                }
                
                .ell {
                    padding: 0 6px;
                }

                #info {
                    margin: auto;
                    font-size: 0.9em;
                    color: light-dark(var(--muted-light), var(--muted-dark));
                }

                @media (min-width: 768px) {
                    .page-controls {
                        flex-direction: row;
                    }

                    #info {
                        margin: 0;
                        margin-left: auto;
                    }
                }
            </style>

            <div class="paginator">
                <table class="paginator-table">
                    <thead>
                        <tr id="table-header"></tr>
                    </thead>
                    <tbody id="table-body"></tbody>
                </table>
            </div>

            <nav class="page-controls">
                <div>
                    <button class="button button-primary" id="previous-page">«</button>
                    <button class="button button-primary" id="next-page">»</button>
                </div>  

                <span id="pages"></span>

                <label for="page-sizes">page size:</label>
                <select id="page-sizes">
                    <option value="10">10</option>
                    <option value="25" selected>25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                </select>
                
                <span id="info"></span>
            </nav>
        `;
        
        this.shadowRoot.addEventListener('click', event => {
            const button = event.target.closest('button');

            if (!button) return;

            if (button.id === 'previous-page') {
                this.#current--;
                if (this.#current < 0) this.#current = 0;
                this.emit();
            } else if (button.id === 'next-page') {
                this.#current++;
                if (this.#current >= this.#pageCount) this.#current = this.#pageCount - 1;
                this.emit();
            } else if (button.dataset.page) {
                this.#current = parseInt(button.dataset.page);
                this.emit();
            }
        });

        const pageSizeSelector = this.shadowRoot.querySelector('#page-sizes');

        pageSizeSelector.value = this.#pageSize;
        pageSizeSelector.addEventListener('change', event => {
            const start = this.#current * this.#pageSize;
            this.#pageSize = parseInt(event.target.value);
            this.#current = Math.floor(start / this.#pageSize);

            this.emit();
        });
    
        this.emit();
    }

    get #pageCount() {
        return Math.max(1, Math.ceil(this.total / this.#pageSize));
    }

    set data(arr) {
        this.#data = Array.isArray(arr) ? arr : [];
        this.render();
    }

    get data() {
        return this.#data;
    }

    set headers(arr){
        this.#headers = Array.isArray(arr) ? arr : null;
        this.render();
    }

    get headers() {
        return this.#headers;
    }

    render() {
        const tableHeader = this.shadowRoot.querySelector('#table-header');
        const tableBody = this.shadowRoot.querySelector('#table-body');
        const pagesSpan = this.shadowRoot.querySelector('#pages');
        const infoSpan = this.shadowRoot.querySelector('#info');

        // reset current paginator
        tableHeader.innerHTML = '';
        tableBody.innerHTML = '';
        pagesSpan.innerHTML = '';

        // get columns or assume from objects
        let columns = this.#headers;
        if (!columns) {
            const keys = Object.keys(this.#data[0]);
            columns = keys.map(key => ({ key, label: key }));
        }

        // create elements behind
        columns.forEach(col => {
            const headerElement = document.createElement('th');
            headerElement.textContent = col.label;
            if (col.width) headerElement.style.width = col.width;
            tableHeader.appendChild(headerElement);
        });

        // render nothing if there is no data
        if (this.total === 0) {
            tableBody.innerHTML = `<tr><td colspan="100">no data!</td></tr>`;
            infoSpan.textContent = `no data!`;
            return;
        }

        // return to base if current page exceeds total pages
        if (this.#current > this.#pageCount) this.#current = 0;

        // populate table with rows, rendering if needed
        const start = this.#current * this.#pageSize;
        const end = Math.min(start + this.#pageSize, this.total);
        this.#data.forEach(row => {
            const tableRow = document.createElement('tr');
            columns.forEach(col => {
                const tableCell = document.createElement('td');
                if (col.width) tableCell.style.width = col.width;

                if (typeof col.render === 'function') {
                    const content = col.render(row);

                    if (content instanceof HTMLElement) tableCell.appendChild(content);
                    else tableCell.textContent = content;
                } else {
                    tableCell.textContent = row[col.key];
                }

                tableRow.appendChild(tableCell);
            });
            tableBody.appendChild(tableRow);
        });

        // create individual pages
        let result = [];
        if (this.#pageCount <= this.#maxPagesInControls) {
            result = Array.from({ length: this.#pageCount }, (_, i) => i);
        } else {
            const half = Math.floor(this.#maxPagesInControls / 2);
            let pageStart = this.#current - half;
            let pageEnd = this.#current + half;

            if (pageStart < 0) {
                pageStart = 0;
                pageEnd = this.#maxPagesInControls - 1;
            }
            if (pageEnd >= this.#pageCount) {
                pageEnd = this.#pageCount - 1;
                pageStart = this.#pageCount - this.#maxPagesInControls;
            }

            if (pageStart > 0) {
                result.push(0);
                if (pageStart >= half) result.push('…');
            }
            
            for (let i = pageStart; i <= pageEnd; i++) {
                if (i !== this.#pageCount - 1) result.push(i);
            }
            
            if (pageEnd < this.#pageCount) {
                if (pageEnd < this.#pageCount - half) result.push('…');
                result.push(this.#pageCount - 1);
            }
        }

        result.forEach(page => {
            if (typeof page === 'number') {
                const button = document.createElement('button');
                button.textContent = page + 1;
                button.dataset.page = page;
                button.className = `button ${(parseInt(page) === this.#current) ? 'button-primary' : 'button-ghost'} page`;
                pagesSpan.appendChild(button);
            } else {
                const span = document.createElement('span');
                span.textContent = page;
                span.className = 'misc-pages';
                pagesSpan.appendChild(span);
            }
        });

        // update information string
        infoSpan.textContent = `Items ${start + 1} - ${end} of ${this.total}`;
    }

    emit() {
        this.dispatchEvent(new CustomEvent('page-change', {
            detail: { page: this.#current, pageSize: this.#pageSize },
            bubbles: true, composed: true
        }));
    }
};

customElements.define('item-paginator', ItemPaginator);