import { db, storage } from './firebase-config.js';
import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { ref as storageRef, listAll, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

// Global variables
let products = [];
let categories = [];
// let cart = JSON.parse(localStorage.getItem('cart')) || []; // Moved to cart/app.js
let currentProduct = null;

// DOM elements
const productsGrid = document.getElementById('products-grid');
const categoriesGrid = document.getElementById('categories-grid');
// const cartSidebar = document.getElementById('cart-sidebar'); // Moved to cart/app.js
// const cartItems = document.getElementById('cart-items'); // Moved to cart/app.js
// const cartCount = document.getElementById('cart-count'); // Moved to cart/app.js
// const cartTotal = document.getElementById('cart-total'); // Moved to cart/app.js
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const categoryFilter = document.getElementById('category-filter');
const sortFilter = document.getElementById('sort-filter');
const loading = document.getElementById('loading');
const productModal = document.getElementById('product-modal');
const productDetails = document.getElementById('product-details');
const closeModal = document.getElementById('close-modal');
// const cartIcon = document.getElementById('cart-icon'); // Removed: Top bar cart icon no longer exists
// const closeCart = document.getElementById('close-cart'); // Moved to cart/app.js
// const checkoutBtn = document.getElementById('checkout-btn'); // Moved to cart/app.js
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const bannerContent = document.querySelector('.banner-content');
const bottomNavBar = document.getElementById('bottom-nav'); // New: Get bottom navigation bar

console.log('mobileMenuBtn:', mobileMenuBtn); // Debugging
console.log('mobileMenu:', mobileMenu); // Debugging

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    // updateCartDisplay(); // Moved to cart/app.js
    setupBottomNav();
    // loadBannerImages(); // Moved inside initializeApp for better timing
    // Check if on product detail page to hide main bottom nav
    if (window.location.pathname.includes('/product/')) {
        if (bottomNavBar) bottomNavBar.style.display = 'none';
    } else {
        if (bottomNavBar) bottomNavBar.style.display = 'flex'; // Ensure it's visible on other pages
        // Restore scroll position when returning to the main page
        const savedScrollY = localStorage.getItem('mainPageScrollY');
        if (savedScrollY) {
            window.scrollTo(0, parseInt(savedScrollY));
            localStorage.removeItem('mainPageScrollY'); // Clear it after use
        }
    }
    
    // Check for order success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('orderSuccess') === 'true') {
        const orderNumber = urlParams.get('orderNumber');
        showOrderSuccessModal(orderNumber);
    }
});

