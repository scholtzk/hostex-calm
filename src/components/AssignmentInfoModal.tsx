import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Phone, Mail, Clock, FileText, AlertTriangle } from 'lucide-react';
import { CleaningAssignment, Cleaner, Booking } from '@/types/booking';
import { useCleaningAssignments } from '@/hooks/useCleaningAssignments';

interface AssignmentInfoModalProps {
  assignment: CleaningAssignment;
  cleaner: Cleaner;
  booking: Booking;
  isOpen: boolean;
  onClose: () => void;
  onUnassign: () => void;
  displayBooking?: Booking;
}

export const AssignmentInfoModal = ({
  assignment,
  cleaner,
  booking,
  isOpen,
  onClose,
  onUnassign,
  displayBooking
}: AssignmentInfoModalProps) => {
  const [isUnassigning, setIsUnassigning] = useState(false);
  const { updateCleanerAssignment } = useCleaningAssignments();

  const handleUnassign = async () => {
    setIsUnassigning(true);
    try {
      console.log('Unassigning cleaner for assignment:', assignment);
      await updateCleanerAssignment(assignment.date, null, null);
      onUnassign();
      onClose();
    } catch (error) {
      console.error('Failed to unassign cleaner:', error);
      // You could add toast notification here
    } finally {
      setIsUnassigning(false);
    }
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'Not specified';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getStatusColor = (status: CleaningAssignment['status']) => {
    switch (status) {
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const uiBooking = displayBooking || booking;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Cleaning Assignment
          </DialogTitle>
          <DialogDescription>
            Details for the cleaning assignment on {new Date(assignment.date).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cleaner Information */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <User className="h-4 w-4" />
              Assigned Cleaner
            </h3>
            <div className="space-y-2">
              <div className="font-medium">{cleaner.name}</div>
              {cleaner.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {cleaner.phone}
                </div>
              )}
              {cleaner.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {cleaner.email}
                </div>
              )}
              {cleaner.flatRate && (
                <div className="text-sm">
                  <span className="font-medium">Rate:</span> ¥{cleaner.flatRate}/job
                </div>
              )}
              {cleaner.specialties && cleaner.specialties.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-muted-foreground mb-1">Specialties:</div>
                  <div className="flex flex-wrap gap-1">
                    {cleaner.specialties.map(specialty => (
                      <Badge key={specialty} variant="outline" className="text-xs">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

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
              {uiBooking.notes && (
                <div className="text-sm">
                  <span className="font-medium">Notes:</span> {uiBooking.notes}
                </div>
              )}
            </div>
          </div>

          {/* Assignment Details */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Assignment Details
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status:</span>
                <Badge className={getStatusColor(assignment.status)}>
                  {assignment.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Estimated Duration:</span>
                <span className="text-sm">{formatDuration(assignment.estimatedDuration)}</span>
              </div>
              {assignment.actualDuration && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Actual Duration:</span>
                  <span className="text-sm">{formatDuration(assignment.actualDuration)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm">Assigned:</span>
                <span className="text-sm">{new Date(assignment.assignedAt).toLocaleDateString()}</span>
              </div>
              {assignment.completedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Completed:</span>
                  <span className="text-sm">{new Date(assignment.completedAt).toLocaleDateString()}</span>
                </div>
              )}
              {assignment.notes && (
                <div className="mt-2">
                  <div className="flex items-center gap-1 text-sm font-medium mb-1">
                    <FileText className="h-3 w-3" />
                    Assignment Notes:
                  </div>
                  <div className="text-sm bg-background p-2 rounded border">
                    {assignment.notes}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="destructive"
              onClick={handleUnassign}
              disabled={isUnassigning}
              className="flex-1"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {isUnassigning ? 'Unassigning...' : 'Unassign Cleaner'}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 