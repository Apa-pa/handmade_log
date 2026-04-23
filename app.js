// データ管理
const Storage = {
    get(key) {
        return JSON.parse(localStorage.getItem(key) || '[]');
    },
    set(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }
};

let materials = Storage.get('hml_materials');
let products = Storage.get('hml_products');
let expenses = Storage.get('hml_expenses');

// DOM要素
const views = ['topView', 'materialRegisterView', 'materialListView', 'productRegisterView', 'productListView', 'soldListView', 'expenseRegisterView', 'inventoryReportView'];
const pageTitle = document.getElementById('pageTitle');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    // サービスワーカー登録
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js');
    }
    
    showView('topView');
    renderMaterialList();
    renderProductList();
    renderExpenseList();
});

// ビュー切り替え
function showView(viewId) {
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });
    
    const activeView = document.getElementById(viewId);
    if (activeView) {
        activeView.classList.remove('hidden');
        activeView.classList.add('fade-in');
    }

    // トップページのみヘッダーを隠すためのクラス制御
    document.body.classList.toggle('hide-header', viewId === 'topView');

    // タイトル更新
    if (pageTitle) {
        switch(viewId) {
            case 'topView': pageTitle.innerText = 'ハンドメイド・ログ'; break;
            case 'materialRegisterView': pageTitle.innerText = '資材を登録'; break;
            case 'materialListView': pageTitle.innerText = '資材一覧'; break;
            case 'productRegisterView': pageTitle.innerText = '作品を登録'; break;
            case 'productListView': pageTitle.innerText = '作品一覧'; break;
            case 'expenseRegisterView': 
                pageTitle.innerText = '経費登録'; 
                renderExpenseList();
                break;
            case 'soldListView': 
                pageTitle.innerText = '成約済みリスト'; 
                const filter = document.getElementById('soldMonthFilter');
                if (!filter.value) {
                    const now = new Date();
                    filter.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                }
                updateSoldView();
                break;
            case 'inventoryReportView':
                pageTitle.innerText = '在庫レポート';
                renderInventoryReport();
                break;
        }
    } else {
        // タイトル表示場所がない場合でも必要な初期化処理は行う
        if (viewId === 'expenseRegisterView') renderExpenseList();
        if (viewId === 'soldListView') {
            const filter = document.getElementById('soldMonthFilter');
            if (filter && !filter.value) {
                const now = new Date();
                filter.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            }
            updateSoldView();
        }
        if (viewId === 'inventoryReportView') renderInventoryReport();
    }

    // ナビゲーションの活性化
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (viewId.includes('material')) document.getElementById('navMaterial').classList.add('active');
    else if (viewId === 'productListView') document.getElementById('navProduct').classList.add('active');
    else if (viewId === 'expenseRegisterView') document.getElementById('navExpense').classList.add('active');
    else if (viewId === 'soldListView') document.getElementById('navSold').classList.add('active');
    else if (viewId === 'topView') document.getElementById('navHome').classList.add('active');
}

// --- 資材管理 ---

function getMaterialUsage(materialId) {
    let usage = 0;
    products.forEach(p => {
        if (p.materials) {
            p.materials.forEach(m => {
                if (m.id == materialId) {
                    usage += Number(m.qty);
                }
            });
        }
    });
    return usage;
}

function getMaterialStock(material) {
    const usage = getMaterialUsage(material.id);
    return material.qty - usage + (material.adjustment || 0);
}

function getAllTags() {
    const tagSet = new Set();
    materials.forEach(m => {
        if (m.tags && Array.isArray(m.tags)) {
            m.tags.forEach(t => tagSet.add(t));
        }
    });
    return Array.from(tagSet).sort();
}

function updateTagSuggestions() {
    const datalist = document.getElementById('tagSuggestions');
    if (!datalist) return;
    const tags = getAllTags();
    datalist.innerHTML = tags.map(t => `<option value="${t}">`).join('');
}

function getAllProductTags() {
    const tagSet = new Set();
    products.forEach(p => {
        if (p.tags && Array.isArray(p.tags)) {
            p.tags.forEach(t => tagSet.add(t));
        }
    });
    return Array.from(tagSet).sort();
}

