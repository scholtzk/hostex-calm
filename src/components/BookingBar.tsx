import { Booking } from '@/types/booking';
import { Badge } from '@/components/ui/badge';
import { Users, Phone, Mail, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BookingBarProps {
  booking: Booking;
  startDay: number; // Which day of the week this booking starts (0-6)
  spanDays: number; // How many days this booking spans
  weekOffset: number; // Which week this booking starts
  hasOverlap?: boolean;
  stackLevel?: number; // For stacking overlapping bookings
  className?: string;
}

export const BookingBar = ({ 
  booking, 
  startDay, 
  spanDays, 
  weekOffset,
  hasOverlap, 
  stackLevel = 0,
  className 
}: BookingBarProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-booking-confirmed border-booking-confirmed text-white';
      case 'pending':
        return 'bg-booking-pending border-booking-pending text-white';
      case 'cancelled':
        return 'bg-booking-cancelled border-booking-cancelled text-white';
      default:
        return 'bg-secondary border-border text-secondary-foreground';
    }
  };

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      'Airbnb': 'bg-rose-500',
      'Booking.com': 'bg-blue-500',
      'VRBO': 'bg-yellow-500',
      'Direct': 'bg-green-500',
    };
    return colors[source] || 'bg-gray-500';
  };

  const getBookingColors = (status: string, source: string) => {
    if (source === 'Airbnb') {
      return 'bg-rose-500 border-rose-500 text-white';
    }
    if (source === 'Booking.com') {
      return 'bg-blue-500 border-blue-500 text-white';
    }
    // Fallback to status colors for other sources
    switch (status) {
      case 'confirmed':
        return 'bg-booking-confirmed border-booking-confirmed text-white';
      case 'pending':
        return 'bg-booking-pending border-booking-pending text-white';
      case 'cancelled':
        return 'bg-booking-cancelled border-booking-cancelled text-white';
      default:
        return 'bg-secondary border-border text-secondary-foreground';
    }
  };

  const gridColumnStart = startDay + 1;
  const gridColumnEnd = gridColumnStart + spanDays;
  const topOffset = 30 + (stackLevel * 35); // Stack overlapping bookings

  return (
    <div
      className={cn(
        "absolute z-10 shadow-booking transition-all duration-200 hover:shadow-hover hover:z-20",
        "px-2 py-1 cursor-pointer",
        getBookingColors(booking.status, booking.source),
        className
      )}
      style={{
        gridColumn: `${gridColumnStart} / ${gridColumnEnd}`,
        top: `${topOffset}px`,
        height: '28px',
        left: '50%', // Start in second half of first day
        right: '50%', // End in first half of last day
        clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)', // Slanted edges
      }}
    >
      <div className="flex items-center justify-between h-full text-xs">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", getSourceColor(booking.source))} />
          <span className="font-medium truncate">{booking.guestName}</span>
          {hasOverlap && <AlertCircle className="w-3 h-3 flex-shrink-0" />}
        </div>
        
        <div className="flex items-center gap-1 text-xs opacity-90 flex-shrink-0">
          <Users className="w-3 h-3" />
          <span>{booking.guests}</span>
        </div>
      </div>

      {/* Tooltip content - shown on hover */}
      <div className="absolute bottom-full mb-2 left-0 right-0 bg-card border rounded-lg shadow-lg p-3 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none z-30 min-w-[200px]">
        <div className="space-y-2">
          <div>
            <h4 className="font-semibold text-sm text-card-foreground">{booking.guestName}</h4>
            <p className="text-xs text-muted-foreground">
              {new Date(booking.checkIn).toLocaleDateString()} - {new Date(booking.checkOut).toLocaleDateString()}
            </p>
          </div>

          <div className="flex gap-2">
            <Badge variant="outline" className={cn("text-xs", getStatusColor(booking.status))}>
              {booking.status}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {booking.source}
            </Badge>
          </div>

          {booking.price && (
            <p className="text-xs font-medium text-card-foreground">
              {booking.currency} {booking.price}
            </p>
          )}

          {(booking.phone || booking.email) && (
            <div className="space-y-1">
              {booking.phone && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  <span>{booking.phone}</span>
                </div>
              )}
              {booking.email && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{booking.email}</span>
                </div>
              )}
            </div>
          )}

          {booking.cleaningRequired && (
            <div className="flex items-center gap-1 text-xs">
              <div className={cn(
                "w-2 h-2 rounded-full",
                booking.cleaningStatus === 'completed' ? 'bg-booking-confirmed' :
                booking.cleaningStatus === 'pending' ? 'bg-cleaning' :
                'bg-muted'
              )} />
              <span className="text-muted-foreground">
                Cleaning {booking.cleaningStatus || 'required'}
              </span>
            </div>
          )}

          {booking.notes && (
            <p className="text-xs text-muted-foreground border-t pt-2">
              {booking.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};