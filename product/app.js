import { db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, limit, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const productDetailsContent = document.getElementById('product-details-content');
const errorMessage = document.getElementById('error-message');
const backToShopBtn = document.getElementById('back-to-shop');
const addToCartBtnBottom = document.getElementById('add-to-cart-btn-bottom');
const buyNowBtnBottom = document.getElementById('buy-now-btn-bottom');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const clearSearchInput = document.getElementById('clear-search-input');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const mobileMenuOverlay = document.getElementById('mobile-menu-overlay'); // Added this line
const navCartProductPage = document.getElementById('nav-cart-product-page'); // New: Get the small cart button
const navChatProductPage = document.getElementById('nav-chat-product-page'); // New: Get the chat button

// Variation modal elements
const variationModal = document.getElementById('variation-modal');
const closeVariationModal = document.getElementById('close-variation-modal');
const variationOptions = document.getElementById('variation-options');
const addToCartConfirmBtn = document.getElementById('add-to-cart-confirm-btn');

// Global variables
let currentProduct = null;
let selectedVariants = {};
let modalSelectedVariants = {}; // Separate state for modal selections
let allProducts = []; // Store all products for search suggestions
let searchTimeout = null; // For debouncing search
let searchSuggestions = []; // Store search suggestions
let selectedSuggestionIndex = -1; // Track selected suggestion for keyboard navigation
let navigationHistory = [];
let isNavigatingBack = false; // Flag to prevent double navigation

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
    console.log('Setting up event listeners...');
    
    if (backToShopBtn) {
        console.log('Back to shop button found');
        backToShopBtn.addEventListener('click', () => {
            // Prevent double navigation
            if (isNavigatingBack) {
                return;
            }
            isNavigatingBack = true;
            
            // Check if we came from checkout and have a stored original referrer
            const originalReferrer = localStorage.getItem('originalReferrer');
            if (originalReferrer) {
                localStorage.removeItem('originalReferrer'); // Clear it after use
                window.location.href = originalReferrer;
            } else {
                // Simple and reliable back navigation
                try {
                    // Try to go back in history
                    if (window.history.length > 1) {
                        window.history.back();
                    } else {
                        // If no history, go to home
                        window.location.href = '../index.html';
                    }
                } catch (error) {
                    // Fallback to home page
                    window.location.href = '../index.html';
                }
            }
            
            // Reset flag after a short delay
            setTimeout(() => {
                isNavigatingBack = false;
            }, 1000);
        });
    }

    if (addToCartBtnBottom) {
        console.log('Add to cart button found');
        addToCartBtnBottom.addEventListener('click', addToCart);
    } else {
        console.error('Add to cart button not found');
    }

    if (buyNowBtnBottom) {
        console.log('Buy now button found');
        buyNowBtnBottom.addEventListener('click', buyNow);
    } else {
        console.error('Buy now button not found');
    }

    if (searchBtn) {
        console.log('Search button found');
        searchBtn.addEventListener('click', handleSearch);
    } else {
        console.error('Search button not found');
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedSuggestionIndex >= 0 && searchSuggestions.length > 0) {
                    // If a product suggestion is selected, go to product detail page
                    const selectedProduct = searchSuggestions[selectedSuggestionIndex];
                    if (selectedProduct && selectedProduct.id) {
                        selectProductSuggestion(selectedProduct.id);
                    } else {
                        // Fallback to normal search
                        handleSearch();
                    }
                } else {
                    // Otherwise perform normal search
                    handleSearch();
                }
            }
        });
        
        // Real-time search with debouncing
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim();
            
            // Show/hide clear button based on input
            if (clearSearchInput) {
                clearSearchInput.style.display = searchTerm ? 'flex' : 'none';
            }
            
            // Clear previous timeout
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            // Reset suggestion selection
            selectedSuggestionIndex = -1;
            
            // If search term is empty, hide suggestions
            if (searchTerm === '') {
                searchSuggestions = [];
                hideSearchSuggestions();
                return;
            }
            
            // Show search suggestions for short terms
            if (searchTerm.length >= 2) {
                showSearchSuggestions(searchTerm);
            } else {
                hideSearchSuggestions();
            }
        });
        
        // Keyboard navigation for suggestions
        searchInput.addEventListener('keydown', (e) => {
            const suggestionsContainer = document.querySelector('.search-suggestions');
            if (!suggestionsContainer || suggestionsContainer.style.display === 'none') {
                return;
            }
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    navigateSuggestions(1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    navigateSuggestions(-1);
                    break;
                case 'Escape':
                    hideSearchSuggestions();
                    selectedSuggestionIndex = -1;
                    break;
            }
        });
    }

    if (clearSearchInput) {
        console.log('Clear search input button found');
        clearSearchInput.addEventListener('click', () => {
            searchInput.value = '';
            searchSuggestions = [];
            hideSearchSuggestions();
            selectedSuggestionIndex = -1;
        });
    } else {
        console.error('Clear search input button not found');
    }

    if (mobileMenuBtn) {
        console.log('Mobile menu button found');
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    } else {
        console.error('Mobile menu button not found');
    }

    // Close mobile menu when clicking on overlay
    if (mobileMenuOverlay) {
        console.log('Mobile menu overlay found');
        mobileMenuOverlay.addEventListener('click', () => {
            if (mobileMenu && mobileMenu.classList.contains('active')) {
                toggleMobileMenu();
            }
        });
    } else {
        console.error('Mobile menu overlay not found');
    }

    if (navCartProductPage) {
        console.log('Nav cart product page button found');
        navCartProductPage.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            console.log('Navigating to cart page');
            window.location.href = '../cart/index.html?hideBottomNav=true'; // Add parameter to hide bottom nav
        });
    } else {
        console.error('Nav cart product page button not found');
    }

    if (navChatProductPage) {
        console.log('Nav chat product page button found');
        navChatProductPage.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            console.log('Navigating to message page with product info');
            if (currentProduct) {
                // Store product info in localStorage for the message page
                const productInfo = {
                    id: currentProduct.id,
                    name: currentProduct.name,
                    price: currentProduct.price,
                    image: currentProduct.thumbnailUrl || (currentProduct.imageUrls && currentProduct.imageUrls[0]) || '',
                    description: currentProduct.description
                };
                localStorage.setItem('chatProductInfo', JSON.stringify(productInfo));
                window.location.href = '../message/';
            } else {
                window.location.href = '../message/';
            }
        });
    } else {
        console.error('Nav chat product page button not found');
    }

    // Variation modal event listeners
    if (closeVariationModal) {
        console.log('Close variation modal button found');
        closeVariationModal.addEventListener('click', closeVariationModalFunc);
    } else {
        console.error('Close variation modal button not found');
    }

    if (addToCartConfirmBtn) {
        console.log('Add to cart confirm button found');
        addToCartConfirmBtn.addEventListener('click', () => {
            // Check if this is for buy now or add to cart based on button text
            const buttonText = addToCartConfirmBtn.textContent || addToCartConfirmBtn.innerHTML;
            if (buttonText.includes('Buy Now')) {
                confirmBuyNow();
            } else {
                confirmAddToCart();
            }
        });
    } else {
        console.error('Add to cart confirm button not found');
    }

    // Close modal when clicking outside
    if (variationModal) {
        console.log('Variation modal found');
        variationModal.addEventListener('click', (e) => {
            if (e.target === variationModal) {
                closeVariationModalFunc();
            }
        });
    } else {
        console.error('Variation modal not found');
    }

    // Set up mobile navigation event listeners
    setupMobileNavigationListeners();
    
    // Handle clicks outside search suggestions
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box') && !e.target.closest('.search-suggestions')) {
            hideSearchSuggestions();
            selectedSuggestionIndex = -1;
        }
    });
}

