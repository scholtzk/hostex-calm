import { useState, useEffect } from 'react';

interface CleaningAssignment {
  date: string;
  originalBookingDate: string;
  currentCleaningDate: string;
  bookingId: string;
  guestName: string;
  cleanerId: string | null;
  cleanerName: string | null;
  bookingDateChanged: boolean;
  updatedAt: any;
}

interface UseCleaningAssignmentsReturn {
  cleaningAssignments: CleaningAssignment[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createOrUpdateAssignment: (assignment: Partial<CleaningAssignment>) => Promise<void>;
  updateCleanerAssignment: (date: string, cleanerId: string | null, cleanerName: string | null) => Promise<void>;
  deleteAssignment: (date: string) => Promise<void>;
  syncAssignments: (bookings: any[]) => Promise<void>;
  updateAssignmentOptimistically: (assignment: Partial<CleaningAssignment>) => void;
}

export const useCleaningAssignments = (): UseCleaningAssignmentsReturn => {
  const [cleaningAssignments, setCleaningAssignments] = useState<CleaningAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  let lastFetchAt: number | null = null;

  const getMonthRange = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    return { startStr, endStr };
  };

  const fetchAssignments = async () => {
    try {
      // basic throttle: skip if refetched within 5s
      if (lastFetchAt && Date.now() - lastFetchAt < 5000) return;
      lastFetchAt = Date.now();
      setLoading(true);
      setError(null);
      
      const { startStr, endStr } = getMonthRange(new Date());
      const url = `https://us-central1-property-manager-cf570.cloudfunctions.net/getCleaningAssignments?startDate=${startStr}&endDate=${endStr}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const hdr = response.headers.get('x-error') || '';
        throw new Error(`HTTP ${response.status}: ${hdr}`);
      }
      
      const data = await response.json();
      setCleaningAssignments(data.assignments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const createOrUpdateAssignment = async (assignment: Partial<CleaningAssignment>) => {
    try {
      // Direct write to Firestore
      const docId = `${assignment.originalBookingDate}_${assignment.bookingId}`;
      const payload: any = {
        originalBookingDate: assignment.originalBookingDate,
        currentCleaningDate: assignment.currentCleaningDate,
        bookingId: assignment.bookingId,
        guestName: assignment.guestName,
        cleanerId: assignment.cleanerId ?? null,
        cleanerName: assignment.cleanerName ?? null,
        bookingDateChanged: assignment.bookingDateChanged ?? false,
        updatedAt: new Date().toISOString(),
      };
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      await setDoc(doc(db as any, 'cleaning-assignments', docId as string), payload, { merge: true } as any);
 
      // Refetch to get updated data
      await fetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const updateCleanerAssignment = async (date: string, cleanerId: string | null, cleanerName: string | null) => {
    try {
      // Direct update by querying by date then updating
      const { query: q, collection: col, where, getDocs, doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const snap = await getDocs(q(col(db as any, 'cleaning-assignments'), where('currentCleaningDate', '==', date)) as any);
      const target = snap.docs[0];
      if (target) {
        await updateDoc(doc(db as any, 'cleaning-assignments', target.id), { cleanerId, cleanerName, updatedAt: new Date().toISOString() } as any);
      }
 
      // Refetch to get updated data
      await fetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const deleteAssignment = async (date: string) => {
    try {
      const { query: q, collection: col, where, getDocs, doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const snap = await getDocs(q(col(db as any, 'cleaning-assignments'), where('currentCleaningDate', '==', date)) as any);
      const target = snap.docs[0];
      if (target) await deleteDoc(doc(db as any, 'cleaning-assignments', target.id));
 
      // Refetch to get updated data
      await fetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const syncAssignments = async (bookings: any[]) => {
    try {
      // Client-side: create missing docs directly
      const { doc, getDoc, setDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      for (const b of bookings) {
        const id = `${b.checkOut}_${b.id}`;
        const ref = doc(db as any, 'cleaning-assignments', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            originalBookingDate: b.checkOut,
            currentCleaningDate: b.checkOut,
            bookingId: b.id,
            guestName: b.guestName,
            cleanerId: null,
            cleanerName: null,
            bookingDateChanged: false,
            updatedAt: new Date().toISOString(),
          } as any);
        }
      }
 
      // Refetch to get updated data
      await fetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const updateAssignmentOptimistically = (assignment: Partial<CleaningAssignment>) => {
    setCleaningAssignments(prev => 
      prev.map(a => {
        if (a.bookingId === assignment.bookingId && a.currentCleaningDate === assignment.currentCleaningDate) {
          return { ...a, ...assignment };
        }
        return a;
      })
    );
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  return {
    cleaningAssignments,
    loading,
    error,
    refetch: fetchAssignments,
    createOrUpdateAssignment,
    updateCleanerAssignment,
    deleteAssignment,
    syncAssignments,
    updateAssignmentOptimistically,
  };
}; 