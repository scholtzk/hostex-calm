import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// GET /availability/:cleanerId/:month - Get cleaner availability for a specific month
export const getCleanerAvailability = functions.https.onRequest(async (req, res) => {
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

    // Extract cleanerId and month from URL path
    const pathParts = req.path.split('/');
    const cleanerId = pathParts[pathParts.length - 2];
    const month = pathParts[pathParts.length - 1];

    if (!cleanerId || !month) {
      res.status(400).json({ error: 'Cleaner ID and month are required' });
      return;
    }

    const availabilitySnapshot = await db.collection('cleaner_availability')
      .where('cleanerId', '==', cleanerId)
      .where('month', '==', month)
      .limit(1)
      .get();

    if (availabilitySnapshot.empty) {
      res.status(200).json({ 
        cleanerId, 
        month, 
        availableDates: [] 
      });
      return;
    }

    const availability = availabilitySnapshot.docs[0].data();
    res.status(200).json({
      id: availabilitySnapshot.docs[0].id,
      ...availability
    });
  } catch (error) {
    console.error('Error fetching cleaner availability:', error);
    res.status(500).json({ error: 'Failed to fetch cleaner availability' });
  }
});

// POST /availability - Create or update cleaner availability
export const updateCleanerAvailability = functions.https.onRequest(async (req, res) => {
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

    const { cleanerId, month, availableDates } = req.body;

    if (!cleanerId || !month || !Array.isArray(availableDates)) {
      res.status(400).json({ error: 'Cleaner ID, month, and availableDates array are required' });
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const date of availableDates) {
      if (!dateRegex.test(date)) {
        res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        return;
      }
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    
    // Check if availability already exists for this cleaner and month
    const existingSnapshot = await db.collection('cleaner_availability')
      .where('cleanerId', '==', cleanerId)
      .where('month', '==', month)
      .limit(1)
      .get();

    if (existingSnapshot.empty) {
      // Create new availability
      const newAvailability = {
        cleanerId,
        month,
        availableDates,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await db.collection('cleaner_availability').add(newAvailability);
      res.status(201).json({ 
        id: docRef.id,
        ...newAvailability 
      });
    } else {
      // Update existing availability
      const docId = existingSnapshot.docs[0].id;
      await db.collection('cleaner_availability').doc(docId).update({
        availableDates,
        updatedAt: now
      });

      res.status(200).json({ 
        id: docId,
        cleanerId,
        month,
        availableDates,
        updatedAt: now
      });
    }
  } catch (error) {
    console.error('Error updating cleaner availability:', error);
    res.status(500).json({ error: 'Failed to update cleaner availability' });
  }
});

// POST /availability-links - Create availability links for cleaners
export const createAvailabilityLinks = functions.https.onRequest(async (req, res) => {
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

    const { cleanerIds, month } = req.body;

    if (!Array.isArray(cleanerIds) || !month) {
      res.status(400).json({ error: 'Cleaner IDs array and month are required' });
      return;
    }

    // Get cleaner details
    const cleanersSnapshot = await db.collection('cleaners')
      .where(admin.firestore.FieldPath.documentId(), 'in', cleanerIds)
      .get();

    const cleaners = cleanersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Array<{ id: string; name: string; [key: string]: any }>;

    const now = admin.firestore.FieldValue.serverTimestamp();
    const links = [];

    for (const cleaner of cleaners) {
      const uniqueLink = uuidv4();
      
      const linkData = {
        cleanerId: cleaner.id,
        cleanerName: cleaner.name,
        month,
        uniqueLink,
        isActive: true,
        createdAt: now
      };

      const docRef = await db.collection('cleaner_availability_links').add(linkData);
      links.push({
        id: docRef.id,
        ...linkData
      });
    }

    res.status(201).json({ links });
  } catch (error) {
    console.error('Error creating availability links:', error);
    res.status(500).json({ error: 'Failed to create availability links' });
  }
});

// GET /availability-links/:uniqueLink - Get availability link details
export const getAvailabilityLink = functions.https.onRequest(async (req, res) => {
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

    // Extract uniqueLink from URL path
    const pathParts = req.path.split('/');
    const uniqueLink = pathParts[pathParts.length - 1];

    if (!uniqueLink) {
      res.status(400).json({ error: 'Unique link is required' });
      return;
    }

    const linkSnapshot = await db.collection('cleaner_availability_links')
      .where('uniqueLink', '==', uniqueLink)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (linkSnapshot.empty) {
      res.status(404).json({ error: 'Availability link not found or inactive' });
      return;
    }

    const linkData = linkSnapshot.docs[0].data();
    res.status(200).json({
      id: linkSnapshot.docs[0].id,
      ...linkData
    });
  } catch (error) {
    console.error('Error fetching availability link:', error);
    res.status(500).json({ error: 'Failed to fetch availability link' });
  }
});

// GET /availability-links - Get all availability links for admin
export const getAllAvailabilityLinks = functions.https.onRequest(async (req, res) => {
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

    const linksSnapshot = await db.collection('cleaner_availability_links')
      .orderBy('createdAt', 'desc')
      .get();

    const links = linksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json({ links });
  } catch (error) {
    console.error('Error fetching availability links:', error);
    res.status(500).json({ error: 'Failed to fetch availability links' });
  }
}); 