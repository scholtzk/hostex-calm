# LINE API Integration Setup Guide

This guide will help you set up LINE API integration for sending automated reminders and schedules to cleaners.

## Overview

The LINE API integration provides:
- **Automated daily reminders** for cleaning assignments
- **Weekly schedule notifications** sent every Monday
- **Interactive messages** with buttons for starting/completing tasks
- **Rich formatting** with Flex Messages for better UX
- **Webhook handling** for cleaner responses

## Prerequisites

1. **LINE Developer Account**: Create an account at [LINE Developers Console](https://developers.line.biz/)
2. **LINE Bot Channel**: Create a Messaging API channel
3. **Firebase Project**: Your existing Firebase project
4. **Domain**: A domain for webhook URL (can use Firebase Hosting)

## Step 1: Create LINE Bot Channel

1. Go to [LINE Developers Console](https://developers.line.biz/)
2. Create a new provider (if you don't have one)
3. Create a new **Messaging API** channel
4. Note down your:
   - **Channel Access Token**
   - **Channel Secret**
   - **Channel ID**

## Step 2: Configure Firebase Functions

### Set LINE API Configuration

```bash
# Set LINE API credentials in Firebase Functions
firebase functions:config:set line.channel_access_token="YOUR_CHANNEL_ACCESS_TOKEN"
firebase functions:config:set line.channel_secret="YOUR_CHANNEL_SECRET"
```

### Deploy Functions

```bash
# Deploy all functions including LINE integration
firebase deploy --only functions
```

## Step 3: Set Up Webhook URL

1. **Deploy your app** to get a public URL
2. **Set webhook URL** in LINE Developers Console:
   ```
   https://your-project-id.cloudfunctions.net/lineWebhook
   ```
3. **Enable webhook** in your LINE channel settings

## Step 4: Update Cleaner Database Schema

Add `lineUserId` field to your cleaners collection:

```javascript
// Example cleaner document
{
  "id": "cleaner_123",
  "name": "Yuki Tanaka",
  "phone": "+81-90-1234-5678",
  "email": "yuki@example.com",
  "lineUserId": "U1234567890abcdef", // LINE User ID
  "isActive": true,
  "hourlyRate": 2500,
  "specialties": ["deep-clean", "laundry"],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## Step 5: Get LINE User IDs for Cleaners

### Method 1: Manual Collection
1. Add your LINE bot as a friend
2. Send a message to the bot
3. Check the webhook logs to get the user ID
4. Update the cleaner's `lineUserId` in Firestore

### Method 2: QR Code Method
1. Create a QR code for your LINE bot
2. Have cleaners scan and add the bot
3. Monitor webhook events to capture user IDs

### Method 3: Programmatic Collection
Create a temporary function to collect user IDs:

```typescript
// Temporary function to collect LINE user IDs
export const collectLineUserIds = functions.https.onRequest(async (req, res) => {
  // This would log user IDs when they first message the bot
  // Remove after collecting all user IDs
});
```

## Step 6: Test the Integration

### Test Individual Functions

```bash
# Test sending a cleaning reminder
curl -X POST https://your-project-id.cloudfunctions.net/sendCleaningReminder \
  -H "Content-Type: application/json" \
  -d '{
    "assignmentId": "assignment_123",
    "cleanerId": "cleaner_456"
  }'

# Test sending weekly schedule
curl -X POST https://your-project-id.cloudfunctions.net/sendWeeklySchedule \
  -H "Content-Type: application/json" \
  -d '{
    "cleanerId": "cleaner_456",
    "weekStart": "2024-01-15"
  }'
```

### Test Scheduled Functions

The scheduled functions will run automatically:
- **Daily reminders**: Every day at 8:00 AM
- **Weekly schedules**: Every Monday at 9:00 AM

## Step 7: Frontend Integration

### Add LINE User ID to Cleaner Management

Update your cleaner management interface to include LINE User ID:

```typescript
// In CleanerManagement.tsx
const [editForm, setEditForm] = useState({
  name: '',
  phone: '',
  email: '',
  flatRate: '',
  specialties: '',
  lineUserId: '' // Add this field
});
```

### Add Manual Notification Buttons

Add buttons to manually send notifications:

```typescript
// Send immediate reminder
const sendReminder = async (assignmentId: string, cleanerId: string) => {
  try {
    const response = await fetch('/sendCleaningReminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId, cleanerId })
    });
    
    if (response.ok) {
      toast.success('Reminder sent successfully');
    }
  } catch (error) {
    toast.error('Failed to send reminder');
  }
};

