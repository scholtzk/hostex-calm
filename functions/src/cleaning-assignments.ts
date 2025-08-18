import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// GET /cleaning-assignments - Get all cleaning assignments
export const getCleaningAssignments = onRequest({ cors: true, minInstances: 0 }, async (req, res) => {
  try {
    if (req.method !== 'GET') { res.status(405).send('Method Not Allowed'); return; }

    const { date, startDate, endDate } = req.query as any;
    let query: admin.firestore.Query = db.collection('cleaning-assignments');

    if (date) {
      query = query.where('currentCleaningDate', '==', date);
    } else if (startDate && endDate) {
      let start = String(startDate);
      let end = String(endDate);
      if (start > end) { const t = start; start = end; end = t; }
      query = query
        .where('currentCleaningDate', '>=', start)
        .where('currentCleaningDate', '<=', end);
    } else {
      // Default to current month to avoid broad scans and 400s
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      query = query
        .where('currentCleaningDate', '>=', monthStart)
        .where('currentCleaningDate', '<=', monthEnd);
    }

    const assignmentsSnapshot = await query.get();
    const assignments = assignmentsSnapshot.docs.map(doc => ({ date: doc.data().currentCleaningDate, id: doc.id, ...doc.data() }));
    res.set('Cache-Control', 'public, max-age=60');
    res.status(200).json({ assignments });
  } catch (error: any) {
    console.error('Error fetching cleaning assignments:', error?.message || error);
    // Fail-soft: return empty list so UI continues to work, include error hint header
    res.set('x-error', String(error?.message || error));
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ assignments: [] });
  }
});

