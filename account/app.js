import { db } from '../firebase-config.js';
import { auth } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

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
const loginPhoneBtn = document.getElementById('login-phone-btn');
const logoutBtn = document.getElementById('logout-btn');

// Phone login modal elements
const phoneLoginModal = document.getElementById('phone-login-modal');
const closePhoneModal = document.getElementById('close-phone-modal');
const cancelPhoneBtn = document.getElementById('cancel-phone-btn');
const sendOtpBtn = document.getElementById('send-otp-btn');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const otpSection = document.getElementById('otp-section');
const phoneNameInput = document.getElementById('phone-name');
const phoneGenderSelect = document.getElementById('phone-gender');
const phoneEmailInput = document.getElementById('phone-email');
const phoneNumberInput = document.getElementById('phone-number');
const otpCodeInput = document.getElementById('otp-code');

let recaptchaVerifierInstance = null;
let confirmationResultGlobal = null;
let lastOtpSentAtMs = 0;
const OTP_SEND_COOLDOWN_MS = 60_000; // 60s cooldown to avoid repeated challenges
let isCompleteProfileOpen = false;

// Complete profile modal elements
const completeProfileModal = document.getElementById('complete-profile-modal');
const closeCompleteProfile = document.getElementById('close-complete-profile');
const completeProfileForm = document.getElementById('complete-profile-form');
const cpSaveBtn = document.getElementById('cp-save-btn');
const cpCancelBtn = document.getElementById('cp-cancel-btn');
const cpNameInput = document.getElementById('cp-name');
const cpGenderSelect = document.getElementById('cp-gender');
const cpPhoneInput = document.getElementById('cp-phone');
const cpEmailInput = document.getElementById('cp-email');
const cpNameGroup = document.getElementById('cp-name-group');
const cpGenderGroup = document.getElementById('cp-gender-group');
const cpPhoneGroup = document.getElementById('cp-phone-group');
const cpEmailGroup = document.getElementById('cp-email-group');

// Initialize account page
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializeAuth();
    // Pre-initialize a single invisible reCAPTCHA widget once per page load
    ensureInvisibleRecaptcha();
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
                userProfile = null; // Will trigger first-time profile completion
            }
            // If user has profile, patch missing display fields for UI only
            if (userProfile) {
                if (!userProfile.name) userProfile.name = user.displayName || '';
                if (!userProfile.email) userProfile.email = user.email || '';
            }
            await loadUserOrders();
            renderProfile();
            renderOrders();
            switchTab('orders');

            // If no user profile exists, force profile completion flow with correct method
            if (!userSnap.exists()) {
                const via = detectLoginMethod(user);
                const prefill = buildPrefillForMethod(user, via);
                openCompleteProfileModal(user, { via, prefill });
            }
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
    if (loginPhoneBtn) loginPhoneBtn.addEventListener('click', () => {
        phoneLoginModal.style.display = 'flex';
        // Prefill +880 and attach input guards
        if (phoneNumberInput) {
            phoneNumberInput.value = '+880';
            sendOtpBtn.disabled = true;
            attachPhoneInputGuards();
        }
        ensureInvisibleRecaptcha();
    });
    logoutBtn.addEventListener('click', handleLogout);

    // Phone login modal open/close
    if (closePhoneModal) closePhoneModal.addEventListener('click', () => phoneLoginModal.style.display = 'none');
    if (cancelPhoneBtn) cancelPhoneBtn.addEventListener('click', () => phoneLoginModal.style.display = 'none');
    if (sendOtpBtn) sendOtpBtn.addEventListener('click', onSendOtpClick);
    if (verifyOtpBtn) verifyOtpBtn.addEventListener('click', onVerifyOtpClick);

    // Complete profile modal events
    if (closeCompleteProfile) closeCompleteProfile.addEventListener('click', () => { completeProfileModal.style.display = 'none'; isCompleteProfileOpen = false; });
    if (cpCancelBtn) cpCancelBtn.addEventListener('click', () => { completeProfileModal.style.display = 'none'; isCompleteProfileOpen = false; });
    if (completeProfileForm) completeProfileForm.addEventListener('submit', onCompleteProfileSubmit);
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

