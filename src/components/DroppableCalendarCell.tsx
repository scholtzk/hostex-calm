import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

interface DroppableCalendarCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isValidDropZone: boolean;
  isNearDrag: boolean;
  isDragging: boolean;
  children: React.ReactNode;
  className?: string;
}

export const DroppableCalendarCell = ({ 
  date, 
  isCurrentMonth, 
  isToday, 
  isValidDropZone,
  isNearDrag,
  isDragging,
  children,
  className 
}: DroppableCalendarCellProps) => {
  const dateString = date.toLocaleDateString('en-CA');
  
  const { setNodeRef, isOver } = useDroppable({
    id: `calendar-cell-${dateString}`,
    data: {
      date: dateString,
      type: 'calendar-cell'
    }
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "p-2 border-r border-b relative",
        !isCurrentMonth && "bg-muted/20 text-muted-foreground",
        isToday && "bg-primary/5 border-primary/20",
        isValidDropZone && isDragging && isOver && "bg-blue-50 border-blue-200",
        isValidDropZone && isDragging && isNearDrag && "animate-pulse",
        className
      )}
    >
      {children}
    </div>
  );
}; 