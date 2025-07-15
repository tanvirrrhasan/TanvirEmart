import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const productDetailsContent = document.getElementById('product-details-content');
const errorMessage = document.getElementById('error-message');
const backToShopBtn = document.getElementById('back-to-shop');
const addToCartBtnBottom = document.getElementById('add-to-cart-btn-bottom');
const buyNowBtnBottom = document.getElementById('buy-now-btn-bottom');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const navCartProductPage = document.getElementById('nav-cart-product-page'); // New: Get the small cart button

// Global variable to store current product data
let currentProduct = null;

// Initialize cart from localStorage
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Utility function to show toast notifications
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px; /* Above the bottom nav bar */
        left: 50%;
        transform: translateX(-50%);
        background: ${isError ? '#e53935' : '#43a047'};
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 9999;
        font-weight: 500;
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.opacity = 1;
    }, 10);

    // Animate out and remove
    setTimeout(() => {
        toast.style.opacity = 0;
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

// Function to show loading spinner
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

// Function to hide loading spinner
function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// Event Listeners setup function
function setupEventListeners() {
    if (backToShopBtn) {
        backToShopBtn.addEventListener('click', () => {
            history.back();
        });
    }

    if (addToCartBtnBottom) {
        addToCartBtnBottom.addEventListener('click', addToCart);
    }

    if (buyNowBtnBottom) {
        buyNowBtnBottom.addEventListener('click', buyNow);
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', handleSearch);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }

    if (navCartProductPage) {
        navCartProductPage.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            window.location.href = '../cart/index.html?hideBottomNav=true'; // Add parameter to hide bottom nav
        });
    }

    document.querySelectorAll('.mobile-nav .nav-link').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (mobileMenu && !mobileMenu.contains(e.target) && e.target !== mobileMenuBtn && e.target !== searchInput && !searchBtn.contains(e.target)) {
            if (mobileMenu.classList.contains('active')) {
                toggleMobileMenu();
            }
        }
    });
}

// Toggle mobile menu
function toggleMobileMenu() {
    if (mobileMenu) {
        const isActive = mobileMenu.classList.contains('active');
        mobileMenu.classList.toggle('active');
        const menuIcon = mobileMenuBtn.querySelector('i');

        if (mobileMenu.classList.contains('active')) {
            menuIcon.classList.remove('fa-bars');
            menuIcon.classList.add('fa-times');
        } else {
            menuIcon.classList.remove('fa-times');
            menuIcon.classList.add('fa-bars');
        }
    }
}

// Handle search from product detail page
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase();
    window.location.href = `/public/index.html?search=${encodeURIComponent(searchTerm)}`;
}

// Handle navigation from mobile menu on product detail page
function handleNavigation(e) {
    e.preventDefault();
    const targetHref = this.getAttribute('href');
    window.location.href = targetHref;

    if (mobileMenu && mobileMenu.classList.contains('active')) {
        toggleMobileMenu(); // Close mobile menu after navigation
    }
}

// Function to get product ID from URL query parameter
function getProductIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Function to fetch product details from Firestore
async function fetchProductDetails(productId) {
    showLoading();
    try {
        const productRef = doc(db, 'products', productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            currentProduct = { id: productSnap.id, ...productSnap.data() };
            renderProductDetails(currentProduct);
            errorMessage.style.display = 'none';
        } else {
            productDetailsContent.innerHTML = '';
            errorMessage.style.display = 'block';
            showToast('Product not found.', true);
        }
    } catch (error) {
        console.error('Error fetching product details:', error);
        productDetailsContent.innerHTML = '';
        errorMessage.style.display = 'block';
        errorMessage.textContent = `Error loading product: ${error.message}`;
        showToast('Error loading product details.', true);
    } finally {
        hideLoading();
    }
}