// Initialize app
async function initializeApp() {
    try {
        showLoading(); // Show loading when initializing app
        await Promise.all([
            loadProducts(),
            loadCategories(),
            loadBannerImages() // Ensure banner images are loaded before restoring scroll
        ]);
        renderProducts();
        renderCategories();
        populateFilters();

        // Restore scroll position after all content is rendered (This is for product detail page navigation)
        const savedScrollY = localStorage.getItem('productListPageScrollY');
        if (savedScrollY) {
            window.scrollTo(0, parseInt(savedScrollY));
            localStorage.removeItem('productListPageScrollY'); // Clear it after use
        }

    } catch (error) {
        console.error('Error initializing app:', error);
        showToast('Error loading data. Please refresh the page.', true);
    } finally {
        hideLoading(); // Hide loading after initializing app
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Filter functionality
    categoryFilter.addEventListener('change', filterProducts);
    sortFilter.addEventListener('change', filterProducts);

    // Cart functionality (removed - now handled by cart/app.js)
    // closeCart.addEventListener('click', toggleCart); 
    // checkoutBtn.addEventListener('click', handleCheckout);

    // Removed modal functionality as it's now a separate page

    // Mobile menu
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);

    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Load products from Firebase
async function loadProducts() {
    try {
        const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error loading products:', error);
        throw error;
    }
}

// Load categories from Firebase
async function loadCategories() {
    try {
        const q = query(collection(db, 'categories'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        categories = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error loading categories:', error);
        throw error;
    }
}

// Load banner images from Firebase Storage and show as carousel
async function loadBannerImages() {
    if (!bannerContent) return;
    bannerContent.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading banners...</p></div>';
    try {
        const bannerFolderRef = storageRef(storage, 'banners');
        const res = await listAll(bannerFolderRef);
        if (res.items.length === 0) {
            bannerContent.innerHTML = '<p style="color:#EFE9D5; text-align:center;">No banner images found.</p>';
            return;
        }
        const urls = await Promise.all(res.items.map(item => getDownloadURL(item)));
        renderBannerCarousel(urls);
    } catch (err) {
        bannerContent.innerHTML = '<p style="color:#EFE9D5; text-align:center;">Failed to load banners.</p>';
        console.error('Error loading banner images:', err);
    }
}

// Banner carousel logic
let bannerCarouselIndex = 0;
let bannerCarouselTimer = null;
function renderBannerCarousel(urls) {
    if (!urls || urls.length === 0) return;
    bannerContent.innerHTML = `
        <div class="banner-carousel">
            <img src="${urls[0]}" class="banner-carousel-img" alt="Banner">
            <div class="banner-carousel-dots">
                ${urls.map((_,i)=>`<button class="banner-carousel-dot${i===0?' active':''}" data-index="${i}"></button>`).join('')}
            </div>
        </div>
    `;
    bannerCarouselIndex = 0;
    setupBannerCarousel(urls);
}

function setupBannerCarousel(urls) {
    const carousel = bannerContent.querySelector('.banner-carousel');
    const img = carousel.querySelector('.banner-carousel-img');
    const dots = Array.from(carousel.querySelectorAll('.banner-carousel-dot'));

    function show(idx) {
        bannerCarouselIndex = (idx + urls.length) % urls.length;
        img.style.opacity = 0;
        setTimeout(() => {
            img.src = urls[bannerCarouselIndex];
            img.style.opacity = 1;
            dots.forEach((d,i)=>d.classList.toggle('active',i===bannerCarouselIndex));
        }, 200);
    }
    function next() { show(bannerCarouselIndex+1); }
    function prev() { show(bannerCarouselIndex-1); }
    function goto(i) { show(i); }

    dots.forEach((dot,i)=>dot.onclick=()=>goto(i));

    // Auto-play
    if (bannerCarouselTimer) clearInterval(bannerCarouselTimer);
    bannerCarouselTimer = setInterval(next, 4000);
    // Pause on hover
    carousel.onmouseenter = ()=>clearInterval(bannerCarouselTimer);
    carousel.onmouseleave = ()=>{ bannerCarouselTimer = setInterval(next, 4000); };

    // Touch/swipe for mobile
    let startX = null;
    img.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
    img.addEventListener('touchend', e => {
        if (startX === null) return;
        let dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) {
            if (dx > 0) prev(); else next();
        }
        startX = null;
    });

    // Mouse drag for desktop
    let isDragging = false;
    let dragStartX = null;
    let dragCurrentX = null;

    img.addEventListener('mousedown', e => {
        isDragging = true;
        dragStartX = e.clientX;
        dragCurrentX = e.clientX;
        img.style.cursor = 'grabbing';
        // Prevent default image drag
        e.preventDefault();
    });
    img.addEventListener('mousemove', e => {
        if (!isDragging) return;
        dragCurrentX = e.clientX;
    });
    img.addEventListener('mouseup', e => {
        if (!isDragging) return;
        let dx = dragCurrentX - dragStartX;
        if (Math.abs(dx) > 40) {
            if (dx > 0) prev(); else next();
        }
        isDragging = false;
        dragStartX = null;
        dragCurrentX = null;
        img.style.cursor = '';
    });
    img.addEventListener('mouseleave', e => {
        if (!isDragging) return;
        isDragging = false;
        dragStartX = null;
        dragCurrentX = null;
        img.style.cursor = '';
    });
}

// Render products
function renderProducts(productsToRender = products) {
    if (productsToRender.length === 0) {
        productsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <h3>No products found</h3>
                <p>Try adjusting your search or filter criteria.</p>
            </div>
        `;
        return;
    }

    productsGrid.innerHTML = productsToRender.map(product => `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image">
                ${product.thumbnailUrl
                    ? `<img src="${product.thumbnailUrl}" alt="${product.name}" loading="lazy">`
                    : (product.secondaryImageUrls && product.secondaryImageUrls.length > 0
                        ? `<img src="${product.secondaryImageUrls[0]}" alt="${product.name}" loading="lazy">`
                        : '<div style="height: 100%; display: flex; align-items: center; justify-content: center; background: #f0f0f0; color: #999;">No Image</div>'
                    )
                }
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">
                    ৳${product.price}
                    ${product.regularPrice ? `<span class="product-regular-price">৳${product.regularPrice}</span>` : ''}
                </div>
                <p class="product-category">${product.category}</p>
                <div class="product-actions">
                    <button class="add-to-cart-btn" onclick="addToCartFromMainPage('${product.id}')">
                        <i class="fas fa-shopping-cart"></i> Add to Cart
                    </button>
                    <button class="view-details-btn" onclick="viewProductDetails('${product.id}')">
                        View Details
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    // Add click event listener to each product card
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', (event) => {
            // Prevent click on cart button from triggering product details
            if (event.target.closest('.add-to-cart-btn')) {
                return;
            }
            const productId = card.dataset.productId;
            viewProductDetails(productId);
        });
    });
}