// Toggle mobile menu
function toggleMobileMenu() {
    if (mobileMenu) {
        const isActive = mobileMenu.classList.contains('active');
        mobileMenu.classList.toggle('active');

        // Toggle overlay
        if (mobileMenuOverlay) {
            mobileMenuOverlay.classList.toggle('active');
        }

        const menuIcon = mobileMenuBtn.querySelector('i');

        if (mobileMenu.classList.contains('active')) {
            menuIcon.classList.remove('fa-bars');
            menuIcon.classList.add('fa-times');
            // Set up navigation listeners when menu opens
            setTimeout(() => {
                setupMobileNavigationListeners();
            }, 100);
        } else {
            menuIcon.classList.remove('fa-times');
            menuIcon.classList.add('fa-bars');
        }
    }
}

// Handle search from product detail page
function handleSearch() {
    console.log('handleSearch function called');
    const searchTerm = searchInput.value.trim();
    if (searchTerm === '') {
        showToast('Please enter a search term', true);
        return;
    }
    console.log('Redirecting to search with term:', searchTerm);
    // Redirect to main page with search parameter
    window.location.href = `../index.html?search=${encodeURIComponent(searchTerm)}`;
}

// Set up mobile navigation event listeners
function setupMobileNavigationListeners() {
    const mobileNavLinks = document.querySelectorAll('.mobile-nav .nav-link');
    console.log('Mobile nav links found:', mobileNavLinks.length);
    mobileNavLinks.forEach((link, index) => {
        console.log(`Setting up event listener for link ${index}:`, link.textContent, link.href);
        // Remove any existing event listeners to prevent duplicates
        link.removeEventListener('click', handleNavigation);
        link.addEventListener('click', handleNavigation);
    });
}

