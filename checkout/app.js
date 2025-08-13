import { db } from '../firebase-config.js';
import { auth } from '../firebase-config.js';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, getDoc, updateDoc, doc, increment } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// Get cart data from localStorage
let cart = JSON.parse(localStorage.getItem('cartForCheckout')) || []; // Use cartForCheckout
let products = [];
let userAddresses = [];
// Get the source URL from localStorage or use referrer or default to index.html
let referrerPage = localStorage.getItem('checkoutSource') || document.referrer || '../index.html';
// Store the original referrer for breaking navigation loops
let originalReferrer = '';

// DOM elements
const cartItemsSummary = document.getElementById('cart-items-summary');
const subtotalElement = document.getElementById('subtotal');
const deliveryFeeElement = document.getElementById('delivery-fee');
const totalElement = document.getElementById('total');
const checkoutForm = document.getElementById('checkout-form');
const paymentMethodSelect = document.getElementById('payment-method');
const mobileNumberGroup = document.getElementById('mobile-number-group');
const mobileNumberInput = document.getElementById('mobile-number');
const deliveryAddressTextarea = document.getElementById('delivery-address');
const backBtn = document.querySelector('.back-btn');

// Initialize checkout page
document.addEventListener('DOMContentLoaded', () => {
    if (cart.length === 0) {
        showMessage('Your cart is empty! Please add some products first.', 'error');
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 2000);
        return;
    }
    
    // Store original referrer if we came from a product page
    if (document.referrer.includes('/product/') && !localStorage.getItem('originalReferrer')) {
        // Find the referrer before the product page
        originalReferrer = localStorage.getItem('productOriginalReferrer') || '../index.html';
        localStorage.setItem('originalReferrer', originalReferrer);
    }
    
    loadCartProducts();
    updateOrderSummary();
    setupEventListeners();
    initializeAuthForCheckout();
});

// Load product details for cart items
async function loadCartProducts() {
    try {
        const productIds = cart.map(item => item.id);
        if (productIds.length > 0) {
            // For simplicity, we'll use the cart data directly
            // In a real app, you'd fetch from Firebase
            products = cart.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                image: item.image
            }));
        }
    } catch (error) {
        console.error('Error loading product details:', error);
        showMessage('Error loading product details.', 'error');
    }
}

