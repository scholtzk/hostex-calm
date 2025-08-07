import { useState, useEffect } from 'react';
import { Booking } from '@/types/booking';

export const useBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = async () => {
    try {
      setLoading(true);
      console.log('Loading bookings from local development server...');
      // Updated to use local development server instead of non-existent Cloud Function
      const response = await fetch('http://localhost:5001/bookings');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      // Check if data has reservations array
      if (!data.reservations || !Array.isArray(data.reservations)) {
        throw new Error('Invalid API response format: missing reservations array');
      }
      
      // Transform the API data to our Booking interface
      const transformedBookings: Booking[] = data.reservations.map((reservation: any) => ({
        id: reservation.reservation_code || Math.random().toString(36).substr(2, 9),
        guestName: reservation.guest_name || 'Unknown Guest',
        checkIn: reservation.check_in_date,
        checkOut: reservation.check_out_date,
        guests: reservation.number_of_guests || 1,
        source: reservation.custom_channel?.name || reservation.channel_type || 'Direct',
        status: reservation.status === 'accepted' ? 'confirmed' : reservation.status,
        cleaningRequired: true, // Assume cleaning is always required for property bookings
        cleaningStatus: 'pending',
        price: reservation.rates?.rate?.amount,
        currency: reservation.rates?.rate?.currency || 'JPY',
        phone: reservation.guest_phone,
        email: reservation.guest_email,
        notes: reservation.remarks || reservation.channel_remarks
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