// Handle navigation from mobile menu on product detail page
function handleNavigation(e) {
    console.log('handleNavigation function called');
    e.preventDefault();
    const targetHref = this.getAttribute('href');
    console.log('Target href:', targetHref);
    console.log('Current location:', window.location.href);
    
    // Navigate to the target URL
    window.location.href = targetHref;

    if (mobileMenu && mobileMenu.classList.contains('active')) {
        console.log('Closing mobile menu after navigation');
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
            console.log("Fetched product data:", currentProduct);
            
            // Log category information for debugging
            if (currentProduct.categories) {
                console.log("Product categories array:", currentProduct.categories);
            }
            if (currentProduct.category) {
                console.log("Product category field:", currentProduct.category);
            }
            
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

    // Compose image gallery: thumbnail + secondaryImageUrls (no duplicate), fallback to imageUrls if missing
    let galleryImages = [];
    if (product.thumbnailUrl) galleryImages.push(product.thumbnailUrl);
    if (product.secondaryImageUrls && Array.isArray(product.secondaryImageUrls)) {
        product.secondaryImageUrls.forEach(url => {
            if (url && url !== product.thumbnailUrl) galleryImages.push(url);
        });
    }
    // Fallback to old imageUrls if no new images
    if (galleryImages.length === 0 && product.imageUrls && product.imageUrls.length > 0) {
        galleryImages = product.imageUrls;
    }
    if (galleryImages.length === 0) {
        galleryImages = ['https://via.placeholder.com/400x400?text=No+Image']; // Changed to 400x400 for square placeholder
    }
    const mainImageUrl = galleryImages[0];

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
    const stockStatusClass = product.stock > 0 ? 'in-stock' : 'out-of-stock';
    const stockMessage = product.stock > 0 ? `In Stock (${product.stock})` : 'Out of Stock';

    productDetailsContent.innerHTML = `
        <div class="product-main-card">
            <div class="product-image-gallery">
                <div class="main-image-container main-image-square">
                    <img src="${mainImageUrl}" alt="${product.name}" class="main-image" id="main-product-image">
                </div>
                ${galleryImages.length > 1 ? `
                    <div class="thumbnail-gallery-container">
                        <div class="thumbnail-gallery" id="thumbnail-gallery">
                            ${galleryImages.map((url, index) => 
                                `<img src="${url}" alt="Thumbnail ${index + 1}" data-src="${url}" class="${index === 0 ? 'active' : ''}">`
                            ).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="product-info-section">
                <h1>${product.name}</h1>
                <div class="product-price-display">
                    ৳${product.price}
                    ${product.regularPrice ? `<span class="product-regular-price-display">৳${product.regularPrice}</span>` : ''}
                </div>
                <div class="product-variants-section">
                    ${variantsHtml}
                </div>
                <div class="product-stock-status ${stockStatusClass}">${stockMessage}</div>
            </div>
        </div>
        
        <div class="product-details-card">
            <div class="product-details-content-inner">
                ${(product.bulletDescriptions && Array.isArray(product.bulletDescriptions) && product.bulletDescriptions.length > 0) ? `
                    <div class="product-info-section">
                        <h3>Features</h3>
                        <div class="product-bullets-section">
                            <ul>
                                ${product.bulletDescriptions.map(bullet => `<li>${bullet}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                ` : ''}
                
                <div class="product-description-section">
                    <h2>Product Description</h2>
                    <p class="product-description-display">${product.description}</p>
                </div>
                
                ${product.category || (product.categories && product.categories.length > 0) ? `
                    <div class="product-info-section">
                        <h3>Category</h3>
                        <div class="product-category-display">
                            ${(() => {
                                // Handle both single category and multiple categories
                                if (product.categories && Array.isArray(product.categories) && product.categories.length > 0) {
                                    if (product.categories.length > 1) {
                                        return `<div class="product-category-tags">
                                            ${product.categories.map(category => `<span class="category-tag">${category}</span>`).join('')}
                                        </div>`;
                                    } else {
                                        return product.categories[0];
                                    }
                                } else if (product.category) {
                                    return product.category;
                                }
                                return '';
                            })()}
                        </div>
                    </div>
                ` : ''}
                
                ${product.warranty ? `
                    <div class="product-info-section">
                        <h3>Warranty</h3>
                        <div class="product-warranty-display">${product.warranty}</div>
                    </div>
                ` : ''}
            </div>
        </div>
        
        <!-- Related Products Section -->
        <div class="related-products-section" id="related-products-section">
            <h2>Related Products</h2>
            <div class="products-grid" id="related-products-grid">
                <div class="loading-spinner">
                    <div class="spinner-small"></div>
                </div>
            </div>
        </div>
        
        <!-- You May Like Section -->
        <div class="you-may-like-section" id="you-may-like-section">
            <h2>You May Like</h2>
            <div class="products-grid" id="you-may-like-grid">
                <div class="loading-spinner">
                    <div class="spinner-small"></div>
                </div>
            </div>
        </div>
    `;

    // After rendering the main product details, fetch related products
    fetchRelatedProducts(product);
    
    // Fetch random products for "You May Like" section
    fetchRandomProducts();

    // Setup thumbnail click functionality
    const mainImage = document.getElementById('main-product-image');
    const thumbnailGallery = document.getElementById('thumbnail-gallery');
    
    // Simple drag scroll for the thumbnail gallery
    if (thumbnailGallery) {
        let isDragging = false;
        let startX, scrollLeftStart;
        let clickStartTime = 0;
        let movedDistance = 0;
        let slideshowInterval = null;
        let currentSlideIndex = 0;
        let allThumbnails = [];
        
        // Helper function to select a thumbnail
        const selectThumbnail = (thumbnail, updateIndex = true) => {
            if (!thumbnail || !thumbnail.dataset || !thumbnail.dataset.src) return;
            
            mainImage.src = thumbnail.dataset.src;
            document.querySelectorAll('#thumbnail-gallery img').forEach((img, index) => {
                img.classList.remove('active');
                if (updateIndex && img === thumbnail) {
                    currentSlideIndex = index;
                }
            });
            thumbnail.classList.add('active');
            
            // Scroll the thumbnail into view
            const thumbnailWidth = thumbnail.offsetWidth;
            const galleryWidth = thumbnailGallery.offsetWidth;
            const scrollPosition = thumbnail.offsetLeft - (galleryWidth / 2) + (thumbnailWidth / 2);
            
            thumbnailGallery.scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });
        };
        
        // Function to start the slideshow
        const startSlideshow = () => {
            // Get all thumbnails
            allThumbnails = Array.from(document.querySelectorAll('#thumbnail-gallery img'));
            if (allThumbnails.length <= 1) return; // Don't start slideshow if only one image
            
            // Clear any existing interval
            if (slideshowInterval) {
                clearInterval(slideshowInterval);
            }
            
            // Add slideshow active class to show indicator
            document.querySelector('.product-image-gallery').classList.add('slideshow-active');
            
            // Set interval to change image every 3 seconds
            slideshowInterval = setInterval(() => {
                currentSlideIndex = (currentSlideIndex + 1) % allThumbnails.length;
                selectThumbnail(allThumbnails[currentSlideIndex], false);
            }, 3000); // Change every 3 seconds
        };
        
        // Function to stop the slideshow
        const stopSlideshow = () => {
            if (slideshowInterval) {
                clearInterval(slideshowInterval);
                slideshowInterval = null;
                
                // Remove slideshow active class to hide indicator
                document.querySelector('.product-image-gallery').classList.remove('slideshow-active');
            }
        };
        
        // Start slideshow when page loads
        startSlideshow();
        
        // Check if gallery has overflow and add class for visual indicator
        const checkForOverflow = () => {
            if (thumbnailGallery.scrollWidth > thumbnailGallery.clientWidth) {
                thumbnailGallery.classList.add('has-overflow');
            } else {
                thumbnailGallery.classList.remove('has-overflow');
            }
        };

        // Check scroll position and update classes accordingly
        const checkScrollPosition = () => {
            if (thumbnailGallery.scrollLeft > 10) {
                thumbnailGallery.classList.add('scrolled-right');
            } else {
                thumbnailGallery.classList.remove('scrolled-right');
            }
        };
        
        // Run on load and on window resize
        checkForOverflow();
        checkScrollPosition();
        window.addEventListener('resize', () => {
            checkForOverflow();
            checkScrollPosition();
        });
        
        // Track scroll position
        thumbnailGallery.addEventListener('scroll', checkScrollPosition);
        
        // Pause slideshow when user interacts with gallery
        const pauseSlideshow = () => {
            stopSlideshow();
            // Restart slideshow after 10 seconds of inactivity
            setTimeout(startSlideshow, 10000);
        };
        
        // For mouse events (desktop)
        thumbnailGallery.addEventListener('mousedown', function(e) {
            pauseSlideshow();
            isDragging = true;
            clickStartTime = Date.now();
            movedDistance = 0;
            startX = e.pageX - thumbnailGallery.offsetLeft;
            scrollLeftStart = thumbnailGallery.scrollLeft;
            thumbnailGallery.style.cursor = 'grabbing';
        });
        
        thumbnailGallery.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.pageX - thumbnailGallery.offsetLeft;
            const walk = (x - startX) * 1.5; // Scroll speed multiplier
            movedDistance += Math.abs(walk - movedDistance);
            thumbnailGallery.scrollLeft = scrollLeftStart - walk;
        });
        
        thumbnailGallery.addEventListener('mouseup', function(e) {
            // If this was a click on a thumbnail (short duration, minimal movement)
            const clickDuration = Date.now() - clickStartTime;
            
            // Only handle as click if it was short and didn't move much
            if (clickDuration < 200 && movedDistance < 10 && e.target.tagName === 'IMG') {
                pauseSlideshow();
                selectThumbnail(e.target);
            }
            
            isDragging = false;
            thumbnailGallery.style.cursor = 'grab';
        });
        
        thumbnailGallery.addEventListener('mouseleave', function() {
            isDragging = false;
            thumbnailGallery.style.cursor = 'grab';
        });
        
        // For touch events (mobile)
        thumbnailGallery.addEventListener('touchstart', function(e) {
            pauseSlideshow();
            isDragging = true;
            clickStartTime = Date.now();
            movedDistance = 0;
            startX = e.touches[0].pageX - thumbnailGallery.offsetLeft;
            scrollLeftStart = thumbnailGallery.scrollLeft;
        }, {passive: false});
        
        thumbnailGallery.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            const x = e.touches[0].pageX - thumbnailGallery.offsetLeft;
            const walk = (x - startX) * 1.5;
            movedDistance += Math.abs(walk - movedDistance);
            thumbnailGallery.scrollLeft = scrollLeftStart - walk;
            
            // If we've moved significantly, prevent default to avoid page scrolling
            if (movedDistance > 10) {
                e.preventDefault();
            }
        }, {passive: false});
        
        thumbnailGallery.addEventListener('touchend', function(e) {
            // If this was a tap on a thumbnail (short duration, minimal movement)
            const clickDuration = Date.now() - clickStartTime;
            
            // Find the element that was touched
            if (clickDuration < 300 && movedDistance < 15) {
                const touch = e.changedTouches[0];
                const elementAtTouch = document.elementFromPoint(touch.clientX, touch.clientY);
                
                if (elementAtTouch && elementAtTouch.tagName === 'IMG' && elementAtTouch.parentNode === thumbnailGallery) {
                    pauseSlideshow();
                    selectThumbnail(elementAtTouch);
                }
            }
            
            isDragging = false;
        });
        
        // Pause slideshow when user hovers over main image
        mainImage.addEventListener('mouseenter', pauseSlideshow);
        
        // Restart slideshow when user leaves the product section
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                startSlideshow();
            } else {
                stopSlideshow();
            }
        });
    }

    // Setup variant selection (optional, if you want to track selection)
    document.querySelectorAll('.variant-option-item').forEach(item => {
        item.addEventListener('click', function() {
            const type = this.dataset.variantType;
            const value = this.dataset.variantValue;
            // Remove selected from other items of the same type
            document.querySelectorAll(`.variant-option-item[data-variant-type="${type}"]`).forEach(el => el.classList.remove('selected'));
            this.classList.add('selected');
            selectedVariants[type] = value;
            // You can store selected variants in currentProduct object or a separate state if needed
            console.log(`Selected ${type}: ${value}`);
        });
    });
}

