import React from 'react';
import { AvailabilityCalendar } from '@/components/AvailabilityCalendar';

const AvailabilityTest: React.FC = () => {
  // Use current month for testing
  const currentMonth = new Date().toISOString().slice(0, 7); // Format: "2025-03"
  
  return (
    <AvailabilityCalendar 
      cleanerId="test-cleaner-id"
      cleanerName="Test Cleaner"
      month={currentMonth}
    />
  );
};

export default AvailabilityTest; 