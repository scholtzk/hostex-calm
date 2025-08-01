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