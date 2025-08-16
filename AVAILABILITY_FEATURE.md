# Cleaner Availability Calendar Feature

## Overview

This feature allows cleaners to input their availability for upcoming months through a mobile-optimized calendar interface. Admins can create unique links for each cleaner to access their personal availability calendar.

## Features

### For Cleaners
- **Mobile-optimized calendar**: Designed specifically for phone screens
- **Simple date selection**: Tap days to highlight/unhighlight availability
- **Month navigation**: Browse different months
- **Visual feedback**: Selected dates are highlighted in green with checkmarks
- **Confirmation**: Submit button to save availability

### For Admins
- **Create availability links**: Generate unique links for cleaners
- **Manage links**: View all created links and their status
- **Copy links**: Easy copying to clipboard for sharing
- **Month selection**: Choose which month to create links for
- **Cleaner selection**: Select multiple cleaners at once

## Technical Implementation

### Database Collections

#### `cleaner_availability`
Stores individual cleaner availability data:
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

#### `cleaner_availability_links`
Stores the unique links created for cleaners:
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

### API Endpoints

#### GET `/availability/:cleanerId/:month`
Get cleaner availability for a specific month

#### POST `/availability`
Create or update cleaner availability

#### POST `/availability-links`
Create availability links for multiple cleaners

#### GET `/availability-links/:uniqueLink`
Get availability link details

#### GET `/availability-links`
Get all availability links (admin only)

### Frontend Routes

- `/` - Main admin interface with availability management tab
- `/availability/:uniqueLink` - Cleaner's availability calendar
- `/test-availability` - Test page for development

## Usage

### For Admins

1. **Navigate to Availability Tab**: Click the "Availability" tab in the main interface
2. **Select Month**: Choose which month to create links for
3. **Select Cleaners**: Check the cleaners you want to create links for
4. **Create Links**: Click "Create Availability Links"
5. **Share Links**: Copy the generated links and send them to cleaners

### For Cleaners

1. **Open Link**: Click the unique link sent by admin
2. **View Calendar**: See the month's calendar with current availability
3. **Select Dates**: Tap days to mark as available/unavailable
4. **Submit**: Click "Confirm Availability" to save changes

## Development

### Testing

The feature includes mock data for testing:
- Test cleaner ID: `test-cleaner-id`
- Test unique link: `test-unique-link-1`
- Test month: `2025-01`

Visit `/test-availability` to test the calendar interface.

### Firebase Functions

The availability functions are deployed to Firebase Functions:
- `getCleanerAvailability`
- `updateCleanerAvailability`
- `createAvailabilityLinks`
- `getAvailabilityLink`
- `getAllAvailabilityLinks`

### Mobile Optimization

The calendar is specifically designed for mobile devices:
- Large touch targets
- Responsive grid layout
- Clear visual feedback
- Optimized for thumb navigation

## Future Enhancements

- **Email notifications**: Send reminders to cleaners
- **Bulk operations**: Select multiple dates at once
- **Recurring availability**: Set weekly patterns
- **Availability conflicts**: Warn about overlapping assignments
- **Export functionality**: Download availability reports 