function detectLoginMethod(user) {
    try {
        const providers = user?.providerData?.map(p => p.providerId) || [];
        if (providers.includes('phone')) return 'phone';
        if (providers.includes('google.com')) return 'google';
        return user?.phoneNumber ? 'phone' : 'google';
    } catch (_) {
        return user?.phoneNumber ? 'phone' : 'google';
    }
}

function buildPrefillForMethod(user, via) {
    if (via === 'phone') {
        return { phone: user.phoneNumber || '', email: user.email || '', name: user.displayName || '', gender: '' };
    }
    return { name: user.displayName || '', email: user.email || '', phone: '', gender: '' };
}

function openCompleteProfileModal(user, options = { via: 'phone', prefill: {} }) {
    if (isCompleteProfileOpen) return;
    // Configure which fields are required based on login method
    const via = options.via || 'phone';
    const pre = options.prefill || {};

    // Phone login: require name, gender, optional email, phone prefilled and locked
    // Google login: require phone, name optional (prefilled), gender optional, email prefilled optional
    if (via === 'phone') {
        cpPhoneGroup.style.display = 'block';
        cpEmailGroup.style.display = 'block';
        cpNameGroup.style.display = 'block';
        cpGenderGroup.style.display = 'block';
        cpPhoneInput.value = pre.phone || user.phoneNumber || '';
        cpEmailInput.value = pre.email || user.email || '';
        cpNameInput.value = pre.name || '';
        cpGenderSelect.value = pre.gender || '';
        cpPhoneInput.disabled = true; // phone verified via OTP
    } else if (via === 'google') {
        cpPhoneGroup.style.display = 'block';
        cpEmailGroup.style.display = 'block';
        cpNameGroup.style.display = 'block';
        cpGenderGroup.style.display = 'block';
        // Prefill +880 and allow typing remaining digits
        cpPhoneInput.value = pre.phone || '+880';
        cpEmailInput.value = pre.email || user.email || '';
        cpNameInput.value = pre.name || user.displayName || '';
        cpGenderSelect.value = pre.gender || '';
        cpPhoneInput.disabled = false;
        attachCPPhoneInputGuards();
    }

    completeProfileModal.style.display = 'flex';
    isCompleteProfileOpen = true;
}

async function onCompleteProfileSubmit(e) {
    e.preventDefault();
    if (!auth.currentUser) return;

    const name = cpNameInput.value.trim();
    const gender = cpGenderSelect.value;
    const email = cpEmailInput.value.trim();
    const phoneNormalized = normalizeBangladeshPhoneNumber(cpPhoneInput.value.trim()) || cpPhoneInput.value.trim();

    // Minimal validation: phone required always for google path
    if (!phoneNormalized) {
        showToast('Please provide a valid phone number', true);
        return;
    }

    try {
        cpSaveBtn.disabled = true;
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const profilePayload = {
            name: name || auth.currentUser.displayName || '',
            phone: auth.currentUser.phoneNumber || phoneNormalized,
            email: email || auth.currentUser.email || '',
            gender: gender || '',
            updatedAt: serverTimestamp()
        };
        await setDoc(userDocRef, profilePayload, { merge: true });
        userProfile = profilePayload;
        completeProfileModal.style.display = 'none';
        isCompleteProfileOpen = false;
        renderProfile();
        showToast('Profile completed successfully');
    } catch (err) {
        console.error('complete profile error', err);
        showToast('Failed to save profile', true);
    } finally {
        cpSaveBtn.disabled = false;
    }
}
// Profile Management
function renderProfile() {
    const displayName = userProfile?.name || currentUser?.displayName || 'User Name';
    const displayPhone = userProfile?.phone || currentUser?.phoneNumber || '+8801XXXXXXXXX';
    profileNameDisplay.textContent = displayName;
    profilePhoneDisplay.textContent = displayPhone;
    profileImg.src = currentUser?.photoURL || 'https://ui-avatars.com/api/?name=' + (displayName || 'User');
    // Populate modal form
    document.getElementById('profile-name').value = userProfile?.name || '';
    document.getElementById('profile-phone').value = userProfile?.phone || '';
    document.getElementById('profile-email').value = userProfile?.email || '';
    document.getElementById('profile-gender').value = userProfile?.gender || '';
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
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);
        if (!userSnap.exists()) {
            openCompleteProfileModal(user, {
                via: 'google',
                prefill: {
                    name: user.displayName || '',
                    email: user.email || '',
                    phone: '',
                    gender: ''
                }
            });
        }
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
function ensureInvisibleRecaptcha() {
    try {
        if (recaptchaVerifierInstance) return recaptchaVerifierInstance;
        // Use stable hidden container so we always reuse the same invisible widget
        recaptchaVerifierInstance = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
            callback: () => {},
        });
        return recaptchaVerifierInstance;
    } catch (e) {
        console.error('Failed to init reCAPTCHA', e);
        showToast('Failed to initialize verification. Please refresh.', true);
        return null;
    }
}