// Render categories
function renderCategories() {
    categoriesGrid.innerHTML = '';
    // Add "All" category card first
    const allCard = document.createElement('div');
    allCard.className = 'category-card';
    allCard.innerHTML = `
        <a href="#" onclick="filterByCategory(''); return false;">
            <img src="https://cdn-icons-png.flaticon.com/512/2910/2910791.png" alt="All">
            <span>All</span>
        </a>
    `;
    categoriesGrid.appendChild(allCard);

    categories.forEach(category => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.innerHTML = `
            <a href="#" onclick="filterByCategory('${category.name}'); return false;">
                <img src="${category.imageUrl || 'https://via.placeholder.com/100'}" alt="${category.name}">
                <span>${category.name}</span>
            </a>
        `;
        categoriesGrid.appendChild(categoryCard);
    });
}

// Populate filter dropdowns
function populateFilters() {
    if (categoryFilter) {
        categoryFilter.innerHTML = '<option value="">All Categories</option>' +
            categories.map(category => `<option value="${category.name}">${category.name}</option>`).join('');
    }
}

// Filter products based on selected category and sort order
function filterProducts() {
    let filtered = [...products];

    const selectedCategory = categoryFilter ? categoryFilter.value : '';
    const selectedSort = sortFilter ? sortFilter.value : 'newest';

    if (selectedCategory) {
        filtered = filtered.filter(product => {
            // Support both array and string for categories
            if (Array.isArray(product.categories)) {
                return product.categories.includes(selectedCategory);
            } else if (product.category) {
                return product.category === selectedCategory;
            }
            return false;
        });
    }

    switch (selectedSort) {
        case 'price-low':
            filtered.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            filtered.sort((a, b) => b.price - a.price);
            break;
        case 'name':
            filtered.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'newest':
        default:
            // Default sort by createdAt desc is already applied during loadProducts
            break;
    }

    renderProducts(filtered);
}

// Handle search
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase();
    const filtered = products.filter(product => {
        const categoriesArr = Array.isArray(product.categories) ? product.categories : [product.category];
        return (
            product.name.toLowerCase().includes(searchTerm) ||
            product.description.toLowerCase().includes(searchTerm) ||
            (categoriesArr && categoriesArr.some(cat => cat && cat.toLowerCase().includes(searchTerm)))
        );
    });
    renderProducts(filtered);
}

// Filter by category directly from category cards
function filterByCategory(categoryName) {
    if (categoryFilter) {
        categoryFilter.value = categoryName;
    }
    filterProducts();
}

