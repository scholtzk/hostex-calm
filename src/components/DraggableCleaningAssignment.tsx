import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { CleaningAssignmentModal } from './CleaningAssignmentModal';
import { Booking } from '@/types/booking';
import { cn } from '@/lib/utils';

interface DraggableCleaningAssignmentProps {
  date: string;
  booking: Booking;
  onAssignmentComplete?: (assignment: any) => void;
  isDragging?: boolean;
  isNearDropZone?: boolean;
  isDraggable?: boolean;
  displayBooking?: Booking;
}

export const DraggableCleaningAssignment = ({ 
  date, 
  booking, 
  onAssignmentComplete,
  isDragging = false,
  isNearDropZone = false,
  isDraggable = true,
  displayBooking
}: DraggableCleaningAssignmentProps) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `cleaning-${date}-${booking.id}`,
    data: {
      date,
      booking,
      type: 'cleaning-assignment'
    },
    disabled: !isDraggable
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <CleaningAssignmentModal
      date={date}
      booking={booking}
      displayBooking={displayBooking}
      onAssignmentComplete={onAssignmentComplete}
    >
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={cn(
          "absolute bottom-2 left-2 right-2 transition-all duration-200 rounded-sm border",
          "hover:bg-red-100 border-red-300 bg-red-50",
          isDragging && "opacity-50 cursor-grabbing",
          isNearDropZone && "scale-105",
          "cursor-grab active:cursor-grabbing"
        )}
        title="Click to assign cleaner, drag to move"
      >
        <div className="px-2 py-1 text-[10px] font-medium text-center text-red-700">
          Ten清掃不足
        </div>
      </div>
    </CleaningAssignmentModal>
  );
}; 