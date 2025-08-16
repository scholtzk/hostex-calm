import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// GET /cleaners - Get all active cleaners
export const getCleaners = functions.https.onRequest(async (req, res) => {
  try {
    // Set CORS headers
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

    const cleanersSnapshot = await db.collection('cleaners')
      .where('isActive', '==', true)
      .orderBy('name')
      .get();

    const cleaners = cleanersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json({ cleaners });
  } catch (error) {
    console.error('Error fetching cleaners:', error);
    res.status(500).json({ error: 'Failed to fetch cleaners' });
  }
});

// POST /cleaners - Create a new cleaner
export const createCleaner = functions.https.onRequest(async (req, res) => {
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

    const cleanerData = req.body;
    
    // Validate required fields
    if (!cleanerData.name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    // Add timestamps
    const now = admin.firestore.FieldValue.serverTimestamp();
    const newCleaner = {
      ...cleanerData,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await db.collection('cleaners').add(newCleaner);
    
    res.status(201).json({ 
      id: docRef.id,
      ...newCleaner 
    });
  } catch (error) {
    console.error('Error creating cleaner:', error);
    res.status(500).json({ error: 'Failed to create cleaner' });
  }
});

// PUT /cleaners/:id - Update a cleaner
export const updateCleaner = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'PUT') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const cleanerId = req.params[0]; // Extract ID from URL
    const updateData = req.body;
    
    // Validate required fields
    if (!updateData.name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    // Add updated timestamp
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('cleaners').doc(cleanerId).update(updateData);
    
    res.status(200).json({ message: 'Cleaner updated successfully' });
  } catch (error) {
    console.error('Error updating cleaner:', error);
    res.status(500).json({ error: 'Failed to update cleaner' });
  }
});

// DELETE /cleaners/:id - Delete a cleaner
export const deleteCleaner = functions.https.onRequest(async (req, res) => {
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

    const cleanerId = req.params[0]; // Extract ID from URL

    // First check if the cleaner exists
    const cleanerDoc = await db.collection('cleaners').doc(cleanerId).get();
    
    if (!cleanerDoc.exists) {
      res.status(404).json({ error: 'Cleaner not found' });
      return;
    }

    // Check if cleaner has any assignments
    const assignmentsSnapshot = await db.collection('cleaning_assignments')
      .where('cleanerId', '==', cleanerId)
      .get();

    if (!assignmentsSnapshot.empty) {
      res.status(400).json({ error: 'Cannot delete cleaner with existing assignments' });
      return;
    }

    // Soft delete by setting isActive to false
    await db.collection('cleaners').doc(cleanerId).update({
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.status(200).json({ message: 'Cleaner deleted successfully' });
  } catch (error) {
    console.error('Error deleting cleaner:', error);
    res.status(500).json({ error: 'Failed to delete cleaner' });
  }
}); 