# Property Booking Manager

A comprehensive property management system with booking calendar, cleaner management, and availability tracking.

## Features

### 📅 Booking Calendar
- View and manage property bookings
- Drag-and-drop cleaning assignments
- Visual calendar interface
- Booking status tracking

### 👥 Cleaner Management
- Add, edit, and manage cleaners
- Track cleaner assignments
- Monitor cleaning status
- Cleaner performance metrics

### 📱 Cleaner Availability Calendar (NEW!)
- **Mobile-optimized calendar** for cleaners to input availability
- **Unique links** for each cleaner to access their personal calendar
- **Admin interface** to create and manage availability links
- **Simple date selection** - tap to highlight/unhighlight availability
- **Month navigation** for future planning
- **Visual feedback** with green highlights and checkmarks

## Quick Start

### For Admins
1. Navigate to the **Availability** tab in the main interface
2. Select a month and choose cleaners
3. Create availability links
4. Copy and share the unique links with cleaners

### For Cleaners
1. Click the unique link sent by admin
2. View the month's calendar
3. Tap days to mark as available/unavailable
4. Click "Confirm Availability" to save

## Development

### Prerequisites
- Node.js 20+
- Firebase project setup
- Git

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd hostex-calm

# Install dependencies
npm install

# Start development server
npm run dev
```

### Testing the Availability Feature
Visit `/test-availability` to test the calendar interface with mock data.

### Firebase Functions
The availability functions are deployed to Firebase Functions:
- `getCleanerAvailability`
- `updateCleanerAvailability`
- `createAvailabilityLinks`
- `getAvailabilityLink`
- `getAllAvailabilityLinks`

## Project Structure

```
src/
├── components/
│   ├── AvailabilityCalendar.tsx    # Mobile calendar for cleaners
│   ├── AvailabilityManagement.tsx  # Admin interface for managing links
│   ├── BookingCalendar.tsx         # Main booking calendar
│   └── CleanerManagement.tsx      # Cleaner management interface
├── hooks/
│   ├── useAvailability.ts          # Availability data management
│   ├── useCleaners.ts             # Cleaner data management
│   └── useBookings.ts             # Booking data management
├── pages/
│   ├── Index.tsx                  # Main application
│   └── AvailabilityTest.tsx       # Test page for availability
└── types/
    └── booking.ts                 # TypeScript type definitions
```

## Mobile Optimization

The availability calendar is specifically designed for mobile devices:
- Large touch targets for easy tapping
- Responsive grid layout
- Clear visual feedback
- Optimized for thumb navigation
- Full-screen calendar view

## Database Schema

### Cleaner Availability
```typescript
{
  id: string;
  cleanerId: string;
  month: string; // Format: "2025-03"
  availableDates: string[]; // Format: ["2025-03-21", "2025-03-22"]
  createdAt: string;
  updatedAt: string;
}
```

### Availability Links
```typescript
{
  id: string;
  cleanerId: string;
  cleanerName: string;
  month: string; // Format: "2025-03"
  uniqueLink: string; // UUID for the link
  isActive: boolean;
  createdAt: string;
  expiresAt?: string; // Optional expiration
}
```

## Deployment

### GitHub Pages
The application is designed to be hosted on GitHub Pages. The availability links will work with the deployed URL structure.

### Firebase Functions
Deploy the functions to Firebase:
```bash
cd functions
firebase deploy --only functions
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
