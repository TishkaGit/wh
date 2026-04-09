/**
 * Скрипт для панели менеджера
 */
let providers = [];
let products = [];
let units = [];
let contracts = [];
let deliverySchedule = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!authService.isAuthenticated()) {
        authService.redirectToLogin();
        return;
    }
    
    const userRole = authService.getUserRole();
    if (userRole !== 'manager') {
        authService.redirectToRoleSelect();
        return;
    }

    setupTabs();
    updateUserInfo();
    loadAllData();
    
    initNavbarBrandClick();
    initThemeToggle();

    document.getElementById('logoutBtn').addEventListener('click', () => {
        authService.logout();
        authService.redirectToLogin();
    });
});

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${tabId}Tab`).classList.add('active');
            
            if (tabId === 'schedule') {
                loadDeliverySchedule();
            }
        });
    });
}

function updateUserInfo() {
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        const userInfo = authService.getUserInfo();
        userNameElement.textContent = userInfo?.name || 'Менеджер';
    }
}

async function loadAllData() {
    try {
        await Promise.all([
            loadProviders(),
            loadUnits(),
            loadProducts(),
            loadContracts()
        ]);
    } catch (error) {
        showNotification('Ошибка загрузки данных', 'error');
    }
}

async function loadProviders() {
    try {
        providers = await api.getProviders();
        renderProvidersTable();
    } catch (error) {
        const tbody = document.getElementById('providersTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="error">Ошибка загрузки</td></tr>';
        }
    }
}

function renderProvidersTable() {
    const tbody = document.getElementById('providersTableBody');
    if (!tbody) return;
    
    if (!providers.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = providers.map(provider => {
        const inn = (provider.itn !== null && provider.itn !== undefined && provider.itn !== 0) 
            ? String(provider.itn) 
            : '-';
        
        const bic = (provider.bic !== null && provider.bic !== undefined && provider.bic !== 0) 
            ? String(provider.bic) 
            : '-';
        
        const account = (provider.settlementAccount !== null && provider.settlementAccount !== undefined) 
            ? String(provider.settlementAccount) 
            : '-';
        
        return `
            <tr>
                <td>${provider.id ?? '-'}</td>
                <td>${provider.name ?? '-'}</td>
                <td>${inn}</td>
                <td>${bic}</td>
                <td>${account}</td>
                <td>${provider.directorFullName ?? '-'}</td>
                <td>${provider.accountantFullName ?? '-'}</td>
            </tr>
        `;
    }).join('');
}

function showAddProviderModal() {
    const modalContent = {
        title: 'Добавление поставщика',
        body: `
            <form id="addProviderForm">
                <div class="form-group">
                    <label>Наименование *</label>
                    <input type="text" id="providerName" required>
                </div>
                <div class="form-group">
                    <label>ИНН *</label>
                    <input type="text" id="providerItn" required maxlength="12" placeholder="10 или 12 цифр">
                </div>
                <div class="form-group">
                    <label>БИК *</label>
                    <input type="text" id="providerBic" required maxlength="9" placeholder="9 цифр">
                </div>
                <div class="form-group">
                    <label>Расчетный счет *</label>
                    <input type="text" id="providerAccount" required>
                </div>
                <div class="form-group">
                    <label>ФИО Директора *</label>
                    <input type="text" id="providerDirector" required>
                </div>
                <div class="form-group">
                    <label>ФИО Бухгалтера *</label>
                    <input type="text" id="providerAccountant" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="modal.hide()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        `
    };
    
    modal.show(modalContent);

    const innInput = document.getElementById('providerItn');
    if (innInput) {
        innInput.addEventListener('input', () => {
            innInput.value = innInput.value.replace(/\D/g, '');
        });
    }

    const bicInput = document.getElementById('providerBic');
    if (bicInput) {
        bicInput.addEventListener('input', () => {
            bicInput.value = bicInput.value.replace(/\D/g, '');
        });
    }

    document.getElementById('addProviderForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const innValue = document.getElementById('providerItn').value;
        const bicValue = document.getElementById('providerBic').value;
        const accountValue = document.getElementById('providerAccount').value;
        
        if (!innValue || innValue.length === 0) {
            showNotification('Введите ИНН', 'error');
            return;
        }
        
        if (!bicValue || bicValue.length === 0) {
            showNotification('Введите БИК', 'error');
            return;
        }
        
        const providerData = {
            name: document.getElementById('providerName').value,
            itn: parseInt(innValue, 10),
            bic: parseInt(bicValue, 10),
            settlementAccount: accountValue.toString(),
            directorFullName: document.getElementById('providerDirector').value,
            accountantFullName: document.getElementById('providerAccountant').value
        };

        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Сохранение...';
            }

            const id = await api.addProvider(providerData);
            modal.hide();
            await loadProviders();
            showNotification(`Поставщик добавлен с ID: ${id}`, 'success');
        } catch (error) {
            console.error('Add provider error:', error);
            showNotification(error.message || 'Ошибка при добавлении поставщика', 'error');
        }
    });
}

