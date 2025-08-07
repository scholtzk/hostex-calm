const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5001;

// Enable CORS for your localhost development
app.use(cors({
  origin: ["http://localhost:8084", "http://localhost:3000", "http://localhost:5173"],
  credentials: true
}));

app.use(express.json());

// Sample booking data - same as in the Cloud Function
const sampleBookings = {
  reservations: [
    {
      reservation_code: "RSV001",
      guest_name: "John Doe",
      check_in_date: "2024-01-15",
      check_out_date: "2024-01-18",
      number_of_guests: 2,
      channel_type: "Airbnb",
      status: "accepted",
      rates: {
        rate: {
          amount: 15000,
          currency: "JPY"
        }
      },
      guest_phone: "+81-90-1234-5678",
      guest_email: "john.doe@example.com",
      remarks: "Early check-in requested"
    },
    {
      reservation_code: "RSV002",
      guest_name: "Jane Smith",
      check_in_date: "2024-01-20",
      check_out_date: "2024-01-22",
      number_of_guests: 1,
      custom_channel: {
        name: "Booking.com"
      },
      status: "accepted",
      rates: {
        rate: {
          amount: 12000,
          currency: "JPY"
        }
      },
      guest_phone: "+81-90-9876-5432",
      guest_email: "jane.smith@example.com",
      channel_remarks: "VIP guest"
    }
  ]
};

// Bookings endpoint
app.get('/bookings', (req, res) => {
  console.log('GET /bookings - Serving sample booking data');
  res.json(sampleBookings);
});

app.listen(PORT, () => {
  console.log(`Development server running on http://localhost:${PORT}`);
  console.log(`Bookings endpoint: http://localhost:${PORT}/bookings`);
  console.log('CORS enabled for localhost:8084, localhost:3000, localhost:5173');
});

module.exports = app;