// POST /cleaning-assignments - Create or update a cleaning assignment
export const createOrUpdateCleaningAssignment = onRequest({ cors: true, minInstances: 0 }, async (req, res) => {
  try {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

    const { originalBookingDate, currentCleaningDate, bookingId, guestName, cleanerId = null, cleanerName = null, bookingDateChanged = false } = req.body;
    if (!originalBookingDate || !currentCleaningDate || !bookingId || !guestName) { res.status(400).json({ error: 'originalBookingDate, currentCleaningDate, bookingId, and guestName are required' }); return; }

    const docId = `${originalBookingDate}_${bookingId}`;
    const assignmentData = { originalBookingDate, currentCleaningDate, bookingId, guestName, cleanerId, cleanerName, bookingDateChanged, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    await db.collection('cleaning-assignments').doc(docId).set(assignmentData);
    res.status(200).json({ date: docId, ...assignmentData });
  } catch (error) {
    console.error('Error creating/updating cleaning assignment:', error);
    res.status(500).json({ error: 'Failed to create/update cleaning assignment' });
  }
});

// PATCH /cleaning-assignments/:date - Update cleaner assignment
export const updateCleanerAssignment = onRequest({ cors: true, minInstances: 0 }, async (req, res) => {
  try {
    if (req.method !== 'PATCH') { res.status(405).send('Method Not Allowed'); return; }

    const date = req.params[0];
    const { cleanerId, cleanerName, bookingId } = req.body;

    let targetDocId: string | null = null;

    if (bookingId) {
      const candidates = await db.collection('cleaning-assignments').where('bookingId', '==', bookingId).get();
      if (candidates.empty) { res.status(404).json({ error: 'Cleaning assignment not found for booking' }); return; }
      const matchingDoc = candidates.docs.find(doc => { const d = doc.data() as any; return d.currentCleaningDate === date || d.originalBookingDate === date; });
      if (!matchingDoc) { res.status(404).json({ error: 'Cleaning assignment not found for given date and booking' }); return; }
      targetDocId = matchingDoc.id;
    } else {
      // Fallback: find by date only
      const byDateSnap = await db.collection('cleaning-assignments').where('currentCleaningDate', '==', date).get();
      if (byDateSnap.empty) { res.status(404).json({ error: 'Cleaning assignment not found for date' }); return; }
      if (byDateSnap.size > 1) { res.status(400).json({ error: 'Multiple assignments on this date; bookingId required' }); return; }
      targetDocId = byDateSnap.docs[0].id;
    }

    await db.collection('cleaning-assignments').doc(targetDocId).update({ cleanerId, cleanerName, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.status(200).json({ message: 'Cleaner assignment updated successfully' });
  } catch (error) {
    console.error('Error updating cleaner assignment:', error);
    res.status(500).json({ error: 'Failed to update cleaner assignment' });
  }
});

// DELETE /cleaning-assignments/:date - Delete a cleaning assignment
export const deleteCleaningAssignment = onRequest({ cors: true, minInstances: 0 }, async (req, res) => {
  try {
    if (req.method !== 'DELETE') { res.status(405).send('Method Not Allowed'); return; }
    const date = req.params[0];
    const assignmentDoc = await db.collection('cleaning-assignments').doc(date).get();
    if (!assignmentDoc.exists) { res.status(404).json({ error: 'Cleaning assignment not found' }); return; }
    await db.collection('cleaning-assignments').doc(date).delete();
    res.status(200).json({ message: 'Cleaning assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting cleaning assignment:', error);
    res.status(500).json({ error: 'Failed to delete cleaning assignment' });
  }
});

// POST /cleaning-assignments/sync - Sync cleaning assignments from bookings
export const syncCleaningAssignments = onRequest({ cors: true, minInstances: 0 }, async (req, res) => {
  try {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

    const { bookings } = req.body;
    if (!bookings || !Array.isArray(bookings)) { res.status(400).json({ error: 'bookings array is required' }); return; }

    const batch = db.batch();
    // Instead of scanning the whole collection, check existence by expected IDs only
    const chunkSize = 500; // Firestore limits for batched gets
    const toCreate: Array<{ id: string; data: any }> = [];

    const expected = bookings
      .filter((b: any) => b && b.cleaningRequired && b.checkOut && b.id)
      .map((b: any) => ({ id: `${b.checkOut}_${b.id}`, data: {
        originalBookingDate: b.checkOut,
        currentCleaningDate: b.checkOut,
        bookingId: b.id,
        guestName: b.guestName,
        cleanerId: null,
        cleanerName: null,
        bookingDateChanged: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }}));

    for (let i = 0; i < expected.length; i += chunkSize) {
      const slice = expected.slice(i, i + chunkSize);
      const refs = slice.map(e => db.collection('cleaning-assignments').doc(e.id));
      const snaps = await db.getAll(...refs);
      snaps.forEach((snap, idx) => {
        if (!snap.exists) {
          toCreate.push(slice[idx]);
        }
      });
    }

    toCreate.forEach(item => {
      batch.set(db.collection('cleaning-assignments').doc(item.id), item.data);
    });

    if (toCreate.length > 0) {
      await batch.commit();
    }
    res.status(200).json({ message: 'Cleaning assignments synced successfully' });
  } catch (error) {
    console.error('Error syncing cleaning assignments:', error);
    res.status(500).json({ error: 'Failed to sync cleaning assignments' });
  }
});

export const syncAllCleaningAssignments = onRequest({ cors: true, minInstances: 0 }, async (req, res) => {
  try {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const { bookings } = req.body;
    if (!bookings || !Array.isArray(bookings)) { res.status(400).json({ error: 'Bookings array is required' }); return; }

    const batch = db.batch();
    const createdAssignments: any[] = [];
    for (const booking of bookings) {
      if (!booking.checkOut || !booking.cleaningRequired) continue;
      const checkoutDate = booking.checkOut;
      const assignmentData = { originalBookingDate: checkoutDate, currentCleaningDate: checkoutDate, bookingId: booking.id, guestName: booking.guestName || 'Unknown Guest', cleanerId: null, cleanerName: null, bookingDateChanged: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      const docRef = db.collection('cleaning-assignments').doc(`${checkoutDate}_${booking.id}`);
      batch.set(docRef, assignmentData);
      createdAssignments.push({ date: checkoutDate, bookingId: booking.id, guestName: booking.guestName });
    }

    await batch.commit();
    res.status(200).json({ message: 'All cleaning assignments synced successfully', createdCount: createdAssignments.length, assignments: createdAssignments });
  } catch (error) {
    console.error('Error syncing all cleaning assignments:', error);
    res.status(500).json({ error: 'Failed to sync cleaning assignments' });
  }
}); 