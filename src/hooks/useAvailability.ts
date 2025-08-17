import { useState, useEffect } from 'react';
import { CleanerAvailability, CleanerAvailabilityLink } from '@/types/booking';
import { collection, getDocs, query, orderBy, where, limit as fbLimit, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/firebase';

// Mock data storage using localStorage to simulate Firestore
const MOCK_STORAGE_KEY = 'availability_mock_data';

// Initialize mock storage
const initializeMockStorage = () => {
  if (typeof window === 'undefined') return;
  
  if (!localStorage.getItem(MOCK_STORAGE_KEY)) {
    const initialData = {
      availability: {},
      links: [
        {
          id: 'mock-link-1',
          cleanerId: 'test-cleaner-id',
          cleanerName: 'Test Cleaner',
          month: '2025-01',
          uniqueLink: 'test-unique-link-1',
          isActive: true,
          createdAt: new Date().toISOString()
        }
      ]
    };
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initialData));
  }
};

const getMockStorage = () => {
  if (typeof window === 'undefined') return { availability: {}, links: [] };
  const data = localStorage.getItem(MOCK_STORAGE_KEY);
  return data ? JSON.parse(data) : { availability: {}, links: [] };
};

const setMockStorage = (data: any) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
};

// Flag to use mock data (set to false to use real Firebase functions)
const USE_MOCK_DATA = false;

// Firebase hosting URL
const FUNCTIONS_BASE_URL = 'https://us-central1-property-manager-cf570.cloudfunctions.net';

