export interface Booking {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  source: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  cleaningRequired?: boolean;
  cleaningStatus?: 'pending' | 'completed' | 'not-required';
  price?: number;
  currency?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface CalendarDay {
  date: Date;
  bookings: Booking[];
  hasOverlap: boolean;
  cleaningRequired: boolean;
}

export interface Cleaner {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  flatRate?: number;
  currency?: string;
  isActive: boolean;
  specialties?: string[]; // e.g., ['deep-clean', 'laundry', 'linen-change']
  availability?: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CleaningAssignment {
  id: string;
  bookingId: string;
  cleanerId: string;
  date: string; // ISO date string
  status: 'assigned' | 'in-progress' | 'completed' | 'cancelled';
  estimatedDuration?: number; // in minutes
  actualDuration?: number; // in minutes
  notes?: string;
  completedAt?: string;
  assignedAt: string;
  assignedBy?: string; // user ID who made the assignment
}

export interface CleaningTask {
  id: string;
  type: 'checkout' | 'turnover' | 'maintenance' | 'deep-clean';
  propertyId?: string;
  roomNumber?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedDuration: number; // in minutes
  requirements?: string[]; // e.g., ['linen-change', 'bathroom-deep-clean']
  notes?: string;
  createdAt: string;
  dueDate: string;
  status: 'pending' | 'assigned' | 'in-progress' | 'completed' | 'cancelled';
}

export interface CleanerAvailability {
  id: string;
  cleanerId: string;
  month: string; // Format: "2025-03"
  availableDates: string[]; // Format: ["2025-03-21", "2025-03-22"]
  createdAt: string;
  updatedAt: string;
}

export interface CleanerAvailabilityLink {
  id: string;
  cleanerId: string;
  cleanerName: string;
  month: string; // Format: "2025-03"
  uniqueLink: string; // Unique identifier for the link
  isActive: boolean;
  createdAt: string;
  expiresAt?: string; // Optional expiration date
}