// Add to Cart functionality
function addToCart() {
    console.log('addToCart function called');
    if (!currentProduct) {
        console.error('No current product data');
        showToast('Error: No product data.', true);
        return;
    }
    if (currentProduct.stock <= 0) {
        showToast('Product is out of stock.', true);
        return;
    }

    // Check if product has variations that need to be selected
    const hasColors = currentProduct.colors && currentProduct.colors.length > 0;
    const hasSizes = currentProduct.sizes && currentProduct.sizes.length > 0;
    
    if (hasColors || hasSizes) {
        // Check if all required variations are already selected
        const colorSelected = !hasColors || selectedVariants.color;
        const sizeSelected = !hasSizes || selectedVariants.size;
        
        if (colorSelected && sizeSelected) {
            // All variations are already selected, add directly to cart
            addProductToCart(selectedVariants);
        } else {
            // Show variation selection modal
            showVariationModal();
        }
    } else {
        // No variations, add directly to cart
        addProductToCart();
    }
}

// Show variation selection modal
function showVariationModal() {
    if (!variationModal || !variationOptions) return;
    
    // Initialize modal selections with already selected variations
    modalSelectedVariants = { ...selectedVariants };
    
    // Generate variation options HTML
    let variationOptionsHtml = '';
    let hasRequiredVariations = false;
    
    if (currentProduct.colors && currentProduct.colors.length > 0) {
        hasRequiredVariations = true;
        variationOptionsHtml += `
            <div class="modal-variation-option-group">
                <h4 class="required">Colors</h4>
                <div class="modal-variation-options-list">
                    ${currentProduct.colors.map(color => 
                        `<span class="modal-variant-option-item ${modalSelectedVariants.color === color ? 'selected' : ''}" data-variant-type="color" data-variant-value="${color}">${color}</span>`
                    ).join('')}
                </div>
            </div>
        `;
    }
    
    if (currentProduct.sizes && currentProduct.sizes.length > 0) {
        hasRequiredVariations = true;
        variationOptionsHtml += `
            <div class="modal-variation-option-group">
                <h4 class="required">Sizes</h4>
                <div class="modal-variation-options-list">
                    ${currentProduct.sizes.map(size => 
                        `<span class="modal-variant-option-item ${modalSelectedVariants.size === size ? 'selected' : ''}" data-variant-type="size" data-variant-value="${size}">${size}</span>`
                    ).join('')}
                </div>
            </div>
        `;
    }
    
    variationOptions.innerHTML = variationOptionsHtml;
    
    // Add click event listeners to variation options
    variationOptions.querySelectorAll('.modal-variant-option-item').forEach(item => {
        item.addEventListener('click', function() {
            const type = this.dataset.variantType;
            const value = this.dataset.variantValue;
            
            // Remove selected from other items of the same type
            variationOptions.querySelectorAll(`.modal-variant-option-item[data-variant-type="${type}"]`).forEach(el => {
                el.classList.remove('selected');
            });
            
            // Select this item
            this.classList.add('selected');
            modalSelectedVariants[type] = value;
            
            // Update confirm button state
            updateConfirmButtonState();
        });
    });
    
    // Show modal
    variationModal.classList.add('active');
    
    // Reset button text to Add to Cart
    if (addToCartConfirmBtn) {
        addToCartConfirmBtn.innerHTML = '<i class="fas fa-cart-plus"></i> Add to Cart';
    }
    
    // Update confirm button state
    updateConfirmButtonState();
}

// Close variation modal
function closeVariationModalFunc() {
    if (variationModal) {
        variationModal.classList.remove('active');
        // Update selectedVariants with modal selections when closing
        selectedVariants = { ...modalSelectedVariants };
        // Don't reset modalSelectedVariants here to avoid data loss
    }
}

