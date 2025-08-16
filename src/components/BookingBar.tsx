import { Booking } from '@/types/booking';
import { Badge } from '@/components/ui/badge';
import { Users, Phone, Mail, AlertCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BookingBarProps {
  booking: Booking;
  startDay: number; // Which day of the week this booking starts (0-6)
  spanDays: number; // How many days this booking spans
  weekOffset: number; // Which week this booking starts
  hasOverlap?: boolean;
  stackLevel?: number; // For stacking overlapping bookings
  isFinalSegment?: boolean; // Whether this is the final segment of the booking
  isCheckInSegment?: boolean; // Whether this segment contains the check-in day
  isCheckOutSegment?: boolean; // Whether this segment contains the check-out day
  isLastDayOfMonth?: boolean; // Whether this segment is on the last day of the month
  isFirstVisibleSegment?: boolean; // Whether this is the first visible segment for this booking
  className?: string;
}

export const BookingBar = ({ 
  booking, 
  startDay, 
  spanDays, 
  weekOffset,
  hasOverlap, 
  stackLevel = 0,
  isFinalSegment = false,
  isCheckInSegment = false,
  isCheckOutSegment = false,
  isLastDayOfMonth = false,
  isFirstVisibleSegment = false,
  className 
}: BookingBarProps) => {
  // Debug logging for specific bookings
  if (booking.guestName === 'Joffrey Swita' || booking.guestName === 'Maximilian Kolb') {
    
  }
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

  const getBookingColors = (status: string, source: string, hasGuestName: boolean) => {
    // Source-based colors using design system
    let baseColors: string;
    
    if (source === 'Airbnb') {
      baseColors = 'bg-[hsl(348_76%_60%)] border-[hsl(348_76%_60%)] text-white';
    } else if (source === 'Booking.com') {
      baseColors = 'bg-[hsl(213_78%_56%)] border-[hsl(213_78%_56%)] text-white';
    } else if (source === 'VRBO') {
      baseColors = 'bg-[hsl(45_90%_60%)] border-[hsl(45_90%_60%)] text-white';
    } else if (source === 'Direct') {
      baseColors = 'bg-booking-confirmed border-booking-confirmed text-white';
    } else {
      // Fallback to status colors for other sources
      switch (status) {
        case 'confirmed':
          baseColors = 'bg-booking-confirmed border-booking-confirmed text-white';
          break;
        case 'pending':
          baseColors = 'bg-booking-pending border-booking-pending text-white';
          break;
        case 'cancelled':
          baseColors = 'bg-booking-cancelled border-booking-cancelled text-white';
          break;
        default:
          baseColors = 'bg-secondary border-border text-secondary-foreground';
      }
    }
    
    // Add dashed border for bookings without guest names
    if (!hasGuestName) {
      return baseColors + ' border-dashed border-2';
    }
    
    return baseColors;
  };

  const getSourceIndicatorColor = (source: string) => {
    const colors: Record<string, string> = {
      'Airbnb': 'bg-[hsl(348_76%_60%)]',
      'Booking.com': 'bg-[hsl(213_78%_56%)]',
      'VRBO': 'bg-[hsl(45_90%_60%)]',
      'Direct': 'bg-booking-confirmed',
    };
    return colors[source] || 'bg-muted';
  };

  const topOffset = 30 + (stackLevel * 40); // Increased gap between stacked bookings
  
  // Calculate positioning based on segment type
  let leftOffset: string;
  let width: string;

  if (isCheckInSegment && isCheckOutSegment) {
    if (spanDays === 1) {
      // Single day booking: start at 60%, end at 40% (so width is 40% of the day)
      leftOffset = `calc(${startDay} * (100% / 7) + (100% / 7) * 0.6)`;
      width = `calc((100% / 7) * 0.4)`;
    } else {
      // Multi-day booking: start at 60% of first day, end at 40% of last day
      leftOffset = `calc(${startDay} * (100% / 7) + (100% / 7) * 0.6)`;
      width = `calc(${spanDays - 1} * (100% / 7) + (100% / 7) * 0.4 - (100% / 7) * 0.6)`;
    }
  } else if (isCheckInSegment) {
    // Check-in day: start at 60%, extend to end of segment
    leftOffset = `calc(${startDay} * (100% / 7) + (100% / 7) * 0.6)`;
    width = `calc(${spanDays} * (100% / 7) - (100% / 7) * 0.6)`;
  } else if (isCheckOutSegment && !isCheckInSegment) {
    // Check-out day (and not also check-in day): start from left edge, end at 40%
    leftOffset = `calc(${startDay} * (100% / 7))`;
    width = `calc((100% / 7) * 0.4)`;
  } else {
    // Intermediate days or multi-week segments: full width
    leftOffset = `calc(${startDay} * (100% / 7))`;
    width = `calc(${spanDays} * (100% / 7))`;
  }

  // Calculate clip path based on segment type for continuous bars across weeks
  let clipPath: string;
  
  if (isCheckInSegment && isCheckOutSegment) {
    // Single segment booking - keep both slants
    clipPath = 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)';
  } else if (isCheckInSegment) {
    // First segment of multi-week booking - only left slant, no right slant
    clipPath = 'polygon(8px 0%, 100% 0%, 100% 100%, 0% 100%)';
  } else if (isCheckOutSegment) {
    // Last segment of multi-week booking - only right slant, no left slant
    clipPath = 'polygon(0% 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)';
  } else if (isLastDayOfMonth) {
    // Last day of month - add right slant to indicate continuation beyond month
    clipPath = 'polygon(0% 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)';
  } else {
    // Middle segment of multi-week booking - no slants
    clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
  }

  return (
    <div
      className={cn(
        "absolute z-10 shadow-booking transition-all duration-200 hover:shadow-hover hover:z-20",
        "px-2 py-1 cursor-pointer",
        getBookingColors(booking.status, booking.source, booking.guestName && !booking.guestName.startsWith('Guest (')),
        className
      )}
      style={{
        top: `${topOffset}px`,
        height: '28px',
        left: leftOffset,
        width: width,
        clipPath: clipPath,
      }}
    >
      {/* Only show text content in the first visible segment of multi-week bookings */}
      {isFirstVisibleSegment && (
        <div className="flex items-center justify-between h-full text-xs">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <div className={cn("w-2 h-2 rounded-full flex-shrink-0", getSourceIndicatorColor(booking.source))} />
            <span className="font-medium truncate">{booking.guestName}</span>
            {hasOverlap && <AlertCircle className="w-3 h-3 flex-shrink-0" />}
            {(!booking.guestName || booking.guestName.startsWith('Guest (')) && <HelpCircle className="w-3 h-3 flex-shrink-0 opacity-70" />}
          </div>
          
          <div className="flex items-center gap-1 text-xs opacity-90 flex-shrink-0">
            <Users className="w-3 h-3" />
            <span>{booking.guests}</span>
          </div>
        </div>
      )}

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

          {(!booking.guestName || booking.guestName.startsWith('Guest (')) && (
            <p className="text-xs text-muted-foreground border-t pt-2 flex items-center gap-1">
              <HelpCircle className="w-3 h-3" />
              <span>Guest name not available</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};