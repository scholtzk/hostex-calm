import { useState, useEffect } from 'react';
import { Booking } from '@/types/booking';

export const useBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = async () => {
    try {
      setLoading(true);
      console.log('Loading bookings from Firebase Cloud Function...');
      const response = await fetch('https://us-central1-property-manager-cf570.cloudfunctions.net/bookings');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      // Transform the API data to our Booking interface
      const transformedBookings: Booking[] = data.map((booking: any) => ({
        id: booking.id || Math.random().toString(36).substr(2, 9),
        guestName: booking.guestName || booking.guest_name || 'Unknown Guest',
        checkIn: booking.checkIn || booking.check_in,
        checkOut: booking.checkOut || booking.check_out,
        guests: booking.guests || booking.guest_count || 1,
        source: booking.source || booking.booking_source || 'Direct',
        status: booking.status || 'confirmed',
        cleaningRequired: booking.cleaningRequired || booking.cleaning_required || true,
        cleaningStatus: booking.cleaningStatus || booking.cleaning_status || 'pending',
        price: booking.price || booking.total_price,
        currency: booking.currency || 'USD',
        phone: booking.phone || booking.guest_phone,
        email: booking.email || booking.guest_email,
        notes: booking.notes || booking.special_requests
      }));
      
      setBookings(transformedBookings);
      setError(null);
    } catch (err) {
      console.error('Error loading bookings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  return { bookings, loading, error, refetch: loadBookings };
};