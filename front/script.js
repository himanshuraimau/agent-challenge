// API base URL - can be overridden by config.js
const API_BASE_URL = window.CONFIG?.API_BASE_URL || "http://localhost:8080";

// DOM elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const privateKeyInput = document.getElementById('privateKey');
const loadingOverlay = document.getElementById('loadingOverlay');
const suggestedQuestions = document.getElementById('suggestedQuestions');
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const sidebar = document.getElementById('sidebar');
const errorNotification = document.getElementById('errorNotification');
const successNotification = document.getElementById('successNotification');

// State management
let isLoading = false;
let messageHistory = [];
let messageCounter = 0;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Load saved private key from localStorage
    const savedKey = localStorage.getItem('nosana_private_key');
    if (savedKey) {
        privateKeyInput.value = savedKey;
    }
    
    // Setup basic event listeners
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Hide suggested questions after first message
    messageInput.addEventListener('input', () => {
        if (messageInput.value.trim()) {
            hideSuggestedQuestions();
        }
        updateSendButtonState();
    });
    
    // Initialize other components
    initializeApp();
    setupEventListeners();
    setupAccessibility();
    loadSavedData();
    showWelcomeAnimation();
});

// Initialize application
function initializeApp() {
    updateSendButtonState();
    messageInput.focus();
    setupMobileMenu();
    setupKeyboardShortcuts();
    updateNetworkStats();
    
    // Update network stats every 30 seconds
    setInterval(updateNetworkStats, 30000);
}

// Show welcome animation
function showWelcomeAnimation() {
    const welcomeMessage = document.querySelector('.message.bot');
    if (welcomeMessage) {
        setTimeout(() => {
            welcomeMessage.style.animationDelay = '0.5s';
        }, 100);
    }
}

// Setup event listeners
function setupEventListeners() {
    messageInput.addEventListener('input', handleInputChange);
    messageInput.addEventListener('keydown', handleInputKeydown);
    
    const form = document.querySelector('.chat-input-wrapper');
    form.addEventListener('submit', handleFormSubmit);
    
    privateKeyInput.addEventListener('input', debounce(savePrivateKey, 500));
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeunload', saveAppState);
    
    document.addEventListener('click', handleOutsideClick);
    
    // Attach button functionality
    const attachButton = document.getElementById('attachButton');
    if (attachButton) {
        attachButton.addEventListener('click', handleAttachFile);
    }
}

// Setup accessibility features
function setupAccessibility() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                const newMessage = Array.from(mutation.addedNodes).find(node => 
                    node.nodeType === Node.ELEMENT_NODE && node.classList.contains('message')
                );
                if (newMessage) {
                    announceToScreenReader(newMessage.textContent);
                }
            }
        });
    });
    
    observer.observe(chatMessages, { childList: true });
    setupModalFocusManagement();
}

// Setup mobile menu functionality
function setupMobileMenu() {
    mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    
    sidebar.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && e.target.tagName === 'A') {
            closeMobileMenu();
        }
    });
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (sidebar.classList.contains('open')) {
                closeMobileMenu();
            } else if (loadingOverlay.classList.contains('show')) {
                hideLoading();
            } else if (errorNotification.classList.contains('show')) {
                hideError();
            } else if (successNotification.classList.contains('show')) {
                hideSuccess();
            }
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            messageInput.focus();
        }
        
        // Clear chat with Ctrl/Cmd + K
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            clearChat();
        }
    });
}

// Load saved data from localStorage
function loadSavedData() {
    const savedKey = localStorage.getItem('nosana_private_key');
    if (savedKey) {
        privateKeyInput.value = savedKey;
    }
    
    const savedHistory = localStorage.getItem('nosana_message_history');
    if (savedHistory) {
        try {
            messageHistory = JSON.parse(savedHistory);
            // Restore recent messages (last 10)
            const recentMessages = messageHistory.slice(-10);
            recentMessages.forEach(msg => {
                if (msg.role !== 'system') {
                    addMessage(msg.content, msg.role === 'user' ? 'user' : 'bot', false);
                }
            });
        } catch (error) {
            console.warn('Failed to load message history:', error);
        }
    }
}

// Save application state
function saveAppState() {
    savePrivateKey();
    saveMessageHistory();
}

// Handle input changes
function handleInputChange() {
    updateSendButtonState();
    
    if (messageInput.value.trim() && suggestedQuestions.style.display !== 'none') {
        hideSuggestedQuestions();
    } else if (!messageInput.value.trim() && suggestedQuestions.style.display === 'none') {
        showSuggestedQuestions();
    }
}

// Handle input keydown events
function handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isLoading && messageInput.value.trim()) {
            sendMessage();
        }
    }
}

