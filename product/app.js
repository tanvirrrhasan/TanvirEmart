import { db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

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
            // Check if we came from checkout and have a stored original referrer
            const originalReferrer = localStorage.getItem('originalReferrer');
            if (originalReferrer) {
                localStorage.removeItem('originalReferrer'); // Clear it after use
                window.location.href = originalReferrer;
            } else {
                // If we came directly to the product page, just go back
                // or go to home if there's no history
                if (document.referrer.includes('checkout')) {
                    window.location.href = '../index.html';
                } else {
                    history.back();
                }
            }
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
    
    // Create a temporary cart with just this product
    const buyNowCart = [{
        id: currentProduct.id,
        name: currentProduct.name,
        price: currentProduct.price,
        image: currentProduct.imageUrls && currentProduct.imageUrls.length > 0 ? currentProduct.imageUrls[0] : null,
        quantity: 1
    }];
    
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

// On page load, fetch product details
document.addEventListener('DOMContentLoaded', () => {
    // Check if we came from checkout and might be in a loop
    if (document.referrer.includes('/checkout/')) {
        // If we have an original referrer stored, we'll use it when back button is clicked
        // The back button handler will take care of this
    }
    
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