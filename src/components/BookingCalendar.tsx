import { useState, useMemo, useCallback, useEffect } from 'react';
import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, RefreshCw, Info, Send, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookingBar } from './BookingBar';
import { useBookings } from '@/hooks/useBookings';
import { useCleaners } from '@/hooks/useCleaners';
import { useCleaningAssignments } from '@/hooks/useCleaningAssignments';
import { Booking } from '@/types/booking';
import { cn } from '@/lib/utils';
import { CleaningAssignmentModal } from './CleaningAssignmentModal';
import { AssignmentInfoModal } from './AssignmentInfoModal';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { DraggableCleaningAssignment } from './DraggableCleaningAssignment';
import { DroppableCalendarCell } from './DroppableCalendarCell';
import { MoveIndicator } from './MoveIndicator';
import { FadedAssignmentIndicator } from './FadedAssignmentIndicator';
import { toast } from '@/hooks/use-toast';

interface BookingSpan {
  booking: Booking;
  startWeek: number;
  startDay: number;
  spanDays: number;
  hasOverlap: boolean;
  stackLevel: number;
  isFinalSegment: boolean;
  isCheckInSegment: boolean;
  isCheckOutSegment: boolean;
  isLastDayOfMonth: boolean;
  isFirstVisibleSegment: boolean;
}