// Handle form submission
function handleFormSubmit(event) {
    event.preventDefault();
    if (!isLoading && messageInput.value.trim()) {
        sendMessage();
    }
}

// Handle attach file
function handleAttachFile() {
    showSuccess('File attachment feature coming soon! 📎');
}

// Update send button state
function updateSendButtonState() {
    const hasContent = messageInput.value.trim().length > 0;
    sendButton.disabled = !hasContent || isLoading;
}

// Handle window resize
function handleResize() {
    if (window.innerWidth > 768) {
        closeMobileMenu();
    }
}

// Handle clicks outside sidebar
function handleOutsideClick(e) {
    if (window.innerWidth <= 768 && 
        sidebar.classList.contains('open') && 
        !sidebar.contains(e.target) && 
        !mobileMenuToggle.contains(e.target)) {
        closeMobileMenu();
    }
}

// Toggle mobile menu
function toggleMobileMenu() {
    const isOpen = sidebar.classList.contains('open');
    
    if (isOpen) {
        closeMobileMenu();
    } else {
        openMobileMenu();
    }
}

// Open mobile menu
function openMobileMenu() {
    sidebar.classList.add('open');
    mobileMenuToggle.classList.add('active');
    mobileMenuToggle.setAttribute('aria-expanded', 'true');
    
    const firstFocusable = sidebar.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
        firstFocusable.focus();
    }
}

// Close mobile menu
function closeMobileMenu() {
    sidebar.classList.remove('open');
    mobileMenuToggle.classList.remove('active');
    mobileMenuToggle.setAttribute('aria-expanded', 'false');
    mobileMenuToggle.focus();
}

// Use suggested question
function useSuggestion(button) {
    const questionText = button.textContent;
    messageInput.value = questionText;
    hideSuggestedQuestions();
    sendMessage();
}

// Toggle private key visibility
function togglePrivateKeyVisibility() {
    const keyInput = document.getElementById('privateKey');
    const toggleBtn = document.getElementById('toggleKey');
    
    if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
        keyInput.type = 'password';
        toggleBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
}

// Hide suggested questions
function hideSuggestedQuestions() {
    if (suggestedQuestions) {
        suggestedQuestions.style.display = 'none';
    }
}

// Clear chat function
function clearChat() {
    const messages = chatMessages.querySelectorAll('.message:not(.message.bot:first-child)');
    messages.forEach(message => {
        message.style.animation = 'slideOut 0.3s ease-in-out forwards';
        setTimeout(() => {
            message.remove();
        }, 300);
    });
    
    messageHistory = [];
    saveMessageHistory();
    showSuggestedQuestions();
    showSuccess('Chat cleared! 🧹');
}

// Send message function
// Send message function
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isLoading) return;
    
    isLoading = true;
    updateSendButtonState();
    hideSuggestedQuestions();
    
    // Add user message to chat
    addMessage(message, 'user');
    
    // Clear input
    messageInput.value = '';
    updateSendButtonState();
    
    // Save private key to localStorage if provided
    const privateKey = privateKeyInput.value.trim();
    if (privateKey) {
        localStorage.setItem('nosana_private_key', privateKey);
    }
    
    // Show loading
    showLoading();
    
    try {
        // Call the Nosana agent API
        const requestBody = {
            messages: [{ 
                role: 'user', 
                content: message
            }]
        };
        
        // If private key is provided, include it in the message (for testing)
        if (privateKey) {
            requestBody.messages[0].content += ` Private key is ${privateKey}`;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/agents/nosanaAgent/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Extract the response text
        const botResponse = data.text || data.content || JSON.stringify(data, null, 2);
        
        // Add bot response to chat
        addMessage(botResponse, 'bot');
        
        // Save to history
        messageHistory.push(
            { role: 'user', content: message, timestamp: Date.now() },
            { role: 'bot', content: botResponse, timestamp: Date.now() }
        );
        
        showSuccess('Response generated successfully! ✨');
        
    } catch (error) {
        console.error('Error:', error);
        const errorMessage = `❌ **Error**: ${error.message}\n\nPlease check that the Nosana Agent server is running on ${API_BASE_URL}`;
        addMessage(errorMessage, 'bot');
        showError(`Error: ${error.message}`);
    } finally {
        isLoading = false;
        hideLoading();
        updateSendButtonState();
        messageInput.focus();
        saveMessageHistory();
    }
}