// Update confirm button state based on required variations
function updateConfirmButtonState() {
    if (!addToCartConfirmBtn) return;
    
    const hasColors = currentProduct.colors && currentProduct.colors.length > 0;
    const hasSizes = currentProduct.sizes && currentProduct.sizes.length > 0;
    
    const colorSelected = !hasColors || modalSelectedVariants.color;
    const sizeSelected = !hasSizes || modalSelectedVariants.size;
    
    // Check if this is for buy now or add to cart based on button text
    const buttonText = addToCartConfirmBtn.textContent || addToCartConfirmBtn.innerHTML;
    const isBuyNow = buttonText.includes('Buy Now');
    
    if (colorSelected && sizeSelected) {
        addToCartConfirmBtn.disabled = false;
        if (isBuyNow) {
            addToCartConfirmBtn.innerHTML = '<i class="fas fa-money-bill-wave"></i> Buy Now';
        } else {
            addToCartConfirmBtn.innerHTML = '<i class="fas fa-cart-plus"></i> Add to Cart';
        }
    } else {
        addToCartConfirmBtn.disabled = true;
        addToCartConfirmBtn.textContent = 'Please select all variations';
    }
}

// Confirm add to cart from modal
function confirmAddToCart() {
    if (!currentProduct) {
        showToast('Error: No product data.', true);
        return;
    }
    
    // Check if all required variations are selected
    const hasColors = currentProduct.colors && currentProduct.colors.length > 0;
    const hasSizes = currentProduct.sizes && currentProduct.sizes.length > 0;
    
    const colorSelected = !hasColors || modalSelectedVariants.color;
    const sizeSelected = !hasSizes || modalSelectedVariants.size;
    
    if (!colorSelected || !sizeSelected) {
        showToast('Please select all required variations.', true);
        return;
    }
    
    // Store the selected variations before closing modal
    const selectedVariations = { ...modalSelectedVariants };
    
    // Update the selectedVariants with modal selections
    selectedVariants = { ...modalSelectedVariants };
    
    // Close modal
    closeVariationModalFunc();
    
    // Add to cart with selected variations
    addProductToCart(selectedVariations);
}

// Add product to cart (with or without variations)
function addProductToCart(selectedVariations = {}) {
    if (!currentProduct) {
        showToast('Error: No product data.', true);
        return;
    }
    
    console.log('Adding product to cart with variations:', selectedVariations);
    
    // Create cart item with variation information
    const cartItem = {
        id: currentProduct.id,
        name: currentProduct.name,
        price: currentProduct.price,
        image: currentProduct.imageUrls && currentProduct.imageUrls.length > 0 ? currentProduct.imageUrls[0] : null,
        quantity: 1,
        selectedColor: selectedVariations.color || null,
        selectedSize: selectedVariations.size || null
    };
    
    console.log('Cart item created:', cartItem);
    
    // Check if item already exists in cart
    const existingItemIndex = cart.findIndex(item => {
        // Match by ID and variations
        if (item.id !== cartItem.id) return false;
        if (item.selectedColor !== cartItem.selectedColor) return false;
        if (item.selectedSize !== cartItem.selectedSize) return false;
        return true;
    });
    
    if (existingItemIndex !== -1) {
        // Update existing item quantity
        cart[existingItemIndex].quantity += 1;
        console.log('Updated existing cart item quantity');
    } else {
        // Add new item
        cart.push(cartItem);
        console.log('Added new cart item');
    }
    
    saveCart();
    
    // Show success message with variation info
    let message = `${currentProduct.name} added to cart!`;
    const variations = [];
    if (selectedVariations.color) variations.push(`Color: ${selectedVariations.color}`);
    if (selectedVariations.size) variations.push(`Size: ${selectedVariations.size}`);
    if (variations.length > 0) {
        message += ` (${variations.join(', ')})`;
    }
    
    showToast(message);
}

// Buy Now functionality (placeholder)
function buyNow() {
    console.log('buyNow function called');
    if (!currentProduct) {
        console.error('No current product data');
        showToast('Error: No product data.', true);
        return;
    }
    if (currentProduct.stock <= 0) {
        showToast('Product is out of stock.', true);
        return;
    }
    
    // Check for required variants
    const hasColors = currentProduct.colors && currentProduct.colors.length > 0;
    const hasSizes = currentProduct.sizes && currentProduct.sizes.length > 0;
    
    if (hasColors || hasSizes) {
        // Check if all required variations are already selected
        const colorSelected = !hasColors || selectedVariants.color;
        const sizeSelected = !hasSizes || selectedVariants.size;
        
        if (colorSelected && sizeSelected) {
            // All variations are already selected, proceed directly to checkout
            proceedToCheckout(selectedVariants);
        } else {
            // Show variation selection modal for buy now
            showVariationModalForBuyNow();
        }
    } else {
        // No variations, proceed directly to checkout
        proceedToCheckout();
    }
}

// Show variation modal for buy now
function showVariationModalForBuyNow() {
    if (!variationModal || !variationOptions) return;
    
    // Initialize modal selections with already selected variations
    modalSelectedVariants = { ...selectedVariants };
    
    // Generate variation options HTML
    let variationOptionsHtml = '';
    
    if (currentProduct.colors && currentProduct.colors.length > 0) {
        variationOptionsHtml += `
            <div class="modal-variation-option-group">
                <h4 class="required">Colors</h4>
                <div class="modal-variation-options-list">
                    ${currentProduct.colors.map(color => 
                        `<span class="modal-variant-option-item ${modalSelectedVariants.color === color ? 'selected' : ''}" data-variant-type="color" data-variant-value="${color}">${color}</span>`
                    ).join('')}
                </div>
            </div>
        `;
    }
    
    if (currentProduct.sizes && currentProduct.sizes.length > 0) {
        variationOptionsHtml += `
            <div class="modal-variation-option-group">
                <h4 class="required">Sizes</h4>
                <div class="modal-variation-options-list">
                    ${currentProduct.sizes.map(size => 
                        `<span class="modal-variant-option-item ${modalSelectedVariants.size === size ? 'selected' : ''}" data-variant-type="size" data-variant-value="${size}">${size}</span>`
                    ).join('')}
                </div>
            </div>
        `;
    }
    
    variationOptions.innerHTML = variationOptionsHtml;
    
    // Add click event listeners to variation options
    variationOptions.querySelectorAll('.modal-variant-option-item').forEach(item => {
        item.addEventListener('click', function() {
            const type = this.dataset.variantType;
            const value = this.dataset.variantValue;
            
            // Remove selected from other items of the same type
            variationOptions.querySelectorAll(`.modal-variant-option-item[data-variant-type="${type}"]`).forEach(el => {
                el.classList.remove('selected');
            });
            
            // Select this item
            this.classList.add('selected');
            modalSelectedVariants[type] = value;
            
            // Update confirm button state
            updateConfirmButtonStateForBuyNow();
        });
    });
    
    // Update button text for buy now
    if (addToCartConfirmBtn) {
        addToCartConfirmBtn.innerHTML = '<i class="fas fa-money-bill-wave"></i> Buy Now';
    }
    
    // Show modal
    variationModal.classList.add('active');
    
    // Update confirm button state
    updateConfirmButtonStateForBuyNow();
}