function updateProductTagSuggestions() {
    const datalist = document.getElementById('productTagSuggestions');
    if (!datalist) return;
    const tags = getAllProductTags();
    datalist.innerHTML = tags.map(t => `<option value="${t}">`).join('');
}

function initMaterialForm(editData = null) {
    document.getElementById('materialForm').reset();
    document.getElementById('mId').value = '';
    document.getElementById('mStockGroup').classList.add('hidden');
    document.getElementById('materialSubmitBtn').innerText = '資材を登録する';

    if (editData) {
        document.getElementById('mId').value = editData.id;
        document.getElementById('mName').value = editData.name;
        document.getElementById('mPrice').value = editData.price;
        document.getElementById('mQty').value = editData.qty;
        document.getElementById('mUnit').value = editData.unit;
        document.getElementById('mDate').value = editData.date;
        document.getElementById('mShop').value = editData.shop;
        document.getElementById('mNote').value = editData.note;
        document.getElementById('mTags').value = (editData.tags || []).join(', ');
        
        // 編集時は在庫修正フィールドを表示
        document.getElementById('mStockGroup').classList.remove('hidden');
        document.getElementById('mStock').value = getMaterialStock(editData);
        document.getElementById('materialSubmitBtn').innerText = '変更を保存する';
    }

    updateTagSuggestions();
    showView('materialRegisterView');
}

function saveMaterial() {
    const id = document.getElementById('mId').value;
    const name = document.getElementById('mName').value;
    const price = Number(document.getElementById('mPrice').value);
    const qty = Number(document.getElementById('mQty').value);
    const unit = document.getElementById('mUnit').value;
    const date = document.getElementById('mDate').value;
    const shop = document.getElementById('mShop').value;
    const note = document.getElementById('mNote').value;
    const tagsInput = document.getElementById('mTags').value;
    const inputStock = document.getElementById('mStock').value;

    if (!name || !price || !qty || !unit) {
        alert('資材名、金額、購入量、単位は必須です。');
        return;
    }

    const tags = tagsInput.split(/[ ,、，]+/).map(t => t.trim()).filter(t => t !== '');

    if (id) {
        // 更新
        const index = materials.findIndex(m => m.id == id);
        if (index !== -1) {
            const m = materials[index];
            m.name = name;
            m.price = price;
            m.qty = qty;
            m.unit = unit;
            m.unitPrice = price / qty;
            m.date = date;
            m.shop = shop;
            m.note = note;
            m.tags = tags;

            // 在庫調整の計算
            if (inputStock !== '') {
                const currentUsage = getMaterialUsage(m.id);
                // 目標在庫 = qty - usage + adjustment
                // adjustment = 目標在庫 - qty + usage
                m.adjustment = Number(inputStock) - qty + currentUsage;
            }
        }
    } else {
        // 新規登録
        const material = {
            id: Date.now(),
            name,
            price,
            qty,
            unit,
            unitPrice: price / qty,
            date,
            shop,
            note,
            tags,
            adjustment: 0
        };
        materials.push(material);
    }

    Storage.set('hml_materials', materials);
    
    alert('資材を保存しました。');
    renderMaterialList();
    showView('materialListView');
}

