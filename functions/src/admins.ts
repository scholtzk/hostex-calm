import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// GET /admins - list active admins
export const getAdmins = onRequest({ cors: true, minInstances: 0 }, async (req, res) => {
  try {
    if (req.method !== 'GET') { res.status(405).send('Method Not Allowed'); return; }
    const snap = await db.collection('admins').where('isActive', '==', true).get();
    const admins = snap.docs.map(d => ({ id: d.id, ...d.data() as any })) as any[];
    admins.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.status(200).json({ admins });
  } catch (e: any) {
    console.error('getAdmins error', e?.message || e);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// POST /admins - create admin
export const createAdmin = onRequest({ cors: true, minInstances: 0 }, async (req, res) => {
  try {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
    const { name, email, lineUserId, phone } = req.body || {};
    if (!name) { res.status(400).json({ error: 'Name is required' }); return; }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const doc = await db.collection('admins').add({ name, email: email || '', lineUserId: lineUserId || '', phone: phone || '', isActive: true, createdAt: now, updatedAt: now });
    res.status(201).json({ id: doc.id, name, email: email || '', lineUserId: lineUserId || '', phone: phone || '', isActive: true });
  } catch (e) {
    console.error('createAdmin error', e);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// PUT /admins/:id - update admin
export const updateAdmin = onRequest({ cors: true, minInstances: 0 }, async (req, res) => {
  try {
    if (req.method !== 'PUT') { res.status(405).send('Method Not Allowed'); return; }
    const id = req.params[0];
    const payload = req.body || {};
    if (!payload.name) { res.status(400).json({ error: 'Name is required' }); return; }
    payload.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('admins').doc(id).update(payload);
    res.status(200).json({ message: 'Admin updated' });
  } catch (e) {
    console.error('updateAdmin error', e);
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

// DELETE /admins/:id - soft delete
export const deleteAdmin = onRequest({ cors: true, minInstances: 0 }, async (req, res) => {
  try {
    if (req.method !== 'DELETE') { res.status(405).send('Method Not Allowed'); return; }
    const id = req.params[0];
    await db.collection('admins').doc(id).update({ isActive: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.status(200).json({ message: 'Admin deleted' });
  } catch (e) {
    console.error('deleteAdmin error', e);
    res.status(500).json({ error: 'Failed to delete admin' });
  }
}); 