// Add to cart function (now redirects to cart page)
function addToCartFromMainPage(productId) {
    // Retrieve existing cart from localStorage
    let cart = JSON.parse(localStorage.getItem('cart')) || [];

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        // Fetch product details from the `products` array available on main page
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
    localStorage.setItem('cart', JSON.stringify(cart));
    showToast('Item added to cart!');
    // No longer toggling cart sidebar, redirect to cart page
}


// Remove from cart (moved to cart/app.js)
// function removeFromCart(productId) {
//     cart = cart.filter(item => item.id !== productId);
//     saveCart();
//     updateCartDisplay();
//     showToast('Item removed from cart.');
// }

// Update cart quantity (moved to cart/app.js)
// function updateCartQuantity(productId, change) {
//     const item = cart.find(item => item.id === productId);
//     if (item) {
//         item.quantity += change;
//         if (item.quantity <= 0) {
//             removeFromCart(productId);
//         } else {
//             saveCart();
//             updateCartDisplay();
//         }
//     }
// }

// Save cart to localStorage (moved to cart/app.js)
// function saveCart() {
//     localStorage.setItem('cart', JSON.stringify(cart));
// }

// Update cart display (moved to cart/app.js)
// function updateCartDisplay() {
//     const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
//     cartCount.textContent = totalItems;

//     if (cart.length === 0) {
//         cartItems.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">Your cart is empty</p>';
//         cartTotal.textContent = '৳0';
//         return;
//     }

//     cartItems.innerHTML = cart.map(item => `
//         <div class="cart-item">
//             <div class="cart-item-image">
//                 ${item.image 
//                     ? `<img src="${item.image}" alt="${item.name}">`
//                     : '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f0f0f0; color: #999; font-size: 0.8rem;">No Image</div>'
//                 }
//             </div>
//             <div class="cart-item-details">
//                 <div class="cart-item-name">${item.name}</div>
//                 <div class="cart-item-price">৳${item.price}</div>
//                 <div class="cart-item-quantity">
//                     <button class="quantity-btn" onclick="updateCartQuantity('${item.id}', -1)">-</button>
//                     <span>${item.quantity}</span>
//                     <button class="quantity-btn" onclick="updateCartQuantity('${item.id}', 1)">+</button>
//                     <button class="remove-cart-item" onclick="removeFromCart('${item.id}')">Remove</button>
//                 </div>
//             </div>
//         </div>
//     `).join('');

//     const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
//     cartTotal.textContent = `৳${total.toFixed(2)}`;
// }

// Toggle cart sidebar (moved to cart/app.js)
// function toggleCart() {
//     cartSidebar.classList.toggle('active');
// }

// View product details (now redirects to new page)
function viewProductDetails(productId) {
    // Save current scroll position before navigating
    localStorage.setItem('productListPageScrollY', window.scrollY);
    localStorage.setItem('mainPageScrollY', window.scrollY); // Also save for main page
    window.location.href = `product/index.html?id=${productId}`;
}

// Handle checkout (moved to cart/app.js)
// function handleCheckout() {
//     if (cart.length === 0) {
//         showToast('Your cart is empty!', true);
//         return;
//     }
//     showToast('Checkout functionality coming soon!');
//     toggleCart();
// }

// Toggle mobile menu
function toggleMobileMenu() {
    if (mobileMenu) {
        const isActive = mobileMenu.classList.contains('active');
        mobileMenu.classList.toggle('active');
        const menuIcon = mobileMenuBtn.querySelector('i');
        
        console.log('toggleMobileMenu called. Menu is active before toggle:', isActive);
        console.log('mobileMenu.classList after toggle:', mobileMenu.classList.contains('active'));

        if (mobileMenu.classList.contains('active')) {
            // When opening, change to cross
            menuIcon.classList.remove('fa-bars');
            menuIcon.classList.add('fa-times');
            console.log('Icon changed to fa-times');
        } else {
            // When closing, change back to bars
            menuIcon.classList.remove('fa-times');
            menuIcon.classList.add('fa-bars');
            console.log('Icon changed to fa-bars');
        }
    }
}

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    // Check if the clicked element is not the mobile menu itself, and not the mobile menu button or its child icon
    if (mobileMenu && !mobileMenu.contains(e.target) && e.target !== mobileMenuBtn && !mobileMenuBtn.contains(e.target)) {
        if (mobileMenu.classList.contains('active')) {
            toggleMobileMenu(); // Use the existing toggle function to close it and revert icon
        }
    }
});

