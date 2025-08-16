import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCleaners } from '@/hooks/useCleaners';
import { User, Edit, Trash2, History, MessageSquare, Calendar } from 'lucide-react';

export const CleanerManagement = () => {
  const { cleaners, loadCleaners } = useCleaners();
  const [newCleaner, setNewCleaner] = useState({
    name: '',
    flatRate: '',
    email: '',
    lineUserId: '',
    role: 'cleaner'
  });

  const [editingCleaner, setEditingCleaner] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    flatRate: '',
    specialties: '',
    lineUserId: '',
    role: 'cleaner'
  });

  const [workHistoryCleaner, setWorkHistoryCleaner] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [workHistory, setWorkHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanerData = {
      name: newCleaner.name,
      flatRate: parseInt(newCleaner.flatRate),
      currency: 'JPY',
      isActive: true,
      phone: '',
      email: newCleaner.email || '',
      lineUserId: newCleaner.lineUserId || '',
      specialties: [],
      role: newCleaner.role
    };

    try {
      const response = await fetch('https://us-central1-property-manager-cf570.cloudfunctions.net/createCleaner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanerData)
      });

      if (response.ok) {
        alert('Cleaner added successfully!');
        setNewCleaner({
          name: '',
          flatRate: '',
          email: '',
          lineUserId: '',
          role: 'cleaner'
        });
        loadCleaners(); // Refresh the list
      } else {
        alert('Error adding cleaner');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error adding cleaner');
    }
  };

  const handleEdit = (cleaner: any) => {
    setEditingCleaner(cleaner);
    setEditForm({
      name: cleaner.name || '',
      phone: cleaner.phone || '',
      email: cleaner.email || '',
      flatRate: cleaner.flatRate?.toString() || '',
      specialties: cleaner.specialties?.join(', ') || '',
      lineUserId: cleaner.lineUserId || '',
      role: cleaner.role || 'cleaner'
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanerData = {
      ...editForm,
      flatRate: parseInt(editForm.flatRate),
      currency: 'JPY',
      specialties: editForm.specialties.split(',').map(s => s.trim()).filter(s => s),
    };

    try {
      const response = await fetch(`https://us-central1-property-manager-cf570.cloudfunctions.net/updateCleaner/${editingCleaner.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanerData)
      });

      if (response.ok) {
        alert('Cleaner updated successfully!');
        setEditingCleaner(null);
        setEditForm({
          name: '',
          phone: '',
          email: '',
          flatRate: '',
          specialties: '',
          lineUserId: '',
          role: 'cleaner'
        });
        loadCleaners(); // Refresh the list
      } else {
        alert('Error updating cleaner');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error updating cleaner');
    }
  };

  const handleDelete = async (cleanerId: string) => {
    if (!confirm('Are you sure you want to delete this cleaner? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`https://us-central1-property-manager-cf570.cloudfunctions.net/deleteCleaner/${cleanerId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        alert('Cleaner deleted successfully!');
        setEditingCleaner(null);
        loadCleaners(); // Refresh the list
      } else if (response.status === 404) {
        // Cleaner not found - remove from local state and refresh
        alert('Cleaner not found - it may have already been deleted. Refreshing list...');
        setEditingCleaner(null);
        loadCleaners(); // Refresh the list
      } else {
        const errorData = await response.json();
        alert(`Error deleting cleaner: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error deleting cleaner');
    }
  };

  const handleWorkHistory = async (cleaner: any) => {
    setWorkHistoryCleaner(cleaner);
    setSelectedMonth('');
    setWorkHistory([]);
  };

  const loadWorkHistory = async () => {
    if (!selectedMonth || !workHistoryCleaner) return;

    setLoadingHistory(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0);

      const response = await fetch('https://us-central1-property-manager-cf570.cloudfunctions.net/getCleaningAssignments');
      const data = await response.json();
      
      const assignments = data.assignments.filter((assignment: any) => {
        const assignmentDate = new Date(assignment.date);
        return assignment.cleanerId === workHistoryCleaner.id &&
               assignmentDate >= startDate &&
               assignmentDate <= endDate;
      });

      setWorkHistory(assignments);
    } catch (error) {
      console.error('Error loading work history:', error);
      alert('Error loading work history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Generate month options for the last 12 months
  const getMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    
    return options;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New Cleaner</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newCleaner.name}
                  onChange={(e) => setNewCleaner({...newCleaner, name: e.target.value})}
                  placeholder="Enter cleaner name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="flatRate">Flat Rate (JPY) *</Label>
                <Input
                  id="flatRate"
                  type="number"
                  value={newCleaner.flatRate}
                  onChange={(e) => setNewCleaner({...newCleaner, flatRate: e.target.value})}
                  placeholder="Enter hourly rate"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newCleaner.email}
                  onChange={(e) => setNewCleaner({...newCleaner, email: e.target.value})}
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <Label htmlFor="lineUserId">LINE User ID</Label>
                <Input
                  id="lineUserId"
                  value={newCleaner.lineUserId}
                  onChange={(e) => setNewCleaner({...newCleaner, lineUserId: e.target.value})}
                  placeholder="U1234567890abcdef"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newCleaner.role} onValueChange={(v) => setNewCleaner({...newCleaner, role: v})}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cleaner">Cleaner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              * Required fields. You can add additional details later by clicking the edit button.
            </div>
            <Button type="submit">Add Cleaner</Button>
          </form>
        </CardContent>
      </Card>

      {/* Split lists into cleaners and admins */}
      {(() => {
        const cleanerList = cleaners.filter((c: any) => (c.role || 'cleaner') !== 'admin');
        const adminList = cleaners.filter((c: any) => c.role === 'admin');
        return (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Cleaners ({cleanerList.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {cleanerList.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-muted-foreground mb-4">
                      <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No cleaners added yet</h3>
                      <p className="text-sm">Add your first cleaner using the form above to get started.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cleanerList.map((cleaner: any) => (
                      <div key={cleaner.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{cleaner.name}</h3>
                              {(cleaner.role === 'admin') && (
                                <Badge variant="outline" className="text-xs">Admin</Badge>
                              )}
                              <div className="flex gap-1">
                                {/* Work history & Edit buttons (unchanged) */}
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" onClick={() => handleWorkHistory(cleaner)} className="h-6 w-6 p-0" title="View work history">
                                      <History className="h-3 w-3" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-md">
                                    <DialogHeader>
                                      <DialogTitle>Work History - {cleaner.name}</DialogTitle>
                                    </DialogHeader>
                                    {/* Existing work history content remains */}
                                    <div className="space-y-4">
                                      <div>
                                        <Label htmlFor="month-select">Select Month</Label>
                                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Choose a month" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {getMonthOptions().map((option) => (
                                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <Button onClick={loadWorkHistory} disabled={!selectedMonth || loadingHistory} className="w-full">
                                        {loadingHistory ? 'Loading...' : 'Load History'}
                                      </Button>
                                      {workHistory.length > 0 && (
                                        <div className="space-y-2">
                                          <h4 className="font-medium">Assignments ({workHistory.length})</h4>
                                          <div className="max-h-60 overflow-y-auto space-y-2">
                                            {workHistory.map((assignment) => (
                                              <div key={assignment.id} className="border rounded p-2 text-sm">
                                                <div className="font-medium">{assignment.date}</div>
                                                <div className="text-muted-foreground">Status: {assignment.status}</div>
                                                {assignment.notes && (<div className="text-muted-foreground">Notes: {assignment.notes}</div>)}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(cleaner)} className="h-6 w-6 p-0" title="Edit cleaner">
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-md">
                                    <DialogHeader>
                                      <DialogTitle>Edit {cleaner.role === 'admin' ? 'Admin' : 'Cleaner'}</DialogTitle>
                                    </DialogHeader>
                                    <form onSubmit={handleEditSubmit} className="space-y-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <Label htmlFor="edit-name">Name</Label>
                                          <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} required />
                                        </div>
                                        <div>
                                          <Label htmlFor="edit-phone">Phone</Label>
                                          <Input id="edit-phone" value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} />
                                        </div>
                                        <div>
                                          <Label htmlFor="edit-email">Email</Label>
                                          <Input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} />
                                        </div>
                                        <div>
                                          <Label htmlFor="edit-flatRate">Flat Rate (JPY)</Label>
                                          <Input id="edit-flatRate" type="number" value={editForm.flatRate} onChange={(e) => setEditForm({...editForm, flatRate: e.target.value})} required />
                                        </div>
                                        <div className="md:col-span-2">
                                          <Label htmlFor="edit-specialties">Specialties (comma-separated)</Label>
                                          <Input id="edit-specialties" value={editForm.specialties} onChange={(e) => setEditForm({...editForm, specialties: e.target.value})} placeholder="deep-clean, laundry, bathroom-clean" />
                                        </div>
                                        <div className="md:col-span-2">
                                          <Label htmlFor="edit-lineUserId">LINE User ID</Label>
                                          <Input id="edit-lineUserId" value={editForm.lineUserId} onChange={(e) => setEditForm({...editForm, lineUserId: e.target.value})} placeholder="U1234567890abcdef" />
                                        </div>
                                        <div className="md:col-span-2">
                                          <Label htmlFor="edit-role">Role</Label>
                                          <Select value={editForm.role} onValueChange={(v) => setEditForm({...editForm, role: v as any})}>
                                            <SelectTrigger id="edit-role">
                                              <SelectValue placeholder="Select role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="cleaner">Cleaner</SelectItem>
                                              <SelectItem value="admin">Admin</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      <div className="flex justify-between items-center pt-4 border-t">
                                        <Button type="button" variant="destructive" size="sm" onClick={() => handleDelete(editingCleaner.id)} className="flex items-center gap-1">
                                          <Trash2 className="h-3 w-3" />
                                          Delete {cleaner.role === 'admin' ? 'Admin' : 'Cleaner'}
                                        </Button>
                                        <div className="flex gap-2">
                                          <Button type="button" variant="outline" onClick={() => setEditingCleaner(null)}>Cancel</Button>
                                          <Button type="submit">Update</Button>
                                        </div>
                                      </div>
                                    </form>
                                  </DialogContent>
                                </Dialog>
                              </div>
                              <div className="space-y-1">
                                {cleaner.email && <p className="text-sm text-gray-600">{cleaner.email}</p>}
                                {cleaner.phone && <p className="text-sm text-gray-600">{cleaner.phone}</p>}
                                {typeof cleaner.flatRate === 'number' && <p className="text-sm text-gray-600">¥{cleaner.flatRate}/job</p>}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {cleaner.specialties?.map((specialty: string) => (
                                <Badge key={specialty} variant="secondary" className="text-xs">{specialty}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Admins ({adminList.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {adminList.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No admins added.</div>
                ) : (
                  <div className="space-y-4">
                    {adminList.map((admin: any) => (
                      <div key={admin.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{admin.name}</h3>
                              <Badge variant="outline" className="text-xs">Admin</Badge>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(admin)} className="h-6 w-6 p-0" title="Edit admin">
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="space-y-1">
                                {admin.email && <p className="text-sm text-gray-600">{admin.email}</p>}
                                {admin.phone && <p className="text-sm text-gray-600">{admin.phone}</p>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        );
      })()}
    </div>
  );
};