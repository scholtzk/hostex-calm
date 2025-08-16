# Cleaner Management System Setup

This guide will help you set up the Firebase Cloud Functions for the cleaner management system.

## What's Been Created

### 1. Firebase Cloud Functions
- **`getCleaners`** - Get all active cleaners
- **`createCleaner`** - Create a new cleaner
- **`updateCleaner`** - Update cleaner information
- **`getCleaningAssignments`** - Get cleaning assignments with filters
- **`createCleaningAssignment`** - Create a new cleaning assignment
- **`updateCleaningAssignment`** - Update assignment status

### 2. Frontend Components
- **`useCleaners`** hook - Manages cleaner data and assignments
- **`CleaningAssignmentModal`** - Modal for assigning cleaners to tasks
- **Updated `BookingCalendar`** - Now includes cleaning assignment functionality

### 3. Database Structure
- **`cleaners`** collection - Stores cleaner information
- **`cleaning-assignments`** collection - Stores cleaning assignments

## Setup Steps

### Step 1: Deploy Firebase Functions

```bash
# Deploy all functions
npx firebase-tools deploy --only functions

# Or deploy specific functions
npx firebase-tools deploy --only functions:getCleaners,functions:createCleaningAssignment
```

### Step 2: Add Sample Data

You can add sample cleaner data using the provided script:

1. Download your service account key from Firebase Console:
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save as `service-account-key.json` in your project root

2. Install Firebase Admin SDK:
   ```bash
   npm install firebase-admin
   ```

3. Run the sample data script:
   ```bash
   node add-sample-data.js
   ```

### Step 3: Test the Endpoints

You can test the endpoints using curl or Postman:

```bash
# Get all cleaners
curl https://us-central1-property-manager-cf570.cloudfunctions.net/getCleaners

# Create a new cleaner
curl -X POST https://us-central1-property-manager-cf570.cloudfunctions.net/createCleaner \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Yuki Tanaka",
    "phone": "+81-90-1234-5678",
    "email": "yuki.tanaka@example.com",
    "hourlyRate": 2500,
    "specialties": ["deep-clean", "laundry"]
  }'

# Create a cleaning assignment
curl -X POST https://us-central1-property-manager-cf570.cloudfunctions.net/createCleaningAssignment \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "booking_123",
    "cleanerId": "cleaner_id_1",
    "date": "2024-08-25",
    "notes": "Standard checkout cleaning"
  }'
```

## Database Schema

### Cleaners Collection
```javascript
{
  "cleaner_id": {
    "name": "string",
    "phone": "string (optional)",
    "email": "string (optional)",
    "hourlyRate": "number (optional)",
    "currency": "string (default: JPY)",
    "isActive": "boolean (default: true)",
    "specialties": ["string array (optional)"],
    "availability": {
      "monday": "boolean",
      "tuesday": "boolean",
      "wednesday": "boolean",
      "thursday": "boolean",
      "friday": "boolean",
      "saturday": "boolean",
      "sunday": "boolean"
    },
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Cleaning Assignments Collection
```javascript
{
  "assignment_id": {
    "bookingId": "string (required)",
    "cleanerId": "string (required)",
    "date": "string (required, ISO date)",
    "status": "string (assigned|in-progress|completed|cancelled)",
    "estimatedDuration": "number (optional, minutes)",
    "actualDuration": "number (optional, minutes)",
    "notes": "string (optional)",
    "completedAt": "timestamp (optional)",
    "assignedAt": "timestamp",
    "assignedBy": "string (optional, user ID)"
  }
}
```

## Frontend Usage

### Using the Cleaning Assignment Modal

The modal is automatically integrated into the calendar. When you click the "Ten清掃不足" button on cleaning days, it will:

1. Show available cleaners for that date
2. Display booking information
3. Allow you to assign a cleaner to the task
4. Save the assignment to Firestore

### Using the useCleaners Hook

```typescript
import { useCleaners } from '@/hooks/useCleaners';

const MyComponent = () => {
  const { 
    cleaners, 
    assignments, 
    assignCleaner, 
    getAvailableCleaners 
  } = useCleaners();

  // Get available cleaners for a specific date
  const availableCleaners = getAvailableCleaners('2024-08-25');

  // Assign a cleaner
  const handleAssign = async () => {
    try {
      await assignCleaner({
        bookingId: 'booking_123',
        cleanerId: 'cleaner_456',
        date: '2024-08-25',
        notes: 'Special instructions'
      });
    } catch (error) {
      console.error('Failed to assign cleaner:', error);
    }
  };

  return (
    // Your component JSX
  );
};
```

## Security Rules

The Firestore security rules allow read/write access to the cleaner collections. In production, you may want to restrict access based on user authentication:

```javascript
// Example of more restrictive rules
match /cleaners/{cleanerId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.token.admin == true;
}

match /cleaning-assignments/{assignmentId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null;
}
```

## Troubleshooting

### Common Issues

1. **Functions not deploying**: Make sure you're logged in with `npx firebase-tools login`
2. **CORS errors**: The functions include CORS headers, but you may need to adjust them for your domain
3. **Permission errors**: Check that your service account has the necessary permissions

### Debugging

1. Check Firebase Functions logs:
   ```bash
   npx firebase-tools functions:log
   ```

2. Test functions locally:
   ```bash
   npx firebase-tools functions:serve
   ```

## Next Steps

1. **Deploy the functions** to make them available
2. **Add sample data** to test the system
3. **Test the frontend** by clicking the "Ten清掃不足" buttons
4. **Customize the UI** as needed for your specific requirements
5. **Add authentication** if required for your use case

The system is now ready to use! The cleaning assignment modal will appear when you click the "Ten清掃不足" button on days that have checkout bookings requiring cleaning. 