// Handle navigation for both desktop and mobile
function handleNavigation(e) {
    e.preventDefault();
    const targetId = this.getAttribute('href').substring(1); // Get the ID from href (e.g., #products -> products)
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
        // Smooth scroll to the target section
        // The scroll position will be correctly offset by the `scroll-padding-top` in CSS
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });

        // Close mobile menu after navigation on mobile
        if (mobileMenu && mobileMenu.classList.contains('active')) {
            toggleMobileMenu();
        }

        // Update active class for nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        this.classList.add('active');
    }
}

// Show toast notification
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
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

// Hide loading spinner
function hideLoading() {
    if (loading) {
        loading.style.display = 'none';
    }
}

// Show loading spinner
function showLoading() {
    if (loading) {
        loading.style.display = 'block';
    }
}

// Make functions globally available for onclick handlers
// window.addToCart = addToCart; // Changed to addToCartFromMainPage
window.addToCartFromMainPage = addToCartFromMainPage;
window.viewProductDetails = viewProductDetails;
// window.updateCartQuantity = updateCartQuantity; // Moved to cart/app.js
// window.removeFromCart = removeFromCart; // Moved to cart/app.js
window.filterByCategory = filterByCategory;

// Hide loading after initialization
// setTimeout(hideLoading, 1000); // Removed, handled by initializeApp

// Bottom Navigation Bar Logic
function setupBottomNav() {
    const navLinks = document.querySelectorAll('.bottom-nav-link');
    const cartCountSpan = document.getElementById('cart-count'); // This will now be null, so we'll handle it.

    // Update cart count on the nav bar
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    // The cart-count span is removed from the home page, so this is no longer needed here.
    // if (cartCountSpan) {
    //     cartCountSpan.textContent = totalItems;
    // }

    // Logic to set the active tab
    const setActiveTab = () => {
        const currentPath = window.location.pathname;
        navLinks.forEach(link => {
            link.classList.remove('active');
        });
        let found = false;
        for (const section of sections) {
            const el = document.querySelector(section.id);
            if (el && el.offsetTop - 80 <= scrollY) {
                const nav = document.querySelector(section.nav);
                if (nav) nav.classList.add('active');
                found = true;
            }
        }
        if (!found) {
            navLinks.forEach(l => l.classList.remove('active'));
        }
    };

    // Highlight nav based on scroll position (for Home, Category)
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        const sections = [
            { id: '#banner', nav: '#nav-home' }, // Changed #home to #banner
            { id: '#categories', nav: '#nav-category' },
            { id: '#products', nav: '#nav-home' },
        ];
        setActiveTab();
    });
}

// Show order success modal
function showOrderSuccessModal(orderNumber) {
    const modal = document.getElementById('order-success-modal');
    const orderNumberSpan = document.getElementById('success-order-number');
    
    if (modal && orderNumberSpan) {
        orderNumberSpan.textContent = orderNumber;
        modal.style.display = 'flex';
        
        // Close modal when clicking the button
        const closeBtn = modal.querySelector('.close-success-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                // Remove the URL parameters
                const url = new URL(window.location);
                url.searchParams.delete('orderSuccess');
                url.searchParams.delete('orderNumber');
                window.history.replaceState({}, '', url);
            });
        }
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                // Remove the URL parameters
                const url = new URL(window.location);
                url.searchParams.delete('orderSuccess');
                url.searchParams.delete('orderNumber');
                window.history.replaceState({}, '', url);
            }
        });
    }
} 