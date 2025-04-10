const express = require('express');
const router = express.Router();
const { pool } = require('./db');

// Get all products with category info
router.get('/products', async (req, res) => {
    try {
        const [products] = await pool.query(`
            SELECT 
                p.id, 
                p.name, 
                p.description, 
                p.price, 
                p.cost, 
                p.stock, 
                p.threshold,
                p.created_at,
                p.updated_at,
                c.id as category_id, 
                c.name as category_name
            FROM 
                products p
            LEFT JOIN 
                categories c ON p.category_id = c.id
            ORDER BY 
                p.name
        `);
        
        res.status(200).json(products);
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get a single product by ID
router.get('/products/:id', async (req, res) => {
    try {
        const [products] = await pool.query(`
            SELECT 
                p.id, 
                p.name, 
                p.description, 
                p.price, 
                p.cost, 
                p.stock, 
                p.threshold,
                p.created_at,
                p.updated_at,
                c.id as category_id, 
                c.name as category_name
            FROM 
                products p
            LEFT JOIN 
                categories c ON p.category_id = c.id
            WHERE 
                p.id = ?
        `, [req.params.id]);
        
        if (products.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        res.status(200).json(products[0]);
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a new product
router.post('/products', async (req, res) => {
    try {
        const { name, description, category_id, price, cost, stock, threshold } = req.body;
        
        // Validate input
        if (!name || !price) {
            return res.status(400).json({ message: 'Name and price are required' });
        }
        
        const [result] = await pool.query(
            'INSERT INTO products (name, description, category_id, price, cost, stock, threshold) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, description, category_id, price, cost, stock || 0, threshold || 10]
        );
        
        // Log the initial stock if greater than 0
        if (stock > 0) {
            await pool.query(
                'INSERT INTO inventory_logs (product_id, user_id, quantity, type, notes) VALUES (?, ?, ?, ?, ?)',
                [result.insertId, req.user.id, stock, 'in', 'Initial stock']
            );
        }
        
        res.status(201).json({
            message: 'Product created successfully',
            productId: result.insertId
        });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update a product
router.put('/products/:id', async (req, res) => {
    try {
        const { name, description, category_id, price, cost, threshold } = req.body;
        const productId = req.params.id;
        
        // Validate input
        if (!name || !price) {
            return res.status(400).json({ message: 'Name and price are required' });
        }
        
        // Check if product exists
        const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [productId]);
        if (products.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        await pool.query(
            'UPDATE products SET name = ?, description = ?, category_id = ?, price = ?, cost = ?, threshold = ? WHERE id = ?',
            [name, description, category_id, price, cost, threshold, productId]
        );
        
        res.status(200).json({
            message: 'Product updated successfully'
        });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a product
router.delete('/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        
        // Check if product exists
        const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [productId]);
        if (products.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        // Delete product (inventory_logs will be deleted due to CASCADE)
        await pool.query('DELETE FROM products WHERE id = ?', [productId]);
        
        res.status(200).json({
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update product stock
router.post('/products/:id/stock', async (req, res) => {
    try {
        const { quantity, type, notes } = req.body;
        const productId = req.params.id;
        
        // Validate input
        if (!quantity || !type || !['in', 'out'].includes(type)) {
            return res.status(400).json({ message: 'Valid quantity and type (in/out) are required' });
        }
        
        // Check if product exists
        const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [productId]);
        if (products.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        const product = products[0];
        let newStock = product.stock;
        
        // Update stock based on type
        if (type === 'in') {
            newStock += parseInt(quantity);
        } else {
            // Check if there's enough stock
            if (product.stock < quantity) {
                return res.status(400).json({ message: 'Not enough stock available' });
            }
            newStock -= parseInt(quantity);
        }
        
        // Begin transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            // Update product stock
            await connection.query(
                'UPDATE products SET stock = ? WHERE id = ?',
                [newStock, productId]
            );
            
            // Log the stock change
            await connection.query(
                'INSERT INTO inventory_logs (product_id, user_id, quantity, type, notes) VALUES (?, ?, ?, ?, ?)',
                [productId, req.user.id, quantity, type, notes]
            );
            
            await connection.commit();
            
            res.status(200).json({
                message: 'Stock updated successfully',
                newStock
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Update stock error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get inventory logs for a product
router.get('/products/:id/logs', async (req, res) => {
    try {
        const productId = req.params.id;
        
        const [logs] = await pool.query(`
            SELECT 
                il.id,
                il.quantity,
                il.type,
                il.notes,
                il.created_at,
                u.username as user_name
            FROM 
                inventory_logs il
            LEFT JOIN 
                users u ON il.user_id = u.id
            WHERE 
                il.product_id = ?
            ORDER BY 
                il.created_at DESC
        `, [productId]);
        
        res.status(200).json(logs);
    } catch (error) {
        console.error('Get inventory logs error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all categories
router.get('/categories', async (req, res) => {
    try {
        const [categories] = await pool.query('SELECT * FROM categories ORDER BY name');
        res.status(200).json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a new category
router.post('/categories', async (req, res) => {
    try {
        const { name, description } = req.body;
        
        // Validate input
        if (!name) {
            return res.status(400).json({ message: 'Category name is required' });
        }
        
        const [result] = await pool.query(
            'INSERT INTO categories (name, description) VALUES (?, ?)',
            [name, description]
        );
        
        res.status(201).json({
            message: 'Category created successfully',
            categoryId: result.insertId
        });
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get dashboard data
router.get('/dashboard', async (req, res) => {
    try {
        // Get total products count
        const [productsResult] = await pool.query('SELECT COUNT(*) as count FROM products');
        const totalProducts = productsResult[0].count;
        
        // Get low stock products count
        const [lowStockResult] = await pool.query('SELECT COUNT(*) as count FROM products WHERE stock <= threshold AND stock > 0');
        const lowStockCount = lowStockResult[0].count;
        
        // Get out of stock products count
        const [outOfStockResult] = await pool.query('SELECT COUNT(*) as count FROM products WHERE stock = 0');
        const outOfStockCount = outOfStockResult[0].count;
        
        // Get total inventory value
        const [valueResult] = await pool.query('SELECT SUM(price * stock) as total FROM products');
        const totalValue = valueResult[0].total || 0;
        
        // Get recent inventory logs
        const [recentLogs] = await pool.query(`
            SELECT 
                il.id,
                p.name as product_name,
                il.quantity,
                il.type,
                il.created_at,
                u.username as user_name
            FROM 
                inventory_logs il
            JOIN 
                products p ON il.product_id = p.id
            LEFT JOIN 
                users u ON il.user_id = u.id
            ORDER BY 
                il.created_at DESC
            LIMIT 10
        `);
        
        // Get products by category
        const [productsByCategory] = await pool.query(`
            SELECT 
                c.name as category,
                COUNT(p.id) as count
            FROM 
                products p
            JOIN 
                categories c ON p.category_id = c.id
            GROUP BY 
                c.name
            ORDER BY 
                count DESC
        `);
        
        // Get low stock products
        const [lowStockProducts] = await pool.query(`
            SELECT 
                p.id,
                p.name,
                p.stock,
                p.threshold,
                c.name as category
            FROM 
                products p
            JOIN 
                categories c ON p.category_id = c.id
            WHERE 
                p.stock <= p.threshold
            ORDER BY 
                (p.threshold - p.stock) DESC
            LIMIT 5
        `);
        
        res.status(200).json({
            totalProducts,
            lowStockCount,
            outOfStockCount,
            totalValue,
            recentLogs,
            productsByCategory,
            lowStockProducts
        });
    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;