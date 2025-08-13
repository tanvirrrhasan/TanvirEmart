// Tawk.to Professional Chat Widget Integration
console.log('🚀 Initializing Tawk.to chat system...');

document.addEventListener('DOMContentLoaded', () => {
    setupCleanInterface();
    loadTawkToScript();
    
    // Auto-open chat if accessed via message page
    setTimeout(() => {
        if (window.Tawk_API && window.Tawk_API.maximize) {
            window.Tawk_API.maximize();
        }
    }, 2000);
});

function setupCleanInterface() {
    // Clean up the message page interface for full screen chat
    const chatMessages = document.getElementById('chat-messages');
    const messageInputSection = document.querySelector('.message-input-section');
    const quickActions = document.querySelector('.quick-actions');
    const messageHeader = document.querySelector('.message-header');

    // Hide all custom chat elements
    if (messageInputSection) messageInputSection.style.display = 'none';
    if (quickActions) quickActions.style.display = 'none';

    // Update header
    if (messageHeader) {
        messageHeader.innerHTML = '<h1>Customer Support</h1>';
    }

    // Clear the chat messages area for full screen chat
    if (chatMessages) {
        chatMessages.innerHTML = '';
        chatMessages.style.height = 'calc(100vh - 140px)';
        chatMessages.style.padding = '0';
        chatMessages.style.margin = '0';
    }
}

function loadTawkToScript() {
    // Initialize Tawk.to API
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();
    
    // Configure to keep bottom nav visible
    window.Tawk_API.customStyle = {
        zIndex: 999  // Lower than bottom nav (which should be 1000+)
    };
    
    // Set up event handlers
    window.Tawk_API.onLoad = function() {
        console.log('✅ Tawk.to loaded successfully');
        updateStatus('ready', '🟢 Chat Ready!', 'Chat is now available.');
        
        // Show widget on message page and maximize
        if (window.Tawk_API.showWidget) {
            window.Tawk_API.showWidget();
        }
        
        // Add CSS for full screen chat on message page
        const style = document.createElement('style');
        style.textContent = `
            #tawk-to-container {
                z-index: 999 !important;
            }
            .bottom-nav {
                z-index: 1000 !important;
                position: fixed !important;
                bottom: 0 !important;
            }
            /* Full screen chat on message page */
            .tawk-min-container {
                bottom: 80px !important;
            }
            .tawk-chat-panel {
                bottom: 80px !important;
                max-height: calc(100vh - 140px) !important;
                height: calc(100vh - 140px) !important;
                width: 100% !important;
                right: 0 !important;
                left: 0 !important;
                margin: 0 !important;
            }
            .tawk-widget-embedded {
                bottom: 80px !important;
                max-height: calc(100vh - 140px) !important;
                height: calc(100vh - 140px) !important;
                width: 100% !important;
                right: 0 !important;
                left: 0 !important;
                margin: 0 !important;
            }
            /* Hide the minimize button on message page */
            .tawk-min-container .tawk-min-box {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    };
    
    window.Tawk_API.onStatusChange = function(status) {
        console.log('📊 Tawk.to status:', status);
        
        switch(status) {
            case 'online':
                updateStatus('online', '🟢 We\'re Online!', 'Our support team is available for live chat.');
                break;
            case 'away':
                updateStatus('away', '🟡 Currently Away', 'Leave a message and we\'ll respond soon!');
                break;
            case 'offline':
                updateStatus('offline', '🔴 Offline', 'Send us a message and we\'ll get back to you.');
                break;
        }
    };
    
    window.Tawk_API.onChatStarted = function() {
        console.log('💬 Chat started');
    };
    
    // Load the Tawk.to script (only if not already loaded)
    if (!document.querySelector('script[src*="tawk.to"]')) {
        (function() {
            var s1 = document.createElement("script");
            var s0 = document.getElementsByTagName("script")[0];
            s1.async = true;
            s1.src = 'https://embed.tawk.to/689b759f4d892d19222e8a49/1j2fk6tt7';
            s1.charset = 'UTF-8';
            s1.setAttribute('crossorigin', '*');
            s0.parentNode.insertBefore(s1, s0);
            
            console.log('📦 Tawk.to script loaded');
        })();
    }
}

function updateStatus(statusType, title, description) {
    const statusElement = document.querySelector('.chat-status');
    if (statusElement) {
        const colors = {
            ready: '#28a745',
            online: '#28a745',
            away: '#ffc107',
            offline: '#dc3545'
        };
        
        statusElement.innerHTML = `
            <h3 style="color: ${colors[statusType] || '#007bff'}; margin-bottom: 0.5rem;">${title}</h3>
            <p style="margin-bottom: 0;">${description}</p>
        `;
    }
}

// Function to open Tawk.to chat (called from button and nav)
function openTawkChat() {
    if (window.Tawk_API && window.Tawk_API.maximize) {
        window.Tawk_API.maximize();
        console.log('📱 Chat opened via button');
    } else {
        console.log('⏳ Tawk.to not ready yet, retrying...');
        setTimeout(openTawkChat, 1000);
    }
}

// Make function globally available
window.openTawkChat = openTawkChat;

// Show welcome notification
setTimeout(() => {
    console.log('💡 Tawk.to chat widget should appear in bottom-right corner');
}, 3000);