// Update confirm button state for buy now
function updateConfirmButtonStateForBuyNow() {
    if (!addToCartConfirmBtn) return;
    
    const hasColors = currentProduct.colors && currentProduct.colors.length > 0;
    const hasSizes = currentProduct.sizes && currentProduct.sizes.length > 0;
    
    const colorSelected = !hasColors || modalSelectedVariants.color;
    const sizeSelected = !hasSizes || modalSelectedVariants.size;
    
    if (colorSelected && sizeSelected) {
        addToCartConfirmBtn.disabled = false;
        addToCartConfirmBtn.innerHTML = '<i class="fas fa-money-bill-wave"></i> Buy Now';
    } else {
        addToCartConfirmBtn.disabled = true;
        addToCartConfirmBtn.innerHTML = 'Please select all variations';
    }
}

// Confirm buy now from modal
function confirmBuyNow() {
    if (!currentProduct) {
        showToast('Error: No product data.', true);
        return;
    }
    
    // Check if all required variations are selected
    const hasColors = currentProduct.colors && currentProduct.colors.length > 0;
    const hasSizes = currentProduct.sizes && currentProduct.sizes.length > 0;
    
    const colorSelected = !hasColors || modalSelectedVariants.color;
    const sizeSelected = !hasSizes || modalSelectedVariants.size;
    
    if (!colorSelected || !sizeSelected) {
        showToast('Please select all required variations.', true);
        return;
    }
    
    // Store the selected variations before closing modal
    const selectedVariations = { ...modalSelectedVariants };
    
    // Update the selectedVariants with modal selections
    selectedVariants = { ...modalSelectedVariants };
    
    // Close modal
    closeVariationModalFunc();
    
    // Proceed to checkout with selected variations
    proceedToCheckout(selectedVariations);
}