function renderMaterialList() {
    const list = document.getElementById('materialListContainer');
    if (!list) return;
    
    const searchInput = document.getElementById('materialSearchInput');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let filteredMaterials = materials;
    if (searchTerm) {
        filteredMaterials = materials.filter(m => {
            const nameMatch = m.name.toLowerCase().includes(searchTerm);
            const tagMatch = m.tags && m.tags.some(t => t.toLowerCase().includes(searchTerm));
            const shopMatch = m.shop && m.shop.toLowerCase().includes(searchTerm);
            return nameMatch || tagMatch || shopMatch;
        });
    }
    
    if (materials.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">登録された資材はありません</p>';
        return;
    }

    if (filteredMaterials.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">条件に一致する資材はありません</p>';
        return;
    }

    list.innerHTML = filteredMaterials.map(m => {
        const stock = getMaterialStock(m);
        const stockStatus = stock <= 0 ? 'color:#c66; font-weight:bold;' : (stock < m.qty * 0.2 ? 'color:#e67e22;' : '');
        
        const tagsHtml = (m.tags && m.tags.length > 0) 
            ? `<div class="tag-container">${m.tags.map(t => `<span class="tag-label">${t}</span>`).join('')}</div>`
            : '';
        
        return `
            <div class="list-item">
                <div class="list-info">
                    <h4>${m.name}</h4>
                    <p>単価: ¥${m.unitPrice.toFixed(2)} / ${m.unit}</p>
                    <p style="${stockStatus}">在庫: ${stock.toFixed(2)} / ${m.qty} ${m.unit}</p>
                    <p style="font-size:0.7rem;">${m.shop ? m.shop + ' | ' : ''}${m.date || ''}</p>
                    ${tagsHtml}
                </div>
                <div style="display:flex; gap:8px; flex-direction:column;">
                    <button onclick="editMaterial(${m.id})" style="width:auto; padding:6px 10px; background:#f0f2f5; color:var(--primary-purple); box-shadow:none; font-size:0.75rem;">編集</button>
                    <button onclick="deleteMaterial(${m.id})" style="width:auto; padding:6px 10px; background:#f5f0f0; color:#c66; box-shadow:none; font-size:0.75rem;">削除</button>
                </div>
            </div>
        `;
    }).reverse().join('');
}

function editMaterial(id) {
    const material = materials.find(m => m.id == id);
    if (material) {
        initMaterialForm(material);
    }
}

function deleteMaterial(id) {
    if (!confirm('この資材を削除しますか？')) return;
    materials = materials.filter(m => m.id !== id);
    Storage.set('hml_materials', materials);
    renderMaterialList();
}

// --- 作品管理 ---

let currentProductMaterials = [];

function initProductForm(editData = null) {
    document.getElementById('productForm').reset();
    document.getElementById('pCalcArea').innerHTML = '';
    document.getElementById('pTotalCost').innerText = '0';
    document.getElementById('pId').value = '';
    document.getElementById('pSoldDateGroup').classList.add('hidden');
    
    if (editData) {
        document.getElementById('pId').value = editData.id;
        document.getElementById('pName').value = editData.name;
        document.getElementById('pPrice').value = editData.salesPrice;
        document.getElementById('pNote').value = editData.note;
        
        if (editData.materials && editData.materials.length > 0) {
            editData.materials.forEach(m => addProductMaterialRow(m.id, m.qty));
        } else {
            addProductMaterialRow();
        }

        if (editData.status === 'sold') {
            document.getElementById('pSoldDateGroup').classList.remove('hidden');
            if (editData.soldAt) {
                document.getElementById('pSoldDate').value = editData.soldAt.split('T')[0];
            }
        }
        document.getElementById('pTags').value = (editData.tags || []).join(', ');
    } else {
        addProductMaterialRow();
        document.getElementById('pTags').value = '';
    }
    
    updateProductTagSuggestions();
    calculateProductCost();
    showView('productRegisterView');
}

function addProductMaterialRow(selectedId = '', qtyValue = '') {
    const area = document.getElementById('pCalcArea');
    const rowId = Date.now() + Math.random().toString(36).substr(2, 5);
    
    const row = document.createElement('div');
    row.className = 'calc-row';
    row.id = `row-${rowId}`;
    row.innerHTML = `
        <div style="flex:2">
            <label>資材</label>
            <select class="p-mat-select" onchange="calculateProductCost()">
                <option value="">選択してください</option>
                ${materials.map(m => {
                    const stock = getMaterialStock(m);
                    return `<option value="${m.id}" ${m.id == selectedId ? 'selected' : ''}>${m.name} (残り:${stock.toFixed(1)}${m.unit} | ¥${m.unitPrice.toFixed(2)})</option>`;
                }).join('')}
            </select>
        </div>
        <div style="flex:1">
            <label>使用量</label>
            <input type="number" class="p-mat-qty" placeholder="0" value="${qtyValue}" oninput="calculateProductCost()">
        </div>
        <button onclick="removeProductMaterialRow('${rowId}')" style="width:auto; padding:12px; background:none; box-shadow:none; color:#c66;">✕</button>
    `;
    area.appendChild(row);
}