function attachPhoneInputGuards() {
    if (!phoneNumberInput) return;
    const PREFIX = '+880';

    const isValidBangladeshE164 = (value) => /^\+8801\d{9}$/.test(value);

    const enforce = () => {
        let v = phoneNumberInput.value || '';
        // Remove any non-digit except leading +
        v = v.replace(/(?!^)[^\d]/g, '');
        if (!v.startsWith('+')) v = '+' + v;
        if (!v.startsWith(PREFIX)) {
            // If user pasted local format, normalize into +880
            const digits = v.replace(/\D/g, '');
            if (/^01\d{9}$/.test(digits)) {
                v = PREFIX + digits.slice(1);
            } else if (/^8801\d{9}$/.test(digits)) {
                v = '+' + digits;
            } else if (/^1\d{9}$/.test(digits)) {
                v = PREFIX + '1' + digits.slice(1);
            } else {
                v = PREFIX;
            }
        }
        // Keep only 10 digits after +880
        const after = v.slice(PREFIX.length).replace(/\D/g, '').slice(0, 10);
        v = PREFIX + after;
        phoneNumberInput.value = v;
        // Enable/disable send button based on validity
        sendOtpBtn.disabled = !isValidBangladeshE164(v);
    };

    const preventPrefixDeletion = (e) => {
        const start = phoneNumberInput.selectionStart || 0;
        if ((e.key === 'Backspace' && start <= 4) || (e.key === 'Delete' && start < 4)) {
            e.preventDefault();
            phoneNumberInput.setSelectionRange(4, 4);
        }
    };

    phoneNumberInput.removeEventListener('input', enforce);
    phoneNumberInput.removeEventListener('keydown', preventPrefixDeletion);
    phoneNumberInput.addEventListener('input', enforce);
    phoneNumberInput.addEventListener('keydown', preventPrefixDeletion);
    // Initial enforce
    enforce();
}

function attachCPPhoneInputGuards() {
    if (!cpPhoneInput) return;
    const PREFIX = '+880';

    const isValidBangladeshE164 = (value) => /^\+8801\d{9}$/.test(value);

    const enforce = () => {
        let v = cpPhoneInput.value || '';
        v = v.replace(/(?!^)[^\d]/g, '');
        if (!v.startsWith('+')) v = '+' + v;
        if (!v.startsWith(PREFIX)) {
            const digits = v.replace(/\D/g, '');
            if (/^01\d{9}$/.test(digits)) {
                v = PREFIX + digits.slice(1);
            } else if (/^8801\d{9}$/.test(digits)) {
                v = '+' + digits;
            } else if (/^1\d{9}$/.test(digits)) {
                v = PREFIX + '1' + digits.slice(1);
            } else {
                v = PREFIX;
            }
        }
        const after = v.slice(PREFIX.length).replace(/\D/g, '').slice(0, 10);
        v = PREFIX + after;
        cpPhoneInput.value = v;
    };

    const preventPrefixDeletion = (e) => {
        const start = cpPhoneInput.selectionStart || 0;
        if ((e.key === 'Backspace' && start <= 4) || (e.key === 'Delete' && start < 4)) {
            e.preventDefault();
            cpPhoneInput.setSelectionRange(4, 4);
        }
    };

    cpPhoneInput.removeEventListener('input', enforce);
    cpPhoneInput.removeEventListener('keydown', preventPrefixDeletion);
    cpPhoneInput.addEventListener('input', enforce);
    cpPhoneInput.addEventListener('keydown', preventPrefixDeletion);
    enforce();
}

