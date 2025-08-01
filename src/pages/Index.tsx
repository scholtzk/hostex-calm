import { BookingCalendar } from '@/components/BookingCalendar';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            Property Booking Manager
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage your property bookings with HostexAPI integration
          </p>
        </div>
        <BookingCalendar />
      </div>
    </div>
  );
};

export default Index;
