import React from 'react';
import { cn } from '@/lib/utils';

interface FadedAssignmentIndicatorProps {
  cleanerName: string;
  isVisible: boolean;
}

export const FadedAssignmentIndicator = ({ 
  cleanerName, 
  isVisible 
}: FadedAssignmentIndicatorProps) => {
  if (!isVisible) return null;

  return (
    <div className="absolute bottom-2 left-2 right-2 transition-all duration-200 rounded-sm border border-dashed border-gray-300 bg-gray-50/50 opacity-50">
      <div className="px-2 py-1 text-[10px] font-medium text-center text-gray-500">
        {cleanerName}
      </div>
    </div>
  );
}; 