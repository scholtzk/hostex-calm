import { onRequest } from "firebase-functions/v2/https";
import * as cors from "cors";

// Initialize CORS with specific origin for development
const corsHandler = cors({
  origin: ["http://localhost:8084", "http://localhost:3000", "http://localhost:5173"],
  credentials: true,
});

// Sample booking data
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

export const bookings = onRequest({ cors: true }, (request, response) => {
  corsHandler(request, response, () => {
    if (request.method === "GET") {
      response.json(sampleBookings);
    } else {
      response.status(405).json({ error: "Method not allowed" });
    }
  });
});