import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Global variables
let currentUser = null;
let userProfile = null;
let userOrders = [];
let userAddresses = [];
let editingAddressId = null;

// DOM elements
const navTabs = document.querySelectorAll('.nav-tab');
const accountSections = document.querySelectorAll('.account-section');
const profileForm = document.getElementById('profile-form');
const editProfileBtn = document.getElementById('edit-profile-btn');
const cancelProfileBtn = document.getElementById('cancel-profile-btn');
const ordersList = document.getElementById('orders-list');
const orderStatusFilter = document.getElementById('order-status-filter');
const addressesList = document.getElementById('addresses-list');
const addAddressBtn = document.getElementById('add-address-btn');
const addressModal = document.getElementById('address-modal');
const addressForm = document.getElementById('address-form');
const closeAddressModal = document.getElementById('close-address-modal');
const cancelAddressBtn = document.getElementById('cancel-address-btn');
const orderModal = document.getElementById('order-modal');
const closeOrderModal = document.getElementById('close-order-modal');

// Initialize account page
document.addEventListener('DOMContentLoaded', () => {
    initializeAccount();
    setupEventListeners();
});

// Initialize account functionality
async function initializeAccount() {
    try {
        // For demo purposes, we'll use a mock user ID
        // In a real app, this would come from authentication
        const mockUserId = 'demo-user-123';
        currentUser = { id: mockUserId };
        
        await Promise.all([
            loadUserProfile(),
            loadUserOrders(),
            loadUserAddresses()
        ]);
        
        renderProfile();
        renderOrders();
        renderAddresses();
        
    } catch (error) {
        console.error('Error initializing account:', error);
        showToast('Error loading account data', true);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Navigation tabs
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
    
    // Profile form
    profileForm.addEventListener('submit', handleProfileSubmit);
    editProfileBtn.addEventListener('click', enableProfileEditing);
    cancelProfileBtn.addEventListener('click', cancelProfileEditing);
    
    // Orders filter
    orderStatusFilter.addEventListener('change', filterOrders);
    
    // Address management
    addAddressBtn.addEventListener('click', openAddressModal);
    addressForm.addEventListener('submit', handleAddressSubmit);
    closeAddressModal.addEventListener('click', closeAddressModalFunc);
    cancelAddressBtn.addEventListener('click', closeAddressModalFunc);
    
    // Real-time validation for address form
    const addressInputs = addressForm.querySelectorAll('input, select, textarea');
    addressInputs.forEach(input => {
        input.addEventListener('blur', validateAddressField);
        input.addEventListener('input', clearAddressFieldError);
    });
    
    // Order modal
    closeOrderModal.addEventListener('click', closeOrderModalFunc);
    
    // Close modals when clicking outside
    addressModal.addEventListener('click', (e) => {
        if (e.target === addressModal) closeAddressModalFunc();
    });
    
    orderModal.addEventListener('click', (e) => {
        if (e.target === orderModal) closeOrderModalFunc();
    });
}

// Tab switching
function switchTab(tabName) {
    // Update active tab
    navTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        }
    });
    
    // Update active section
    accountSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === tabName) {
            section.classList.add('active');
        }
    });
}

