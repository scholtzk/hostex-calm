import { useState } from 'react';
import { BookingCalendar } from '@/components/BookingCalendar';
import { CleanerManagement } from '@/components/CleanerManagement';
import { AvailabilityManagement } from '@/components/AvailabilityManagement';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Link } from 'lucide-react';

const Index = () => {
  const [activeTab, setActiveTab] = useState<'calendar' | 'cleaners' | 'availability'>('calendar');

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

        {/* Tab Navigation */}
        <div className="flex justify-end mb-6">
          <div className="flex space-x-2">
            <Button
              variant={activeTab === 'calendar' ? 'default' : 'outline'}
              onClick={() => setActiveTab('calendar')}
              className="flex items-center space-x-2"
            >
              <Calendar className="w-4 h-4" />
              <span>Calendar</span>
            </Button>
            <Button
              variant={activeTab === 'cleaners' ? 'default' : 'outline'}
              onClick={() => setActiveTab('cleaners')}
              className="flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Cleaners</span>
            </Button>
            <Button
              variant={activeTab === 'availability' ? 'default' : 'outline'}
              onClick={() => setActiveTab('availability')}
              className="flex items-center space-x-2"
            >
              <Link className="w-4 h-4" />
              <span>Availability</span>
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'calendar' && <BookingCalendar />}
        {activeTab === 'cleaners' && <CleanerManagement />}
        {activeTab === 'availability' && <AvailabilityManagement />}
      </div>
    </div>
  );
};

export default Index;
