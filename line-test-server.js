const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static('.'));

// Webhook endpoint for LINE
app.post('/webhook', (req, res) => {
  console.log('📥 Webhook received:', JSON.stringify(req.body, null, 2));
  
  const { events } = req.body;
  
  if (events && events.length > 0) {
    events.forEach(event => {
      if (event.type === 'message') {
        console.log('💬 Message from user:', event.source.userId);
        console.log('📝 Message content:', event.message.text);
        
        // Store user ID for testing
        global.lastUserId = event.source.userId;
      }
    });
  }
  
  res.status(200).send('OK');
});

// Get last user ID endpoint
app.get('/last-user-id', (req, res) => {
  res.json({ 
    userId: global.lastUserId || null,
    message: global.lastUserId ? 'User ID captured from webhook' : 'No user ID captured yet'
  });
});

// Proxy endpoint for LINE API
app.post('/api/line/send-message', async (req, res) => {
  try {
    const { lineUserId } = req.body;
    
    if (!lineUserId) {
      return res.status(400).json({ error: 'lineUserId is required' });
    }

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer tBUR276bwxwSwNGscbwMMm7rCxdWsJBIRqcTlzrl//yevZ2LzI2dq4E82jmjCSyTLqQwOsr5Ey4LSTwmMAdEasSWjR/SMsKF2liadsHidFRY9Mn0gqTm4QUaBmc2RWYwIoCim0ZA5dn/k5P4lYIXpQdB04t89/1O/w1cDnyilFU='
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{
          type: 'text',
          text: '🧪 LINE API テスト\n\nこのメッセージが表示されれば、LINE API の統合が正常に動作しています！\n\nテスト日時: ' + new Date().toLocaleString('ja-JP')
        }]
      })
    });

    if (response.ok) {
      const result = await response.json();
      res.json({ 
        success: true, 
        message: 'Test message sent successfully',
        timestamp: new Date().toISOString(),
        result: result
      });
    } else {
      const errorText = await response.text();
      res.status(response.status).json({ 
        error: `LINE API Error: ${response.status}`,
        details: errorText
      });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Failed to send test message',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 LINE API Test Server running on http://localhost:${PORT}`);
  console.log(`📱 Test page: http://localhost:${PORT}/LINE_API_TEST_PROXY.html`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`👤 Get User ID: http://localhost:${PORT}/last-user-id`);
}); 