// Profile Management
async function loadUserProfile() {
    try {
        // In a real app, you'd query the user's profile from Firebase
        // For demo, we'll use localStorage or create a default profile
        const savedProfile = localStorage.getItem('userProfile');
        if (savedProfile) {
            userProfile = JSON.parse(savedProfile);
        } else {
            // Create default profile
            userProfile = {
                name: '',
                phone: '',
                email: '',
                birthdate: '',
                gender: ''
            };
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        userProfile = {
            name: '',
            phone: '',
            email: '',
            birthdate: '',
            gender: ''
        };
    }
}

function renderProfile() {
    if (!userProfile) return;
    
    document.getElementById('profile-name').value = userProfile.name || '';
    document.getElementById('profile-phone').value = userProfile.phone || '';
    document.getElementById('profile-email').value = userProfile.email || '';
    document.getElementById('profile-birthdate').value = userProfile.birthdate || '';
    document.getElementById('profile-gender').value = userProfile.gender || '';
    
    // Update profile statistics
    updateProfileStats();
    
    // Disable form initially
    disableProfileForm();
}

function enableProfileEditing() {
    enableProfileForm();
    editProfileBtn.style.display = 'none';
    cancelProfileBtn.style.display = 'inline-block';
}

function cancelProfileEditing() {
    renderProfile(); // Reset to original values
    disableProfileForm();
    editProfileBtn.style.display = 'inline-block';
    cancelProfileBtn.style.display = 'none';
}

function enableProfileForm() {
    const inputs = profileForm.querySelectorAll('input, select');
    inputs.forEach(input => input.disabled = false);
}

function disableProfileForm() {
    const inputs = profileForm.querySelectorAll('input, select');
    inputs.forEach(input => input.disabled = true);
}

async function handleProfileSubmit(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('profile-name').value,
        phone: document.getElementById('profile-phone').value,
        email: document.getElementById('profile-email').value,
        birthdate: document.getElementById('profile-birthdate').value,
        gender: document.getElementById('profile-gender').value,
        updatedAt: serverTimestamp()
    };
    
    try {
        // In a real app, you'd save to Firebase
        // For demo, we'll save to localStorage
        localStorage.setItem('userProfile', JSON.stringify(formData));
        userProfile = formData;
        
        disableProfileForm();
        editProfileBtn.style.display = 'inline-block';
        cancelProfileBtn.style.display = 'none';
        
        // Update statistics after profile update
        updateProfileStats();
        
        showToast('Profile updated successfully!');
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Error updating profile', true);
    }
}

