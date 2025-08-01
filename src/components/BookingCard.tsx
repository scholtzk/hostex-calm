import { Booking } from '@/types/booking';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Users, MapPin, Phone, Mail, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BookingCardProps {
  booking: Booking;
  isOverlap?: boolean;
  className?: string;
}

export const BookingCard = ({ booking, isOverlap, className }: BookingCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-booking-confirmed/20 text-booking-confirmed border-booking-confirmed/30';
      case 'pending':
        return 'bg-booking-pending/20 text-booking-pending border-booking-pending/30';
      case 'cancelled':
        return 'bg-booking-cancelled/20 text-booking-cancelled border-booking-cancelled/30';
      default:
        return 'bg-secondary/20 text-secondary-foreground border-border';
    }
  };

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      'Airbnb': 'bg-red-100 text-red-700 border-red-200',
      'Booking.com': 'bg-blue-100 text-blue-700 border-blue-200',
      'VRBO': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'Direct': 'bg-green-100 text-green-700 border-green-200',
    };
    return colors[source] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <Card className={cn(
      "relative transition-all duration-200 hover:shadow-hover cursor-pointer",
      "bg-gradient-card border-l-4",
      isOverlap ? "border-l-overlap" : `border-l-booking-${booking.status}`,
      className
    )}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-semibold text-sm truncate">{booking.guestName}</h4>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <CalendarDays className="w-3 h-3" />
              <span>{new Date(booking.checkIn).toLocaleDateString()} - {new Date(booking.checkOut).toLocaleDateString()}</span>
            </div>
          </div>
          {isOverlap && (
            <AlertCircle className="w-4 h-4 text-overlap flex-shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={getStatusColor(booking.status)}>
            {booking.status}
          </Badge>
          <Badge variant="outline" className={getSourceColor(booking.source)}>
            {booking.source}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{booking.guests} guest{booking.guests !== 1 ? 's' : ''}</span>
          </div>
          {booking.price && (
            <span className="font-medium">
              {booking.currency || 'USD'} {booking.price}
            </span>
          )}
        </div>

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

        {(booking.phone || booking.email) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
            {booking.phone && (
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                <span className="truncate">{booking.phone}</span>
              </div>
            )}
            {booking.email && (
              <div className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                <span className="truncate">{booking.email}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};