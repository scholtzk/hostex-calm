import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// GET /cleaning-assignments - Get all cleaning assignments
export const getCleaningAssignments = functions.https.onRequest(async (req, res) => {
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

    const { date } = req.query;
    let query: admin.firestore.Query = db.collection('cleaning-assignments');

    // Apply date filter if provided
    if (date) {
      query = query.where('currentCleaningDate', '==', date);
    }

    const assignmentsSnapshot = await query.get();

    const assignments = assignmentsSnapshot.docs.map(doc => ({
      date: doc.data().currentCleaningDate,
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json({ assignments });
  } catch (error) {
    console.error('Error fetching cleaning assignments:', error);
    res.status(500).json({ error: 'Failed to fetch cleaning assignments' });
  }
});

// POST /cleaning-assignments - Create or update a cleaning assignment
export const createOrUpdateCleaningAssignment = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const {
      originalBookingDate,
      currentCleaningDate,
      bookingId,
      guestName,
      cleanerId = null,
      cleanerName = null,
      bookingDateChanged = false
    } = req.body;
    
    // Validate required fields
    if (!originalBookingDate || !currentCleaningDate || !bookingId || !guestName) {
      res.status(400).json({ error: 'originalBookingDate, currentCleaningDate, bookingId, and guestName are required' });
      return;
    }

    // Use composite ID to support multiple bookings with the same date
    const docId = `${originalBookingDate}_${bookingId}`;
    
    const assignmentData = {
      originalBookingDate,
      currentCleaningDate,
      bookingId,
      guestName,
      cleanerId,
      cleanerName,
      bookingDateChanged,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Set the document (creates if doesn't exist, updates if exists)
    await db.collection('cleaning-assignments').doc(docId).set(assignmentData);
    
    res.status(200).json({ 
      date: docId,
      ...assignmentData 
    });
  } catch (error) {
    console.error('Error creating/updating cleaning assignment:', error);
    res.status(500).json({ error: 'Failed to create/update cleaning assignment' });
  }
});

// PATCH /cleaning-assignments/:date - Update cleaner assignment
export const updateCleanerAssignment = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'PATCH') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const date = req.params[0];
    const { cleanerId, cleanerName, bookingId } = req.body;
    
    if (!bookingId) {
      res.status(400).json({ error: 'bookingId is required' });
      return;
    }

    // Find the document by composite key (originalDate + bookingId) or by matching date fields
    const candidates = await db.collection('cleaning-assignments')
      .where('bookingId', '==', bookingId)
      .get();

    if (candidates.empty) {
      res.status(404).json({ error: 'Cleaning assignment not found for booking' });
      return;
    }

    const matchingDoc = candidates.docs.find(doc => {
      const d = doc.data();
      return d.currentCleaningDate === date || d.originalBookingDate === date;
    });

    if (!matchingDoc) {
      res.status(404).json({ error: 'Cleaning assignment not found for given date and booking' });
      return;
    }

    const updateData = {
      cleanerId,
      cleanerName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('cleaning-assignments').doc(matchingDoc.id).update(updateData);
    
    res.status(200).json({ message: 'Cleaner assignment updated successfully' });
  } catch (error) {
    console.error('Error updating cleaner assignment:', error);
    res.status(500).json({ error: 'Failed to update cleaner assignment' });
  }
});

// DELETE /cleaning-assignments/:date - Delete a cleaning assignment
export const deleteCleaningAssignment = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'DELETE') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const date = req.params[0];
    
    // Check if assignment exists
    const assignmentDoc = await db.collection('cleaning-assignments').doc(date).get();
    
    if (!assignmentDoc.exists) {
      res.status(404).json({ error: 'Cleaning assignment not found' });
      return;
    }

    // Delete the assignment
    await db.collection('cleaning-assignments').doc(date).delete();
    
    res.status(200).json({ message: 'Cleaning assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting cleaning assignment:', error);
    res.status(500).json({ error: 'Failed to delete cleaning assignment' });
  }
});

// POST /cleaning-assignments/sync - Sync cleaning assignments from bookings
export const syncCleaningAssignments = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { bookings } = req.body;
    
    if (!bookings || !Array.isArray(bookings)) {
      res.status(400).json({ error: 'bookings array is required' });
      return;
    }

    const batch = db.batch();
    const existingAssignments = new Map();

    // Get existing cleaning assignments
    const existingSnapshot = await db.collection('cleaning-assignments').get();
    existingSnapshot.docs.forEach(doc => {
      existingAssignments.set(doc.id, doc.data());
    });

    // Process each booking that requires cleaning
    for (const booking of bookings) {
      if (booking.cleaningRequired) {
        const originalBookingDate = booking.checkOut;
        const currentCleaningDate = originalBookingDate; // Default to original date
        
        const assignmentData = {
          originalBookingDate,
          currentCleaningDate,
          bookingId: booking.id,
          guestName: booking.guestName,
          cleanerId: null,
          cleanerName: null,
          bookingDateChanged: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Use composite ID to avoid collisions by date
        const docId = `${originalBookingDate}_${booking.id}`;
        const existingAssignment = existingAssignments.get(docId);
        
        if (!existingAssignment || existingAssignment.bookingId !== booking.id) {
          // Create new assignment or update if booking changed
          batch.set(db.collection('cleaning-assignments').doc(docId), assignmentData);
        }
      }
    }

    await batch.commit();
    
    res.status(200).json({ message: 'Cleaning assignments synced successfully' });
  } catch (error) {
    console.error('Error syncing cleaning assignments:', error);
    res.status(500).json({ error: 'Failed to sync cleaning assignments' });
  }
}); 

export const syncAllCleaningAssignments = functions.https.onRequest(async (req, res) => {
  try {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { bookings } = req.body;

    if (!bookings || !Array.isArray(bookings)) {
      res.status(400).json({ error: 'Bookings array is required' });
      return;
    }

    const db = admin.firestore();
    const batch = db.batch();
    const createdAssignments = [];

    // Process each booking
    for (const booking of bookings) {
      if (!booking.checkOut || !booking.cleaningRequired) {
        continue; // Skip bookings without checkout date or cleaning not required
      }

      // Create cleaning assignment for checkout date
      const checkoutDate = booking.checkOut;
      const assignmentData = {
        originalBookingDate: checkoutDate,
        currentCleaningDate: checkoutDate,
        bookingId: booking.id,
        guestName: booking.guestName || 'Unknown Guest',
        cleanerId: null,
        cleanerName: null,
        bookingDateChanged: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Add to batch with composite ID
      const docRef = db.collection('cleaning-assignments').doc(`${checkoutDate}_${booking.id}`);
      batch.set(docRef, assignmentData);
      
      createdAssignments.push({
        date: checkoutDate,
        bookingId: booking.id,
        guestName: booking.guestName
      });
    }

    // Commit the batch
    await batch.commit();

    res.status(200).json({
      message: 'All cleaning assignments synced successfully',
      createdCount: createdAssignments.length,
      assignments: createdAssignments
    });

  } catch (error) {
    console.error('Error syncing all cleaning assignments:', error);
    res.status(500).json({ error: 'Failed to sync cleaning assignments' });
  }
}); 