// Send weekly schedule
const sendSchedule = async (cleanerId: string) => {
  const weekStart = getWeekStart(); // Helper function
  try {
    const response = await fetch('/sendWeeklySchedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cleanerId, weekStart })
    });
    
    if (response.ok) {
      toast.success('Schedule sent successfully');
    }
  } catch (error) {
    toast.error('Failed to send schedule');
  }
};
```

## Message Types

### 1. Cleaning Reminder Message
- **Trigger**: Daily at 8:00 AM or manual
- **Content**: Assignment details, guest info, cleaning date
- **Actions**: "開始" (Start) and "完了" (Complete) buttons
- **Format**: Rich Flex Message with header, body, and footer

### 2. Weekly Schedule Message
- **Trigger**: Every Monday at 9:00 AM or manual
- **Content**: Week's assignments with dates and guest names
- **Actions**: "詳細を見る" (View Details) button
- **Format**: Rich Flex Message with assignment list

### 3. Interactive Responses
- **Start Cleaning**: Updates assignment status to "in-progress"
- **Complete Cleaning**: Updates assignment status to "completed"
- **Confirmation**: Sends confirmation message back to cleaner

## Database Collections

### line-notifications Collection
Tracks all sent notifications:

```javascript
{
  "notification_id": {
    "cleanerId": "string",
    "assignmentId": "string (optional)",
    "weekStart": "string (optional)",
    "messageType": "reminder|schedule|daily_reminder|weekly_schedule",
    "sentAt": "timestamp",
    "status": "sent|failed",
    "assignmentCount": "number (optional)",
    "date": "string (optional)"
  }
}
```

## Security Considerations

1. **Environment Variables**: Store LINE credentials securely
2. **Webhook Validation**: Validate webhook signatures
3. **Rate Limiting**: Implement rate limiting for API calls
4. **Error Handling**: Comprehensive error handling and logging
5. **User Consent**: Ensure cleaners consent to notifications

## Monitoring and Logging

### View Function Logs
```bash
firebase functions:log
```

### Monitor LINE API Usage
- Check LINE Developers Console for usage statistics
- Monitor webhook delivery status
- Track message delivery rates

### Custom Metrics
The system logs all notifications to Firestore for:
- Delivery tracking
- Analytics
- Debugging

## Troubleshooting

### Common Issues

1. **Webhook Not Receiving Events**
   - Check webhook URL is correct
   - Verify domain is HTTPS
   - Check Firebase function logs

2. **Messages Not Sending**
   - Verify Channel Access Token
   - Check user has added bot as friend
   - Validate LINE User ID format

3. **Scheduled Functions Not Running**
   - Check Firebase billing status
   - Verify function deployment
   - Check timezone settings

### Debug Commands

```bash
# Check function configuration
firebase functions:config:get

# View specific function logs
firebase functions:log --only sendDailyReminders

# Test function locally
firebase emulators:start --only functions
```

## Cost Considerations

1. **LINE API**: Free tier includes 1,000 messages/month
2. **Firebase Functions**: Pay per invocation and execution time
3. **Firestore**: Pay per read/write operation
4. **Scheduled Functions**: Count as function invocations

## Next Steps

1. **Deploy the functions** to your Firebase project
2. **Set up LINE bot channel** and get credentials
3. **Configure webhook URL** in LINE Developers Console
4. **Add LINE User IDs** to your cleaner database
5. **Test the integration** with manual function calls
6. **Monitor scheduled functions** for automatic operation
7. **Update frontend** to include LINE User ID management
8. **Add manual notification buttons** for immediate sending

## Support

For LINE API issues:
- [LINE Developers Documentation](https://developers.line.biz/en/docs/)
- [LINE Messaging API Reference](https://developers.line.biz/en/reference/messaging-api/)

For Firebase Functions issues:
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Firebase Console](https://console.firebase.google.com/) 