function normalizeBangladeshPhoneNumber(inputValue) {
    if (!inputValue) return '';
    const trimmed = inputValue.trim();
    const onlyDigits = trimmed.replace(/\D/g, '');
    // If user already typed with plus sign, trust E.164 as long as it starts with +8801XXXXXXXXX
    if (trimmed.startsWith('+')) {
        const cleaned = '+' + onlyDigits;
        return /^\+8801\d{9}$/.test(cleaned) ? cleaned : '';
    }
    // If starts with 8801XXXXXXXXX
    if (/^8801\d{9}$/.test(onlyDigits)) {
        return '+' + onlyDigits;
    }
    // If starts with 01XXXXXXXXX (common local format)
    if (/^01\d{9}$/.test(onlyDigits)) {
        return '+880' + onlyDigits.slice(1);
    }
    // If user entered 1XXXXXXXXX (missing leading 0)
    if (/^1\d{9}$/.test(onlyDigits)) {
        return '+8801' + onlyDigits.slice(1);
    }
    return '';
}

async function onSendOtpClick() {
    // Throttle to reduce repeated reCAPTCHA challenges
    const now = Date.now();
    if (now - lastOtpSentAtMs < OTP_SEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((OTP_SEND_COOLDOWN_MS - (now - lastOtpSentAtMs)) / 1000);
        showToast(`Please wait ${waitSec}s before requesting another code.`);
        return;
    }
    const phoneNumberRaw = phoneNumberInput.value.trim();
    const phoneNumber = normalizeBangladeshPhoneNumber(phoneNumberRaw);

    if (!phoneNumber) { showToast('Please enter a valid Bangladesh number (e.g., 01XXXXXXXXX)', true); return; }

    const verifier = ensureInvisibleRecaptcha();
    if (!verifier) return;

    try {
        sendOtpBtn.disabled = true;
        confirmationResultGlobal = await signInWithPhoneNumber(auth, phoneNumber, verifier);
        lastOtpSentAtMs = Date.now();
        otpSection.style.display = 'block';
        // Show normalized number back to user for clarity
        phoneNumberInput.value = phoneNumber;
        showToast('Verification code sent');
    } catch (error) {
        console.error('send otp error', error);
        showToast('Failed to send code. Check number format with country code.', true);
    }
    finally {
        sendOtpBtn.disabled = false;
    }
}

async function onVerifyOtpClick() {
    const code = otpCodeInput.value.trim();
    if (!code || !confirmationResultGlobal) {
        showToast('Enter the code from SMS', true);
        return;
    }
    try {
        verifyOtpBtn.disabled = true;
        const result = await confirmationResultGlobal.confirm(code);
        const user = result.user;
        // After OTP success, check if profile exists; if exists -> normal flow, else -> open completion
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);
        phoneLoginModal.style.display = 'none';
        otpSection.style.display = 'none';
        otpCodeInput.value = '';

        if (userSnap.exists()) {
            showToast('Logged in successfully');
        } else {
            openCompleteProfileModal(user, {
                via: 'phone',
                prefill: {
                    phone: user.phoneNumber || normalizeBangladeshPhoneNumber(phoneNumberInput.value.trim()) || phoneNumberInput.value.trim(),
                    email: '',
                    name: '',
                    gender: ''
                }
            });
        }
    } catch (error) {
        console.error('verify otp error', error);
        showToast('Invalid code. Please try again.', true);
    }
    finally {
        verifyOtpBtn.disabled = false;
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