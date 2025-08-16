import React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MoveIndicatorProps {
  originalDate: string;
  newDate: string;
  originalDayIndex: number;
  newDayIndex: number;
  weekIndex: number;
}

export const MoveIndicator = ({ 
  originalDate, 
  newDate, 
  originalDayIndex, 
  newDayIndex, 
  weekIndex 
}: MoveIndicatorProps) => {
  // Only show if dates are different
  if (originalDate === newDate) return null;

  const isSameWeek = Math.floor(originalDayIndex / 7) === Math.floor(newDayIndex / 7);
  
  if (isSameWeek) {
    // Same week - show horizontal arrow with text
    const startPosition = (originalDayIndex % 7) * (100 / 7) + (100 / 7) / 2;
    const endPosition = (newDayIndex % 7) * (100 / 7) + (100 / 7) / 2;
    const width = Math.abs(endPosition - startPosition);
    const left = Math.min(startPosition, endPosition);

    return (
              <div className="absolute bottom-8 left-2 right-2 flex items-center justify-center text-blue-600 text-[10px] opacity-60">
          <span>Moved</span>
          <svg className="absolute right-2 w-14 h-4" viewBox="0 0 56 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 8h50M50 8l-6-6M50 8l-6 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
    );
  } else {
    // Different weeks - show vertical arrow at the bottom
    return (
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex items-center gap-1 text-blue-600 text-xs opacity-60">
        <span className="text-[10px]">Moved</span>
        <ArrowRight className="w-3 h-3" />
      </div>
    );
  }
}; 