import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookingCard } from './BookingCard';
import { useBookings } from '@/hooks/useBookings';
import { Booking, CalendarDay } from '@/types/booking';
import { cn } from '@/lib/utils';

export const BookingCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { bookings, loading, error, refetch } = useBookings();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startCalendar = new Date(firstDay);
    startCalendar.setDate(startCalendar.getDate() - firstDay.getDay());
    
    const days: CalendarDay[] = [];
    const current = new Date(startCalendar);

    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const dateStr = current.toISOString().split('T')[0];
      
      // Find bookings for this date
      const dayBookings = bookings.filter(booking => {
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        const currentDate = new Date(current);
        
        // Check if current date is within booking period (inclusive of check-in, exclusive of check-out)
        return currentDate >= checkIn && currentDate < checkOut;
      });

      // Check for overlaps (checkout on same day as checkin)
      const checkoutBookings = bookings.filter(booking => {
        const checkOut = new Date(booking.checkOut);
        return checkOut.toDateString() === current.toDateString();
      });

      const checkinBookings = bookings.filter(booking => {
        const checkIn = new Date(booking.checkIn);
        return checkIn.toDateString() === current.toDateString();
      });

      const hasOverlap = checkoutBookings.length > 0 && checkinBookings.length > 0;
      
      // Check for cleaning requirements
      const cleaningRequired = checkoutBookings.some(booking => booking.cleaningRequired);

      days.push({
        date: new Date(current),
        bookings: dayBookings,
        hasOverlap,
        cleaningRequired
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
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

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => (
              <div
                key={index}
                className={cn(
                  "min-h-[120px] p-2 border-r border-b relative",
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
                  <div className="flex flex-col gap-1">
                    {day.hasOverlap && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 bg-overlap/20 text-overlap border-overlap/30">
                        Overlap
                      </Badge>
                    )}
                    {day.cleaningRequired && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 bg-cleaning/20 text-cleaning border-cleaning/30">
                        Clean
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  {day.bookings.slice(0, 2).map(booking => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      isOverlap={day.hasOverlap}
                      className="text-xs"
                    />
                  ))}
                  {day.bookings.length > 2 && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                      +{day.bookings.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};