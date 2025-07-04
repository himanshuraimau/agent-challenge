# Nosana Agent Frontend

A beautiful, modern frontend interface for the Nosana Agent built with HTML, CSS, and JavaScript.

## Features

- **Interactive Chat Interface**: Chat with the Nosana Agent to run distributed GPU jobs
- **Model Selection**: Choose from various AI models across different categories
- **GPU Job Deployment**: Deploy AI models on Nosana's distributed GPU network
- **Modern Design**: Professional UI with gradient colors and smooth animations
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Private Key Management**: Securely store and manage your Solana private key
- **Animated Loading States**: Visual feedback during GPU job execution
- **Smart Message Formatting**: Automatic detection and formatting of code blocks
- **Nosana Branding**: Consistent design aligned with Nosana's visual identity

## Model Selection

The frontend now supports a variety of AI models:

- **Basic Jobs**: Simple test jobs for network verification
- **AI Models**: Large language models like TinyLlama for text generation
- **Image Generation**: Models like Stable Diffusion for creating images
- **Training Tools**: Tools for fine-tuning and training AI models

Users can:

1. Filter models by category using the dropdown
2. Select a specific model to run
3. Provide custom prompts for applicable models
4. Get guidance from the agent on model selection

## API Endpoint

The frontend interacts with the Nosana Agent through a single API endpoint:

```http
POST /api/agents/nosanaAgent/generate
```

This endpoint is used to send messages to the agent and run "Hello World" jobs on the Nosana GPU network.

## How to Use

1. **Start the Mastra server**:

   ```bash
   npm run dev
   ```

2. **Open the frontend**:
   - Navigate to the `frontend` folder
   - Open `index.html` in your web browser
   - Or serve it with a local server:

     ```bash
     # Using Python
     python -m http.server 8080
     
     # Using Node.js (if you have http-server installed)
     npx http-server
     ```

3. **Chat with the Nosana Agent**:
   - Enter your Solana private key (optional)
   - Type a message and send it
   - The agent will execute a "Hello World" job on the Nosana GPU network
   - Review the formatted response, which includes job execution details

4. **Private Key Storage**:
   - Your private key is stored in the browser's localStorage
   - The key remains only on your device and is never sent to the server
   - You can toggle visibility of the private key field for security

## Example Messages

Try these example messages with the Nosana Agent:

- "Run a Hello World job on Nosana"
- "Check my wallet balances for NOS and SOL"
- "Execute a GPU inference job"
- "Get statistics on the Nosana network"
- "What is Nosana and how does it work?"

## Nosana Data

The Nosana Agent provides information about:

- **Job Execution**: Success/failure status and job ID
- **Transaction Details**: Signature and confirmation status
- **SOL Usage**: Information about minimal SOL used for fees
- **NOS Usage**: Information about NOS tokens used for job payment
- **Associated Token Accounts**: Status of ATA setup

## Technical Details

### Frontend Architecture

- **Pure JavaScript**: No frameworks, lightweight and fast
- **CSS Grid & Flexbox**: Modern responsive layout
- **CSS Custom Properties**: Consistent theming system
- **Local Storage**: Secure private key persistence
- **Fetch API**: Modern HTTP requests to backend

### Styling Features

- **CSS Variables**: Consistent color scheme with primary and secondary colors
- **Gradient Backgrounds**: Professional visual design with brand colors
- **Glass Morphism**: Modern UI effect with backdrop-filter
- **Smooth Animations**: Enhanced user experience with subtle transitions
- **Responsive Breakpoints**: Mobile-first design approach

### JavaScript Features

- **Async/Await**: Modern promise handling
- **Error Handling**: Comprehensive error management
- **JSON Formatting**: Automatic detection and formatting of code blocks
- **Secure Storage**: Private key management with localStorage
- **Loading States**: Visual feedback for API calls
- **Message Formatting**: Rich text formatting for weather data
- **Typing Indicators**: Real-time chat experience

## Customization

### Changing Colors
Edit the CSS custom properties in `styles.css`:

```css
:root {
    --primary-color: #3b82f6;
    --secondary-color: #10b981;
    --accent-color: #f59e0b;
    /* ... other colors */
}
```

### Adding New API Endpoints
1. Add a new button in `index.html`
2. Create a corresponding function in `script.js`
3. Follow the existing pattern for error handling and loading states

### Modifying Chat Behavior
- Edit message formatting in the `formatMessage()` function
- Customize typing indicators and animations
- Modify chat history persistence logic

## Browser Compatibility

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Dependencies

### External CDN Resources
- **Font Awesome 6.0.0**: Icons
- **Google Fonts (Inter)**: Typography

### No Build Process Required
The frontend uses vanilla HTML, CSS, and JavaScript with no build step or bundling required.

## Troubleshooting

### Common Issues

1. **API Calls Failing**:
   - Ensure the Mastra server is running (`npm run dev`)
   - Check that the server is accessible at `http://localhost:3000`
   - Verify CORS settings if running from a different origin

2. **Chat History Not Saving**:
   - Check browser's local storage settings
   - Ensure the site has permission to store data

3. **Styling Issues**:
   - Verify Font Awesome and Google Fonts CDN links are accessible
   - Check browser console for CSS loading errors

4. **Mobile Layout Issues**:
   - Ensure viewport meta tag is present
   - Test responsive breakpoints

### Development Tips

- Use browser DevTools to debug API responses
- Check Network tab for failed requests
- Use Console tab to view JavaScript errors
- Inspect Elements to debug CSS layout issues

## Future Enhancements

Potential improvements:

- **Dark/Light Mode Toggle**
- **Weather Maps Integration**
- **Export Chat History**
- **Voice Input/Output**
- **Progressive Web App (PWA)**
- **Real-time Weather Updates**
- **Weather Alerts/Notifications**
- **Multi-language Support**