// Orders Management
async function loadUserOrders() {
    try {
        // In a real app, you'd query orders for the current user
        // For demo, we'll get all orders and filter by phone number
        const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        userOrders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Filter orders by user's phone number (if profile exists)
        if (userProfile && userProfile.phone) {
            userOrders = userOrders.filter(order => 
                order.customerPhone === userProfile.phone
            );
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        userOrders = [];
    }
}

function renderOrders() {
    if (!userOrders || userOrders.length === 0) {
        ordersList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-bag"></i>
                <h3>No Orders Yet</h3>
                <p>Start shopping to see your order history here</p>
            </div>
        `;
        return;
    }
    
    ordersList.innerHTML = userOrders.map(order => `
        <div class="order-card">
            <div class="order-header">
                <div>
                    <div class="order-number">${order.orderNumber}</div>
                    <div class="order-date">${formatDate(order.createdAt)}</div>
                </div>
                <span class="order-status status-${order.status}">${order.status}</span>
            </div>
            
            <div class="order-summary">
                <div class="order-items">${order.items?.length || 0} items</div>
                <div class="order-total">৳${order.total?.toFixed(2) || '0.00'}</div>
            </div>
            
            <div class="order-actions">
                <button class="view-order-btn" onclick="viewOrderDetails('${order.id}')">
                    View Details
                </button>
            </div>
        </div>
    `).join('');
}

function filterOrders() {
    const filterValue = orderStatusFilter.value;
    
    if (!filterValue) {
        renderOrders();
        return;
    }
    
    const filteredOrders = userOrders.filter(order => order.status === filterValue);
    
    if (filteredOrders.length === 0) {
        ordersList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-filter"></i>
                <h3>No Orders Found</h3>
                <p>No orders match the selected status</p>
            </div>
        `;
        return;
    }
    
    ordersList.innerHTML = filteredOrders.map(order => `
        <div class="order-card">
            <div class="order-header">
                <div>
                    <div class="order-number">${order.orderNumber}</div>
                    <div class="order-date">${formatDate(order.createdAt)}</div>
                </div>
                <span class="order-status status-${order.status}">${order.status}</span>
            </div>
            
            <div class="order-summary">
                <div class="order-items">${order.items?.length || 0} items</div>
                <div class="order-total">৳${order.total?.toFixed(2) || '0.00'}</div>
            </div>
            
            <div class="order-actions">
                <button class="view-order-btn" onclick="viewOrderDetails('${order.id}')">
                    View Details
                </button>
            </div>
        </div>
    `).join('');
}

// Address Management
async function loadUserAddresses() {
    try {
        // In a real app, you'd query addresses for the current user
        // For demo, we'll use localStorage
        const savedAddresses = localStorage.getItem('userAddresses');
        console.log('Loading addresses from localStorage:', savedAddresses);
        
        if (savedAddresses) {
            userAddresses = JSON.parse(savedAddresses);
            console.log('Parsed addresses:', userAddresses);
        } else {
            userAddresses = [];
            console.log('No saved addresses found, initializing empty array');
        }
    } catch (error) {
        console.error('Error loading addresses:', error);
        userAddresses = [];
    }
}

function renderAddresses() {
    console.log('Rendering addresses:', userAddresses);
    
    if (!userAddresses || userAddresses.length === 0) {
        addressesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-map-marker-alt"></i>
                <h3>No Addresses Saved</h3>
                <p>Add your first address to get started</p>
            </div>
        `;
        return;
    }
    
    addressesList.innerHTML = userAddresses.map(address => `
        <div class="address-card ${address.isDefault ? 'default' : ''}">
            <div class="address-header">
                <div class="address-title">${address.title}</div>
                <span class="address-type">${address.type}</span>
            </div>
            
            <div class="address-content">
                <div class="address-name">${address.name}</div>
                <div class="address-phone">${address.phone}</div>
                <div class="address-street">${address.street}</div>
                <div class="address-street">${address.city}, ${address.postal}</div>
            </div>
            
            <div class="address-actions">
                <button class="edit-address-btn" onclick="editAddress('${address.id}')">
                    Edit
                </button>
                <button class="delete-address-btn" onclick="deleteAddress('${address.id}')">
                    Delete
                </button>
            </div>
        </div>
    `).join('');
}

function openAddressModal(addressId = null) {
    editingAddressId = addressId;
    
    if (addressId) {
        // Edit existing address
        const address = userAddresses.find(addr => addr.id === addressId);
        if (address) {
            document.getElementById('address-modal-title').textContent = 'Edit Address';
            document.getElementById('address-title').value = address.title;
            document.getElementById('address-name').value = address.name;
            document.getElementById('address-phone').value = address.phone;
            document.getElementById('address-street').value = address.street;
            document.getElementById('address-city').value = address.city;
            document.getElementById('address-postal').value = address.postal;
            document.getElementById('address-type').value = address.type;
            document.getElementById('address-default').checked = address.isDefault;
        }
    } else {
        // Add new address
        document.getElementById('address-modal-title').textContent = 'Add New Address';
        addressForm.reset();
    }
    
    addressModal.style.display = 'flex';
}

function closeAddressModalFunc() {
    console.log('Closing address modal');
    addressModal.style.display = 'none';
    editingAddressId = null;
    addressForm.reset();
    
    // Clear any validation messages
    const errorMessages = addressForm.querySelectorAll('.error-message');
    errorMessages.forEach(msg => msg.remove());
}

async function handleAddressSubmit(e) {
    e.preventDefault();
    
    // Get form values
    const title = document.getElementById('address-title').value.trim();
    const name = document.getElementById('address-name').value.trim();
    const phone = document.getElementById('address-phone').value.trim();
    const street = document.getElementById('address-street').value.trim();
    const city = document.getElementById('address-city').value.trim();
    const postal = document.getElementById('address-postal').value.trim();
    const type = document.getElementById('address-type').value;
    const isDefault = document.getElementById('address-default').checked;
    
    // Clear previous error messages
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(el => {
        el.textContent = '';
        el.classList.remove('show');
    });
    
    // Validate required fields
    let hasErrors = false;
    
    if (!title) {
        document.getElementById('title-error').textContent = 'Address title is required';
        document.getElementById('title-error').classList.add('show');
        hasErrors = true;
    }
    
    if (!name) {
        document.getElementById('name-error').textContent = 'Full name is required';
        document.getElementById('name-error').classList.add('show');
        hasErrors = true;
    }
    
    if (!phone) {
        document.getElementById('phone-error').textContent = 'Phone number is required';
        document.getElementById('phone-error').classList.add('show');
        hasErrors = true;
    }
    
    if (!street) {
        document.getElementById('street-error').textContent = 'Street address is required';
        document.getElementById('street-error').classList.add('show');
        hasErrors = true;
    }
    
    if (!city) {
        document.getElementById('city-error').textContent = 'City is required';
        document.getElementById('city-error').classList.add('show');
        hasErrors = true;
    }
    
    if (!postal) {
        document.getElementById('postal-error').textContent = 'Postal code is required';
        document.getElementById('postal-error').classList.add('show');
        hasErrors = true;
    }
    
    if (!type) {
        document.getElementById('type-error').textContent = 'Address type is required';
        document.getElementById('type-error').classList.add('show');
        hasErrors = true;
    }
    
    if (hasErrors) {
        showToast('Please fix the validation errors', true);
        return;
    }
    
    const formData = {
        title: title,
        name: name,
        phone: phone,
        street: street,
        city: city,
        postal: postal,
        type: type,
        isDefault: isDefault,
        createdAt: new Date().toISOString()
    };
    
    try {
        if (editingAddressId) {
            // Update existing address
            const index = userAddresses.findIndex(addr => addr.id === editingAddressId);
            if (index !== -1) {
                userAddresses[index] = { ...userAddresses[index], ...formData };
            }
        } else {
            // Add new address
            formData.id = 'addr_' + Date.now();
            userAddresses.push(formData);
        }
        
        // Handle default address
        if (formData.isDefault) {
            userAddresses.forEach(addr => {
                if (addr.id !== formData.id) {
                    addr.isDefault = false;
                }
            });
        }
        
        // Save to localStorage
        localStorage.setItem('userAddresses', JSON.stringify(userAddresses));
        
        // Debug logging
        console.log('Addresses saved:', userAddresses);
        console.log('LocalStorage check:', localStorage.getItem('userAddresses'));
        
        renderAddresses();
        updateProfileStats(); // Update statistics after address change
        closeAddressModalFunc();
        showToast(editingAddressId ? 'Address updated successfully!' : 'Address added successfully!');
        
    } catch (error) {
        console.error('Error saving address:', error);
        showToast('Error saving address: ' + error.message, true);
    }
}

// Order Details Modal
function viewOrderDetails(orderId) {
    const order = userOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const itemsHtml = order.items?.map(item => `
        <div class="order-item">
            <div class="order-item-image">
                ${item.image 
                    ? `<img src="${item.image}" alt="${item.name}">`
                    : '<div style="width: 100%; height: 100%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #999; font-size: 0.8rem;">No Image</div>'
                }
            </div>
            <div class="order-item-details">
                <div class="order-item-name">${item.name}</div>
                <div class="order-item-price">৳${item.price}</div>
                <div class="order-item-quantity">Quantity: ${item.quantity}</div>
            </div>
        </div>
    `).join('') || '';
    
    document.getElementById('order-modal-title').textContent = `Order Details - ${order.orderNumber}`;
    document.getElementById('order-details-content').innerHTML = `
        <div class="order-detail-section">
            <h4>Customer Information</h4>
            <p><strong>Name:</strong> ${order.customerName}</p>
            <p><strong>Phone:</strong> ${order.customerPhone}</p>
            <p><strong>Email:</strong> ${order.customerEmail || 'N/A'}</p>
            <p><strong>Address:</strong> ${order.deliveryAddress}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            ${order.mobileNumber ? `<p><strong>Mobile Number:</strong> ${order.mobileNumber}</p>` : ''}
        </div>
        
        <div class="order-detail-section">
            <h4>Order Items</h4>
            <div class="order-items-list">
                ${itemsHtml}
            </div>
        </div>
        
        <div class="order-detail-section">
            <h4>Order Summary</h4>
            <p><strong>Subtotal:</strong> ৳${order.subtotal?.toFixed(2) || '0.00'}</p>
            <p><strong>Delivery Fee:</strong> ৳${order.deliveryFee || '0.00'}</p>
            <p><strong>Total:</strong> ৳${order.total?.toFixed(2) || '0.00'}</p>
            <p><strong>Status:</strong> <span class="order-status status-${order.status}">${order.status}</span></p>
            ${order.orderNotes ? `<p><strong>Notes:</strong> ${order.orderNotes}</p>` : ''}
        </div>
    `;
    
    orderModal.style.display = 'flex';
}

function closeOrderModalFunc() {
    orderModal.style.display = 'none';
}

// Update profile statistics
function updateProfileStats() {
    // Total orders
    const totalOrders = userProfile.totalOrders || userOrders.length;
    document.getElementById('total-orders').textContent = totalOrders;
    
    // Saved addresses
    document.getElementById('saved-addresses').textContent = userAddresses.length;
    
    // Last order date
    const lastOrderDate = userProfile.lastOrderDate;
    if (lastOrderDate) {
        try {
            const date = new Date(lastOrderDate);
            document.getElementById('last-order-date').textContent = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch (error) {
            document.getElementById('last-order-date').textContent = 'Never';
        }
    } else {
        document.getElementById('last-order-date').textContent = 'Never';
    }
}

// Utility Functions
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'N/A';
    }
}

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

// Real-time validation functions
function validateAddressField(e) {
    const field = e.target;
    const fieldId = field.id;
    const value = field.value.trim();
    const errorElement = document.getElementById(fieldId.replace('address-', '') + '-error');
    
    if (!errorElement) return;
    
    let isValid = true;
    let errorMessage = '';
    
    switch (fieldId) {
        case 'address-title':
            if (!value) {
                isValid = false;
                errorMessage = 'Address title is required';
            }
            break;
        case 'address-name':
            if (!value) {
                isValid = false;
                errorMessage = 'Full name is required';
            }
            break;
        case 'address-phone':
            if (!value) {
                isValid = false;
                errorMessage = 'Phone number is required';
            }
            break;
        case 'address-street':
            if (!value) {
                isValid = false;
                errorMessage = 'Street address is required';
            }
            break;
        case 'address-city':
            if (!value) {
                isValid = false;
                errorMessage = 'City is required';
            }
            break;
        case 'address-postal':
            if (!value) {
                isValid = false;
                errorMessage = 'Postal code is required';
            }
            break;
        case 'address-type':
            if (!value) {
                isValid = false;
                errorMessage = 'Address type is required';
            }
            break;
    }
    
    if (!isValid) {
        errorElement.textContent = errorMessage;
        errorElement.classList.add('show');
    } else {
        errorElement.textContent = '';
        errorElement.classList.remove('show');
    }
}

function clearAddressFieldError(e) {
    const fieldId = e.target.id;
    const errorElement = document.getElementById(fieldId.replace('address-', '') + '-error');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.remove('show');
    }
}

// Global functions for onclick handlers
window.viewOrderDetails = viewOrderDetails;
window.editAddress = openAddressModal;
window.deleteAddress = async (addressId) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    
    try {
        userAddresses = userAddresses.filter(addr => addr.id !== addressId);
        localStorage.setItem('userAddresses', JSON.stringify(userAddresses));
        renderAddresses();
        updateProfileStats(); // Update statistics after address deletion
        showToast('Address deleted successfully!');
    } catch (error) {
        console.error('Error deleting address:', error);
        showToast('Error deleting address', true);
    }
}; 