export const BookingCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [assignmentInfoModal, setAssignmentInfoModal] = useState<{
    isOpen: boolean;
    assignment: any;
    cleaner: any;
    booking: any;
  }>({
    isOpen: false,
    assignment: null,
    cleaner: null,
    booking: null
  });
  
  // Drag and drop state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [movedAssignments, setMovedAssignments] = useState<Map<string, { originalDate: string; newDate: string }>>(new Map());
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [nearDropZone, setNearDropZone] = useState<string | null>(null);
  const [draggableCleanings, setDraggableCleanings] = useState<Set<string>>(new Set());
  const [validDropZones, setValidDropZones] = useState<Map<string, Set<string>>>(new Map());
  
  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 1000, // Require 1 second press and hold before activating drag
        tolerance: 5, // Allow 5px movement during the delay
      },
    })
  );
  
  const { bookings, loading, error, refetch: refetchBookings } = useBookings();
  const { getAssignmentsForDate, cleaners, assignments, assignCleaner, getAvailableCleaners, refetch: refetchCleaners } = useCleaners();
  const { 
    cleaningAssignments, 
    refetch: refetchCleaningAssignments,
    createOrUpdateAssignment,
    updateAssignmentOptimistically,
    syncAssignments
  } = useCleaningAssignments();

  const [distributing, setDistributing] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<Promise<any> | null>(null);

  const handleSuggestFairDistribution = async () => {
    if (distributing) return;
    setDistributing(true);

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    try {
      // Count current assignments per cleaner for the month
      const assignmentCounts: Record<string, number> = {};
      cleaningAssignments.forEach(a => {
        const d = new Date(a.currentCleaningDate);
        if (d.getFullYear() === year && d.getMonth() === month && a.cleanerId) {
          assignmentCounts[a.cleanerId] = (assignmentCounts[a.cleanerId] || 0) + 1;
        }
      });

      // Filter unassigned assignments in this month
      const unassigned = cleaningAssignments.filter(a => {
        const d = new Date(a.currentCleaningDate);
        return d.getFullYear() === year && d.getMonth() === month && !a.cleanerId;
      });

      let newlyAssigned = 0;

      for (const assignment of unassigned) {
        const available = getAvailableCleaners(assignment.currentCleaningDate);
        if (available.length === 0) continue;

        // Sort available cleaners by current count (ascending)
        available.sort((a, b) => (assignmentCounts[a.id] || 0) - (assignmentCounts[b.id] || 0));

        const chosen = available[0];
        try {
          await assignCleaner({
            bookingId: assignment.bookingId,
            cleanerId: chosen.id,
            date: assignment.currentCleaningDate,
            status: 'assigned',
            notes: 'Auto-assigned (fair distribution)',
            estimatedDuration: 120,
          });
          assignmentCounts[chosen.id] = (assignmentCounts[chosen.id] || 0) + 1;
          newlyAssigned++;
        } catch (err) {
          console.error('Auto-assign failed for', assignment, err);
        }
      }

      toast({
        title: 'Fair distribution completed',
        description: `${newlyAssigned} assignments auto-assigned.`,
      });

      // Refresh data
      // avoid double-refetch; only refresh assignments
      refetchCleaningAssignments();
    } catch (err) {
      console.error('Fair distribution error', err);
      toast({
        title: 'Error',
        description: 'Failed to suggest fair distribution.',
        variant: 'destructive',
      });
    } finally {
      setDistributing(false);
    }
  };

  // Firebase Functions base URL (update if region differs)
  const FUNCTIONS_BASE_URL = 'https://us-central1-property-manager-cf570.cloudfunctions.net';

  // Send monthly assignments to all cleaners
  const handleSendMonthlyAssignments = async () => {
    const monthString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    try {
      const resp = await fetch(`${FUNCTIONS_BASE_URL}/sendMonthlyAssignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: monthString })
      });

      if (!resp.ok) {
        throw new Error(`Server responded ${resp.status}`);
      }

      const data = await resp.json();

      toast({
        title: 'Schedules sent',
        description: `${data.totalMessagesSent || 0} cleaners notified for ${monthString}.`
      });
    } catch (err) {
      console.error('Failed to send monthly assignments', err);
      toast({
        title: 'Error',
        description: 'Failed to push schedules to cleaners.',
        variant: 'destructive'
      });
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const { calendarDays, bookingSpans } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0); // Last day of current month
    
    // Calculate how many blank spaces we need at the start to align with the correct day of week
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, ...
    
    const days = [];
    
    // Add blank spaces at the start to align with the correct day of week
    for (let i = 0; i < startDayOfWeek - 1; i++) {
      days.push({
        date: null, // null indicates a blank space
        dayIndex: i,
        weekIndex: Math.floor(i / 7),
        dayOfWeek: i % 7
      });
    }
    
    // Add one day from the previous month (the day before the first day of current month)
    if (startDayOfWeek > 0) {
      const prevMonthLastDay = new Date(year, month, 0); // Last day of previous month
      days.push({
        date: new Date(prevMonthLastDay),
        dayIndex: startDayOfWeek - 1,
        weekIndex: Math.floor((startDayOfWeek - 1) / 7),
        dayOfWeek: (startDayOfWeek - 1) % 7
      });
    }
    
    // Add all days of the current month
    const current = new Date(firstDay);
    for (let i = 0; i < lastDay.getDate(); i++) {
      days.push({
        date: new Date(current),
        dayIndex: startDayOfWeek + i,
        weekIndex: Math.floor((startDayOfWeek + i) / 7),
        dayOfWeek: (startDayOfWeek + i) % 7
      });
      current.setDate(current.getDate() + 1);
    }
    
    // Add blank spaces at the end to complete the grid (if needed)
    const totalDaysInGrid = Math.ceil(days.length / 7) * 7;
    for (let i = days.length; i < totalDaysInGrid; i++) {
      days.push({
        date: null, // null indicates a blank space
        dayIndex: i,
        weekIndex: Math.floor(i / 7),
        dayOfWeek: i % 7
      });
    }

    

    // Process bookings into spans
    const spans: BookingSpan[] = [];
    const processedBookings = new Set<string>(); // Track processed bookings to avoid duplicates

    bookings.forEach(booking => {
      // Skip if already processed (avoid duplicates)
      if (processedBookings.has(booking.id)) return;
      processedBookings.add(booking.id);

      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      
      // Track if we've found the first visible segment for this booking
      let foundFirstVisibleSegment = false;
      
      // In booking systems, checkout date is typically the day the guest leaves
      // So if checkout is Aug 8, they actually stay until the end of Aug 7
      // But based on the cleaning button appearing on day 8, we want to show the booking until day 8
      // So we'll keep the checkout date as is for display purposes
      

      
      // Find start and end positions in calendar (only for days with actual dates)
      const startDayIndex = days.findIndex(day => 
        day.date && day.date.toDateString() === checkIn.toDateString()
      );
      const endDayIndex = days.findIndex(day => 
        day.date && day.date.toDateString() === checkOut.toDateString()
      );

      // Debug logging for specific bookings
      if (booking.guestName === 'Joffrey Swita' || booking.guestName === 'Maximilian Kolb') {
        console.log(`Finding positions for ${booking.guestName}:`, {
          checkIn: checkIn.toDateString(),
          checkOut: checkOut.toDateString(),
          startDayIndex,
          endDayIndex
        });
      }

      if (startDayIndex === -1) return; // Booking outside current view



      // If checkout date is not in current view, extend the booking to the end of the calendar
      // This ensures bookings that extend beyond the current view are still displayed properly
      let actualEndIndex: number;
      if (endDayIndex === -1) {
        // Checkout date is beyond current calendar view
        // Find the last actual date (not blank space) that's within the current calendar view
        let lastActualDateIndex = -1;
        for (let i = days.length - 1; i >= 0; i--) {
          if (days[i].date !== null) {
            lastActualDateIndex = i;
            break;
          }
        }
        actualEndIndex = lastActualDateIndex;

      } else {
        actualEndIndex = endDayIndex;

      }
      
      // Handle bookings that span multiple weeks
      let currentStart = startDayIndex;
      let segmentIndex = 0;
      
      while (currentStart <= actualEndIndex) {
        // Skip if the current start position is a blank space
        if (!days[currentStart]?.date) {
          currentStart++;
          continue;
        }

        const startWeek = Math.floor(currentStart / 7);
        const startDay = currentStart % 7;
        // Fix: weekEnd should be the last day index of this week (0-based)
        const weekEnd = (startWeek + 1) * 7 - 1;
        // The segment should end at the lesser of the booking's end or the end of the week
        const segmentEnd = Math.min(actualEndIndex, weekEnd);
        
        // Ensure the segment end is also an actual date, not a blank space
        let actualSegmentEnd = segmentEnd;
        while (actualSegmentEnd > currentStart && !days[actualSegmentEnd]?.date) {
          actualSegmentEnd--;
        }
        
        const spanDays = actualSegmentEnd - currentStart + 1;

        // All booking bars should be in the same row (stack level 0)
        const stackLevel = 0;

        // Check for actual overlaps (where bookings share the same day)
        const hasOverlap = bookings.some(otherBooking => {
          if (otherBooking.id === booking.id) return false;
          const otherCheckOut = new Date(otherBooking.checkOut);
          const otherCheckIn = new Date(otherBooking.checkIn);
          // Check if the date ranges actually overlap
          const thisCheckIn = new Date(checkIn);
          const thisCheckOut = new Date(checkOut);
          // Two bookings overlap if one starts before the other ends and ends after the other starts
          return (thisCheckIn < otherCheckOut && thisCheckOut > otherCheckIn);
        });

        // Check if this segment is on the last day of the month
        const segmentDate = days[actualSegmentEnd]?.date;
        const isLastDayOfMonth = segmentDate && 
          segmentDate.getDate() === new Date(segmentDate.getFullYear(), segmentDate.getMonth() + 1, 0).getDate();

        // Determine if this is the first visible segment for this booking
        const isFirstVisibleSegment = !foundFirstVisibleSegment;
        if (isFirstVisibleSegment) {
          foundFirstVisibleSegment = true;
        }



        spans.push({
          booking,
          startWeek,
          startDay,
          spanDays,
          hasOverlap,
          stackLevel,
          isFinalSegment: actualSegmentEnd === actualEndIndex,
          isCheckInSegment: currentStart === startDayIndex,
          isCheckOutSegment: actualSegmentEnd === actualEndIndex,
          isLastDayOfMonth: isLastDayOfMonth || false,
          isFirstVisibleSegment
        });

        currentStart = actualSegmentEnd + 1;
        segmentIndex++;
      }
    });



    return { calendarDays: days, bookingSpans: spans };
  }, [currentMonth, bookings]);

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const isCurrentMonth = (date: Date) => {
    if (!date) return false;
    return date.getMonth() === currentMonth.getMonth();
  };

  const isToday = (date: Date) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Get monthly statistics based on current month
  const getMonthlyStats = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Count confirmed bookings whose CHECKOUT falls in this month (aligns with cleaning dates)
    const confirmedBookings = bookings.filter(b => {
      const co = new Date(b.checkOut);
      return b.status === 'confirmed' && co.getFullYear() === year && co.getMonth() === month;
    }).length;
    
    // Get cleaning assignments for the current month using Firestore data
    const monthlyAssignments = cleaningAssignments.filter(assignment => {
      const assignmentDate = new Date(assignment.currentCleaningDate);
      return assignmentDate.getFullYear() === year && 
             assignmentDate.getMonth() === month;
    });
    
    // Get assigned cleanings for the month (cleanerId is not null)
    const assignedCleanings = monthlyAssignments.filter(assignment => 
      assignment.cleanerId !== null
    ).length;
    
    // Get unassigned cleanings for the month (cleanerId is null)
    const unassignedCleanings = monthlyAssignments.filter(assignment => 
      assignment.cleanerId === null
    ).length;
    
    return {
      confirmedBookings,
      assignedCleanings,
      unassignedCleanings
    };
  };

  const stats = getMonthlyStats();

  // Get cleaning indicators for each day
  const getCleaningForDay = (date: Date) => {
    if (!date) return [];
    
    const dateString = date.toLocaleDateString('en-CA');
    
    // Find all assignments where this date is the current cleaning date
    const assignmentsForDate = cleaningAssignments.filter(a => a.currentCleaningDate === dateString);
    
    if (assignmentsForDate.length > 0) {
      // Map to the bookings for these assignments
      const bookingsForDate = assignmentsForDate
        .map(a => bookings.find(b => b.id === a.bookingId))
        .filter((b): b is Booking => Boolean(b));
      return bookingsForDate;
    }
    
    // Return empty array if no assignment found in Firestore
    return [];
  };

  const handleAssignmentInfoClick = (assignment: any, cleaner: any, booking: any) => {
    // Convert the new Firestore assignment structure to the old structure expected by AssignmentInfoModal
    const convertedAssignment = {
      id: assignment.date, // Use date as ID
      date: assignment.currentCleaningDate,
      bookingId: assignment.bookingId,
      cleanerId: assignment.cleanerId,
      status: assignment.cleanerId ? 'assigned' : 'unassigned',
      assignedAt: assignment.updatedAt,
      completedAt: null
    };
    
    setAssignmentInfoModal({
      isOpen: true,
      assignment: convertedAssignment,
      cleaner,
      booking
    });
  };

  const handleAssignmentInfoClose = () => {
    setAssignmentInfoModal({
      isOpen: false,
      assignment: null,
      cleaner: null,
      booking: null
    });
  };

  const handleUnassign = () => {
    // Refresh assignments only
    refetchCleaningAssignments();
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    setDragPosition(null);
    setNearDropZone(null);
  };

  const handleDragMove = (event: any) => {
    if (activeDragId) {
      setDragPosition({ x: event.delta.x, y: event.delta.y });
      
      // Get the mouse position relative to the viewport
      const mouseX = event.delta.x;
      const mouseY = event.delta.y;
      
      // Check if we're near any valid drop zones
      const validDropZones = calendarDays
        .filter(day => day.date)
        .filter(day => {
          const dateString = day.date!.toLocaleDateString('en-CA');
          const cleaningItems = getCleaningForDay(day.date!);
          return cleaningItems.some(cleaningItem => {
            const originalDate = movedAssignments.get(cleaningItem.id)?.originalDate || dateString;
            return isValidDropZone(originalDate, dateString, cleaningItem);
          });
        });
      
      // Find the closest drop zone using a more sophisticated approach
      let closestZone: string | null = null;
      let minDistance = Infinity;
      const magneticThreshold = 150; // pixels
      
      validDropZones.forEach(day => {
        const dateString = day.date!.toLocaleDateString('en-CA');
        
        // Calculate distance to this drop zone
        // For now, we'll use a simple approach based on the day index
        const dayIndex = calendarDays.findIndex(d => d.date && d.date.toLocaleDateString('en-CA') === dateString);
        if (dayIndex !== -1) {
          const weekIndex = Math.floor(dayIndex / 7);
          const dayOfWeek = dayIndex % 7;
          
          // Estimate position based on grid layout
          const estimatedX = dayOfWeek * 100; // Approximate cell width
          const estimatedY = weekIndex * 120; // Approximate cell height
          
          const distance = Math.sqrt(
            Math.pow(mouseX - estimatedX, 2) + Math.pow(mouseY - estimatedY, 2)
          );
          
          if (distance < minDistance && distance < magneticThreshold) {
            minDistance = distance;
            closestZone = dateString;
          }
        }
      });
      
      setNearDropZone(closestZone);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    console.log('=== DRAG END DEBUG ===');
    console.log('Active ID:', active.id);
    console.log('Over ID:', over.id);
    console.log('Over data:', over.data.current);
    
    if (over && over.data.current?.type === 'calendar-cell') {
      // Parse the active ID to extract date and booking ID
      const activeId = active.id as string;
      // The ID format is: cleaning-{date}-{bookingId}
      // Example: cleaning-2025-08-01-9-6748325892-i3fklqfu09
      const parts = activeId.split('-');
      
      if (parts.length >= 4) {
        // Extract date (first 3 parts after 'cleaning')
        const originalDate = `${parts[1]}-${parts[2]}-${parts[3]}`;
        // Extract booking ID (everything after the date)
        const bookingId = parts.slice(4).join('-');
        
                        // Instead of relying on over.data.current?.date, use the drop zone detection logic
        // that we know is working correctly
        const validZonesForBooking = validDropZones.get(bookingId);
        console.log('Valid drop zones for booking:', validZonesForBooking);
        
        // Use the same logic as the useDroppable hook to determine the actual drop target
        const validDropZoneArray = Array.from(validZonesForBooking || []);
        let newDate = validDropZoneArray[0]; // Default to first valid zone
        
        // Extract the date from the over ID using the same method as useDroppable
        if (over.id && typeof over.id === 'string' && over.id.startsWith('calendar-cell-')) {
          const overDate = over.id.replace('calendar-cell-', '');
          console.log('Over date from ID:', overDate);
          
          // Check if this date is in our valid drop zones
          if (validDropZoneArray.includes(overDate)) {
            newDate = overDate;
            console.log('Using over date as drop target:', overDate);
          } else {
            console.log('Over date not in valid drop zones - no action taken');
            // Clear drag state when drop fails
            setActiveDragId(null);
            setDragPosition(null);
            setNearDropZone(null);
            return; // Exit early if drop target is not valid
          }
        }
        
        console.log('Using drop zone:', { originalDate, newDate, bookingId });
        
        // Find the existing cleaning assignment first
        const existingAssignment = cleaningAssignments.find(a => 
          a.bookingId === bookingId && a.currentCleaningDate === originalDate
        );
        
        // Check if dropping back to original date (revert case)
        if (existingAssignment && newDate === existingAssignment.originalBookingDate) {
          // Optimistic UI update - update local state immediately
          const revertedAssignment = {
            ...existingAssignment,
            currentCleaningDate: existingAssignment.originalBookingDate,
            bookingDateChanged: false
          };
          
          // Update local cleaning assignments state immediately
          updateAssignmentOptimistically(revertedAssignment);
          
          // Clear the moved assignments state
          setMovedAssignments(prev => {
            const newMap = new Map(prev);
            newMap.delete(bookingId);
            return newMap;
          });
          
          console.log(`✅ Reverted: ${originalDate} → ${existingAssignment.originalBookingDate}`);
          
          // Save to Firestore in background
          createOrUpdateAssignment(revertedAssignment).then(() => {
            console.log('✅ Reverted assignment in Firestore');
          }).catch(error => {
            console.error('❌ Error reverting assignment:', error);
            // Revert the optimistic update on error
            updateAssignmentOptimistically(existingAssignment);
          });
        } else if (newDate && originalDate !== newDate) {
          // Find the booking object
          const booking = bookings.find(b => b.id === bookingId);
          
          if (!booking) {
            console.log('Booking not found for ID:', bookingId);
            return;
          }
          
          // Check if the new date is valid (before next booking)
          // For moved assignments, use the original booking date for validation
          const validationOriginalDate = existingAssignment && existingAssignment.bookingDateChanged 
            ? existingAssignment.originalBookingDate 
            : originalDate;
          const isValidMove = isValidDropZone(validationOriginalDate, newDate, booking);
        
                  console.log('Valid move:', isValidMove);
          
          if (isValidMove) {
            // Find the existing cleaning assignment
            const existingAssignment = cleaningAssignments.find(a => 
              a.bookingId === bookingId && a.currentCleaningDate === originalDate
            );
          
          if (existingAssignment) {
            // Update the existing assignment with the new date
            const updatedAssignment = {
              ...existingAssignment,
              currentCleaningDate: newDate,
              bookingDateChanged: true
            };
            
            // Save to Firestore
            createOrUpdateAssignment(updatedAssignment).then(() => {
              console.log('✅ Updated assignment in Firestore');
              // Refetch to get updated data
              refetchCleaningAssignments();
            }).catch(error => {
              console.error('❌ Error updating assignment:', error);
            });
          } else {
            // This should not happen - we should always find an existing assignment
            console.error('❌ No existing assignment found for booking:', bookingId);
          }
          
          // Update the moved assignments state for immediate UI feedback
          setMovedAssignments(prev => {
            const newMap = new Map(prev);
            newMap.set(bookingId, { originalDate, newDate });
            return newMap;
          });
          
                    console.log(`✅ Moved: ${originalDate} → ${newDate}`);
        } else {
          console.log('❌ Invalid move - drop zone validation failed');
        }
      } else {
        console.log('❌ Same date or no valid new date');
      }
    } else {
      console.log('❌ Could not parse active ID:', activeId);
    }
          } else {
        console.log('❌ No valid drop target');
      }
    
    setActiveDragId(null);
    setDragPosition(null);
    setNearDropZone(null);
  };

  // Helper function to check if a drop zone is valid
  const isValidDropZone = (originalDate: string, newDate: string, booking: Booking) => {
    const original = new Date(originalDate);
    const newDateObj = new Date(newDate);
    
    // Must be moving forward in time
    if (newDateObj <= original) return false;
    
    // Find the next booking that starts on or after the original date
    const nextBooking = bookings.find(b => {
      const checkIn = new Date(b.checkIn);
      return checkIn >= original && b.id !== booking.id;
    });
    
    if (nextBooking) {
      const nextCheckIn = new Date(nextBooking.checkIn);
      // Must be before the next booking
      if (newDateObj >= nextCheckIn) return false;
    }
    
    // Check if the newDate is occupied by a DIFFERENT booking (not the same booking)
    const isOccupiedByOther = bookings.some(b => {
      if (b.id === booking.id) return false; // Same booking - allow cleaning during stay
      
      const bCheckIn = new Date(b.checkIn);
      const bCheckOut = new Date(b.checkOut);
      // A day is occupied if it falls within another booking's check-in to check-out range
      // BUT: check-in day is NOT occupied (cleaning can happen before guest arrives)
      return (newDateObj > bCheckIn && newDateObj < bCheckOut);
    });
    
    if (isOccupiedByOther) return false;
    
    return true;
  };

  // Debug: Log all valid drop zones for a specific booking
  // Calculate which cleanings are allowed to be moved and their valid drop zones
  const calculateDraggableCleanings = useCallback(() => {
    const draggable = new Set<string>();
    const dropZones = new Map<string, Set<string>>();
    
    // Sort bookings by check-out date to process them in order
    const sortedBookings = [...bookings].sort((a, b) => 
      new Date(a.checkOut).getTime() - new Date(b.checkOut).getTime()
    );
    
    sortedBookings.forEach(booking => {
      if (!booking.cleaningRequired) return;
      
      const checkOutDate = new Date(booking.checkOut);
      
      // Check if there's an existing assignment for this booking
      const existingAssignment = cleaningAssignments.find(a => a.bookingId === booking.id);
      
      // For moved assignments, calculate drop zones based on original booking date
      // For unmoved assignments, use the current cleaning date or checkout date
      const baseDate = existingAssignment && existingAssignment.bookingDateChanged 
        ? new Date(existingAssignment.originalBookingDate) 
        : (existingAssignment ? new Date(existingAssignment.currentCleaningDate) : checkOutDate);
      
      // Find the next booking that starts on or after the base date
      const nextBooking = sortedBookings.find(b => {
        const bCheckIn = new Date(b.checkIn);
        return bCheckIn >= baseDate && b.id !== booking.id;
      });
      
      if (nextBooking) {
        const nextCheckIn = new Date(nextBooking.checkIn);
        
        // Check if there are ANY available days between base date and next check-in
        let hasAvailableDays = false;
        let validZones = new Set<string>();
        let currentDate = new Date(baseDate);
        currentDate.setDate(currentDate.getDate() + 1); // Start from day after base date
        
        while (currentDate <= nextCheckIn) {
          // Check if this specific date is available (no other bookings)
          const isAvailable = !sortedBookings.some(otherBooking => {
            if (otherBooking.id === booking.id) return false;
            
            const otherCheckIn = new Date(otherBooking.checkIn);
            const otherCheckOut = new Date(otherBooking.checkOut);
            
            // A day is occupied if it falls within another booking's stay
            // BUT: check-in day is available (cleaning can happen before guest arrives)
            return currentDate > otherCheckIn && currentDate < otherCheckOut;
          });
          
          if (isAvailable) {
            hasAvailableDays = true;
            validZones.add(currentDate.toLocaleDateString('en-CA'));
          }
          
          // Move to next day
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // If this cleaning has been moved, adjust the valid zones
        if (existingAssignment && existingAssignment.bookingDateChanged) {
          // Add the original date back (for reverting)
          validZones.add(existingAssignment.originalBookingDate);
          // Remove the current date (where it's currently located)
          validZones.delete(existingAssignment.currentCleaningDate);
          hasAvailableDays = true;
        }
        
        // Only allow dragging if there are available days
        if (hasAvailableDays) {
          draggable.add(booking.id);
          dropZones.set(booking.id, validZones);
        }
        

      } else {
        // No next booking, check if there are any available days after check-out
        let hasAvailableDays = false;
        let validZones = new Set<string>();
        let currentDate = new Date(checkOutDate);
        currentDate.setDate(currentDate.getDate() + 1);
        
        // Check the next 30 days for any availability
        for (let i = 0; i < 30; i++) {
          const isAvailable = !sortedBookings.some(otherBooking => {
            if (otherBooking.id === booking.id) return false;
            
            const otherCheckIn = new Date(otherBooking.checkIn);
            const otherCheckOut = new Date(otherBooking.checkOut);
            
            return currentDate >= otherCheckIn && currentDate < otherCheckOut;
          });
          
          if (isAvailable) {
            hasAvailableDays = true;
            validZones.add(currentDate.toLocaleDateString('en-CA'));
          }
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // If this cleaning has been moved, adjust the valid zones
        if (existingAssignment && existingAssignment.bookingDateChanged) {
          // Add the original date back (for reverting)
          validZones.add(existingAssignment.originalBookingDate);
          // Remove the current date (where it's currently located)
          validZones.delete(existingAssignment.currentCleaningDate);
          hasAvailableDays = true;
        }
        
        if (hasAvailableDays) {
          draggable.add(booking.id);
          dropZones.set(booking.id, validZones);
        }
      }
    });
    
    setDraggableCleanings(draggable);
    setValidDropZones(dropZones);
    

  }, [bookings, cleaningAssignments]);

  // Calculate draggable cleanings when bookings or cleaning assignments change
  useEffect(() => {
    if (bookings.length > 0) {
      calculateDraggableCleanings();
    }
  }, [bookings, cleaningAssignments, calculateDraggableCleanings]);

  // Auto-heal: ensure Firestore has an assignment for each checkout in the visible month
  useEffect(() => {
    if (bookings.length === 0) return;
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const storageKey = `autoHealRan-${monthKey}`;
    try {
      const ranFlag = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (ranFlag === 'true') {
        return; // already ran this month in this browser session
      }
    } catch {}

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const bookingsInMonth = bookings.filter(b => {
      const co = new Date(b.checkOut);
      return co >= monthStart && co <= monthEnd && b.cleaningRequired !== false;
    });
    const missing = bookingsInMonth.filter(b => 
      !cleaningAssignments.some(a => a.bookingId === b.id && a.currentCleaningDate === b.checkOut)
    );
    if (missing.length > 0) {
      // Fire-and-forget to create any missing assignments
      syncAssignments(missing).then(() => {
        try { if (typeof window !== 'undefined') localStorage.setItem(storageKey, 'true'); } catch {}
        refetchCleaningAssignments();
      }).catch(() => {});
    } else {
      try { if (typeof window !== 'undefined') localStorage.setItem(storageKey, 'true'); } catch {}
    }
  }, [bookings, currentMonth, cleaningAssignments]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="p-6 text-center">
          <p className="text-destructive mb-4">Error loading bookings: {error}</p>
          <Button onClick={refetchBookings} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleRefresh = useCallback(() => {
    if ((handleRefresh as any)._lock) return;
    (handleRefresh as any)._lock = true;
    refetchBookings();
    refetchCleaningAssignments();
    setTimeout(() => { (handleRefresh as any)._lock = false; }, 1000);
  }, [refetchBookings, refetchCleaningAssignments]);

  return (
    <div className="space-y-6">
      {/* Header with monthly stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-booking-confirmed" />
              <div>
                <p className="text-2xl font-bold">{stats.confirmedBookings}</p>
                <p className="text-sm text-muted-foreground">Confirmed Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.assignedCleanings}</p>
                <p className="text-sm text-muted-foreground">Assigned Cleanings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.unassignedCleanings}</p>
                <p className="text-sm text-muted-foreground">Unassigned Cleanings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <Button onClick={handleSuggestFairDistribution} variant="outline" size="sm" disabled={distributing}>
          <Scale className={cn("w-4 h-4 mr-2", distributing && "animate-spin")}/>
          Suggest Distribution
        </Button>
        <Button onClick={handleSendMonthlyAssignments} variant="default" size="sm">
          <Send className="w-4 h-4 mr-2" />
          Send Schedules
        </Button>
        <Button onClick={handleRefresh} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </Button>
        <Button onClick={goToToday} variant="outline" size="sm">
          Today
        </Button>
      </div>

      {/* Calendar */}
      <DndContext 
        sensors={sensors}
        onDragStart={handleDragStart} 
        onDragMove={handleDragMove} 
        onDragEnd={handleDragEnd}
      >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
              <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Days of week header */}
          <div className="grid grid-cols-7 border-b">
            {daysOfWeek.map(day => (
              <div key={day} className="p-3 text-center font-medium text-muted-foreground bg-muted/30">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid with booking spans */}
          <div className="relative">
            {/* Week rows */}
            {Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 relative" style={{ minHeight: '120px' }}>
                <>
                  {/* Day cells for this week */}
                  {calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, dayIndex) => {
                    // Handle blank spaces (null dates)
                    if (!day.date) {
                      return (
                        <div
                          key={day.dayIndex}
                          className="p-2 border-r border-b bg-muted/20"
                        >
                          {/* Empty cell for blank space */}
                        </div>
                      );
                    }
                    
                    const cleaningItems = getCleaningForDay(day.date);
                      const dateString = day.date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
                      

                      
                      // Use Firestore cleaning assignments data directly
                      // Find assignment where this date is the current cleaning date
                      const assignment = cleaningAssignments.find(a => a.currentCleaningDate === dateString);
                      const hasAssignment = assignment && assignment.cleanerId !== null;
                      
                      // Also find assignments that have this date as their original date (for showing faded indicators)
                      const originalAssignment = cleaningAssignments.find(a => a.originalBookingDate === dateString && a.bookingDateChanged);
                      
                      // Get cleaner name if assignment exists
                      const cleanerName = assignment?.cleanerName || null;
                      
                      const cleaner = assignment?.cleanerId 
                        ? cleaners.find(c => c.id === assignment.cleanerId)
                        : null;
                      
                      const booking = assignment 
                        ? cleaningItems.find(b => b.id === assignment.bookingId)
                        : null;
                      
                      // Determine the next guest booking after this cleaning date for display
                      let nextGuestBooking: Booking | undefined;
                      if (booking) {
                        const currentDateObj = new Date(dateString);
                        nextGuestBooking = bookings
                          .filter(b => new Date(b.checkIn) >= currentDateObj && b.id !== booking.id)
                          .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())[0];
                      }
                      
                      // Check if this is a valid drop zone for the specific cleaning being dragged
                      let finalIsValidDropZone = false;
                      
                      if (activeDragId) {
                        // Extract the booking ID from the active drag ID
                        // Format: "cleaning-2025-08-21-0-HMCZ4WC29P-i3fkl9jm5w"
                        const dragIdParts = activeDragId.split('-');
                        // Remove "cleaning" and date parts, join the rest as the booking ID
                        const bookingIdParts = dragIdParts.slice(4); // Skip "cleaning", "2025", "08", "21"
                        const draggedBookingId = bookingIdParts.join('-');
                        
                        // Check if this date is in the pre-calculated valid drop zones for this booking
                        const validZonesForBooking = validDropZones.get(draggedBookingId);
                        if (validZonesForBooking) {
                          finalIsValidDropZone = validZonesForBooking.has(dateString);
                        }
                        
                        // Debug: Log drop zone detection for specific dates
                        if (dateString === '2025-08-02' || dateString === '2025-08-01') {
                          console.log(`Drop zone for ${dateString}:`, {
                            activeDragId,
                            draggedBookingId,
                            validZonesForBooking: Array.from(validZonesForBooking || []),
                            finalIsValidDropZone
                          });
                        }
                      }


                      
                      const isNearDragZone = nearDropZone === dateString;
                    
                    return (
                        <DroppableCalendarCell
                        key={day.dayIndex}
                          date={day.date}
                          isCurrentMonth={isCurrentMonth(day.date)}
                          isToday={isToday(day.date)}
                          isValidDropZone={finalIsValidDropZone}
                          isNearDrag={isNearDragZone}
                          isDragging={!!activeDragId}
                      >
                        <div className="mb-2">
                          <span className={cn(
                            "text-sm font-medium",
                            isToday(day.date) && "text-primary font-bold"
                          )}>
                            {day.date.getDate()}
                          </span>
                        </div>
                        
                          {/* Drop zone indicator - show when this is a valid drop zone AND dragging */}
                          {finalIsValidDropZone && cleaningItems.length === 0 && !!activeDragId && (
                            <div className="absolute bottom-2 left-2 right-2 transition-all duration-200 rounded-sm bg-blue-50/50 opacity-60" style={{ border: '2px dotted #93c5fd' }}>
                              <div className="px-2 py-1 text-[10px] font-medium text-center text-blue-600 h-5">
                                
                              </div>
                            </div>
                          )}
                          


                          {/* Show faded indicator if this is the original location after move (from Firestore) - outside cleaning items */}
                          {originalAssignment && (
                            <FadedAssignmentIndicator
                              cleanerName="Ten清掃不足"
                              isVisible={true}
                            />
                          )}

                          {/* Render all cleaning assignments for this day */}
                          {cleaningAssignments
                            .filter(a => a.currentCleaningDate === dateString)
                            .map(a => {
                              const bookingForAssignment = bookings.find(b => b.id === a.bookingId);
                              if (!bookingForAssignment) return null;
                              const cleanerForAssignment = a.cleanerId ? cleaners.find(c => c.id === a.cleanerId) : null;

                              // Determine the next guest booking after this cleaning date for display
                              const currentDateObj = new Date(dateString);
                              const nextGuest = bookings
                                .filter(b => new Date(b.checkIn) >= currentDateObj && b.id !== bookingForAssignment.id)
                                .sort((x, y) => new Date(x.checkIn).getTime() - new Date(y.checkIn).getTime())[0];

                              if (a.cleanerId && cleanerForAssignment) {
                                // Assigned - show clickable cleaner name for assignment info
                                return (
                                  <div
                                    key={`${a.bookingId}-assigned`}
                                    className="absolute bottom-2 left-2 right-2 cursor-pointer transition-all duration-200 rounded-sm border hover:bg-green-200 hover:border-green-400 border-green-300 bg-green-50 group"
                                    onClick={() => handleAssignmentInfoClick(a, cleanerForAssignment, bookingForAssignment)}
                                    title="Click to view assignment details"
                                  >
                                    <div className="px-2 py-1 text-[10px] font-medium text-center text-green-700 group-hover:text-green-800 flex items-center justify-center gap-1">
                                      <span>{a.cleanerName || 'Assigned'}</span>
                                      <Info className="h-2 w-2 opacity-60 group-hover:opacity-100" />
                                    </div>
                                  </div>
                                );
                              }

                              // Unassigned - show draggable assignment
                              return (
                                 <div className="contents" key={`assignment-${a.currentCleaningDate}-${a.bookingId}`}>
                                   {/* Show faded indicator if this is the original location during drag */}
                                   {activeDragId === `cleaning-${dateString}-${bookingForAssignment.id}` && (
                                     <FadedAssignmentIndicator
                                       key={`${a.bookingId}-fade-active`}
                                       cleanerName="Ten清掃不足"
                                       isVisible={true}
                                     />
                                   )}
                                   
                                   {/* Show faded indicator if this is the original location after move (from Firestore) */}
                                   {a.bookingDateChanged && a.originalBookingDate === dateString && (
                                     <FadedAssignmentIndicator
                                       key={`${a.bookingId}-fade-original`}
                                       cleanerName="Ten清掃不足"
                                       isVisible={true}
                                     />
                                   )}
                                   
                                   {(!a.bookingDateChanged || a.currentCleaningDate === dateString) && 
                                    activeDragId !== `cleaning-${dateString}-${bookingForAssignment.id}` && (
                                     <DraggableCleaningAssignment
                                       key={`${a.bookingId}-draggable`}
                                       date={dateString}
                                       booking={bookingForAssignment}
                                       displayBooking={nextGuest || undefined}
                                       onAssignmentComplete={(assignment) => {
                                         console.log('Assignment completed:', assignment);
                                         refetchCleaners();
                                         refetchCleaningAssignments();
                                       }}
                                       isDragging={activeDragId === `cleaning-${dateString}-${bookingForAssignment.id}`}
                                       isNearDropZone={isNearDragZone}
                                       isDraggable={draggableCleanings.has(bookingForAssignment.id)}
                                     />
                                   )}
                                 </div>
                               );
                            })}

                           {/* Fallback: show placeholder for bookings checking out today without an assignment doc */}
                           {bookings
                             .filter(b => new Date(b.checkOut).toLocaleDateString('en-CA') === dateString)
                             .filter(b => !cleaningAssignments.some(a => a.currentCleaningDate === dateString && a.bookingId === b.id))
                             .map(b => {
                               const currentDateObj = new Date(dateString);
                               const nextGuest = bookings
                                 .filter(x => new Date(x.checkIn) >= currentDateObj && x.id !== b.id)
                                 .sort((x, y) => new Date(x.checkIn).getTime() - new Date(y.checkIn).getTime())[0];
                               return (
                                 <DraggableCleaningAssignment
                                   key={`placeholder-${dateString}-${b.id}`}
                                   date={dateString}
                                   booking={b}
                                   displayBooking={nextGuest || undefined}
                                   onAssignmentComplete={(assignment) => {
                                     console.log('Assignment completed:', assignment);
                                     refetchCleaners();
                                     refetchCleaningAssignments();
                                   }}
                                   isDragging={activeDragId === `cleaning-${dateString}-${b.id}`}
                                   isNearDropZone={isNearDragZone}
                                   isDraggable={draggableCleanings.has(b.id)}
                                 />
                               );
                             })}
                         
                         {/* Show move indicator (from Firestore) - only at the original date */}
                         {cleaningAssignments.some(assignment => 
                           assignment.bookingDateChanged && assignment.originalBookingDate === dateString
                         ) && (
                           <MoveIndicator
                             originalDate={cleaningAssignments.find(a => a.bookingDateChanged && a.originalBookingDate === dateString)?.originalBookingDate || ''}
                             newDate={cleaningAssignments.find(a => a.bookingDateChanged && a.originalBookingDate === dateString)?.currentCleaningDate || ''}
                             originalDayIndex={calendarDays.findIndex(d => d.date && d.date.toLocaleDateString('en-CA') === dateString)}
                             newDayIndex={calendarDays.findIndex(d => d.date && d.date.toLocaleDateString('en-CA') === cleaningAssignments.find(a => a.bookingDateChanged && a.originalBookingDate === dateString)?.currentCleaningDate)}
                             weekIndex={weekIndex}
                           />
                         )}
                        </DroppableCalendarCell>
                    );
                  })}

                  {/* Booking spans for this week */}
                  {bookingSpans
                    .filter(span => span.startWeek === weekIndex)
                    .map((span, index) => (
                      <BookingBar
                        key={`${span.booking.id}-${weekIndex}-${index}`}
                        booking={span.booking}
                        startDay={span.startDay}
                        spanDays={span.spanDays}
                        weekOffset={weekIndex}
                        hasOverlap={span.hasOverlap}
                        stackLevel={span.stackLevel}
                        isFinalSegment={span.isFinalSegment}
                        isCheckInSegment={span.isCheckInSegment}
                        isCheckOutSegment={span.isCheckOutSegment}
                        isLastDayOfMonth={span.isLastDayOfMonth}
                          isFirstVisibleSegment={span.isFirstVisibleSegment}
                      />
                    ))
                  }
                </>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
        
        {/* Drag Overlay */}
        <DragOverlay>
          {activeDragId ? (
            <div className="px-2 py-1 text-[10px] font-medium text-center text-red-700 bg-red-50 border border-red-300 rounded-sm opacity-80 shadow-none">
              Ten清掃不足
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Assignment Info Modal */}
      {assignmentInfoModal.isOpen && assignmentInfoModal.assignment && assignmentInfoModal.cleaner && assignmentInfoModal.booking && (
        <AssignmentInfoModal
          assignment={assignmentInfoModal.assignment}
          cleaner={assignmentInfoModal.cleaner}
          booking={assignmentInfoModal.booking}
          displayBooking={(() => {
            const date = assignmentInfoModal.assignment.date;
            const currentDateObj = new Date(date);
            const currentBooking = assignmentInfoModal.booking;
            const next = bookings
              .filter(b => new Date(b.checkIn) >= currentDateObj && b.id !== currentBooking.id)
              .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())[0];
            return next;
          })()}
          isOpen={assignmentInfoModal.isOpen}
          onClose={handleAssignmentInfoClose}
          onUnassign={handleUnassign}
        />
      )}
    </div>
  );
};