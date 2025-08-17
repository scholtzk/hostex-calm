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
      const response = await fetch(`https://us-central1-property-manager-cf570.cloudfunctions.net/getCleaningAssignments?startDate=${startStr}&endDate=${endStr}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch cleaning assignments');
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
      const response = await fetch('https://us-central1-property-manager-cf570.cloudfunctions.net/createOrUpdateCleaningAssignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assignment),
      });

      if (!response.ok) {
        throw new Error('Failed to create/update cleaning assignment');
      }

      // Refetch to get updated data
      await fetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const updateCleanerAssignment = async (date: string, cleanerId: string | null, cleanerName: string | null) => {
    try {
      const response = await fetch(`https://us-central1-property-manager-cf570.cloudfunctions.net/updateCleanerAssignment/${date}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cleanerId, cleanerName }),
      });

      if (!response.ok) {
        throw new Error('Failed to update cleaner assignment');
      }

      // Refetch to get updated data
      await fetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const deleteAssignment = async (date: string) => {
    try {
      const response = await fetch(`https://deletecleaningassignment-463sryhoiq-uc.a.run.app/${date}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete cleaning assignment');
      }

      // Refetch to get updated data
      await fetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const syncAssignments = async (bookings: any[]) => {
    try {
      const response = await fetch('https://us-central1-property-manager-cf570.cloudfunctions.net/syncCleaningAssignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookings }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync cleaning assignments');
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