async function loadUnits() {
    try {
        units = await api.getUnits();
        renderUnitsTable();
    } catch (error) {
        const tbody = document.getElementById('unitsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="2" class="error">Ошибка загрузки</td></tr>';
        }
    }
}

function renderUnitsTable() {
    const tbody = document.getElementById('unitsTableBody');
    if (!tbody) return;
    
    if (!units.length) {
        tbody.innerHTML = '<tr><td colspan="2" class="loading">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = units.map(unit => `
        <tr>
            <td>${unit.id}</td>
            <td>${unit.name}</td>
        </tr>
    `).join('');
}

function showAddUnitModal() {
    const modalContent = {
        title: 'Добавление единицы измерения',
        body: `
            <form id="addUnitForm">
                <div class="form-group">
                    <label>Наименование *</label>
                    <input type="text" id="unitName" placeholder="шт., кг., л." required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="modal.hide()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        `
    };
    
    modal.show(modalContent);

    document.getElementById('addUnitForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('unitName').value;

        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Сохранение...';
            }

            const id = await api.addUnit(name);
            modal.hide();
            await loadUnits();
            showNotification(`Единица измерения добавлена с ID: ${id}`, 'success');
        } catch (error) {
            if (error.message.includes('Conflict')) {
                showNotification('Такая единица измерения уже существует', 'error');
            } else {
                showNotification(error.message, 'error');
            }
        }
    });
}

async function loadProducts() {
    try {
        products = await api.getProducts();
        renderProductsTable();
    } catch (error) {
        const tbody = document.getElementById('productsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4" class="error">Ошибка загрузки</td></tr>';
        }
    }
}

function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    
    if (!products.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>${product.unit?.name || '-'}</td>
            <td>${product.criticalBalance ?? 0}</td>
        </tr>
    `).join('');
}

function showAddProductModal() {
    if (!units || units.length === 0) {
        loadUnits().then(() => showAddProductModal());
        return;
    }
    
    const unitOptions = units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    
    const modalContent = {
        title: 'Добавление товара',
        body: `
            <form id="addProductForm">
                <div class="form-group">
                    <label>Наименование *</label>
                    <input type="text" id="productName" required>
                </div>
                <div class="form-group">
                    <label>Единица измерения *</label>
                    <select id="productUnit" required>
                        <option value="">Выберите единицу измерения</option>
                        ${unitOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Критический остаток *</label>
                    <input type="number" id="productCriticalBalance" min="0" value="0" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="modal.hide()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        `
    };

    modal.show(modalContent);

    const form = document.getElementById('addProductForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const productData = {
                name: document.getElementById('productName').value,
                unit: parseInt(document.getElementById('productUnit').value),
                criticalBalance: parseInt(document.getElementById('productCriticalBalance').value)
            };

            try {
                const submitBtn = e.target.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Сохранение...';
                }

                const id = await api.addProduct(productData);
                modal.hide();
                await loadProducts();
                showNotification(`Товар добавлен с ID: ${id}`, 'success');
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });
    }
}

async function loadContracts() {
    try {
        contracts = await api.getContracts();
        renderContractsTable();
    } catch (error) {
        const tbody = document.getElementById('contractsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="error">Ошибка загрузки</td></tr>';
        }
    }
}