// Proceed to checkout (with or without variations)
function proceedToCheckout(selectedVariations = {}) {
    console.log('Proceeding to checkout with variations:', selectedVariations);
    
    // Create a temporary cart with just this product
    const buyNowCart = [{
        id: currentProduct.id,
        name: currentProduct.name,
        price: currentProduct.price,
        image: currentProduct.imageUrls && currentProduct.imageUrls.length > 0 ? currentProduct.imageUrls[0] : null,
        quantity: 1,
        selectedColor: selectedVariations.color || null,
        selectedSize: selectedVariations.size || null
    }];
    
    console.log('Buy now cart created:', buyNowCart);
    
    // Store this temporary cart in localStorage for checkout
    localStorage.setItem('cartForCheckout', JSON.stringify(buyNowCart));
    
    // Store the current URL to return to after checkout
    localStorage.setItem('checkoutSource', window.location.href);
    
    // Store the original referrer (where we came to this product page from)
    // This helps break navigation loops
    localStorage.setItem('productOriginalReferrer', document.referrer || '../index.html');
    
    // Redirect to checkout page
    window.location.href = '../checkout/index.html';
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Function to fetch related products based on category
async function fetchRelatedProducts(product) {
    try {
        const relatedProductsGrid = document.getElementById('related-products-grid');
        if (!relatedProductsGrid) return;
        
        // Add loading indicator
        relatedProductsGrid.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-small"></div>
                <p>Finding related products...</p>
            </div>
        `;
        
        // Check if product has categories field
        console.log("Product data:", product);
        
        // Determine which categories to use for filtering
        let categoriesToUse = [];
        
        // First check for categories array
        if (product.categories && Array.isArray(product.categories) && product.categories.length > 0) {
            categoriesToUse = [...product.categories]; // Use all categories
            console.log("Using categories array:", categoriesToUse);
        } 
        // Then check for single category field
        else if (product.category) {
            categoriesToUse = [product.category];
            console.log("Using single category:", categoriesToUse);
        }
        
        if (categoriesToUse.length === 0) {
            console.log("No categories found for this product");
            relatedProductsGrid.innerHTML = '<p class="no-products-message">No related products found.</p>';
            return;
        }
        
        // Create a query to get products from the same categories
        const productsRef = collection(db, 'products');
        let relatedProducts = [];
        
        // First approach: Get all products and filter by category
        try {
            console.log("Fetching all products and filtering by categories");
            const allProductsQuery = query(productsRef, limit(50)); // Get a reasonable number of products
            const allProductsSnapshot = await getDocs(allProductsQuery);
            
            console.log(`Found ${allProductsSnapshot.size} total products`);
            
            // Filter products that match any of our categories
            allProductsSnapshot.forEach((doc) => {
                const productData = { id: doc.id, ...doc.data() };
                
                // Skip the current product
                if (productData.id === product.id) {
                    return;
                }
                
                // Check if this product matches any of our categories
                let categoryMatch = false;
                
                // Check in categories array
                if (productData.categories && Array.isArray(productData.categories)) {
                    for (const category of categoriesToUse) {
                        if (productData.categories.includes(category)) {
                            categoryMatch = true;
                            console.log(`Product ${productData.id} matches category ${category} in categories array`);
                            break;
                        }
                    }
                }
                
                // Check in category field
                if (!categoryMatch && productData.category) {
                    for (const category of categoriesToUse) {
                        if (productData.category === category) {
                            categoryMatch = true;
                            console.log(`Product ${productData.id} matches category ${category} in category field`);
                            break;
                        }
                    }
                }
                
                // If we found a match, add it to related products
                if (categoryMatch) {
                    relatedProducts.push(productData);
                }
            });
            
            console.log(`Found ${relatedProducts.length} related products by category matching`);
        } catch (error) {
            console.error("Error fetching all products:", error);
        }
        
        // If we still don't have enough products, get some random ones
        if (relatedProducts.length < 6) {
            try {
                console.log("Getting additional random products to fill the grid");
                const q3 = query(productsRef, limit(20));
                const querySnapshot3 = await getDocs(q3);
                
                querySnapshot3.forEach((doc) => {
                    const productData = { id: doc.id, ...doc.data() };
                    // Only add if not the current product and not already in the array
                    if (productData.id !== product.id && 
                        !relatedProducts.some(p => p.id === productData.id)) {
                        relatedProducts.push(productData);
                    }
                });
                
                // Shuffle to get random selection
                relatedProducts = shuffleArray(relatedProducts);
            } catch (error) {
                console.error("Error with fallback query:", error);
            }
        }
        
        // Limit to 6 products
        relatedProducts = relatedProducts.slice(0, 6);
        
        if (relatedProducts.length === 0) {
            relatedProductsGrid.innerHTML = '<p class="no-products-message">No related products found.</p>';
            return;
        }
        
        console.log(`Showing ${relatedProducts.length} related products`);
        console.log("Related products:", relatedProducts);
        
        // Render the related products
        relatedProductsGrid.innerHTML = renderProductsGrid(relatedProducts);
        
        // Add click event listeners to the product links
        setupProductLinkEventListeners(relatedProductsGrid);
        
    } catch (error) {
        console.error('Error fetching related products:', error);
        const relatedProductsGrid = document.getElementById('related-products-grid');
        if (relatedProductsGrid) {
            relatedProductsGrid.innerHTML = '<p class="error-message">Error loading related products.</p>';
        }
    }
}

// Function to fetch random products for "You May Like" section
async function fetchRandomProducts() {
    try {
        const youMayLikeGrid = document.getElementById('you-may-like-grid');
        if (!youMayLikeGrid) return;
        
        // Add loading indicator
        youMayLikeGrid.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-small"></div>
                <p>Finding products you may like...</p>
            </div>
        `;
        
        // Get all products with a reasonable limit
        const productsRef = collection(db, 'products');
        const q = query(productsRef, limit(50)); // Get more products for better variety
        const querySnapshot = await getDocs(q);
        
        console.log("Found total products for You May Like:", querySnapshot.size);
        
        // Filter out the current product and any products already shown in related section
        let randomProducts = [];
        const relatedProductsGrid = document.getElementById('related-products-grid');
        const relatedProductIds = new Set();
        
        // Get IDs of products already shown in related products section
        if (relatedProductsGrid) {
            const relatedProductElements = relatedProductsGrid.querySelectorAll('.product-card');
            relatedProductElements.forEach(el => {
                const link = el.querySelector('.product-link');
                if (link) {
                    const href = link.getAttribute('href');
                    const idMatch = href.match(/id=([^&]+)/);
                    if (idMatch && idMatch[1]) {
                        relatedProductIds.add(idMatch[1]);
                    }
                }
            });
        }
        
        console.log("Already shown product IDs:", Array.from(relatedProductIds));
        
        // Add all products that aren't the current product and aren't already shown
        querySnapshot.forEach((doc) => {
            const productData = { id: doc.id, ...doc.data() };
            if (currentProduct && productData.id !== currentProduct.id && 
                !relatedProductIds.has(productData.id)) {
                randomProducts.push(productData);
            } else if (!currentProduct && !relatedProductIds.has(productData.id)) {
                randomProducts.push(productData);
            }
        });
        
        // Shuffle the array to get random products
        randomProducts = shuffleArray(randomProducts);
        
        // Limit to 6 products
        randomProducts = randomProducts.slice(0, 6);
        
        if (randomProducts.length === 0) {
            youMayLikeGrid.innerHTML = '<p class="no-products-message">No additional products found.</p>';
            return;
        }
        
        console.log(`Showing ${randomProducts.length} random products`);
        
        // Render the random products
        youMayLikeGrid.innerHTML = renderProductsGrid(randomProducts);
        
        // Add click event listeners to the product links
        setupProductLinkEventListeners(youMayLikeGrid);
        
    } catch (error) {
        console.error('Error fetching random products:', error);
        const youMayLikeGrid = document.getElementById('you-may-like-grid');
        if (youMayLikeGrid) {
            youMayLikeGrid.innerHTML = '<p class="error-message">Error loading products.</p>';
        }
    }
}

// Helper function to render a grid of products
function renderProductsGrid(products) {
    return products.map(product => {
        // Get the first image URL with proper fallbacks
        let imageUrl = 'https://via.placeholder.com/300x300?text=No+Image';
        
        if (product.thumbnailUrl) {
            imageUrl = product.thumbnailUrl;
        } else if (product.imageUrls && Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
            imageUrl = product.imageUrls[0];
        } else if (product.secondaryImageUrls && Array.isArray(product.secondaryImageUrls) && product.secondaryImageUrls.length > 0) {
            imageUrl = product.secondaryImageUrls[0];
        }
        
        // Format price with discount if available
        const priceHtml = product.regularPrice ? 
            `<span class="product-price">৳${product.price}</span>
             <span class="product-regular-price">৳${product.regularPrice}</span>` : 
            `<span class="product-price">৳${product.price}</span>`;
        
        // Return the product card HTML with correct URL
        return `
            <div class="product-card">
                <a href="index.html?id=${product.id}" class="product-link">
                    <div class="product-image-container">
                        <img src="${imageUrl}" alt="${product.name}" class="product-image">
                    </div>
                    <div class="product-info">
                        <h3 class="product-title">${product.name}</h3>
                        <div class="product-price-container">
                            ${priceHtml}
                        </div>
                    </div>
                </a>
            </div>
        `;
    }).join('');
}

// Helper function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    
    // While there remain elements to shuffle
    while (currentIndex !== 0) {
        // Pick a remaining element
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        
        // And swap it with the current element
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    
    return array;
}

// Helper function to set up click event listeners for product links
function setupProductLinkEventListeners(container) {
    if (!container) return;
    
    const productLinks = container.querySelectorAll('.product-link');
    productLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            window.location.href = href;
        });
    });
}

// Load all products for search suggestions
async function loadAllProducts() {
    try {
        const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        allProducts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log('Loaded', allProducts.length, 'products for search suggestions');
    } catch (error) {
        console.error('Error loading products for search suggestions:', error);
    }
}

// Navigate through suggestions with keyboard
function navigateSuggestions(direction) {
    if (searchSuggestions.length === 0) return;
    
    selectedSuggestionIndex += direction;
    
    // Wrap around
    if (selectedSuggestionIndex >= searchSuggestions.length) {
        selectedSuggestionIndex = 0;
    } else if (selectedSuggestionIndex < 0) {
        selectedSuggestionIndex = searchSuggestions.length - 1;
    }
    
    updateSuggestionSelection();
}

