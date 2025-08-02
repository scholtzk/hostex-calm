import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookingBar } from './BookingBar';
import { useBookings } from '@/hooks/useBookings';
import { Booking } from '@/types/booking';
import { cn } from '@/lib/utils';

interface BookingSpan {
  booking: Booking;
  startWeek: number;
  startDay: number;
  spanDays: number;
  hasOverlap: boolean;
  stackLevel: number;
}

export const BookingCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { bookings, loading, error, refetch } = useBookings();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const { calendarDays, bookingSpans } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startCalendar = new Date(firstDay);
    startCalendar.setDate(startCalendar.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startCalendar);

    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      days.push({
        date: new Date(current),
        dayIndex: i,
        weekIndex: Math.floor(i / 7),
        dayOfWeek: i % 7
      });
      current.setDate(current.getDate() + 1);
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
      
      // Find start and end positions in calendar
      const startDayIndex = days.findIndex(day => 
        day.date.toDateString() === checkIn.toDateString()
      );
      const endDayIndex = days.findIndex(day => 
        day.date.toDateString() === checkOut.toDateString()
      );

      if (startDayIndex === -1) return; // Booking outside current view

      const actualEndIndex = endDayIndex === -1 ? days.length - 1 : endDayIndex - 1;
      
      // Handle bookings that span multiple weeks
      let currentStart = startDayIndex;
      let segmentIndex = 0;
      
      while (currentStart <= actualEndIndex) {
        const startWeek = Math.floor(currentStart / 7);
        const startDay = currentStart % 7;
        const weekEnd = (startWeek + 1) * 7 - 1;
        const segmentEnd = Math.min(actualEndIndex, weekEnd);
        const spanDays = segmentEnd - currentStart + 1;

        // Find stack level by checking for overlaps with existing spans in this week
        let stackLevel = 0;
        const existingSpansInWeek = spans.filter(s => s.startWeek === startWeek);
        
        // Check each stack level until we find a free one
        while (true) {
          const hasConflict = existingSpansInWeek.some(existingSpan => {
            if (existingSpan.stackLevel !== stackLevel) return false;
            
            const existingStart = existingSpan.startDay;
            const existingEnd = existingSpan.startDay + existingSpan.spanDays - 1;
            const newStart = startDay;
            const newEnd = startDay + spanDays - 1;
            
            // Check for overlap
            return !(newEnd < existingStart || newStart > existingEnd);
          });
          
          if (!hasConflict) break;
          stackLevel++;
        }

        // Check for same-day checkout/checkin overlaps
        const hasOverlap = bookings.some(otherBooking => {
          if (otherBooking.id === booking.id) return false;
          const otherCheckOut = new Date(otherBooking.checkOut);
          const otherCheckIn = new Date(otherBooking.checkIn);
          return (otherCheckOut.toDateString() === checkIn.toDateString()) ||
                 (otherCheckIn.toDateString() === checkOut.toDateString());
        });

        spans.push({
          booking,
          startWeek,
          startDay,
          spanDays,
          hasOverlap,
          stackLevel
        });

        currentStart = weekEnd + 1;
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
    return date.getMonth() === currentMonth.getMonth();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getTotalBookings = () => bookings.filter(b => b.status === 'confirmed').length;
  const getPendingBookings = () => bookings.filter(b => b.status === 'pending').length;
  const getCleaningRequired = () => bookings.filter(b => b.cleaningRequired && b.cleaningStatus === 'pending').length;

  // Get cleaning indicators for each day
  const getCleaningForDay = (date: Date) => {
    return bookings.filter(booking => {
      const checkOut = new Date(booking.checkOut);
      return checkOut.toDateString() === date.toDateString() && booking.cleaningRequired;
    });
  };

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
          <Button onClick={refetch} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-booking-confirmed" />
              <div>
                <p className="text-2xl font-bold">{getTotalBookings()}</p>
                <p className="text-sm text-muted-foreground">Confirmed Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-booking-pending" />
              <div>
                <p className="text-2xl font-bold">{getPendingBookings()}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-cleaning" />
              <div>
                <p className="text-2xl font-bold">{getCleaningRequired()}</p>
                <p className="text-sm text-muted-foreground">Cleaning Required</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <Button onClick={refetch} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={goToToday} variant="outline" size="sm">
              Today
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
            <div className="flex gap-2">
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
            {Array.from({ length: 6 }, (_, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 relative" style={{ minHeight: '120px' }}>
                {/* Day cells for this week */}
                {calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, dayIndex) => {
                  const cleaningItems = getCleaningForDay(day.date);
                  
                  return (
                    <div
                      key={day.dayIndex}
                      className={cn(
                        "p-2 border-r border-b relative",
                        !isCurrentMonth(day.date) && "bg-muted/20 text-muted-foreground",
                        isToday(day.date) && "bg-primary/5 border-primary/20"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className={cn(
                          "text-sm font-medium",
                          isToday(day.date) && "text-primary font-bold"
                        )}>
                          {day.date.getDate()}
                        </span>
                        
                        {/* Cleaning indicators */}
                        {cleaningItems.length > 0 && (
                          <div className="flex flex-col gap-1">
                            {cleaningItems.map(item => (
                              <Badge 
                                key={item.id}
                                variant="outline" 
                                className="text-[10px] px-1 py-0 bg-cleaning/20 text-cleaning border-cleaning/30"
                              >
                                Clean
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
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
                    />
                  ))
                }
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};