// Function to render product details on the page
function renderProductDetails(product) {
    if (!product) return;

    const variantsHtml = `
        ${product.colors && product.colors.length > 0 ? `
            <div class="variant-option-group">
                <h4>Colors:</h4>
                <div class="variant-options-list">
                    ${product.colors.map(color => `<span class="variant-option-item" data-variant-type="color" data-variant-value="${color}">${color}</span>`).join('')}
                </div>
            </div>
        ` : ''}
        ${product.sizes && product.sizes.length > 0 ? `
            <div class="variant-option-group">
                <h4>Sizes:</h4>
                <div class="variant-options-list">
                    ${product.sizes.map(size => `<span class="variant-option-item" data-variant-type="size" data-variant-value="${size}">${size}</span>`).join('')}
                </div>
            </div>
        ` : ''}
    `;

    const mainImageUrl = product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : 'https://via.placeholder.com/400x300?text=No+Image';
    const stockStatusClass = product.stock > 0 ? 'in-stock' : 'out-of-stock';
    const stockMessage = product.stock > 0 ? `In Stock (${product.stock})` : 'Out of Stock';

    productDetailsContent.innerHTML = `
        <div class="product-image-gallery">
            <div class="main-image-container">
                <img src="${mainImageUrl}" alt="${product.name}" class="main-image" id="main-product-image">
            </div>
            ${product.imageUrls && product.imageUrls.length > 1 ? `
                <div class="thumbnail-gallery" id="thumbnail-gallery">
                    ${product.imageUrls.map((url, index) => 
                        `<img src="${url}" alt="Thumbnail ${index + 1}" data-src="${url}" class="${index === 0 ? 'active' : ''}">
                    `).join('')}
                </div>
            ` : ''}
        </div>
        <div class="product-info-section">
            <h1>${product.name}</h1>
            <div class="product-price-display">
                ৳${product.price}
                ${product.regularPrice ? `<span class="product-regular-price-display">৳${product.regularPrice}</span>` : ''}
            </div>
            <p class="product-description-display">${product.description}</p>
            ${product.category ? `<div class="product-category-display"><strong>Category:</strong> ${product.category}</div>` : ''}
            <div class="product-variants-section">
                ${variantsHtml}
            </div>
            <div class="product-stock-status ${stockStatusClass}">${stockMessage}</div>
            ${(product.bulletDescriptions && Array.isArray(product.bulletDescriptions) && product.bulletDescriptions.length > 0) ? `
                <div class="product-bullets-section">
                    <strong>Features:</strong>
                    <ul>
                        ${product.bulletDescriptions.map(bullet => `<li>${bullet}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${product.warranty ? `<div class="product-warranty-display"><strong>Warranty:</strong> ${product.warranty}</div>` : ''}
        </div>
    `;

    // Setup thumbnail click functionality
    const mainImage = document.getElementById('main-product-image');
    document.querySelectorAll('#thumbnail-gallery img').forEach(thumbnail => {
        thumbnail.addEventListener('click', () => {
            mainImage.src = thumbnail.dataset.src;
            // Remove active class from all and add to clicked one
            document.querySelectorAll('#thumbnail-gallery img').forEach(img => img.classList.remove('active'));
            thumbnail.classList.add('active');
        });
    });

    // Setup variant selection (optional, if you want to track selection)
    document.querySelectorAll('.variant-option-item').forEach(item => {
        item.addEventListener('click', function() {
            const type = this.dataset.variantType;
            const value = this.dataset.variantValue;
            // Remove selected from other items of the same type
            document.querySelectorAll(`.variant-option-item[data-variant-type="${type}"]`).forEach(el => el.classList.remove('selected'));
            this.classList.add('selected');
            // You can store selected variants in currentProduct object or a separate state if needed
            console.log(`Selected ${type}: ${value}`);
        });
    });
}

// Add to Cart functionality
function addToCart() {
    if (!currentProduct) {
        showToast('Error: No product data.', true);
        return;
    }
    if (currentProduct.stock <= 0) {
        showToast('Product is out of stock.', true);
        return;
    }

    const existingItem = cart.find(item => item.id === currentProduct.id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: currentProduct.id,
            name: currentProduct.name,
            price: currentProduct.price,
            image: currentProduct.imageUrls && currentProduct.imageUrls.length > 0 ? currentProduct.imageUrls[0] : null,
            quantity: 1
        });
    }

    saveCart();
    showToast(`${currentProduct.name} added to cart!`);
}

// Buy Now functionality (placeholder)
function buyNow() {
    if (!currentProduct) {
        showToast('Error: No product data.', true);
        return;
    }
    if (currentProduct.stock <= 0) {
        showToast('Product is out of stock.', true);
        return;
    }
    showToast(`Buying ${currentProduct.name} now! (Checkout process would start here)`);
    // In a real app, this would redirect to a checkout page with this product pre-selected
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// On page load, fetch product details
document.addEventListener('DOMContentLoaded', () => {
    const productId = getProductIdFromUrl();
    if (productId) {
        fetchProductDetails(productId);
        setupEventListeners(); // Call setupEventListeners after DOM is loaded
    } else {
        hideLoading();
        productDetailsContent.innerHTML = '';
        errorMessage.style.display = 'block';
        errorMessage.textContent = 'No product ID provided.';
        showToast('No product ID provided.', true);
    }
}); 