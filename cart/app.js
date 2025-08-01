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

// Custom modal elements
const confirmModal = document.getElementById('custom-confirm-modal');
const confirmModalYes = document.getElementById('confirm-modal-yes');
const confirmModalNo = document.getElementById('confirm-modal-no');
let productIdToRemove = null;

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

    // Custom modal listeners
    confirmModalYes.addEventListener('click', () => {
        if (productIdToRemove) {
            cart = cart.filter(item => item.id !== productIdToRemove);
            saveCart();
            updateCartDisplay();
            showToast('Item removed from cart.');
        }
        closeConfirmModal();
    });

    confirmModalNo.addEventListener('click', () => {
        closeConfirmModal();
    });
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
                quantity: 1,
                selected: true // Added for selection
            });
        }
    }
    saveCart();
    updateCartDisplay();
    showToast('Item added to cart!');
}

// --- Custom Modal Functions ---
function openConfirmModal(productId) {
    productIdToRemove = productId;
    confirmModal.style.display = 'flex';
}

function closeConfirmModal() {
    productIdToRemove = null;
    confirmModal.style.display = 'none';
}
// -----------------------------

// Remove from cart - now opens the custom modal
function removeFromCart(productId) {
    // Find the specific cart item by ID and variations
    const itemToRemove = cart.find(item => item.id === productId);
    if (itemToRemove) {
        // Remove the specific item (with its variations)
        cart = cart.filter(item => {
            if (item.id !== productId) return true;
            if (item.selectedColor !== itemToRemove.selectedColor) return true;
            if (item.selectedSize !== itemToRemove.selectedSize) return true;
            return false; // Remove this specific item
        });
        saveCart();
        updateCartDisplay();
        showToast('Item removed from cart.');
    }
}

// Update cart quantity
function updateCartQuantity(productId, change) {
    // Find the specific cart item by ID and variations
    const itemToUpdate = cart.find(item => item.id === productId);
    if (itemToUpdate) {
        const newQuantity = itemToUpdate.quantity + change;
        if (newQuantity <= 0) {
            // Remove item if quantity becomes 0
            removeFromCart(productId);
        } else {
            // Update quantity for the specific item (with its variations)
            cart = cart.map(item => {
                if (item.id === productId && 
                    item.selectedColor === itemToUpdate.selectedColor && 
                    item.selectedSize === itemToUpdate.selectedSize) {
                    return { ...item, quantity: newQuantity };
                }
                return item;
            });
            saveCart();
            updateCartDisplay();
        }
    }
}

// Toggle item selection
function toggleItemSelection(productId) {
    // Find the specific cart item by ID and variations
    const itemToToggle = cart.find(item => item.id === productId);
    if (itemToToggle) {
        // Toggle selection for the specific item (with its variations)
        cart = cart.map(item => {
            if (item.id === productId && 
                item.selectedColor === itemToToggle.selectedColor && 
                item.selectedSize === itemToToggle.selectedSize) {
                return { ...item, selected: !item.selected };
            }
            return item;
        });
        saveCart();
        updateCartDisplay();
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
        cartItems.innerHTML = cart.map(item => {
            // Generate variation display text
            let variationText = '';
            const variations = [];
            if (item.selectedColor) variations.push(`Color: ${item.selectedColor}`);
            if (item.selectedSize) variations.push(`Size: ${item.selectedSize}`);
            if (variations.length > 0) {
                variationText = `<div class="cart-item-variations">${variations.join(', ')}</div>`;
            }
            
            return `
                <div class="cart-item ${item.selected ? 'selected' : ''}">
                    <div class="cart-item-selection">
                        <input type="checkbox" class="item-selection-checkbox" onchange="toggleItemSelection('${item.id}')" ${item.selected ? 'checked' : ''}>
                    </div>
                    <div class="cart-item-image">
                        ${item.image
                            ? `<img src="${item.image}" alt="${item.name}">`
                            : '<div style="width: 100%; height: 100%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #999; font-size: 0.8rem;">No Image</div>'
                        }
                    </div>
                    <div class="cart-item-details">
                        <div class="cart-item-name">${item.name}</div>
                        ${variationText}
                        <div class="cart-item-price">৳${item.price}</div>
                        <div class="cart-item-quantity">
                            <button class="quantity-btn" onclick="updateCartQuantity('${item.id}', -1)">-</button>
                            <span>${item.quantity}</span>
                            <button class="quantity-btn" onclick="updateCartQuantity('${item.id}', 1)">+</button>
                            <button class="remove-cart-item" onclick="removeFromCart('${item.id}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Update total based on selected items
    const total = cart
        .filter(item => item.selected)
        .reduce((sum, item) => sum + (item.price * item.quantity), 0);
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
    const selectedItems = cart.filter(item => item.selected);
    if (selectedItems.length === 0) {
        showToast('Please select items to checkout!', true);
        return;
    }

    // Store only selected items for checkout
    localStorage.setItem('cartForCheckout', JSON.stringify(selectedItems));
    
    // Store the current URL to return to after checkout
    localStorage.setItem('checkoutSource', window.location.href);

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
window.toggleItemSelection = toggleItemSelection; // Expose new function
window.showToast = showToast; 