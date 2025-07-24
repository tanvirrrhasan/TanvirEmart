import { db } from '../firebase-config.js';
import { auth } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// Global variables
let currentUser = null;
let userProfile = null;
let userOrders = [];
let userAddresses = [];
let editingAddressId = null;

// DOM elements
const navTabs = document.querySelectorAll('.nav-tab');
const accountSections = document.querySelectorAll('.account-section');
// Profile summary elements
const profileNameDisplay = document.getElementById('profile-name-display');
const profilePhoneDisplay = document.getElementById('profile-phone-display');
const profileImg = document.getElementById('profile-img');
const editProfileBtn = document.getElementById('edit-profile-btn');
const profileModal = document.getElementById('profile-modal');
const closeProfileModal = document.getElementById('close-profile-modal');
const profileForm = document.getElementById('profile-form');
const cancelProfileBtn = document.getElementById('cancel-profile-btn');
const ordersList = document.getElementById('orders-list');
const orderStatusFilter = document.getElementById('order-status-filter');
const orderModal = document.getElementById('order-modal');
const closeOrderModal = document.getElementById('close-order-modal');
const loginPrompt = document.getElementById('login-prompt');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

// Initialize account page
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializeAuth();
});

// Initialize account functionality
async function initializeAuth() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            loginPrompt.style.display = 'none';
            document.querySelector('.account-nav').style.display = 'flex';
            editProfileBtn.style.display = 'block';
            logoutBtn.style.display = 'block';
            const userDocRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                userProfile = userSnap.data();
            } else {
                userProfile = {
                    name: user.displayName || '',
                    phone: user.phoneNumber || '',
                    email: user.email || '',
                    gender: '',
                    updatedAt: serverTimestamp()
                };
                await setDoc(userDocRef, userProfile);
            }
            if (!userProfile.name) userProfile.name = user.displayName || '';
            if (!userProfile.email) userProfile.email = user.email || '';
            await loadUserOrders();
            renderProfile();
            renderOrders();
            switchTab('orders');
        } else {
            loginPrompt.style.display = 'block';
            document.querySelector('.account-nav').style.display = 'none';
            accountSections.forEach(sec => sec.style.display = 'none');
            editProfileBtn.style.display = 'none';
            logoutBtn.style.display = 'none';
            profileNameDisplay.textContent = 'Guest User';
            profilePhoneDisplay.textContent = '';
            profileImg.src = 'https://ui-avatars.com/api/?name=Guest';
            userProfile = null;
            userOrders = [];
            userAddresses = [];
        }
    });
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
    
    // Profile modal open/close
    editProfileBtn.addEventListener('click', () => {
        profileModal.style.display = 'flex';
    });
    closeProfileModal.addEventListener('click', () => {
        profileModal.style.display = 'none';
    });
    cancelProfileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        profileModal.style.display = 'none';
        renderProfile();
    });
    // Close modal when clicking outside
    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) profileModal.style.display = 'none';
    });

    // Profile form submit
    profileForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = {
            name: document.getElementById('profile-name').value,
            phone: document.getElementById('profile-phone').value,
            email: document.getElementById('profile-email').value,
            gender: document.getElementById('profile-gender').value,
            updatedAt: serverTimestamp()
        };
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), formData);
            userProfile = { ...userProfile, ...formData };
            renderProfile();
            profileModal.style.display = 'none';
            showToast('Profile updated successfully!');
        } catch (error) {
            showToast('Error updating profile', true);
        }
    });
    
    // Orders filter
    orderStatusFilter.addEventListener('change', filterOrders);
    
    // Order modal
    closeOrderModal.addEventListener('click', closeOrderModalFunc);
    
    // Close modals when clicking outside
    orderModal.addEventListener('click', (e) => {
        if (e.target === orderModal) closeOrderModalFunc();
    });

    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
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
function renderProfile() {
    profileNameDisplay.textContent = userProfile.name || 'User Name';
    profilePhoneDisplay.textContent = userProfile.phone || '+8801XXXXXXXXX';
    profileImg.src = currentUser.photoURL || 'https://ui-avatars.com/api/?name=' + (userProfile.name || 'User');
    // Populate modal form
    document.getElementById('profile-name').value = userProfile.name || '';
    document.getElementById('profile-phone').value = userProfile.phone || '';
    document.getElementById('profile-email').value = userProfile.email || '';
    document.getElementById('profile-gender').value = userProfile.gender || '';
}

// Orders Management
async function loadUserOrders() {
    try {
        const q = query(collection(db, 'orders'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        userOrders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
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
        case 'address-division':
            if (!value) {
                isValid = false;
                errorMessage = 'Division is required';
            }
            break;
        case 'address-district':
            if (!value) {
                isValid = false;
                errorMessage = 'District is required';
            }
            break;
        case 'address-upazila':
            if (!value) {
                isValid = false;
                errorMessage = 'Upazila is required';
            }
            break;
        case 'address-street':
            if (!value) {
                isValid = false;
                errorMessage = 'Street address is required';
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
async function handleLogin() {
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error('Login error:', error);
        showToast('Failed to login. Please try again.', true);
    }
}
async function handleLogout() {
    try {
        await signOut(auth);
        showToast('Logged out successfully');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Failed to logout', true);
    }
}
window.deleteAddress = async (addressId) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'addresses', addressId));
        userAddresses = userAddresses.filter(addr => addr.id !== addressId);
        renderAddresses();
        showToast('Address deleted successfully!');
    } catch (error) {
        console.error('Error deleting address:', error);
        showToast('Error deleting address', true);
    }
}; 