// Update visual selection of suggestions
function updateSuggestionSelection() {
    const suggestionItems = document.querySelectorAll('.suggestion-item');
    suggestionItems.forEach((item, index) => {
        if (index === selectedSuggestionIndex) {
            item.classList.add('selected');
            // Scroll into view if needed
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

// Show search suggestions
function showSearchSuggestions(searchTerm) {
    const term = searchTerm.toLowerCase();
    
    // Find matching products
    const matchingProducts = allProducts.filter(product => {
        const productName = product.name.toLowerCase();
        const productDesc = product.description.toLowerCase();
        const categoriesArr = Array.isArray(product.categories) ? product.categories : [product.category];
        const productCategories = categoriesArr.map(cat => cat ? cat.toLowerCase() : '').join(' ');
        const productKeywords = Array.isArray(product.keywords) ? product.keywords.map(k => k.toLowerCase()).join(' ') : '';
        
        return productName.includes(term) ||
               productDesc.includes(term) ||
               productCategories.includes(term) ||
               productKeywords.includes(term);
    });
    
    // Sort by relevance
    matchingProducts.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aKeywords = Array.isArray(a.keywords) ? a.keywords.map(k => k.toLowerCase()) : [];
        const bKeywords = Array.isArray(b.keywords) ? b.keywords.map(k => k.toLowerCase()) : [];
        
        // Check match types for both products
        const aNameMatch = aName.includes(term);
        const bNameMatch = bName.includes(term);
        const aKeywordMatch = aKeywords.some(keyword => keyword.includes(term));
        const bKeywordMatch = bKeywords.some(keyword => keyword.includes(term));
        
        // Priority 1: Exact name match
        const aExactMatch = aName === term;
        const bExactMatch = bName === term;
        
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;
        
        // Priority 2: Name starts with
        const aStartsWith = aName.startsWith(term);
        const bStartsWith = bName.startsWith(term);
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        // Priority 3: Name contains (but not starts with)
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        
        // Priority 4: Keyword match (only if name doesn't match)
        if (!aNameMatch && aKeywordMatch && !bNameMatch && !bKeywordMatch) return -1;
        if (!bNameMatch && bKeywordMatch && !aNameMatch && !aKeywordMatch) return 1;
        
        // Priority 5: Both name and keyword match - name takes priority
        if (aNameMatch && aKeywordMatch && bNameMatch && !bKeywordMatch) return -1;
        if (bNameMatch && bKeywordMatch && aNameMatch && !aKeywordMatch) return 1;
        
        // Finally alphabetically
        return aName.localeCompare(bName);
    });
    
    // Limit to 8 products
    searchSuggestions = matchingProducts.slice(0, 8);
    
    // Create suggestions dropdown
    const suggestionsContainer = document.querySelector('.search-suggestions') || createSearchSuggestionsContainer();
    suggestionsContainer.innerHTML = searchSuggestions.map((product, index) => {
        // Check match types
        const productName = product.name.toLowerCase();
        const productKeywords = Array.isArray(product.keywords) ? product.keywords.map(k => k.toLowerCase()) : [];
        
        const isNameMatch = productName.includes(term);
        const isKeywordMatch = productKeywords.some(keyword => keyword.includes(term));
        
        // Determine match type for display
        let matchType = '';
        if (isNameMatch && isKeywordMatch) {
            matchType = 'Name & Keyword match';
        } else if (isNameMatch) {
            matchType = 'Name match';
        } else if (isKeywordMatch) {
            matchType = 'Keyword match';
        }
        
        return `
        <div class="suggestion-item product-suggestion" data-product-id="${product.id}" data-index="${index}">
            <div class="suggestion-product-image">
                ${product.thumbnailUrl
                    ? `<img src="${product.thumbnailUrl}" alt="${product.name}" loading="lazy">`
                    : (product.secondaryImageUrls && product.secondaryImageUrls.length > 0
                        ? `<img src="${product.secondaryImageUrls[0]}" alt="${product.name}" loading="lazy">`
                        : '<div class="no-image">No Image</div>'
                    )
                }
            </div>
            <div class="suggestion-product-info">
                <div class="suggestion-product-name">${product.name}</div>
                <div class="suggestion-product-price">৳${product.price}</div>
                ${matchType ? `<div class="suggestion-match-type" style="font-size: 11px; color: ${isNameMatch ? '#43a047' : '#f38124'}; margin-top: 2px;">✓ ${matchType}</div>` : ''}
            </div>
        </div>
        `;
    }).join('');
    
    // Add click event listeners to suggestion items
    suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const productId = item.getAttribute('data-product-id');
            if (productId) {
                selectProductSuggestion(productId);
            }
        });
    });
    
    suggestionsContainer.style.display = searchSuggestions.length > 0 ? 'block' : 'none';
}

// Create search suggestions container
function createSearchSuggestionsContainer() {
    console.log('Creating search suggestions container');
    const searchBox = document.querySelector('.search-box');
    if (!searchBox) {
        console.error('Search box not found');
        return null;
    }
    const container = document.createElement('div');
    container.className = 'search-suggestions';
    searchBox.appendChild(container);
    console.log('Search suggestions container created');
    return container;
}

// Hide search suggestions
function hideSearchSuggestions() {
    const suggestionsContainer = document.querySelector('.search-suggestions');
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
    }
    selectedSuggestionIndex = -1;
}

// Select a product suggestion and go to product detail page
function selectProductSuggestion(productId) {
    console.log('selectProductSuggestion called with productId:', productId);
    hideSearchSuggestions();
    selectedSuggestionIndex = -1;
    
    // Validate productId
    if (!productId) {
        console.error('No productId provided');
        return;
    }
    
    // Check if product exists
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.error('Product not found with id:', productId);
        return;
    }
    
    console.log('Navigating to product:', product.name);
    window.location.href = `index.html?id=${productId}`;
}

// On page load, fetch product details
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded');
    
    // Check if we came from checkout and might be in a loop
    if (document.referrer.includes('/checkout/')) {
        // If we have an original referrer stored, we'll use it when back button is clicked
        // The back button handler will take care of this
    }
    
    // Load all products for search suggestions
    console.log('Loading all products for search suggestions...');
    await loadAllProducts();
    
    const productId = getProductIdFromUrl();
    console.log('Product ID from URL:', productId);
    
    if (productId) {
        console.log('Fetching product details...');
        await fetchProductDetails(productId);
        console.log('Setting up event listeners...');
        setupEventListeners(); // Call setupEventListeners after DOM is loaded
        
        // Handle popstate for back button (without pushing extra state)
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.scrollY) {
                setTimeout(() => {
                    window.scrollTo(0, event.state.scrollY);
                }, 100);
            }
        });
    } else {
        console.log('No product ID provided');
        hideLoading();
        productDetailsContent.innerHTML = '';
        errorMessage.style.display = 'block';
        errorMessage.textContent = 'No product ID provided.';
        showToast('No product ID provided.', true);
        
        // Still set up event listeners for navigation and search
        console.log('Setting up event listeners without product...');
        setupEventListeners();
    }
}); 