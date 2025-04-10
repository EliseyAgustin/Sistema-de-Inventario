document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    // Set user name
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById('user-name').textContent = user.name;
    }

    // Sidebar toggle
    const toggleSidebar = document.getElementById('toggle-sidebar');
    const closeSidebar = document.getElementById('close-sidebar');
    const sidebar = document.getElementById('sidebar');

    if (toggleSidebar) {
        toggleSidebar.addEventListener('click', function() {
            sidebar.classList.toggle('-translate-x-full');
        });
    }

    if (closeSidebar) {
        closeSidebar.addEventListener('click', function() {
            sidebar.classList.add('-translate-x-full');
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        });
    }

    // Update date and time
    const dateTimeEl = document.getElementById('date-time');
    if (dateTimeEl) {
        function updateDateTime() {
            const now = new Date();
            dateTimeEl.textContent = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
        }
        updateDateTime();
        setInterval(updateDateTime, 1000);
    }

    // Load dashboard data
    if (window.location.pathname === '/dashboard') {
        loadDashboardData();
    }

    // Load inventory data
    if (window.location.pathname === '/inventory') {
        loadCategories();
        loadProducts();
        setupInventoryEventListeners();
    }
});

// Load dashboard data
async function loadDashboardData() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/inventory/dashboard', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load dashboard data');
        }

        const data = await response.json();
        
        // Update stats
        document.getElementById('total-products').textContent = data.totalProducts;
        document.getElementById('low-stock').textContent = data.lowStockCount;
        document.getElementById('out-of-stock').textContent = data.outOfStockCount;
        document.getElementById('inventory-value').textContent = '$' + data.totalValue.toFixed(2);
        
        // Update low stock table
        const lowStockTable = document.getElementById('low-stock-table');
        if (data.lowStockProducts.length === 0) {
            lowStockTable.innerHTML = `
                <tr>
                    <td colspan="5" class="py-4 px-4 text-center text-gray-500">No low stock items</td>
                </tr>
            `;
        } else {
            lowStockTable.innerHTML = '';
            data.lowStockProducts.forEach(product => {
                let statusClass = 'bg-yellow-100 text-yellow-800';
                let statusText = 'Low Stock';
                
                if (product.stock <= 0) {
                    statusClass = 'bg-red-100 text-red-800';
                    statusText = 'Out of Stock';
                }
                
                lowStockTable.innerHTML += `
                    <tr>
                        <td class="py-2 px-4 border-b border-gray-200">${product.name}</td>
                        <td class="py-2 px-4 border-b border-gray-200">${product.category}</td>
                        <td class="py-2 px-4 border-b border-gray-200">${product.stock}</td>
                        <td class="py-2 px-4 border-b border-gray-200">${product.threshold}</td>
                        <td class="py-2 px-4 border-b border-gray-200">
                            <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                                ${statusText}
                            </span>
                        </td>
                    </tr>
                `;
            });
        }
        
        // Update recent activity table
        const recentActivityTable = document.getElementById('recent-activity-table');
        if (data.recentLogs.length === 0) {
            recentActivityTable.innerHTML = `
                <tr>
                    <td colspan="5" class="py-4 px-4 text-center text-gray-500">No recent activity</td>
                </tr>
            `;
        } else {
            recentActivityTable.innerHTML = '';
            data.recentLogs.forEach(log => {
                const date = new Date(log.created_at).toLocaleString();
                const typeClass = log.type === 'in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                const typeText = log.type === 'in' ? 'Stock In' : 'Stock Out';
                
                recentActivityTable.innerHTML += `
                    <tr>
                        <td class="py-2 px-4 border-b border-gray-200">${log.product_name}</td>
                        <td class="py-2 px-4 border-b border-gray-200">${log.quantity}</td>
                        <td class="py-2 px-4 border-b border-gray-200">
                            <span class="px-2 py-1 text-xs font-semibold rounded-full ${typeClass}">
                                ${typeText}
                            </span>
                        </td>
                        <td class="py-2 px-4 border-b border-gray-200">${log.user_name || 'System'}</td>
                        <td class="py-2 px-4 border-b border-gray-200">${date}</td>
                    </tr>
                `;
            });
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Load categories
async function loadCategories() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/inventory/categories', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load categories');
        }

        const categories = await response.json();
        
        // Update category filter
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.innerHTML = '<option value="">All Categories</option>';
            categories.forEach(category => {
                categoryFilter.innerHTML += `<option value="${category.id}">${category.name}</option>`;
            });
        }
        
        // Update product category select
        const productCategory = document.getElementById('product-category');
        if (productCategory) {
            productCategory.innerHTML = '';
            categories.forEach(category => {
                productCategory.innerHTML += `<option value="${category.id}">${category.name}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Load products
async function loadProducts() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/inventory/products', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load products');
        }

        const products = await response.json();
        
        // Update products table
        const productsTable = document.getElementById('products-table');
        if (productsTable) {
            if (products.length === 0) {
                productsTable.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-4 px-4 text-center text-gray-500">No products found</td>
                    </tr>
                `;
            } else {
                productsTable.innerHTML = '';
                products.forEach(product => {
                    let statusClass = 'bg-green-100 text-green-800';
                    let statusText = 'In Stock';
                    
                    if (product.stock <= 0) {
                        statusClass = 'bg-red-100 text-red-800';
                        statusText = 'Out of Stock';
                    } else if (product.stock <= product.threshold) {
                        statusClass = 'bg-yellow-100 text-yellow-800';
                        statusText = 'Low Stock';
                    }
                    
                    productsTable.innerHTML += `
                        <tr data-id="${product.id}">
                            <td class="py-2 px-4 border-b border-gray-200">
                                <div class="font-medium">${product.name}</div>
                                <div class="text-sm text-gray-500">${product.description || ''}</div>
                            </td>
                            <td class="py-2 px-4 border-b border-gray-200">${product.category_name || 'Uncategorized'}</td>
                            <td class="py-2 px-4 border-b border-gray-200">$${product.price.toFixed(2)}</td>
                            <td class="py-2 px-4 border-b border-gray-200">${product.stock}</td>
                            <td class="py-2 px-4 border-b border-gray-200">
                                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                                    ${statusText}
                                </span>
                            </td>
                            <td class="py-2 px-4 border-b border-gray-200">
                                <div class="flex space-x-2">
                                    <button class="update-stock-btn text-blue-600 hover:text-blue-800" title="Update Stock">
                                        <i class="fas fa-exchange-alt"></i>
                                    </button>
                                    <button class="edit-product-btn text-yellow-600 hover:text-yellow-800" title="Edit Product">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="delete-product-btn text-red-600 hover:text-red-800" title="Delete Product">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
                
                // Add event listeners to buttons
                document.querySelectorAll('.update-stock-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const productId = this.closest('tr').dataset.id;
                        openStockModal(productId);
                    });
                });
                
                document.querySelectorAll('.edit-product-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const productId = this.closest('tr').dataset.id;
                        openProductModal(productId);
                    });
                });
                
                document.querySelectorAll('.delete-product-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const productId = this.closest('tr').dataset.id;
                        openDeleteModal(productId);
                    });
                });
            }
        }
        
        // Setup search and filter
        setupSearchAndFilter(products);
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

// Setup search and filter
function setupSearchAndFilter(products) {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const stockFilter = document.getElementById('stock-filter');
    
    if (searchInput && categoryFilter && stockFilter) {
        function filterProducts() {
            const searchTerm = searchInput.value.toLowerCase();
            const categoryId = categoryFilter.value;
            const stockStatus = stockFilter.value;
            
            const filteredProducts = products.filter(product => {
                // Search term filter
                const matchesSearch = product.name.toLowerCase().includes(searchTerm) || 
                                     (product.description && product.description.toLowerCase().includes(searchTerm));
                
                // Category filter
                const matchesCategory = !categoryId || product.category_id == categoryId;
                
                // Stock status filter
                let matchesStock = true;
                if (stockStatus === 'in-stock') {
                    matchesStock = product.stock > product.threshold;
                } else if (stockStatus === 'low-stock') {
                    matchesStock = product.stock <= product.threshold && product.stock > 0;
                } else if (stockStatus === 'out-of-stock') {
                    matchesStock = product.stock <= 0;
                }
                
                return matchesSearch && matchesCategory && matchesStock;
            });
            
            // Update products table with filtered results
            const productsTable = document.getElementById('products-table');
            if (productsTable) {
                if (filteredProducts.length === 0) {
                    productsTable.innerHTML = `
                        <tr>
                            <td colspan="6" class="py-4 px-4 text-center text-gray-500">No products found</td>
                        </tr>
                    `;
                } else {
                    productsTable.innerHTML = '';
                    filteredProducts.forEach(product => {
                        let statusClass = 'bg-green-100 text-green-800';
                        let statusText = 'In Stock';
                        
                        if (product.stock <= 0) {
                            statusClass = 'bg-red-100 text-red-800';
                            statusText = 'Out of Stock';
                        } else if (product.stock <= product.threshold) {
                            statusClass = 'bg-yellow-100 text-yellow-800';
                            statusText = 'Low Stock';
                        }
                        
                        productsTable.innerHTML += `
                            <tr data-id="${product.id}">
                                <td class="py-2 px-4 border-b border-gray-200">
                                    <div class="font-medium">${product.name}</div>
                                    <div class="text-sm text-gray-500">${product.description || ''}</div>
                                </td>
                                <td class="py-2 px-4 border-b border-gray-200">${product.category_name || 'Uncategorized'}</td>
                                <td class="py-2 px-4 border-b border-gray-200">$${product.price.toFixed(2)}</td>
                                <td class="py-2 px-4 border-b border-gray-200">${product.stock}</td>
                                <td class="py-2 px-4 border-b border-gray-200">
                                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                                        ${statusText}
                                    </span>
                                </td>
                                <td class="py-2 px-4 border-b border-gray-200">
                                    <div class="flex space-x-2">
                                        <button class="update-stock-btn text-blue-600 hover:text-blue-800" title="Update Stock">
                                            <i class="fas fa-exchange-alt"></i>
                                        </button>
                                        <button class="edit-product-btn text-yellow-600 hover:text-yellow-800" title="Edit Product">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="delete-product-btn text-red-600 hover:text-red-800" title="Delete Product">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    });
                    
                    // Re-add event listeners to buttons
                    document.querySelectorAll('.update-stock-btn').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const productId = this.closest('tr').dataset.id;
                            openStockModal(productId);
                        });
                    });
                    
                    document.querySelectorAll('.edit-product-btn').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const productId = this.closest('tr').dataset.id;
                            openProductModal(productId);
                        });
                    });
                    
                    document.querySelectorAll('.delete-product-btn').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const productId = this.closest('tr').dataset.id;
                            openDeleteModal(productId);
                        });
                    });
                }
            }
        }
        
        searchInput.addEventListener('input', filterProducts);
        categoryFilter.addEventListener('change', filterProducts);
        stockFilter.addEventListener('change', filterProducts);
    }
}