// Helper to notify cleaners via LINE after link creation (only in production mode)
const notifyCleanerAvailabilityLink = async (link: CleanerAvailabilityLink) => {
  try {
    await fetch(`${FUNCTIONS_BASE_URL}/sendAvailabilityLink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cleanerId: link.cleanerId,
        uniqueLink: link.uniqueLink,
        month: link.month
      })
    });
  } catch (err) {
    console.error('Failed to send LINE availability link notification', err);
  }
};

// (legacy) Firebase hosting URL (not used for API calls but kept for reference)
const FIREBASE_HOSTING_URL = 'https://property-manager-cf570.web.app';

export const useAvailability = () => {
  const [availability, setAvailability] = useState<CleanerAvailability | null>(null);
  const [availabilityLinks, setAvailabilityLinks] = useState<CleanerAvailabilityLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize mock storage on mount
  useEffect(() => {
    initializeMockStorage();
  }, []);

  const getCleanerAvailability = async (cleanerId: string, month: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // For testing, use mock data with localStorage
      if (USE_MOCK_DATA || cleanerId === 'test-cleaner-id') {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
        
        const storage = getMockStorage();
        const key = `${cleanerId}-${month}`;
        
        let mockData = storage.availability[key];
        if (!mockData) {
          // Create new availability record
          mockData = {
            id: `mock-availability-${cleanerId}-${month}`,
            cleanerId,
            month,
            availableDates: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          storage.availability[key] = mockData;
          setMockStorage(storage);
        }
        
        setAvailability(mockData);
        return mockData;
      }
      // Read availability from Firestore
      const q = query(
        collection(db, 'cleaner_availability'),
        where('cleanerId', '==', cleanerId),
        where('month', '==', month),
        fbLimit(1)
      );

      const snap = await getDocs(q);

      let result: CleanerAvailability;

      if (snap.empty) {
        // No availability yet; return default empty array
        result = {
          cleanerId,
          month,
          availableDates: [],
        } as CleanerAvailability;
      } else {
        const doc = snap.docs[0];
        result = { id: doc.id, ...doc.data() } as CleanerAvailability;
      }

      setAvailability(result);
      return result;
    } catch (err) {
      console.error('Error loading cleaner availability:', err);
      setError(err instanceof Error ? err.message : 'Failed to load cleaner availability');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateCleanerAvailability = async (cleanerId: string, month: string, availableDates: string[]) => {
    try {
      setLoading(true);
      setError(null);
      
      // For testing, use mock data with localStorage
      if (USE_MOCK_DATA || cleanerId === 'test-cleaner-id') {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
        
        const storage = getMockStorage();
        const key = `${cleanerId}-${month}`;
        
        const updatedAvailability = {
          id: `mock-availability-${cleanerId}-${month}`,
          cleanerId,
          month,
          availableDates,
          createdAt: storage.availability[key]?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        storage.availability[key] = updatedAvailability;
        setMockStorage(storage);
        setAvailability(updatedAvailability);
        return updatedAvailability;
      }

      // Check if a record exists for this cleaner+month
      const q = query(
        collection(db, 'cleaner_availability'),
        where('cleanerId', '==', cleanerId),
        where('month', '==', month),
        fbLimit(1)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        // Create new document
        const newDoc = await addDoc(collection(db, 'cleaner_availability'), {
          cleanerId,
          month,
          availableDates,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const docRef = snap.docs[0].ref;
        await updateDoc(docRef, {
          availableDates,
          updatedAt: serverTimestamp(),
        });
      }

      // Notify admins via Cloud Function
      try {
        const resp = await fetch('https://us-central1-property-manager-cf570.cloudfunctions.net/notifyAvailabilityUpdate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cleanerId, month, dates: availableDates })
        });
        if (!resp.ok) {
          const t = await resp.text().catch(()=>'');
          console.warn('Notify admins failed:', resp.status, t);
        }
      } catch (notifyErr) {
        console.warn('Notify admins failed (non-blocking):', notifyErr);
      }

      return { cleanerId, month, availableDates } as any;
    } catch (err) {
      console.error('Error updating cleaner availability:', err);
      setError(err instanceof Error ? err.message : 'Failed to update cleaner availability');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createAvailabilityLinks = async (cleanerIds: string[], month: string, cleanerNames?: string[]) => {
    try {
      setLoading(true);
      setError(null);
      
      // For testing, use mock data with localStorage
      if (USE_MOCK_DATA || cleanerIds.includes('test-cleaner-id')) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
        
        const storage = getMockStorage();
        const newLinks = cleanerIds.map((cleanerId, index) => {
          // Try to find the cleaner name from the provided names array
          const cleanerName = cleanerNames && cleanerNames[index] 
            ? cleanerNames[index] 
            : `Cleaner ${index + 1}`;
            
          return {
            id: `mock-link-${Date.now()}-${index}`,
            cleanerId,
            cleanerName,
            month,
            uniqueLink: `mock-unique-link-${Date.now()}-${index}`,
            isActive: true,
            createdAt: new Date().toISOString()
          };
        });
        
        // Add new links to storage
        storage.links.push(...newLinks);
        setMockStorage(storage);
        
        // Update state
        setAvailabilityLinks(prev => [...prev, ...newLinks]);
        
        return newLinks;
      }

      // Create links directly in Firestore
      const createdLinks: CleanerAvailabilityLink[] = [];

      for (let i = 0; i < cleanerIds.length; i++) {
        const cleanerId = cleanerIds[i];
        const cleanerName = cleanerNames && cleanerNames[i] ? cleanerNames[i] : `Cleaner ${i + 1}`;

        const linkData = {
          cleanerId,
          cleanerName,
          month,
          uniqueLink: uuidv4(),
          isActive: true,
          createdAt: serverTimestamp(),
        } as any;

        const docRef = await addDoc(collection(db, 'cleaner_availability_links'), linkData);

        createdLinks.push({ id: docRef.id, ...linkData } as CleanerAvailabilityLink);
        // Notify cleaner via LINE (non-blocking)
        notifyCleanerAvailabilityLink({ id: docRef.id, ...linkData } as CleanerAvailabilityLink).catch(()=>{});
      }

      // Update local state
      setAvailabilityLinks(prev => [...prev, ...createdLinks]);

      return createdLinks;
    } catch (err) {
      console.error('Error creating availability links:', err);
      setError(err instanceof Error ? err.message : 'Failed to create availability links');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getAvailabilityLink = async (uniqueLink: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // For testing, use mock data with localStorage
      if (USE_MOCK_DATA || uniqueLink === 'test-unique-link-1') {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
        
        const storage = getMockStorage();
        const link = storage.links.find((l: any) => l.uniqueLink === uniqueLink);
        
        if (link) {
          return link;
        }
        
        // Return a mock link if not found
        return {
          id: `mock-link-${uniqueLink}`,
          cleanerId: 'mock-cleaner-id',
          cleanerName: 'Mock Cleaner',
          month: '2025-03', // Default to current month
          uniqueLink,
          isActive: true,
          createdAt: new Date().toISOString()
        };
      }
      // Read specific link from Firestore
      const q = query(
        collection(db, 'cleaner_availability_links'),
        where('uniqueLink', '==', uniqueLink),
        where('isActive', '==', true)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error('Availability link not found or inactive');
      }

      const linkDoc = snap.docs[0];
      return { id: linkDoc.id, ...linkDoc.data() } as CleanerAvailabilityLink;
    } catch (err) {
      console.error('Error loading availability link:', err);
      setError(err instanceof Error ? err.message : 'Failed to load availability link');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getAllAvailabilityLinks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For testing, use mock data with localStorage
      if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
        
        const storage = getMockStorage();
        setAvailabilityLinks(storage.links || []);
        return storage.links || [];
      }

      // Fetch first page via Cloud Function with pagination (no automatic month filter here)
      const resp = await fetch('https://us-central1-property-manager-cf570.cloudfunctions.net/getAllAvailabilityLinks?limit=50', {
        method: 'GET'
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const links = (data.links || []) as CleanerAvailabilityLink[];
      setAvailabilityLinks(links);
      return links;
    } catch (err) {
      console.error('Error loading availability links:', err);
      setError(err instanceof Error ? err.message : 'Failed to load availability links');
    } finally {
      setLoading(false);
    }
  };

  const getAvailabilityLinksPage = async (opts: { month?: string; cursor?: string; limit?: number } = {}) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (opts.month) params.set('month', opts.month);
      if (opts.cursor) params.set('cursor', opts.cursor);
      params.set('limit', String(opts.limit ?? 50));
      const url = `https://us-central1-property-manager-cf570.cloudfunctions.net/getAllAvailabilityLinks?${params.toString()}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json(); // { links, nextCursor }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability links');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    availability,
    availabilityLinks,
    loading,
    error,
    getCleanerAvailability,
    updateCleanerAvailability,
    createAvailabilityLinks,
    getAvailabilityLink,
    getAllAvailabilityLinks,
    getAvailabilityLinksPage,
    refetch: () => {
      if (availability) {
        getCleanerAvailability(availability.cleanerId, availability.month);
      }
      getAllAvailabilityLinks();
    }
  };
}; 