function removeProductMaterialRow(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (row) row.remove();
    calculateProductCost();
}

function calculateProductCost() {
    let total = 0;
    const selects = document.querySelectorAll('.p-mat-select');
    const qtys = document.querySelectorAll('.p-mat-qty');
    
    selects.forEach((select, i) => {
        const matId = select.value;
        const qty = Number(qtys[i].value);
        if (matId && qty) {
            const mat = materials.find(m => m.id == matId);
            if (mat) {
                total += mat.unitPrice * qty;
            }
        }
    });
    
    document.getElementById('pTotalCost').innerText = Math.round(total).toLocaleString();
}

function saveProduct() {
    const id = document.getElementById('pId').value;
    const name = document.getElementById('pName').value;
    const salesPrice = Number(document.getElementById('pPrice').value) || 0;
    const note = document.getElementById('pNote').value;
    const cost = Number(document.getElementById('pTotalCost').innerText.replace(/,/g, ''));
    const soldDate = document.getElementById('pSoldDate').value;
    const tagsInput = document.getElementById('pTags').value;

    if (!name) {
        alert('作品名は必須です。');
        return;
    }

    const tags = tagsInput.split(/[ ,、，]+/).map(t => t.trim()).filter(t => t !== '');
    const usedMaterials = [];
    const selects = document.querySelectorAll('.p-mat-select');
    const qtys = document.querySelectorAll('.p-mat-qty');
    
    selects.forEach((select, i) => {
        const matId = select.value;
        const qty = Number(qtys[i].value);
        if (matId && qty) {
            usedMaterials.push({ id: matId, qty: qty });
        }
    });

    if (id) {
        // 更新
        const index = products.findIndex(p => p.id == id);
        if (index !== -1) {
            products[index].name = name;
            products[index].salesPrice = salesPrice;
            products[index].cost = cost;
            products[index].note = note;
            products[index].materials = usedMaterials;
            products[index].tags = tags;
            if (products[index].status === 'sold' && soldDate) {
                products[index].soldAt = new Date(soldDate).toISOString();
            }
        }
    } else {
        // 新規登録
        const product = {
            id: Date.now(),
            name,
            salesPrice,
            cost,
            note,
            materials: usedMaterials,
            tags: tags,
            status: 'working',
            createdAt: new Date().toISOString(),
            soldAt: null
        };
        products.push(product);
    }

    Storage.set('hml_products', products);
    
    alert('作品を保存しました。');
    renderProductList();
    renderSoldList();
    calculateMonthlyStats();
    
    if (id) {
        const product = products.find(p => p.id == id);
        if (product && product.status === 'sold') {
            showView('soldListView');
            return;
        }
    }
    showView('productListView');
}

