import { onRequest } from "firebase-functions/v2/https";
import * as cors from "cors";
import { getBookings as getBookingsHandler } from "./bookings";

// Initialize CORS with specific origin for development
const corsHandler = cors({
  origin: ["http://localhost:8084", "http://localhost:3000", "http://localhost:5173"],
  credentials: true,
});

export const bookings = onRequest({ cors: true }, (request, response) => {
  corsHandler(request, response, () => {
    // Handle CORS preflight request
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    // Explicitly set CORS headers for actual requests
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === "GET") {
      // Delegate to real Hostex API handler
      return getBookingsHandler(request as any, response);
    }
    response.status(405).json({ error: "Method not allowed" });
  });
});

// Export additional HTTPS functions (v2)
export * from './line-notifications';
export * from './cleaners';
export * from './cleaning-assignments';