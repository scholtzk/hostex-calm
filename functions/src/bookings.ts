import * as functions from 'firebase-functions';

// GET /bookings - Get all bookings from HostexAPI
export const getBookings = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'GET') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Get query parameters from the request
    const limit = req.query.limit as string || '100'; // Default to 100 (max allowed)
    const offset = req.query.offset as string || '0';
    const startCheckInDate = req.query.start_check_in_date as string;
    const endCheckInDate = req.query.end_check_in_date as string;
    const startCheckOutDate = req.query.start_check_out_date as string;
    const endCheckOutDate = req.query.end_check_out_date as string;
    const status = req.query.status as string || ''; // Default to all statuses
    const useDateRanges = req.query.use_date_ranges as string === 'true'; // New parameter for date range approach

    // Build query parameters
    const params = new URLSearchParams({
      limit,
      offset
    });

    // Add status filter if provided
    if (status) params.append('status', status);

    // Add date filters if provided
    if (startCheckInDate) params.append('start_check_in_date', startCheckInDate);
    if (endCheckInDate) params.append('end_check_in_date', endCheckInDate);
    if (startCheckOutDate) params.append('start_check_out_date', startCheckOutDate);
    if (endCheckOutDate) params.append('end_check_out_date', endCheckOutDate);

    let allReservations: any[] = [];

    if (useDateRanges) {
      // Fetch bookings using 3 date ranges approach
      const dateRanges = [
        { start: '2024-01-01', end: '2025-06-30' }, // Past to mid-2025
        { start: '2025-07-01', end: '2025-12-31' }, // Mid-2025 to end-2025
        { start: '2026-01-01', end: '2026-12-31' }  // 2026
      ];

      for (const range of dateRanges) {
        console.log(`Fetching bookings for date range: ${range.start} to ${range.end}`);
        
        const rangeParams = new URLSearchParams({
          limit: '100',
          offset: '0',
          start_check_in_date: range.start,
          end_check_in_date: range.end
        });

        if (status) rangeParams.append('status', status);

        let currentOffset = 0;
        let requestCount = 0;
        const maxRequests = 5; // Safety limit per range

        while (requestCount < maxRequests) {
          rangeParams.set('offset', currentOffset.toString());
          
          const response = await fetch(`https://api.hostex.io/v3/reservations?${rangeParams.toString()}`, {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer GO5Kxx5vb6SZPXrW7BAhJsomhx5gpgUxd2Trsmgh9FdxJETKyDy2A9YUNDbluzzm',
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error(`HostexAPI responded with status: ${response.status}`);
          }

          const data = await response.json();
          const reservations = data.data?.reservations || [];
          
          console.log(`Fetched ${reservations.length} reservations for range ${range.start}-${range.end} with offset ${currentOffset}`);
          
          allReservations = allReservations.concat(reservations);
          
          if (reservations.length < 100) {
            break;
          }
          
          currentOffset += 100;
          requestCount++;
        }
      }
    } else {
      // Fetch all bookings using pagination (original approach)
      let currentOffset = 0;
      const maxRequests = 10; // Safety limit to prevent infinite loops
      let requestCount = 0;

      while (requestCount < maxRequests) {
        // Update offset for current request
        params.set('offset', currentOffset.toString());
        
        console.log(`Fetching bookings with offset ${currentOffset}...`);
        
        const response = await fetch(`https://api.hostex.io/v3/reservations?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer GO5Kxx5vb6SZPXrW7BAhJsomhx5gpgUxd2Trsmgh9FdxJETKyDy2A9YUNDbluzzm',
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HostexAPI responded with status: ${response.status}`);
        }

        const data = await response.json();
        const reservations = data.data?.reservations || [];
        
        console.log(`Fetched ${reservations.length} reservations with offset ${currentOffset}`);
        
        // Add to our collection
        allReservations = allReservations.concat(reservations);
        
        // If we got fewer than the limit, we've reached the end
        if (reservations.length < parseInt(limit)) {
          break;
        }
        
        // Move to next page
        currentOffset += parseInt(limit);
        requestCount++;
      }
    }

    console.log(`Total reservations fetched: ${allReservations.length}`);
    
    // Return the data in the format expected by the frontend
    res.status(200).json({
      reservations: allReservations
    });
  } catch (error) {
    console.error('Error fetching bookings from HostexAPI:', error);
    res.status(500).json({ error: 'Failed to fetch bookings from HostexAPI' });
  }
}); 