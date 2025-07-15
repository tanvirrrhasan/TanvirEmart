import { db } from '../firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Get cart data from localStorage
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let products = [];
let userAddresses = [];

// DOM elements
const cartItemsSummary = document.getElementById('cart-items-summary');
const subtotalElement = document.getElementById('subtotal');
const deliveryFeeElement = document.getElementById('delivery-fee');
const totalElement = document.getElementById('total');
const checkoutForm = document.getElementById('checkout-form');
const paymentMethodSelect = document.getElementById('payment-method');
const mobileNumberGroup = document.getElementById('mobile-number-group');
const mobileNumberInput = document.getElementById('mobile-number');
const savedAddressesSelect = document.getElementById('saved-addresses');
const deliveryAddressTextarea = document.getElementById('delivery-address');

// Initialize checkout page
document.addEventListener('DOMContentLoaded', () => {
    if (cart.length === 0) {
        showMessage('Your cart is empty! Please add some products first.', 'error');
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 2000);
        return;
    }
    
    loadCartProducts();
    loadUserAddresses();
    updateOrderSummary();
    setupEventListeners();
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
        <div class="cart-item-summary">
            <div class="cart-item-image">
                ${item.image 
                    ? `<img src="${item.image}" alt="${item.name}">`
                    : '<div style="width: 100%; height: 100%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #999; font-size: 0.8rem;">No Image</div>'
                }
            </div>
            <div class="cart-item-details">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">৳${item.price}</div>
                <div class="cart-item-quantity">Quantity: ${item.quantity}</div>
            </div>
        </div>
    `).join('');

    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = 60;
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
    savedAddressesSelect.addEventListener('change', (e) => {
        const selectedAddressId = e.target.value;
        if (selectedAddressId) {
            const selectedAddress = userAddresses.find(addr => addr.id === selectedAddressId);
            if (selectedAddress) {
                const fullAddress = `${selectedAddress.street}, ${selectedAddress.city}, ${selectedAddress.postal}`;
                deliveryAddressTextarea.value = fullAddress;
            }
        }
    });

    // Form submission
    checkoutForm.addEventListener('submit', handleOrderSubmission);
    
    // Load saved profile data
    loadSavedProfile();
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
        const formData = {
            customerName: document.getElementById('customer-name').value,
            customerPhone: document.getElementById('customer-phone').value,
            customerEmail: document.getElementById('customer-email').value || '',
            deliveryAddress: document.getElementById('delivery-address').value,
            paymentMethod: document.getElementById('payment-method').value,
            mobileNumber: document.getElementById('mobile-number').value || '',
            orderNotes: document.getElementById('order-notes').value || '',
            items: cart,
            subtotal: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            deliveryFee: 60,
            total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + 60,
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
        updateUserProfile(formData);
        
        // Clear cart
        localStorage.removeItem('cart');
        
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
function loadUserAddresses() {
    try {
        const savedAddresses = localStorage.getItem('userAddresses');
        if (savedAddresses) {
            userAddresses = JSON.parse(savedAddresses);
            populateSavedAddresses();
        }
    } catch (error) {
        console.error('Error loading addresses:', error);
        userAddresses = [];
    }
}

// Populate saved addresses dropdown
function populateSavedAddresses() {
    if (!userAddresses || userAddresses.length === 0) {
        savedAddressesSelect.innerHTML = '<option value="">No saved addresses</option>';
        return;
    }
    
    savedAddressesSelect.innerHTML = '<option value="">Select Saved Address</option>' +
        userAddresses.map(address => 
            `<option value="${address.id}">${address.title} - ${address.name}</option>`
        ).join('');
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
function updateUserProfile(orderData) {
    try {
        // Update profile with order information
        const currentProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        const updatedProfile = {
            ...currentProfile,
            name: orderData.customerName,
            phone: orderData.customerPhone,
            email: orderData.customerEmail || currentProfile.email || '',
            lastOrderDate: new Date().toISOString(),
            totalOrders: (currentProfile.totalOrders || 0) + 1
        };
        
        localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        
        // Add delivery address to saved addresses if not exists
        const currentAddresses = JSON.parse(localStorage.getItem('userAddresses') || '[]');
        const addressExists = currentAddresses.some(addr => 
            addr.street === orderData.deliveryAddress
        );
        
        if (!addressExists && orderData.deliveryAddress) {
            const newAddress = {
                id: 'addr_' + Date.now(),
                title: 'Last Order Address',
                name: orderData.customerName,
                phone: orderData.customerPhone,
                street: orderData.deliveryAddress,
                city: 'Dhaka', // Default city
                postal: '1000', // Default postal code
                type: 'other',
                isDefault: false,
                createdAt: new Date().toISOString()
            };
            
            currentAddresses.push(newAddress);
            localStorage.setItem('userAddresses', JSON.stringify(currentAddresses));
        }
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