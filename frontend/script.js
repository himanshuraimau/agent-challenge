// API base URL
const API_BASE_URL = "http://localhost:8080";

// DOM elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const privateKeyInput = document.getElementById('privateKey');
const loadingOverlay = document.getElementById('loadingOverlay');
const modelSelector = document.getElementById('modelSelector');
const modelCategoryFilter = document.getElementById('modelCategoryFilter');

// Global state
let availableModels = [];
let modelCategories = [];

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Load saved private key from localStorage
    const savedKey = localStorage.getItem('nosana_private_key');
    if (savedKey) {
        privateKeyInput.value = savedKey;
    }
    
    // Enter key sends message
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Load model categories and populate filter dropdown
    loadModelData();
    
    // Set up category filter change handler
    if (modelCategoryFilter) {
        modelCategoryFilter.addEventListener('change', filterModelsByCategory);
    }
});

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

// Send message function
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, 'user');
    
    // Clear input and disable send button
    messageInput.value = '';
    sendButton.disabled = true;
    
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
        
    } catch (error) {
        console.error('Error:', error);
        addMessage(`Error: ${error.message}`, 'bot');
    } finally {
        hideLoading();
        sendButton.disabled = false;
        messageInput.focus();
    }
}

// Add message to chat
function addMessage(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Format links in the content
    const formattedContent = content.replace(
        /(https?:\/\/[^\s]+)/g, 
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Look for JSON data to format nicely
    let processedContent = formattedContent;
    const jsonRegex = /{[\s\S]*}/;
    const jsonMatch = content.match(jsonRegex);
    
    if (jsonMatch) {
        try {
            const jsonData = JSON.parse(jsonMatch[0]);
            const prettyJson = JSON.stringify(jsonData, null, 2);
            processedContent = formattedContent.replace(
                jsonRegex, 
                `<pre class="code-block"><code>${prettyJson}</code></pre>`
            );
        } catch (error) {
            // Not valid JSON, keep original content
            console.log("Not valid JSON in message:", error.message);
        }
    }
    
    // Add appropriate icons
    let iconPrefix = '';
    if (type === 'bot') {
        iconPrefix = '<div class="message-icon"><i class="fa-solid fa-robot"></i></div>';
    } else if (type === 'user') {
        iconPrefix = '<div class="message-icon"><i class="fa-solid fa-user"></i></div>';
    }
    
    messageContent.innerHTML = processedContent;
    
    if (iconPrefix) {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'message-icon-wrapper';
        iconDiv.innerHTML = iconPrefix;
        messageDiv.appendChild(iconDiv);
    }
    
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // Add timestamp
    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    const now = new Date();
    timestamp.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    messageContent.appendChild(timestamp);
    
    // Scroll to bottom with animation
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: 'smooth'
    });
}

// Show loading overlay
function showLoading() {
    const loadingContent = document.querySelector('.loading-content p');
    loadingContent.innerHTML = '<strong>Running Nosana Job on GPU Network</strong><br>Setting up ATA accounts, executing GPU job...';
    loadingOverlay.classList.add('show');
    
    // Add progress animation
    setTimeout(() => {
        if (loadingOverlay.classList.contains('show')) {
            loadingContent.innerHTML = '<strong>Running Nosana Job on GPU Network</strong><br>Waiting for job completion...';
        }
    }, 3000);
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.classList.remove('show');
}

// Load model categories and models from API
async function loadModelData() {
    try {
        // We'll simulate this API call for now since we're using the agent's tools directly
        // In production, this would be an actual API endpoint
        
        // Add a system message about model loading
        addSystemMessage("Loading available models...");
        
        // In a real implementation, we'd fetch this data from the backend
        // For now, we'll add a placeholder message
        addSystemMessage("Model selection is available through the chat interface. Ask the agent 'What models can I run?' to see options.");
    } catch (error) {
        console.error('Error loading model data:', error);
        addSystemMessage("Failed to load models. Please try again later.");
    }
}

// Filter models by category
function filterModelsByCategory() {
    if (!modelCategoryFilter || !modelSelector) return;
    
    const selectedCategory = modelCategoryFilter.value;
    
    // Clear current options
    modelSelector.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a model...';
    modelSelector.appendChild(defaultOption);
    
    // Filter and add models
    const filteredModels = selectedCategory === 'all' 
        ? availableModels 
        : availableModels.filter(model => model.category === selectedCategory);
    
    filteredModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = `${model.name}${model.vramRequired ? ` (${model.vramRequired}GB VRAM)` : ''}`;
        modelSelector.appendChild(option);
    });
}