// Update order summary display
function updateOrderSummary() {
    if (cart.length === 0) {
        cartItemsSummary.innerHTML = '<p>No items in cart</p>';
        return;
    }

    // Display cart items
    cartItemsSummary.innerHTML = cart.map(item => `
        <div class="cart-item-summary" data-id="${item.id}">
            <div class="cart-item-image">
                ${item.image 
                    ? `<img src="${item.image}" alt="${item.name}" loading="lazy" width="64" height="64">`
                    : '<div style="width: 100%; height: 100%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #999; font-size: 0.8rem;">No Image</div>'
                }
            </div>
            <div class="cart-item-details">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">৳${item.price}</div>
                ${(item.selectedColor ? `<div class='cart-item-variant'><strong>Color:</strong> ${item.selectedColor}</div>` : '')}
                ${(item.selectedSize ? `<div class='cart-item-variant'><strong>Size:</strong> ${item.selectedSize}</div>` : '')}
                <div class="cart-item-quantity">
                    <span>Quantity:</span>
                    <div class="quantity-controls">
                        <button class="quantity-btn decrease-qty" data-id="${item.id}">-</button>
                        <span class="quantity-value">${item.quantity}</span>
                        <button class="quantity-btn increase-qty" data-id="${item.id}">+</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = 150;
    const total = subtotal + deliveryFee;

    subtotalElement.textContent = `৳${subtotal.toFixed(2)}`;
    deliveryFeeElement.textContent = `৳${deliveryFee}`;
    totalElement.textContent = `৳${total.toFixed(2)}`;
}

// Setup event listeners
function setupEventListeners() {
    // Payment method change handler
    paymentMethodSelect.addEventListener('change', (e) => {
        const method = e.target.value;
        if (method === 'bkash' || method === 'nagad' || method === 'rocket') {
            mobileNumberGroup.style.display = 'block';
            mobileNumberInput.required = true;
        } else {
            mobileNumberGroup.style.display = 'none';
            mobileNumberInput.required = false;
        }
    });

    // Saved address selection
    // This section is no longer needed as address fields are directly populated
    // savedAddressesSelect.addEventListener('change', (e) => {
    //     const selectedAddressId = e.target.value;
    //     if (selectedAddressId) {
    //         const selectedAddress = userAddresses.find(addr => addr.id === selectedAddressId);
    //         if (selectedAddress) {
    //             deliveryAddressTextarea.value = selectedAddress.street;
    //         }
    //     }
    // });

    // Form submission
    checkoutForm.addEventListener('submit', handleOrderSubmission);
    
    // Quantity controls
    cartItemsSummary.addEventListener('click', handleQuantityChange);

    // Back button functionality
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Clear the checkout source from localStorage
            const checkoutSource = localStorage.getItem('checkoutSource');
            localStorage.removeItem('checkoutSource');
            
            // If we're going back to a product page, we need to handle the loop
            if (checkoutSource && checkoutSource.includes('/product/')) {
                // Keep originalReferrer in localStorage so product page can use it
                // The product page will clear it after use
            } else {
                // If not going to product page, clear originalReferrer
                localStorage.removeItem('originalReferrer');
            }
            
            window.location.href = referrerPage;
        });
    }
    document.getElementById('login-btn').addEventListener('click', handleLogin);
}

// Handle quantity changes
function handleQuantityChange(e) {
    const target = e.target;
    if (target.classList.contains('quantity-btn')) {
        const productId = target.dataset.id;
        const change = target.classList.contains('increase-qty') ? 1 : -1;
        updateQuantity(productId, change);
    }
}

// Update item quantity
function updateQuantity(productId, change) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        const newQuantity = cart[itemIndex].quantity + change;
        if (newQuantity >= 1) {
            cart[itemIndex].quantity = newQuantity;
            localStorage.setItem('cartForCheckout', JSON.stringify(cart));
            updateOrderSummary();
        }
    }
}


// Handle order submission
async function handleOrderSubmission(e) {
    e.preventDefault();
    
    const submitBtn = checkoutForm.querySelector('.place-order-btn');
    const originalText = submitBtn.textContent;
    
    try {
        // Disable button and show loading
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing Order...';
        checkoutForm.classList.add('loading');

        // Get form data
        const division = document.getElementById('division').value;
        const district = document.getElementById('district').value;
        const upazila = document.getElementById('upazila').value;
        const street = document.getElementById('delivery-address').value;
        const fullAddress = `Street: ${street}, Upazila: ${upazila}, District: ${district}, Division: ${division}`;

        const formData = {
            userId: auth.currentUser.uid,
            customerName: document.getElementById('customer-name').value,
            customerPhone: document.getElementById('customer-phone').value,
            customerEmail: document.getElementById('customer-email').value || '',
            deliveryAddress: fullAddress,
            deliveryAddressDetails: {
                division,
                district,
                upazila,
                street
            },
            paymentMethod: document.getElementById('payment-method').value,
            mobileNumber: document.getElementById('mobile-number').value || '',
            orderNotes: document.getElementById('order-notes').value || '',
            items: cart,
            subtotal: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            deliveryFee: 150,
            total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + 150,
            status: 'pending',
            createdAt: serverTimestamp(),
            orderNumber: generateOrderNumber()
        };

        // Validate payment method
        if (['bkash', 'nagad', 'rocket'].includes(formData.paymentMethod) && !formData.mobileNumber) {
            throw new Error('Mobile number is required for mobile banking payments');
        }

        // Save order to Firebase
        const orderRef = await addDoc(collection(db, 'orders'), formData);
        
        // Update user profile with order information
        await updateUserProfile(formData);
        
        // Clear only the purchased items from the main cart
        const mainCart = JSON.parse(localStorage.getItem('cart')) || [];
        const purchasedItemIds = cart.map(item => item.id);
        const updatedMainCart = mainCart.filter(item => !purchasedItemIds.includes(item.id));
        localStorage.setItem('cart', JSON.stringify(updatedMainCart));

        // Clear the temporary checkout cart
        localStorage.removeItem('cartForCheckout');
        
        // Clear all navigation-related localStorage items
        localStorage.removeItem('checkoutSource');
        localStorage.removeItem('originalReferrer');
        localStorage.removeItem('productOriginalReferrer');
        
        // Show success message
        showMessage('Order placed successfully! Your order number is: ' + formData.orderNumber, 'success');
        
        // Redirect to success page or home
        setTimeout(() => {
            window.location.href = '../index.html?orderSuccess=true&orderNumber=' + formData.orderNumber;
        }, 3000);

    } catch (error) {
        console.error('Error placing order:', error);
        showMessage('Error placing order: ' + error.message, 'error');
        
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        checkoutForm.classList.remove('loading');
    }
}

// Load user addresses
async function loadUserAddresses() {
    try {
        const q = query(collection(db, 'users', auth.currentUser.uid, 'addresses'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        userAddresses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        // populateSavedAddresses(); // This function is no longer needed
    } catch (error) {
        console.error('Error loading addresses:', error);
        userAddresses = [];
    }
}

// Populate saved addresses dropdown
// This function is no longer needed
function populateSavedAddresses() {
    if (!userAddresses || userAddresses.length === 0) {
        // savedAddressesSelect.innerHTML = '<option value="">No saved addresses</option>'; // This element is removed
        return;
    }
    
    // savedAddressesSelect.innerHTML = '<option value="">Select Saved Address</option>' + // This element is removed
    //     userAddresses.map(address => 
    //         `<option value="${address.id}">${address.type} - ${address.street}</option>`
    //     ).join('');
}

// Load saved profile data
function loadSavedProfile() {
    try {
        const savedProfile = localStorage.getItem('userProfile');
        if (savedProfile) {
            const profile = JSON.parse(savedProfile);
            document.getElementById('customer-name').value = profile.name || '';
            document.getElementById('customer-phone').value = profile.phone || '';
            document.getElementById('customer-email').value = profile.email || '';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Update user profile with order information
async function updateUserProfile(orderData) {
    try {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userDocRef, {
            name: orderData.customerName,
            phone: orderData.customerPhone,
            email: orderData.customerEmail,
            lastOrderDate: serverTimestamp(),
            totalOrders: increment(1),
            lastAddress: orderData.deliveryAddressDetails // Save the last used address object
        }, {merge: true});
        
    } catch (error) {
        console.error('Error updating user profile:', error);
    }
}

// Generate unique order number
function generateOrderNumber() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `EM${timestamp.slice(-6)}${random}`;
}

// Show message
function showMessage(message, type = 'success') {
    // Remove existing messages
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    // Insert at the top of the form
    checkoutForm.insertBefore(messageDiv, checkoutForm.firstChild);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
} 

function initializeAuthForCheckout() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            document.getElementById('login-prompt').style.display = 'none';
            checkoutForm.style.display = 'block';
            await loadProfileFromFirestore(user.uid);
            await loadUserAddresses();
        } else {
            document.getElementById('login-prompt').style.display = 'block';
            checkoutForm.style.display = 'none';
        }
    });
}
async function handleLogin() {
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Failed to login. Please try again.', 'error');
    }
}
async function loadProfileFromFirestore(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            const profile = userDoc.data();
            document.getElementById('customer-name').value = profile.name || '';
            document.getElementById('customer-phone').value = profile.phone || '';
            document.getElementById('customer-email').value = profile.email || '';

            // Populate address fields from last used address
            if (profile.lastAddress) {
                document.getElementById('division').value = profile.lastAddress.division || '';
                document.getElementById('district').value = profile.lastAddress.district || '';
                document.getElementById('upazila').value = profile.lastAddress.upazila || '';
                document.getElementById('delivery-address').value = profile.lastAddress.street || '';
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}