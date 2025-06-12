# Embeddable Chatbot

A React-based chatbot that can be easily embedded into any website using an iframe. Features real-time communication via Socket.IO and responsive design.

## Features

- 🚀 Easy iframe embedding
- 💬 Real-time messaging with Socket.IO
- 📱 Responsive design (20% width/80% height on desktop, 100% on mobile)
- 🎨 Modern UI with typing indicators
- 🔄 Session persistence until page reload
- ⚡ Built with Vite + React + TypeScript

## Quick Start

### Development

1. **Install dependencies:**
   \`\`\`bash
   npm install
   cd server && npm install && cd ..
   \`\`\`

2. **Start the socket server:**
   \`\`\`bash
   cd server
   npm run dev
   \`\`\`

3. **Start the React app:**
   \`\`\`bash
   npm run dev
   \`\`\`

4. **Test embedding:**
   Open `embed-example.html` in your browser to see the chatbot embedded in a sample website.

### Production Deployment

#### Deploy to Vercel

1. **Set environment variables in Vercel:**
   - `PORT`: 3001
   - `VITE_SOCKET_URL`: Your deployed socket server URL
   - `FRONTEND_URL`: Your deployed frontend URL

2. **Deploy:**
   \`\`\`bash
   npm run build
   vercel --prod
   \`\`\`

#### Embedding in Production

Replace the iframe src with your deployed URL:

\`\`\`html
<iframe 
    src="https://your-chatbot.vercel.app" 
    style="position: fixed; bottom: 0; right: 0; width: 100%; height: 100%; border: none; pointer-events: none; z-index: 9999;"
    id="chatbot-iframe">
</iframe>
\`\`\`

## Environment Variables

### Frontend (.env)
\`\`\`
VITE_SOCKET_URL=wss://your-socket-server.com
\`\`\`

### Backend
\`\`\`
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
\`\`\`

## Customization

### Styling
Modify `src/App.css` to customize:
- Colors and branding
- Dimensions and positioning
- Animations and transitions

### AI Integration
Replace the simulated responses in `server/server.js` with actual AI integration:

\`\`\`js
const generateAIResponse = async (message) => {
  // Replace with actual AI API call
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: message }]
    })
  })
  
  const data = await response.json()
  return data.choices[0].message.content
}
\`\`\`

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## License

MIT License - feel free to use in your projects!