function renderProductList() {
    const list = document.getElementById('productListContainer');
    if (!list) return;
    
    const searchInput = document.getElementById('productSearchInput');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let workingProducts = products.filter(p => p.status === 'working');
    
    if (searchTerm) {
        workingProducts = workingProducts.filter(p => {
            const nameMatch = p.name.toLowerCase().includes(searchTerm);
            const tagMatch = p.tags && p.tags.some(t => t.toLowerCase().includes(searchTerm));
            const noteMatch = p.note && p.note.toLowerCase().includes(searchTerm);
            return nameMatch || tagMatch || noteMatch;
        });
    }

    if (workingProducts.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:#999; padding:20px;">${searchTerm ? '一致する作品はありません' : '登録された作品はありません'}</p>`;
        return;
    }

    list.innerHTML = workingProducts.map(p => {
        const tagsHtml = (p.tags && p.tags.length > 0) 
            ? `<div class="tag-container">${p.tags.map(t => `<span class="tag-label">${t}</span>`).join('')}</div>`
            : '';
            
        return `
            <div class="list-item">
                <div class="list-info">
                    <h4>${p.name}</h4>
                    <p>材料費: ¥${p.cost.toLocaleString()}${p.salesPrice ? ` | 予定価格: ¥${p.salesPrice.toLocaleString()}` : ''}</p>
                    ${p.note ? `<p style="font-size:0.75rem; color:#666;">${p.note}</p>` : ''}
                    ${tagsHtml}
                </div>
            <div style="display:flex; gap:8px; flex-direction:column;">
                <div style="display:flex; gap:8px;">
                    <button onclick="markAsSold(${p.id})" style="width:auto; padding:6px 10px; background:var(--light-purple); color:var(--primary-purple); box-shadow:none; font-size:0.75rem;">成約</button>
                    <button onclick="editProduct(${p.id})" style="width:auto; padding:6px 10px; background:#f0f2f5; color:var(--primary-purple); box-shadow:none; font-size:0.75rem;">編集</button>
                </div>
                <button onclick="deleteProduct(${p.id})" style="width:auto; padding:6px 10px; background:#f5f0f0; color:#c66; box-shadow:none; font-size:0.75rem;">削除</button>
            </div>
        </div>
        `;
    }).reverse().join('');
}

function editProduct(id) {
    const product = products.find(p => p.id == id);
    if (product) {
        initProductForm(product);
    }
}

function deleteProduct(id) {
    if (!confirm('この作品を削除しますか？')) return;
    products = products.filter(p => p.id !== id);
    Storage.set('hml_products', products);
    renderProductList();
    renderSoldList();
    calculateMonthlyStats();
}

function updateSoldView() {
    renderSoldList();
    calculateMonthlyStats();
}

function markAsSold(id) {
    const product = products.find(p => p.id === id);
    if (product) {
        document.getElementById('soldModalPId').value = id;
        document.getElementById('soldModalPrice').value = product.salesPrice || '';
        
        // 今日の日付をセット
        const now = new Date();
        document.getElementById('soldModalDate').value = now.toISOString().split('T')[0];
        
        document.getElementById('soldModal').classList.remove('hidden');
    }
}

function closeSoldModal() {
    document.getElementById('soldModal').classList.add('hidden');
}

function submitSoldInfo() {
    const id = Number(document.getElementById('soldModalPId').value);
    const price = Number(document.getElementById('soldModalPrice').value);
    const date = document.getElementById('soldModalDate').value;

    if (!price || !date) {
        alert('販売価格と成約日は必須です。');
        return;
    }

    const product = products.find(p => p.id === id);
    if (product) {
        product.salesPrice = price;
        product.status = 'sold';
        product.soldAt = new Date(date).toISOString();
        Storage.set('hml_products', products);
        
        closeSoldModal();
        renderProductList();
        renderSoldList();
        calculateMonthlyStats();
        alert('成約済みリストに移動しました');
    }
}

function renderSoldList() {
    const list = document.getElementById('soldListContainer');
    if (!list) return;
    
    const filterValue = document.getElementById('soldMonthFilter').value;
    if (!filterValue) return;
    
    const [year, month] = filterValue.split('-').map(Number);
    
    const soldProducts = products.filter(p => {
        if (p.status !== 'sold' || !p.soldAt) return false;
        const soldDate = new Date(p.soldAt);
        return soldDate.getFullYear() === year && (soldDate.getMonth() + 1) === month;
    });
    
    if (soldProducts.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">この月の成約済み作品はありません</p>';
        return;
    }

    list.innerHTML = soldProducts.map(p => {
        const profit = p.salesPrice - p.cost;
        const soldDate = new Date(p.soldAt).toLocaleDateString('ja-JP');
        const tagsHtml = (p.tags && p.tags.length > 0) 
            ? `<div class="tag-container">${p.tags.map(t => `<span class="tag-label">${t}</span>`).join('')}</div>`
            : '';

        return `
            <div class="list-item">
                <div class="list-info">
                    <h4>${p.name}</h4>
                    <p>売上: ¥${p.salesPrice.toLocaleString()} | 原価: ¥${p.cost.toLocaleString()}</p>
                    <p style="color:var(--primary-purple); font-weight:600;">利益: ¥${profit.toLocaleString()}</p>
                    <p style="font-size:0.7rem;">成約日: ${soldDate}</p>
                    ${tagsHtml}
                </div>
                <div style="display:flex; gap:8px; flex-direction:column;">
                    <button onclick="editProduct(${p.id})" style="width:auto; padding:6px 10px; background:#f0f2f5; color:var(--primary-purple); box-shadow:none; font-size:0.75rem;">編集</button>
                    <button onclick="deleteProduct(${p.id})" style="width:auto; padding:6px 10px; background:#f5f0f0; color:#c66; box-shadow:none; font-size:0.75rem;">削除</button>
                </div>
            </div>
        `;
    }).reverse().join('');
}

