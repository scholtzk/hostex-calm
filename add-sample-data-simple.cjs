// Simple script to add sample cleaner data to Firestore
// Run this with: node add-sample-data-simple.js

const admin = require('firebase-admin');

// Initialize Firebase Admin with default credentials
admin.initializeApp();

const db = admin.firestore();

const sampleCleaners = [
  {
    name: "Yuki Tanaka",
    phone: "+81-90-1234-5678",
    email: "yuki.tanaka@example.com",
    hourlyRate: 2500,
    currency: "JPY",
    isActive: true,
    specialties: ["deep-clean", "laundry", "linen-change"],
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    name: "Aiko Yamamoto",
    phone: "+81-90-8765-4321",
    email: "aiko.yamamoto@example.com",
    hourlyRate: 2200,
    currency: "JPY",
    isActive: true,
    specialties: ["bathroom-deep-clean", "kitchen-clean"],
    availability: {
      monday: false,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: false
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    name: "Kenji Sato",
    phone: "+81-90-5555-1234",
    email: "kenji.sato@example.com",
    hourlyRate: 2800,
    currency: "JPY",
    isActive: true,
    specialties: ["maintenance", "deep-clean", "linen-change"],
    availability: {
      monday: true,
      tuesday: true,
      wednesday: false,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

async function addSampleCleaners() {
  try {
    console.log('Adding sample cleaners...');
    
    for (const cleaner of sampleCleaners) {
      const docRef = await db.collection('cleaners').add(cleaner);
      console.log(`Added cleaner: ${cleaner.name} with ID: ${docRef.id}`);
    }
    
    console.log('Sample cleaners added successfully!');
  } catch (error) {
    console.error('Error adding sample cleaners:', error);
  } finally {
    process.exit(0);
  }
}

addSampleCleaners(); 