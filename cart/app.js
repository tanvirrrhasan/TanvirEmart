import { db } from '../firebase-config.js'; // Assuming firebase-config.js is one level up
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Global variables
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let products = []; // To store product details for cart display

// DOM elements
const cartSidebar = document.getElementById('cart-sidebar');
const cartItems = document.getElementById('cart-items');
const cartCount = document.getElementById('cart-count');
const cartTotal = document.getElementById('cart-total');
const closeCart = document.getElementById('close-cart');
const checkoutBtn = document.getElementById('checkout-btn');
const bottomNavBar = document.getElementById('bottom-nav');

// Initialize the cart page
document.addEventListener('DOMContentLoaded', () => {
    loadCartProducts(); // Load product details for items in cart
    updateCartDisplay();
    setupEventListeners();
    setupBottomNav();
    // Ensure cart sidebar is visible on the cart page
    if (cartSidebar) {
        cartSidebar.classList.add('active');
    }

    // Check URL parameter to hide bottom nav
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('hideBottomNav') === 'true') {
        document.body.classList.add('hide-bottom-nav');
    }
});

// Load product details for items in cart from Firebase
async function loadCartProducts() {
    if (cart.length === 0) {
        return;
    }
    try {
        const productIds = cart.map(item => item.id);
        if (productIds.length > 0) {
            // Fetch all products to match with cart items.
            // A more optimized approach would be to query specific products,
            // but Firestore 'in' query has a limit of 10.
            // For simplicity, fetching all products for now.
            const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const allProducts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter products that are in the cart
            products = allProducts.filter(p => productIds.includes(p.id));
        }
    } catch (error) {
        console.error('Error loading product details for cart:', error);
        showToast('Error loading product details.', true);
    }
}

// Setup event listeners for the cart page
function setupEventListeners() {
    if (closeCart) {
        closeCart.addEventListener('click', () => {
            // On cart page, close button could navigate back or just be decorative
            // For now, let's make it navigate back to the home page
            window.location.href = '../index.html';
        });
    }
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', handleCheckout);
    }
}

// Add to cart (can be used if product details are displayed)
function addToCart(productId) {
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        const product = products.find(p => p.id === productId);
        if (product) {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : null,
                quantity: 1
            });
        }
    }
    saveCart();
    updateCartDisplay();
    showToast('Item added to cart!');
}

// Remove from cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartDisplay();
    showToast('Item removed from cart.');
}

// Update cart quantity
function updateCartQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            updateCartDisplay();
        }
    }
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Update cart display
function updateCartDisplay() {
    // Update cart count
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount) {
        cartCount.textContent = totalItems;
    }

    // Update cart items
    if (cart.length === 0) {
        if (cartItems) {
            cartItems.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">Your cart is empty</p>';
        }
        if (cartTotal) {
            cartTotal.textContent = '৳0';
        }
        return;
    }

    if (cartItems) {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-image">
                    ${item.image
                        ? `<img src="${item.image}" alt="${item.name}">`
                        : '<div style="width: 100%; height: 100%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #999; font-size: 0.8rem;">No Image</div>'
                    }
                </div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">৳${item.price}</div>
                    <div class="cart-item-quantity">
                        <button class="quantity-btn" onclick="updateCartQuantity('${item.id}', -1)">-</button>
                        <span>${item.quantity}</span>
                        <button class="quantity-btn" onclick="updateCartQuantity('${item.id}', 1)">+</button>
                        <button class="remove-cart-item" onclick="removeFromCart('${item.id}')">Remove</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Update total
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (cartTotal) {
        cartTotal.textContent = `৳${total.toFixed(2)}`;
    }
}

// Toggle cart sidebar (not strictly needed for a dedicated page, but good to keep if reused)
function toggleCart() {
    // For a dedicated cart page, the cart is always open, so this might be redundant
    // cartSidebar.classList.toggle('active');
}

// Handle checkout
function handleCheckout() {
    if (cart.length === 0) {
        showToast('Your cart is empty!', true);
        return;
    }

    // Redirect to checkout page
    window.location.href = '../checkout/index.html';
}

// Show toast notification
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 90px; /* Adjust for bottom nav */
        left: 50%;
        transform: translateX(-50%);
        background: ${isError ? '#e53935' : '#43a047'};
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 9999;
        font-weight: 500;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Bottom Navigation Bar Logic (copied for consistency in cart page)
function setupBottomNav() {
    const navLinks = document.querySelectorAll('.bottom-nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Remove active from all
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            // Handle navigation - prevent default if it's a hash link that might scroll
            const href = this.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault(); // Prevent default anchor behavior
            }
            // Other navigation (e.g., to index.html or account) will be handled by browser
        });
    });
}

// Make functions globally available for onclick handlers in cart.html
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.showToast = showToast; 