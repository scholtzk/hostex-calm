import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useCleaners } from '@/hooks/useCleaners';
import { CleaningAssignment, Booking } from '@/types/booking';
import { Calendar, Clock, User, Phone, Mail } from 'lucide-react';

interface CleaningAssignmentModalProps {
  date: string;
  booking: Booking;
  onAssignmentComplete?: (assignment: CleaningAssignment) => void;
  displayBooking?: Booking;
  children: React.ReactNode;
}

export const CleaningAssignmentModal = ({ 
  date, 
  booking, 
  onAssignmentComplete,
  displayBooking,
  children 
}: CleaningAssignmentModalProps) => {
  const [open, setOpen] = useState(false);
  const [selectedCleaner, setSelectedCleaner] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { 
    cleaners, 
    assignCleaner, 
    getAvailableCleaners
  } = useCleaners();

  const availableCleaners = getAvailableCleaners(date);

  const handleAssign = async () => {
    if (!selectedCleaner) return;

    console.log('Modal assigning cleaner:', {
      bookingId: booking.id,
      cleanerId: selectedCleaner,
      date,
      notes: notes.trim() || undefined,
      estimatedDuration: 120
    });

    setIsSubmitting(true);
    try {
      const assignment = await assignCleaner({
        bookingId: booking.id,
        cleanerId: selectedCleaner,
        date,
        originalBookingDate: booking.checkOut,
        guestName: booking.guestName,
        notes: notes.trim() || undefined,
        estimatedDuration: 120, // Default 2 hours
      });

      console.log('Assignment completed successfully:', assignment);
      onAssignmentComplete?.(assignment);
      setOpen(false);
      setSelectedCleaner('');
      setNotes('');
    } catch (error) {
      console.error('Failed to assign cleaner:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCleanerData = cleaners.find(c => c.id === selectedCleaner);
  const uiBooking = displayBooking || booking;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Assign Cleaning for {new Date(date + 'T00:00:00').toLocaleDateString('en-GB')}
          </DialogTitle>
          <DialogDescription>
            Select a cleaner to assign for this cleaning task.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Booking Information */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Property Details
            </h3>
            <div className="space-y-2">
              <div className="font-medium">{uiBooking.guestName}</div>
              <div className="text-sm text-muted-foreground">
                Check-in: {new Date(uiBooking.checkIn).toLocaleDateString()}
              </div>
              <div className="text-sm text-muted-foreground">
                {uiBooking.guests} guest{uiBooking.guests !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Available Cleaners */}
          <div>
            <Label htmlFor="cleaner-select">Select Cleaner</Label>
            <Select value={selectedCleaner} onValueChange={setSelectedCleaner}>
              <SelectTrigger id="cleaner-select">
                <SelectValue placeholder="Choose a cleaner" />
              </SelectTrigger>
              <SelectContent>
                {availableCleaners.map(cleaner => (
                  <SelectItem key={cleaner.id} value={cleaner.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{cleaner.name}</span>
                      {cleaner.flatRate && (
                        <Badge variant="outline" className="ml-2">
                          {cleaner.currency || 'JPY'} {cleaner.flatRate}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Cleaner Details */}
          {selectedCleanerData && (
            <div className="p-4 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-2 font-medium">
                <User className="h-4 w-4" /> {selectedCleanerData.name}
              </div>
              <div className="text-sm text-muted-foreground mt-1 flex flex-col gap-1">
                {selectedCleanerData.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {selectedCleanerData.phone}
                  </div>
                )}
                {selectedCleanerData.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {selectedCleanerData.email}
                  </div>
                )}
              </div>
              {selectedCleanerData.specialties && selectedCleanerData.specialties.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-muted-foreground mb-1">Specialties:</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedCleanerData.specialties.map(specialty => (
                      <Badge key={specialty} variant="outline" className="text-xs">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any special instructions for the cleaner..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssign}
              disabled={!selectedCleaner || isSubmitting}
            >
              {isSubmitting ? 'Assigning...' : 'Assign Cleaner'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 