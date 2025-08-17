import { useState, useEffect, useRef } from 'react';
import { Cleaner, CleaningAssignment, CleaningTask } from '@/types/booking';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, limit as fbLimit } from 'firebase/firestore';

export const useCleaners = () => {
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [assignments, setAssignments] = useState<CleaningAssignment[]>([]);
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, { month: string; dates: string[] }>>({}); // cleanerId -> {month, dates}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prefetchedMonthsRef = useRef<Set<string>>(new Set());
  const prefetchInFlightRef = useRef<Set<string>>(new Set());

  const getMonthRange = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    return { startStr, endStr };
  };

  const getRangeForMonthString = (month: string) => {
    const [y, m] = month.split('-').map((v) => parseInt(v, 10));
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return { startStr: start.toISOString().split('T')[0], endStr: end.toISOString().split('T')[0] };
  };

  const prefetchAvailabilityForMonth = async (month: string) => {
    if (prefetchedMonthsRef.current.has(month) || prefetchInFlightRef.current.has(month)) return;
    prefetchInFlightRef.current.add(month);
    try {
      const qAll = query(collection(db, 'cleaner_availability'), where('month', '==', month));
      const snap = await getDocs(qAll);
      const updates: Record<string, { month: string; dates: string[] }> = {};
      snap.forEach((d) => {
        const data: any = d.data();
        updates[data.cleanerId] = { month, dates: data.availableDates || [] };
      });
      // Ensure we also set empty arrays for active cleaners without a doc to avoid future reads
      cleaners
        .filter((c) => c.isActive)
        .forEach((c) => {
          if (!updates[c.id]) updates[c.id] = { month, dates: [] };
        });
      if (Object.keys(updates).length > 0) {
        setAvailabilityMap((prev) => ({ ...prev, ...updates }));
      }
      prefetchedMonthsRef.current.add(month);
    } catch (e) {
      console.warn('Prefetch availability failed for', month, e);
    } finally {
      prefetchInFlightRef.current.delete(month);
    }
  };

  const loadCleaners = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://us-central1-property-manager-cf570.cloudfunctions.net/getCleaners');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const nonAdmins = (data.cleaners || []).filter((c: any) => (c.role || 'cleaner') !== 'admin');
      setCleaners(nonAdmins);
      setError(null);
    } catch (err) {
      console.error('Error loading cleaners:', err);
      setError(err instanceof Error ? err.message : 'Failed to load cleaners');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    try {
      const { startStr, endStr } = getMonthRange(new Date());
      const response = await fetch(`https://us-central1-property-manager-cf570.cloudfunctions.net/getCleaningAssignments?startDate=${startStr}&endDate=${endStr}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Handle the new cleaning assignments structure
      const assignments = data.assignments || [];
      
      // Convert the new structure to the old structure for backward compatibility
      const convertedAssignments = assignments.map((assignment: any) => ({
        id: assignment.date, // Use date as ID
        date: assignment.currentCleaningDate,
        bookingId: assignment.bookingId,
        cleanerId: assignment.cleanerId,
        status: assignment.cleanerId ? 'assigned' : 'unassigned',
        assignedAt: assignment.updatedAt,
        completedAt: null
      }));
      
      setAssignments(convertedAssignments);
    } catch (err) {
      console.error('Error loading assignments:', err);
      setAssignments([]);
    }
  };

  const loadTasks = async () => {
    // Cleaning tasks functionality not implemented yet
    // This will be added in a future update
    setTasks([]);
  };

  const assignCleaner = async (
    assignment: Omit<CleaningAssignment, 'id' | 'assignedAt'> & { originalBookingDate?: string; guestName?: string }
  ) => {
    try {
      // Find the cleaner name
      const cleaner = cleaners.find(c => c.id === assignment.cleanerId);
      const cleanerName = cleaner?.name || '';

      if (!cleaner) {
        throw new Error('Cleaner not found');
      }

      console.log('Assigning cleaner:', {
        date: assignment.date,
        cleanerId: assignment.cleanerId,
        cleanerName: cleanerName,
        bookingId: assignment.bookingId
      });

      // Use the new update cleaner assignment endpoint
      let response = await fetch(`https://us-central1-property-manager-cf570.cloudfunctions.net/updateCleanerAssignment/${assignment.date}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          cleanerId: assignment.cleanerId, 
          cleanerName: cleanerName,
          bookingId: assignment.bookingId
        }),
      });

      if (!response.ok) {
        // If not found, create the assignment then retry
        if (response.status === 404) {
          const originalBookingDate = assignment.originalBookingDate || assignment.date; // fallback
          const guestName = assignment.guestName || '';
          console.log('Assignment missing - creating then retrying...', { originalBookingDate, currentCleaningDate: assignment.date, bookingId: assignment.bookingId });
          const createResp = await fetch('https://us-central1-property-manager-cf570.cloudfunctions.net/createOrUpdateCleaningAssignment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              originalBookingDate,
              currentCleaningDate: assignment.date,
              bookingId: assignment.bookingId,
              guestName
            })
          });
          if (!createResp.ok) {
            const createText = await createResp.text();
            console.error('Create assignment failed:', createResp.status, createText);
            throw new Error(`HTTP ${createResp.status}: ${createText}`);
          }
          // Retry PATCH with bookingId
          response = await fetch(`https://us-central1-property-manager-cf570.cloudfunctions.net/updateCleanerAssignment/${assignment.date}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cleanerId: assignment.cleanerId, cleanerName: cleanerName, bookingId: assignment.bookingId })
          });
        }
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Assignment failed:', response.status, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      }

      const result = await response.json();
      console.log('Assignment successful:', result);
      
      // Refresh for the month of the assignment
      const month = assignment.date.slice(0, 7);
      const { startStr, endStr } = getRangeForMonthString(month);
      const refreshResponse = await fetch(`https://us-central1-property-manager-cf570.cloudfunctions.net/getCleaningAssignments?startDate=${startStr}&endDate=${endStr}`);
      const refreshData = await refreshResponse.json();
      const assignmentsArr = refreshData.assignments || [];
      
      // Find the updated assignment from the refreshed data
      const updatedAssignment = assignmentsArr.find((a: any) => a.currentCleaningDate === assignment.date && a.bookingId === assignment.bookingId);
      
      if (!updatedAssignment) {
        throw new Error('Assignment not found after update');
      }
      
      // Convert to the old structure for compatibility
      const convertedAssignment: CleaningAssignment = {
        id: updatedAssignment.id || updatedAssignment.date,
        date: updatedAssignment.currentCleaningDate,
        bookingId: updatedAssignment.bookingId,
        cleanerId: updatedAssignment.cleanerId,
        status: updatedAssignment.cleanerId ? 'assigned' : 'unassigned',
        assignedAt: updatedAssignment.updatedAt,
        completedAt: null
      };
      
      // Update local list optimistically
      setAssignments((prev) => {
        const others = prev.filter((a) => !(a.date === convertedAssignment.date && a.bookingId === convertedAssignment.bookingId));
        return [...others, convertedAssignment];
      });
      
      return convertedAssignment;
    } catch (err) {
      console.error('Error assigning cleaner:', err);
      throw err;
    }
  };

  const updateAssignmentStatus = async (assignmentId: string, status: CleaningAssignment['status']) => {
    try {
      // Find the assignment to get the date
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) {
        throw new Error('Assignment not found');
      }

      // For now, we'll just update the local state since the new structure doesn't have status
      // In the future, we can add status tracking to the new cleaning assignments structure
      setAssignments(prev => prev.map(a => 
        a.id === assignmentId 
          ? { 
              ...a, 
              status,
              completedAt: status === 'completed' ? new Date().toISOString() : a.completedAt
            }
          : a
      ));
    } catch (err) {
      console.error('Error updating assignment status:', err);
      throw err;
    }
  };

  const unassignCleaner = async (assignmentId: string) => {
    try {
      console.log('Unassigning cleaner for assignment ID:', assignmentId);
      
      // The assignmentId might be the date itself (from new Firestore structure)
      // or it might be the old ID structure
      let assignment = assignments.find(a => a.id === assignmentId);
      
      // If not found, try to find by date (for new Firestore structure)
      if (!assignment) {
        assignment = assignments.find(a => a.date === assignmentId);
      }
      
      if (!assignment) {
        console.error('Assignment not found in assignments array:', assignments);
        console.error('Looking for assignmentId:', assignmentId);
        throw new Error('Assignment not found');
      }

      console.log('Found assignment:', assignment);

      // Use the new update cleaner assignment endpoint
      const response = await fetch(`https://us-central1-property-manager-cf570.cloudfunctions.net/updateCleanerAssignment/${assignment.date}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cleanerId: null, cleanerName: null, bookingId: assignment.bookingId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Unassign failed:', response.status, errorText);
        if (response.status === 404) {
          // Assignment not found - remove it from local state anyway
          setAssignments(prev => prev.filter(assignment => assignment.id !== assignmentId));
          // Refresh assignments to get the latest data
          await loadAssignments();
          throw new Error('Assignment not found. Please try refreshing the page.');
        }
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      console.log('Unassign successful');

      // Update local state to remove cleaner assignment
      setAssignments(prev => prev.map(a => 
        a.id === assignmentId || a.date === assignmentId
          ? { ...a, cleanerId: null, status: 'unassigned' }
          : a
      ));

      // Refresh assignments to get the latest data from Firestore
      await loadAssignments();
    } catch (err) {
      console.error('Error unassigning cleaner:', err);
      throw err;
    }
  };

  const getAssignmentsForDate = (date: string) => {
    if (!assignments || !Array.isArray(assignments)) return [];
    return assignments.filter(assignment => assignment && assignment.date === date);
  };

  const getAvailableCleaners = (date: string) => {
    if (!cleaners || !Array.isArray(cleaners)) return [];

    const dateStr = date; // expected "YYYY-MM-DD"
    const month = dateStr.slice(0, 7); // YYYY-MM

    // Prefetch availability once per month instead of per cleaner
    prefetchAvailabilityForMonth(month).catch(() => {});

    return cleaners.filter(
      cleaner =>
        cleaner &&
        cleaner.isActive &&
        (cleaner as any).role !== 'admin' &&
        availabilityMap[cleaner.id] &&
        availabilityMap[cleaner.id].month === month &&
        availabilityMap[cleaner.id].dates.includes(dateStr)
    );
  };

  // Function to clear assignments created with old client-side ID system
  const clearOldAssignments = () => {
    // Remove assignments that were created with the old client-side ID system
    // These IDs are typically 9 characters long and alphanumeric
    setAssignments(prev => {
      if (!prev || !Array.isArray(prev)) return [];
      return prev.filter(assignment => {
        // Keep assignments that have proper Firestore document IDs (20 characters, alphanumeric)
        return assignment && assignment.id && assignment.id.length >= 20;
      });
    });
  };

  useEffect(() => {
    loadCleaners();
  }, []);

  // Clear old assignments after loading
  useEffect(() => {
    if (assignments.length > 0) {
      clearOldAssignments();
    }
  }, [assignments.length]);

  return {
    cleaners,
    assignments,
    tasks,
    loading,
    error,
    loadCleaners,
    assignCleaner,
    updateAssignmentStatus,
    unassignCleaner,
    getAssignmentsForDate,
    getAvailableCleaners,
    clearOldAssignments,
    refetch: () => {
      loadCleaners();
      loadTasks();
    }
  };
}; 