function calculateMonthlyStats() {
    const filterValue = document.getElementById('soldMonthFilter').value;
    if (!filterValue) return;
    
    const [year, month] = filterValue.split('-').map(Number);
    
    // 成約作品の集計
    const monthlySold = products.filter(p => {
        if (p.status !== 'sold' || !p.soldAt) return false;
        const soldDate = new Date(p.soldAt);
        return soldDate.getFullYear() === year && (soldDate.getMonth() + 1) === month;
    });
    
    // 経費の集計
    const monthlyExpensesData = expenses.filter(e => {
        const expDate = new Date(e.date);
        return expDate.getFullYear() === year && (expDate.getMonth() + 1) === month;
    });
    
    let totalSales = 0;
    let totalCosts = 0;
    let totalExpenses = 0;
    
    monthlySold.forEach(p => {
        totalSales += p.salesPrice;
        totalCosts += p.cost;
    });

    monthlyExpensesData.forEach(e => {
        totalExpenses += e.amount;
    });
    
    const totalProfit = totalSales - totalCosts - totalExpenses;
    
    document.getElementById('monthlySales').innerText = totalSales.toLocaleString();
    document.getElementById('monthlyCosts').innerText = totalCosts.toLocaleString();
    document.getElementById('monthlyExpenses').innerText = totalExpenses.toLocaleString();
    document.getElementById('monthlyProfit').innerText = totalProfit.toLocaleString();
}

// --- 経費管理 ---

function saveExpense() {
    const title = document.getElementById('eTitle').value;
    const amount = Number(document.getElementById('eAmount').value);
    const date = document.getElementById('eDate').value;
    const note = document.getElementById('eNote').value;

    if (!title || !amount || !date) {
        alert('用途、金額、日付は必須です。');
        return;
    }

    const expense = {
        id: Date.now(),
        title,
        amount,
        date,
        note
    };

    expenses.push(expense);
    Storage.set('hml_expenses', expenses);
    
    alert('経費を登録しました。');
    document.getElementById('expenseForm').reset();
    renderExpenseList();
}

function renderExpenseList() {
    const list = document.getElementById('expenseListContainer');
    if (!list) return;
    
    if (expenses.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">登録された経費はありません</p>';
        return;
    }

    list.innerHTML = expenses.map(e => `
        <div class="list-item">
            <div class="list-info">
                <h4>${e.title}</h4>
                <p>¥${e.amount.toLocaleString()} | ${e.date}</p>
                ${e.note ? `<p style="font-size:0.75rem; color:#666;">${e.note}</p>` : ''}
            </div>
            <button onclick="deleteExpense(${e.id})" style="width:auto; padding:8px 12px; background:#f5f0f0; color:#c66; box-shadow:none; font-size:0.8rem;">削除</button>
        </div>
    `).reverse().join('');
}

function deleteExpense(id) {
    if (!confirm('この経費を削除しますか？')) return;
    expenses = expenses.filter(e => e.id !== id);
    Storage.set('hml_expenses', expenses);
    renderExpenseList();
    calculateMonthlyStats();
}

// --- レポート機能 ---

let currentReportTab = 'material';

function switchReportTab(tab) {
    currentReportTab = tab;
    
    // UI更新
    document.getElementById('tabMaterial').classList.toggle('active', tab === 'material');
    document.getElementById('tabProduct').classList.toggle('active', tab === 'product');
    
    renderInventoryReport();
}