// Add message to chat with improved accessibility
function addMessage(content, type, animate = true) {
    messageCounter++;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.setAttribute('role', 'article');
    messageDiv.setAttribute('aria-label', `${type === 'user' ? 'Your' : 'Bot'} message`);
    messageDiv.setAttribute('data-message-id', messageCounter);
    
    // Add avatar
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = type === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Format content
    const formattedContent = formatMessageContent(content);
    messageContent.innerHTML = formattedContent;
    
    // Add timestamp
    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    const now = new Date();
    timestamp.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    timestamp.setAttribute('aria-label', `Sent at ${now.toLocaleTimeString()}`);
    messageContent.appendChild(timestamp);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    
    if (!animate) {
        messageDiv.style.animation = 'none';
        messageDiv.style.opacity = '1';
    }
    
    chatMessages.appendChild(messageDiv);
    
    requestAnimationFrame(() => {
        scrollToBottom();
    });
    
    announceToScreenReader(`${type === 'user' ? 'You said' : 'Bot replied'}: ${content}`);
}

// Format message content
function formatMessageContent(content) {
    let formattedContent = content;
    
    // Format links
    formattedContent = formattedContent.replace(
        /(https?:\/\/[^\s]+)/g, 
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Format bold text
    formattedContent = formattedContent.replace(
        /\*\*(.*?)\*\*/g,
        '<strong>$1</strong>'
    );
    
    // Format code blocks
    formattedContent = formattedContent.replace(
        /```(\w+)?\n([\s\S]*?)```/g,
        '<pre class="code-block"><code>$2</code></pre>'
    );
    
    // Format inline code
    formattedContent = formattedContent.replace(
        /`([^`]+)`/g,
        '<code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>'
    );
    
    // Format line breaks
    formattedContent = formattedContent.replace(/\n/g, '<br>');
    
    return formattedContent;
}

// Smooth scroll to bottom of chat
function scrollToBottom() {
    const scrollOptions = {
        top: chatMessages.scrollHeight,
        behavior: 'smooth'
    };
    
    requestAnimationFrame(() => {
        chatMessages.scrollTo(scrollOptions);
    });
}

// Show loading overlay with progress simulation
// Show loading overlay
function showLoading() {
    const loadingContent = document.querySelector('.loading-content p');
    if (loadingContent) {
        loadingContent.innerHTML = '<strong>Running Nosana Job on GPU Network</strong><br>Setting up ATA accounts, executing GPU job...';
    }
    loadingOverlay.classList.add('show');
    
    // Add progress animation
    setTimeout(() => {
        if (loadingOverlay.classList.contains('show') && loadingContent) {
            loadingContent.innerHTML = '<strong>Running Nosana Job on GPU Network</strong><br>Waiting for job completion...';
        }
    }, 3000);
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.classList.remove('show');
}

// Show error notification
function showError(message) {
    const errorMessage = errorNotification.querySelector('.error-message');
    errorMessage.textContent = message;
    errorNotification.classList.add('show');
    
    setTimeout(() => {
        hideError();
    }, 5000);
}

// Hide error notification
function hideError() {
    errorNotification.classList.remove('show');
}

// Show success notification
function showSuccess(message) {
    const successMessage = successNotification.querySelector('.success-message');
    successMessage.textContent = message;
    successNotification.classList.add('show');
    
    setTimeout(() => {
        hideSuccess();
    }, 3000);
}

// Hide success notification
function hideSuccess() {
    successNotification.classList.remove('show');
}

// Update network stats
function updateNetworkStats() {
    const stats = document.querySelectorAll('.stat-value');
    if (stats.length >= 3) {
        // Simulate real-time updates
        const nodes = 1200 + Math.floor(Math.random() * 100);
        const jobs = 45000 + Math.floor(Math.random() * 2000);
        const response = (2.0 + Math.random() * 1.0).toFixed(1);
        
        stats[0].textContent = nodes.toLocaleString();
        stats[1].textContent = jobs.toLocaleString();
        stats[2].textContent = `${response}s`;
    }
}

// Save private key to localStorage
function savePrivateKey() {
    const privateKey = privateKeyInput.value.trim();
    if (privateKey) {
        localStorage.setItem('nosana_private_key', privateKey);
    } else {
        localStorage.removeItem('nosana_private_key');
    }
}

// Save message history
function saveMessageHistory() {
    try {
        const recentHistory = messageHistory.slice(-50);
        localStorage.setItem('nosana_message_history', JSON.stringify(recentHistory));
    } catch (error) {
        console.warn('Failed to save message history:', error);
    }
}

// Announce to screen readers
function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

// Setup modal focus management
function setupModalFocusManagement() {
    const modal = loadingOverlay;
    
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
        }
    });
}

// Debounce utility function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export functions for global access
window.togglePrivateKeyVisibility = togglePrivateKeyVisibility;
window.useSuggestion = useSuggestion;
window.hideError = hideError;
window.hideSuccess = hideSuccess;
window.clearChat = clearChat;

// Service worker registration for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

