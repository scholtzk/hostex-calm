import { useState, useEffect } from 'react';
import { Booking } from '@/types/booking';

export const useBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  let lastLoadAt: number | null = null;

  const loadBookings = async () => {
    try {
      if (lastLoadAt && Date.now() - lastLoadAt < 5000) return;
      lastLoadAt = Date.now();
      setLoading(true);
      console.log('Loading bookings from Firebase Cloud Function...');
      const response = await fetch('https://us-central1-property-manager-cf570.cloudfunctions.net/bookings?limit=100');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      // Check if data has reservations array
      if (!data.reservations || !Array.isArray(data.reservations)) {
        throw new Error('Invalid API response format: missing reservations array');
      }
      
      // Transform the API data to our Booking interface and filter out cancelled bookings and bookings without guest names
      // Also remove duplicates based on reservation_code
      const uniqueReservations = data.reservations.filter((reservation: any, index: number, self: any[]) => 
        index === self.findIndex((r: any) => r.reservation_code === reservation.reservation_code)
      );

      const transformedBookings: Booking[] = uniqueReservations
        .filter((reservation: any) => 
          reservation.status !== 'cancelled'
        )
        .map((reservation: any) => ({
          id: reservation.reservation_code || Math.random().toString(36).substr(2, 9),
          guestName: reservation.guest_name && reservation.guest_name.trim() !== '' 
            ? reservation.guest_name 
            : `Guest (${reservation.reservation_code?.slice(-8) || 'Unknown'})`,
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