function renderInventoryReport() {
    if (currentReportTab === 'material') {
        renderMaterialInventoryReport();
    } else {
        renderProductInventoryReport();
    }
}

function renderMaterialInventoryReport() {
    const container = document.getElementById('inventoryReportContainer');
    if (!container) return;

    // 残量がある資材をフィルタリング
    const stockMaterials = materials.filter(m => getMaterialStock(m) > 0);

    if (stockMaterials.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">残量がある資材はありません</p>';
        return;
    }

    let totalInventoryValue = 0;

    let html = `
        <table class="report-table">
            <thead>
                <tr>
                    <th>資材名</th>
                    <th class="num">単価</th>
                    <th class="num">残量</th>
                    <th class="num">金額</th>
                </tr>
            </thead>
            <tbody>
    `;

    stockMaterials.forEach(m => {
        const stock = getMaterialStock(m);
        const value = m.unitPrice * stock;
        totalInventoryValue += value;

        html += `
            <tr>
                <td>${m.name}</td>
                <td class="num">¥${m.unitPrice.toFixed(2)}</td>
                <td class="num">${stock.toFixed(2)}${m.unit}</td>
                <td class="num">¥${Math.round(value).toLocaleString()}</td>
            </tr>
        `;
    });

    html += `
            <tr class="report-total-row">
                <td colspan="3" style="text-align:right;">合計金額</td>
                <td class="num">¥${Math.round(totalInventoryValue).toLocaleString()}</td>
            </tr>
        </tbody>
    </table>
    `;

    container.innerHTML = html;
}

function renderProductInventoryReport() {
    const container = document.getElementById('inventoryReportContainer');
    if (!container) return;

    // 未成約（working）の作品をフィルタリング
    const workingProducts = products.filter(p => p.status === 'working');

    if (workingProducts.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">未成約の作品はありません</p>';
        return;
    }

    let totalSalesValue = 0;
    let totalCostValue = 0;

    let html = `
        <table class="report-table">
            <thead>
                <tr>
                    <th>作品名</th>
                    <th class="num">販売予定</th>
                    <th class="num">材料費</th>
                </tr>
            </thead>
            <tbody>
    `;

    workingProducts.forEach(p => {
        totalSalesValue += p.salesPrice;
        totalCostValue += p.cost;

        html += `
            <tr>
                <td>${p.name}</td>
                <td class="num">¥${p.salesPrice.toLocaleString()}</td>
                <td class="num">¥${p.cost.toLocaleString()}</td>
            </tr>
        `;
    });

    html += `
            <tr class="report-total-row">
                <td style="text-align:right;">合計</td>
                <td class="num">¥${totalSalesValue.toLocaleString()}</td>
                <td class="num">¥${totalCostValue.toLocaleString()}</td>
            </tr>
        </tbody>
    </table>
    `;

    container.innerHTML = html;
}


// --- バックアップ・復元機能 ---

const BACKUP_PREFIX = 'hml_';

function exportData() {
    const data = {};
    // hml_ で始まる全てのデータを収集
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(BACKUP_PREFIX)) {
            try {
                data[key] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
                data[key] = localStorage.getItem(key);
            }
        }
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const dateStr = now.getFullYear() + 
                    String(now.getMonth() + 1).padStart(2, '0') + 
                    String(now.getDate()).padStart(2, '0');
    
    a.href = url;
    a.download = `handmade_log_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm('データを復元しますか？現在のデータはすべて上書きされます。')) {
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // データの検証（少なくとも一つは hml_ データがあるか）
            const keys = Object.keys(data).filter(k => k.startsWith(BACKUP_PREFIX));
            if (keys.length === 0) {
                throw new Error('有効なバックアップデータが見つかりません。');
            }

            // 全ての hml_ データを復元
            keys.forEach(key => {
                const value = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
                localStorage.setItem(key, value);
            });

            alert('データの復元が完了しました。最新のデータを反映するためにページを再読み込みします。');
            location.reload();
        } catch (err) {
            alert('復元に失敗しました: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}