// Setup inventory event listeners
function setupInventoryEventListeners() {
    // Add product button
    const addProductBtn = document.getElementById('add-product-btn');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', function() {
            openProductModal();
        });
    }
    
    // Product modal
    const productModal = document.getElementById('product-modal');
    const closeModal = document.getElementById('close-modal');
    const cancelProduct = document.getElementById('cancel-product');
    const productForm = document.getElementById('product-form');
    
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            productModal.classList.add('hidden');
        });
    }
    
    if (cancelProduct) {
        cancelProduct.addEventListener('click', function() {
            productModal.classList.add('hidden');
        });
    }
    
    if (productForm) {
        productForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const productId = document.getElementById('product-id').value;
            const name = document.getElementById('product-name').value;
            const description = document.getElementById('product-description').value;
            const categoryId = document.getElementById('product-category').value;
            const price = document.getElementById('product-price').value;
            const cost = document.getElementById('product-cost').value;
            const stock = document.getElementById('product-stock').value;
            const threshold = document.getElementById('product-threshold').value;
            
            const productData = {
                name,
                description,
                category_id: categoryId,
                price,
                cost,
                stock,
                threshold
            };
            
            try {
                const token = localStorage.getItem('token');
                let url = '/api/inventory/products';
                let method = 'POST';
                
                if (productId) {
                    url = `/api/inventory/products/${productId}`;
                    method = 'PUT';
                }
                
                const response = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(productData)
                });
                
                if (!response.ok) {
                    throw new Error('Failed to save product');
                }
                
                productModal.classList.add('hidden');
                loadProducts();
            } catch (error) {
                console.error('Error saving product:', error);
                alert('Failed to save product. Please try again.');
            }
        });
    }
    
    // Stock modal
    const stockModal = document.getElementById('stock-modal');
    const closeStockModal = document.getElementById('close-stock-modal');
    const cancelStock = document.getElementById('cancel-stock');
    const stockForm = document.getElementById('stock-form');
    
    if (closeStockModal) {
        closeStockModal.addEventListener('click', function() {
            stockModal.classList.add('hidden');
        });
    }
    
    if (cancelStock) {
        cancelStock.addEventListener('click', function() {
            stockModal.classList.add('hidden');
        });
    }
    
    if (stockForm) {
        stockForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const productId = document.getElementById('stock-product-id').value;
            const type = document.getElementById('stock-type').value;
            const quantity = document.getElementById('stock-quantity').value;
            const notes = document.getElementById('stock-notes').value;
            
            const stockData = {
                type,
                quantity,
                notes
            };
            
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/inventory/products/${productId}/stock`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(stockData)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to update stock');
                }
                
                stockModal.classList.add('hidden');
                loadProducts();
            } catch (error) {
                console.error('Error updating stock:', error);
                alert(error.message || 'Failed to update stock. Please try again.');
            }
        });
    }
    
    // Delete modal
    const deleteModal = document.getElementById('delete-modal');
    const closeDeleteModal = document.getElementById('close-delete-modal');
    const cancelDelete = document.getElementById('cancel-delete');
    const confirmDelete = document.getElementById('confirm-delete');
    
    if (closeDeleteModal) {
        closeDeleteModal.addEventListener('click', function() {
            deleteModal.classList.add('hidden');
        });
    }
    
    if (cancelDelete) {
        cancelDelete.addEventListener('click', function() {
            deleteModal.classList.add('hidden');
        });
    }
    
    if (confirmDelete) {
        confirmDelete.addEventListener('click', async function() {
            const productId = this.dataset.id;
            
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/inventory/products/${productId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Failed to delete product');
                }
                
                deleteModal.classList.add('hidden');
                loadProducts();
            } catch (error) {
                console.error('Error deleting product:', error);
                alert('Failed to delete product. Please try again.');
            }
        });
    }
}

// Open product modal
async function openProductModal(productId = null) {
    const productModal = document.getElementById('product-modal');
    const modalTitle = document.getElementById('modal-title');
    const productIdInput = document.getElementById('product-id');
    const productName = document.getElementById('product-name');
    const productDescription = document.getElementById('product-description');
    const productCategory = document.getElementById('product-category');
    const productPrice = document.getElementById('product-price');
    const productCost = document.getElementById('product-cost');
    const productStock = document.getElementById('product-stock');
    const productThreshold = document.getElementById('product-threshold');
    
    // Reset form
    document.getElementById('product-form').reset();
    
    if (productId) {
        modalTitle.textContent = 'Edit Product';
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/inventory/products/${productId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load product');
            }
            
            const product = await response.json();
            
            productIdInput.value = product.id;
            productName.value = product.name;
            productDescription.value = product.description || '';
            productCategory.value = product.category_id || '';
            productPrice.value = product.price;
            productCost.value = product.cost || '';
            productStock.value = product.stock;
            productThreshold.value = product.threshold;
            
            // Disable stock field for existing products
            productStock.disabled = true;
        } catch (error) {
            console.error('Error loading product:', error);
            alert('Failed to load product. Please try again.');
            return;
        }
    } else {
        modalTitle.textContent = 'Add Product';
        productIdInput.value = '';
        
        // Enable stock field for new products
        productStock.disabled = false;
    }
    
    productModal.classList.remove('hidden');
}

// Open stock modal
async function openStockModal(productId) {
    const stockModal = document.getElementById('stock-modal');
    const stockProductId = document.getElementById('stock-product-id');
    const stockProductName = document.getElementById('stock-product-name');
    const stockCurrent = document.getElementById('stock-current');
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/inventory/products/${productId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load product');
        }
        
        const product = await response.json();
        
        stockProductId.value = product.id;
        stockProductName.textContent = product.name;
        stockCurrent.textContent = `Current Stock: ${product.stock}`;
        
        // Reset form
        document.getElementById('stock-form').reset();
        
        stockModal.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading product:', error);
        alert('Failed to load product. Please try again.');
    }
}

// Open delete modal
async function openDeleteModal(productId) {
    const deleteModal = document.getElementById('delete-modal');
    const deleteProductName = document.getElementById('delete-product-name');
    const confirmDelete = document.getElementById('confirm-delete');
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/inventory/products/${productId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load product');
        }
        
        const product = await response.json();
        
        deleteProductName.textContent = product.name;
        confirmDelete.dataset.id = product.id;
        
        deleteModal.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading product:', error);
        alert('Failed to load product. Please try again.');
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}