function renderContractsTable() {
    const tbody = document.getElementById('contractsTableBody');
    if (!tbody) return;
    
    if (!contracts.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = contracts.map(contract => {
        const productList = contract.productInfo || [];
        const productCount = productList.length;
        const productNames = productList.map(info => 
            info.product?.name || `Товар #${info.product}`
        );
        
        const maxVisible = 3;
        const visibleProducts = productNames.slice(0, maxVisible);
        const hiddenCount = productCount - maxVisible;
        
        let productsHtml = visibleProducts.map(name => 
            `<span class="product-tag">${name}</span>`
        ).join('');
        
        if (hiddenCount > 0) {
            productsHtml += `<span class="product-more">+${hiddenCount} ещё</span>`;
        }
        
        const tooltip = productNames.join('\n');

        return `
            <tr>
                <td>${contract.id}</td>
                <td>${contract.provider?.name || '-'}</td>
                <td>
                    <span class="status-badge status-${CONFIG.CONTRACT_STATUSES[contract.status]?.class || 'created'}">
                        ${CONFIG.CONTRACT_STATUSES[contract.status]?.name || 'Неизвестно'}
                    </span>
                </td>
                <td>
                    <div class="products-list" title="${tooltip}">
                        ${productsHtml}
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon btn-view" onclick="viewContract(${contract.id})">👁️ Просмотр</button>
                        <button class="btn-icon btn-success" onclick="openAddScheduleModal(${contract.id})">📅 График</button>
                        <button class="btn-icon btn-print" onclick="printContract(${contract.id})">🖨️ Печать</button>
                        <button class="btn-icon btn-pdf" onclick="exportContractToPdf(${contract.id})">📄 PDF</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function viewContract(id) {
    try {
        const contract = await api.getContract(id);
        showContractModal(contract);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function showContractModal(contract) {
    const productRows = contract.productInfo?.map(info => `
        <tr>
            <td>${info.product?.name || 'ID: ' + info.product}</td>
            <td>${info.count}</td>
            <td>${info.price}</td>
            <td>${(info.count * info.price).toFixed(2)}</td>
        </tr>
    `).join('') || '';
    
    const total = contract.productInfo?.reduce((sum, info) => 
        sum + (info.count * info.price), 0
    ).toFixed(2) || 0;

    const modalContent = {
        title: `Договор №${contract.id}`,
        body: `
            <div class="contract-details">
                <p><strong>Поставщик:</strong> ${contract.provider?.name || '-'}</p>
                <p><strong>Статус:</strong> 
                    <span class="status-badge status-${CONFIG.CONTRACT_STATUSES[contract.status]?.class || 'created'}">
                        ${CONFIG.CONTRACT_STATUSES[contract.status]?.name || 'Неизвестно'}
                    </span>
                </p>
                
                <h4>Товары в договоре:</h4>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Товар</th>
                            <th>Количество</th>
                            <th>Цена</th>
                            <th>Сумма</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productRows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3"><strong>Итого:</strong></td>
                            <td><strong>${total}</strong></td>
                        </tr>
                    </tfoot>
                </table>

                <h4>Изменить статус:</h4>
                <select id="changeStatusSelect" class="form-control">
                    ${Object.entries(CONFIG.CONTRACT_STATUSES).map(([key, value]) => `
                        <option value="${key}" ${contract.status === parseInt(key) ? 'selected' : ''}>
                            ${value.name}
                        </option>
                    `).join('')}
                </select>

                <div class="form-actions" style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; gap: 10px;">
                        <button type="button" class="btn btn-secondary" onclick="printContract(${contract.id})">
                            🖨️ Печать
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="exportContractToPdf(${contract.id})">
                            📄 PDF
                        </button>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button type="button" class="btn btn-secondary" onclick="modal.hide()">Закрыть</button>
                        <button type="button" class="btn btn-primary" onclick="changeContractStatus(${contract.id})">
                            Изменить статус
                        </button>
                    </div>
                </div>
            </div>
        `
    };

    modal.show(modalContent);
}

async function printContract(id) {
    try {
        const contract = await api.getContract(id);
        const productRows = contract.productInfo?.map(info => `
            <tr>
                <td>${info.product?.name || 'ID: ' + info.product}</td>
                <td style="text-align: center;">${info.count}</td>
                <td style="text-align: right;">${info.price.toFixed(2)}</td>
                <td style="text-align: right;">${(info.count * info.price).toFixed(2)}</td>
            </tr>
        `).join('') || '';
        
        const total = contract.productInfo?.reduce((sum, info) => 
            sum + (info.count * info.price), 0
        ).toFixed(2) || 0;
        
        const statusName = CONFIG.CONTRACT_STATUSES[contract.status]?.name || 'Неизвестно';

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <title>Договор №${contract.id}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Times New Roman', Times, serif; 
                        padding: 40px; 
                        font-size: 14px;
                        line-height: 1.5;
                    }
                    .header { text-align: center; margin-bottom: 30px; }
                    .header h1 { font-size: 24px; margin-bottom: 10px; }
                    .header p { font-size: 12px; color: #666; }
                    .contract-info { margin-bottom: 30px; }
                    .contract-info p { margin-bottom: 8px; }
                    .contract-info strong { display: inline-block; width: 150px; }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin: 20px 0;
                    }
                    th, td { 
                        border: 1px solid #333; 
                        padding: 10px; 
                    }
                    th { 
                        background: #f0f0f0; 
                        font-weight: bold;
                    }
                    tfoot td { 
                        font-weight: bold; 
                        background: #f0f0f0;
                    }
                    .footer { 
                        margin-top: 50px; 
                    }
                    .signature-block {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 40px;
                    }
                    .signature-block div {
                        width: 45%;
                    }
                    .signature-line {
                        border-top: 1px solid #333;
                        margin-top: 50px;
                        padding-top: 5px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ДОГОВОР №${contract.id}</h1>
                    <p>от ${new Date().toLocaleDateString('ru-RU')} г.</p>
                </div>
                
                <div class="contract-info">
                    <p><strong>Поставщик:</strong> ${contract.provider?.name || '-'}</p>
                    <p><strong>Статус:</strong> ${statusName}</p>
                    ${contract.provider ? `
                    <p><strong>ИНН:</strong> ${contract.provider.itn || '-'}</p>
                    <p><strong>БИК:</strong> ${contract.provider.bic || '-'}</p>
                    <p><strong>Расчетный счет:</strong> ${contract.provider.settlementAccount || '-'}</p>
                    <p><strong>Директор:</strong> ${contract.provider.directorFullName || '-'}</p>
                    <p><strong>Бухгалтер:</strong> ${contract.provider.accountantFullName || '-'}</p>
                    ` : ''}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Наименование товара</th>
                            <th style="width: 100px;">Количество</th>
                            <th style="width: 120px;">Цена, руб.</th>
                            <th style="width: 120px;">Сумма, руб.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productRows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="text-align: right;"><strong>ИТОГО:</strong></td>
                            <td style="text-align: right;"><strong>${total}</strong></td>
                        </tr>
                    </tfoot>
                </table>

                <p style="margin-top: 20px;"><strong>Всего на сумму:</strong> ${numberToWords(total)} (${total} руб.)</p>

                <div class="footer">
                    <div class="signature-block">
                        <div>
                            <p><strong>Заказчик</strong></p>
                            <div class="signature-line">
                                <p>____________________</p>
                                <p style="font-size: 12px; color: #666;">Подпись</p>
                            </div>
                        </div>
                        <div>
                            <p><strong>Поставщик</strong></p>
                            <div class="signature-line">
                                <p>____________________</p>
                                <p style="font-size: 12px; color: #666;">Подпись</p>
                            </div>
                        </div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    } catch (error) {
        showNotification('Ошибка при подготовке к печати: ' + error.message, 'error');
    }
}

function numberToWords(num) {
    const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 
                  'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 
                  'семнадцать', 'восемнадцать', 'девятнадцать'];
    const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    
    num = Math.round(num * 100) / 100;
    const rubles = Math.floor(num);
    const kopecks = Math.round((num - rubles) * 100);
    
    if (rubles === 0) return 'ноль рублей 00 копеек';
    
    let result = '';
    const thousands = Math.floor(rubles / 1000);
    if (thousands > 0) {
        result += (thousands < 20 ? ones[thousands] : tens[Math.floor(thousands / 10)] + (ones[thousands % 10] ? ' ' + ones[thousands % 10] : '')) + ' тысяч ';
    }
    
    const remainder = rubles % 1000;
    if (remainder >= 100) {
        const hundreds = Math.floor(remainder / 100);
        result += ['сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'][hundreds - 1] + ' ';
    }
    
    const tensAndOnes = remainder % 100;
    if (tensAndOnes >= 20) {
        result += tens[Math.floor(tensAndOnes / 10)] + (ones[tensAndOnes % 10] ? ' ' + ones[tensAndOnes % 10] : '');
    } else if (tensAndOnes > 0) {
        result += ones[tensAndOnes];
    }
    
    const lastTwo = rubles % 100;
    let rubWord = 'рублей';
    if (lastTwo >= 11 && lastTwo <= 14) rubWord = 'рублей';
    else {
        const last = rubles % 10;
        if (last === 1) rubWord = 'рубль';
        else if (last >= 2 && last <= 4) rubWord = 'рубля';
    }
    
    return result.trim() + ' ' + rubWord + ' ' + kopecks.toString().padStart(2, '0') + ' копеек';
}

async function exportContractToPdf(id) {
    try {
        const contract = await api.getContract(id);
        const productRows = contract.productInfo?.map(info => `
            <tr>
                <td>${info.product?.name || 'ID: ' + info.product}</td>
                <td style="text-align: center;">${info.count}</td>
                <td style="text-align: right;">${info.price.toFixed(2)}</td>
                <td style="text-align: right;">${(info.count * info.price).toFixed(2)}</td>
            </tr>
        `).join('') || '';
        
        const total = contract.productInfo?.reduce((sum, info) => 
            sum + (info.count * info.price), 0
        ).toFixed(2) || 0;
        
        const statusName = CONFIG.CONTRACT_STATUSES[contract.status]?.name || 'Неизвестно';

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <title>Договор №${contract.id} - PDF</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Times New Roman', Times, serif; 
                        padding: 40px; 
                        font-size: 14px;
                        line-height: 1.5;
                    }
                    .header { text-align: center; margin-bottom: 30px; }
                    .header h1 { font-size: 24px; margin-bottom: 10px; }
                    .header p { font-size: 12px; color: #666; }
                    .contract-info { margin-bottom: 30px; }
                    .contract-info p { margin-bottom: 8px; }
                    .contract-info strong { display: inline-block; width: 150px; }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin: 20px 0;
                    }
                    th, td { 
                        border: 1px solid #333; 
                        padding: 10px; 
                    }
                    th { 
                        background: #f0f0f0; 
                        font-weight: bold;
                    }
                    tfoot td { 
                        font-weight: bold; 
                        background: #f0f0f0;
                    }
                    .footer { 
                        margin-top: 50px; 
                    }
                    .signature-block {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 40px;
                    }
                    .signature-block div {
                        width: 45%;
                    }
                    .signature-line {
                        border-top: 1px solid #333;
                        margin-top: 50px;
                        padding-top: 5px;
                    }
                    @media print {
                        @page { size: A4; margin: 15mm; }
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ДОГОВОР №${contract.id}</h1>
                    <p>от ${new Date().toLocaleDateString('ru-RU')} г.</p>
                </div>
                
                <div class="contract-info">
                    <p><strong>Поставщик:</strong> ${contract.provider?.name || '-'}</p>
                    <p><strong>Статус:</strong> ${statusName}</p>
                    ${contract.provider ? `
                    <p><strong>ИНН:</strong> ${contract.provider.itn || '-'}</p>
                    <p><strong>БИК:</strong> ${contract.provider.bic || '-'}</p>
                    <p><strong>Расчетный счет:</strong> ${contract.provider.settlementAccount || '-'}</p>
                    <p><strong>Директор:</strong> ${contract.provider.directorFullName || '-'}</p>
                    <p><strong>Бухгалтер:</strong> ${contract.provider.accountantFullName || '-'}</p>
                    ` : ''}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Наименование товара</th>
                            <th style="width: 100px;">Количество</th>
                            <th style="width: 120px;">Цена, руб.</th>
                            <th style="width: 120px;">Сумма, руб.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productRows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="text-align: right;"><strong>ИТОГО:</strong></td>
                            <td style="text-align: right;"><strong>${total}</strong></td>
                        </tr>
                    </tfoot>
                </table>

                <p style="margin-top: 20px;"><strong>Всего на сумму:</strong> ${numberToWords(total)} (${total} руб.)</p>

                <div class="footer">
                    <div class="signature-block">
                        <div>
                            <p><strong>Заказчик</strong></p>
                            <div class="signature-line">
                                <p>____________________</p>
                                <p style="font-size: 12px; color: #666;">Подпись</p>
                            </div>
                        </div>
                        <div>
                            <p><strong>Поставщик</strong></p>
                            <div class="signature-line">
                                <p>____________________</p>
                                <p style="font-size: 12px; color: #666;">Подпись</p>
                            </div>
                        </div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 250);
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    } catch (error) {
        showNotification('Ошибка при экспорте в PDF: ' + error.message, 'error');
    }
}

async function changeContractStatus(id) {
    const select = document.getElementById('changeStatusSelect');
    const newStatus = parseInt(select.value);
    
    try {
        await api.changeContractStatus(id, newStatus);
        modal.hide();
        await loadContracts();
        showNotification('Статус договора изменен', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function loadDeliverySchedule() {
    try {
        deliverySchedule = await api.getDeliverySchedule();
        renderScheduleTable();
    } catch (error) {
        const tbody = document.getElementById('scheduleTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="error">Ошибка загрузки</td></tr>';
        }
        console.error('Load schedule error:', error);
    }
}

function getScheduleStatus(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduleDate = new Date(dateStr);
    scheduleDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((scheduleDate - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { class: 'status-overdue', icon: '🔴', text: 'Просрочка', key: 'overdue' };
    if (diffDays === 0) return { class: 'status-today', icon: '🟡', text: 'Сегодня', key: 'today' };
    if (diffDays <= 7) return { class: 'status-upcoming', icon: '🟢', text: 'Ожидается', key: 'upcoming' };
    return { class: 'status-future', icon: '⚪', text: 'Запланировано', key: 'future' };
}

function renderScheduleTable() {
    const tbody = document.getElementById('scheduleTableBody');
    if (!tbody) return;
    
    if (!deliverySchedule.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Нет данных</td></tr>';
        return;
    }

    const sorted = [...deliverySchedule].sort((a, b) => new Date(a.date) - new Date(b.date));
    tbody.innerHTML = sorted.map(entry => {
        const status = getScheduleStatus(entry.date);
        const isReceived = entry.relatedReceipt !== null && entry.relatedReceipt !== undefined;
        const unitName = entry.product?.unit?.name || 'шт.';
        const quantityWithUnit = `${entry.count} ${unitName}`;
        
        return `
            <tr class="schedule-row ${isReceived ? 'received' : ''}" data-id="${entry.id}">
                <td><input type="checkbox" class="schedule-select" value="${entry.id}"></td>
                <td>${new Date(entry.date).toLocaleDateString('ru-RU')}</td>
                <td>${entry.product?.name || 'Товар #' + entry.product}</td>
                <td>${quantityWithUnit}</td>
                <td>
                    <a href="#" class="contract-link" onclick="openContractFromSchedule(${entry.contract}); return false;">
                        #${entry.contract}
                    </a>
                </td>
                <td>
                    <span class="status-badge ${status.class}">
                        ${isReceived ? '✅ Поступило' : status.icon + ' ' + status.text}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

async function openContractFromSchedule(contractId) {
    try {
        const contract = await api.getContract(contractId);
        showContractModal(contract);
    } catch (error) {
        showNotification('Ошибка загрузки договора', 'error');
        console.error('Open contract error:', error);
    }
}

function toggleSelectAllSchedule() {
    const selectAll = document.getElementById('selectAllSchedule');
    const checkboxes = document.querySelectorAll('.schedule-select');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
}

function openAddScheduleModal(contractId) {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) { 
        showNotification('Договор не найден', 'error'); 
        return; 
    }

    const productSections = contract.productInfo?.map((info, index) => `
        <div class="contract-product-section">
            <div class="product-section-header">
                <h4>
                    📦 ${info.product?.name || 'Товар #' + info.product}
                    <span style="font-size: 12px; color: #b0b0b0; font-weight: normal;">(в договоре: ${info.count} ${info.product?.unit?.name || 'шт.'})</span>
                </h4>
                <button type="button" class="btn btn-sm btn-success" onclick="addScheduleRowForProduct(${info.product?.id || info.product}, '${(info.product?.name || 'Товар').replace(/'/g, "\\'")}')">
                    ➕ Добавить дату
                </button>
            </div>
            <div id="product-schedule-container-${info.product?.id || info.product}" class="product-schedule-container">
            </div>
            <input type="hidden" class="product-id" value="${info.product?.id || info.product}">
            <input type="hidden" class="product-name" value="${info.product?.name || 'Товар'}">
        </div>
    `).join('') || '<p style="color: #b0b0b0; text-align: center;">Нет товаров в договоре</p>';

    const modalContent = {
        title: `📅 График для договора #${contractId}`,
        body: `
            <form id="addScheduleForm" data-contract-id="${contractId}">
                <div style="margin-bottom: 20px; padding: 15px; background: #0a0a0a; border-radius: 5px; border-left: 4px solid #2196f3;">
                    <p style="margin: 0; color: #b0b0b0; font-weight: 500;">
                        ℹ️ Добавьте даты поставки для каждого товара из договора.
                    </p>
                </div>
                
                <div id="allProductsContainer">
                    ${productSections}
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="modal.hide()">Отмена</button>
                    <button type="submit" class="btn btn-primary">💾 Сохранить график</button>
                </div>
            </form>
        `
    };
    modal.show(modalContent);
    window.scheduleRowCounter = 0;
    window.currentContractId = contractId;
}

function addScheduleRowForProduct(productId, productName) {
    const container = document.getElementById(`product-schedule-container-${productId}`);
    if (!container) {
        console.error(`Контейнер для товара ${productId} не найден`);
        return;
    }
    
    const rowId = `schedule_row_${window.scheduleRowCounter++}`;

    const rowHtml = `
        <div class="schedule-row-item" id="${rowId}">
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 13px; color: #b0b0b0;">Дата *</label>
                <input type="date" class="schedule-date" required style="width: 100%; padding: 10px; border: 1px solid #333; border-radius: 3px;">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 13px; color: #b0b0b0;">Количество *</label>
                <input type="number" class="schedule-count" min="1" required style="width: 100%; padding: 10px; border: 1px solid #333; border-radius: 3px;">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <button type="button" class="btn btn-danger" onclick="removeScheduleRow('${rowId}')" style="padding: 10px 15px; height: 42px;">🗑️</button>
            </div>
            <input type="hidden" class="schedule-product-id" value="${productId}">
            <input type="hidden" class="schedule-product-name" value="${productName}">
        </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHtml);
}

function removeScheduleRow(id) {
    const element = document.getElementById(id);
    if (element) {
        element.remove();
    }
}

document.addEventListener('submit', async (e) => {
    if (e.target.id === 'addScheduleForm') {
        e.preventDefault();
        
        const contractId = e.target.dataset?.contractId || window.currentContractId;
        if (!contractId) {
            showNotification('Ошибка: ID договора не найден', 'error');
            return;
        }
        
        const allRows = document.querySelectorAll('.schedule-row-item');
        if (allRows.length === 0) {
            showNotification('Добавьте хотя бы одну дату для любого товара', 'error');
            return;
        }
        
        const entries = [];
        for (const row of allRows) {
            const dateInput = row.querySelector('.schedule-date');
            const countInput = row.querySelector('.schedule-count');
            const productIdInput = row.querySelector('.schedule-product-id');
            
            if (dateInput && countInput && productIdInput && dateInput.value && countInput.value && productIdInput.value) {
                entries.push({ 
                    date: dateInput.value, 
                    contract: parseInt(contractId), 
                    product: parseInt(productIdInput.value), 
                    count: parseInt(countInput.value) 
                });
            }
        }
        
        if (entries.length === 0) { 
            showNotification('Заполните все поля (дата и количество)', 'error'); 
            return; 
        }
        
        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Сохранение...';
            }
            
            for (const entry of entries) {
                await api.addDeliveryScheduleEntry(entry);
            }
            
            modal.hide();
            await loadDeliverySchedule();
            showNotification(`График добавлен (${entries.length} записей)`, 'success');
        } catch (error) {
            console.error('Add schedule error:', error);
            showNotification(error.message || 'Ошибка при сохранении графика', 'error');
        }
    }
    
    if (e.target.id === 'addContractForm') {
        e.preventDefault();
        
        const providerId = parseInt(document.getElementById('contractProvider').value);
        const productItems = document.querySelectorAll('.product-item');
        const productInfo = [];
        
        for (const item of productItems) {
            const select = item.querySelector('.product-select');
            const count = item.querySelector('.product-count');
            const price = item.querySelector('.product-price');
            if (select.value && count.value && price.value) {
                productInfo.push({
                    product: parseInt(select.value),
                    count: parseInt(count.value),
                    price: parseFloat(price.value)
                });
            }
        }
        
        if (productInfo.length === 0) { 
            showNotification('Добавьте хотя бы один товар', 'error'); 
            return; 
        }
        
        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Создание...';
            }
            const id = await api.addContract({ provider: providerId, productInfo });
            modal.hide();
            await loadContracts();
            showNotification(`Договор создан с ID: ${id}`, 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
});

function showAddContractModal() {
    Promise.all([
        providers.length ? Promise.resolve() : loadProviders(),
        products.length ? Promise.resolve() : loadProducts()
    ]).then(() => {
        const providerOptions = providers.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        
        const modalContent = {
            title: 'Создание договора',
            body: `
                <form id="addContractForm">
                    <div class="form-group">
                        <label>Поставщик *</label>
                        <select id="contractProvider" required>
                            <option value="">Выберите поставщика</option>
                            ${providerOptions}
                        </select>
                    </div>
                    
                    <div id="productsContainer"></div>

                    <button type="button" class="add-product-btn" onclick="addProductToContract()">
                        ➕ Добавить товар
                    </button>

                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="modal.hide()">Отмена</button>
                        <button type="submit" class="btn btn-primary">Создать договор</button>
                    </div>
                </form>
            `
        };

        modal.show(modalContent);
        window.productCounter = 0;
        addProductToContract();
    });
}

function addProductToContract() {
    const container = document.getElementById('productsContainer');
    if (!container) return;
    
    const productId = `product_${window.productCounter++}`;

    const productOptions = products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    const productHtml = `
        <div class="product-item" id="${productId}">
            <div class="product-item-header">
                <h4>Товар ${window.productCounter}</h4>
                <button type="button" class="remove-btn" onclick="removeProductFromContract('${productId}')">×</button>
            </div>
            <div class="form-group">
                <label>Товар *</label>
                <select class="product-select" required>
                    <option value="">Выберите товар</option>
                    ${productOptions}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Количество *</label>
                    <input type="number" class="product-count" min="1" required>
                </div>
                <div class="form-group">
                    <label>Цена *</label>
                    <input type="number" step="0.01" class="product-price" min="0" required>
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', productHtml);
}

function removeProductFromContract(id) {
    const element = document.getElementById(id);
    if (element) {
        element.remove();
    }
}

window.showAddProviderModal = showAddProviderModal;
window.showAddUnitModal = showAddUnitModal;
window.showAddProductModal = showAddProductModal;
window.showAddContractModal = showAddContractModal;
window.viewContract = viewContract;
window.addProductToContract = addProductToContract;
window.removeProductFromContract = removeProductFromContract;
window.changeContractStatus = changeContractStatus;
window.openAddScheduleModal = openAddScheduleModal;
window.addScheduleRowForProduct = addScheduleRowForProduct;
window.removeScheduleRow = removeScheduleRow;
window.toggleSelectAllSchedule = toggleSelectAllSchedule;
window.openContractFromSchedule = openContractFromSchedule;
window.printContract = printContract;
window.exportContractToPdf = exportContractToPdf;
