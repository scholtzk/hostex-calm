import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, Link, Copy, ExternalLink } from 'lucide-react';
import { useAvailability } from '@/hooks/useAvailability';
import { useCleaners } from '@/hooks/useCleaners';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AvailabilityCalendar } from './AvailabilityCalendar';

export const AvailabilityManagement: React.FC = () => {
  const { cleaners, loading: cleanersLoading } = useCleaners();
  const { availabilityLinks, getAllAvailabilityLinks, createAvailabilityLinks, loading } = useAvailability();
  
  const [selectedCleaners, setSelectedCleaners] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [creatingLinks, setCreatingLinks] = useState(false);

  // Get current month and next few months
  const getAvailableMonths = () => {
    const months = [];
    const now = new Date();
    
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      months.push({ value: monthString, label: monthName });
    }
    
    return months;
  };

  // Encode cleanerId to numeric (3-digit ASCII per char)
  const encodeCleanerIdToNumeric = (id: string): string =>
    Array.from(id).map(ch => String(ch.charCodeAt(0)).padStart(3, '0')).join('');

  // Build stable token YYYYMM + encoded cleaner id
  const buildStableToken = (cleanerId: string, month: string): string => {
    const yyyymm = month.replace(/-/g, '');
    return `${yyyymm}${encodeCleanerIdToNumeric(cleanerId)}`;
  };

  // Handle cleaner selection
  const toggleCleaner = (cleanerId: string) => {
    setSelectedCleaners(prev => 
      prev.includes(cleanerId)
        ? prev.filter(id => id !== cleanerId)
        : [...prev, cleanerId]
    );
  };

  // Handle select all/none
  const toggleAllCleaners = () => {
    if (selectedCleaners.length === cleaners.length) {
      setSelectedCleaners([]);
    } else {
      setSelectedCleaners(cleaners.map(c => c.id));
    }
  };

  // Create availability links
  const handleCreateLinks = async () => {
    if (selectedCleaners.length === 0) {
      toast({
        title: "No cleaners selected",
        description: "Please select at least one cleaner.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedMonth) {
      toast({
        title: "No month selected",
        description: "Please select a month for availability.",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreatingLinks(true);
      
      // Send stable links via LINE for selected cleaners
      const sendResults = await Promise.allSettled(
        selectedCleaners.map(async (cleanerId) => {
          const token = buildStableToken(cleanerId, selectedMonth);
          const resp = await fetch('https://us-central1-property-manager-cf570.cloudfunctions.net/sendAvailabilityLink', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cleanerId, uniqueLink: token, month: selectedMonth })
          });
          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(text || `HTTP ${resp.status}`);
          }
          return resp.json();
        })
      );
      
      const success = sendResults.filter(r => r.status === 'fulfilled').length;
      const failed = sendResults.length - success;
      
      toast({
        title: "Links sent",
        description: `${success} sent via LINE${failed ? `, ${failed} failed` : ''}.`,
      });

      // Reset form
      setSelectedCleaners([]);
      setSelectedMonth('');
    } catch (error) {
      toast({
        title: "Error sending links",
        description: "Failed to send availability links via LINE.",
        variant: "destructive",
      });
    } finally {
      setCreatingLinks(false);
    }
  };

  // Copy link to clipboard
  const copyLink = async (uniqueLink: string) => {
    const baseUrl = window.location.origin;
    const basePath = (import.meta as any).env.BASE_URL?.replace(/\/$/, '') || '';
    const fullLink = `${baseUrl}${basePath}#/availability/${uniqueLink}`;
    
    try {
      await navigator.clipboard.writeText(fullLink);
      toast({
        title: "Link copied",
        description: "Availability link copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy link to clipboard.",
        variant: "destructive",
      });
    }
  };

  // Copy stable link to clipboard
  const copyStableLink = async (cleanerId: string, month: string) => {
    if (!month) {
      toast({
        title: "Select a month",
        description: "Choose a month to generate the stable link.",
        variant: "destructive",
      });
      return;
    }
    const baseUrl = window.location.origin;
    const token = buildStableToken(cleanerId, month);
    const basePath = (import.meta as any).env.BASE_URL?.replace(/\/$/, '') || '';
    const fullLink = `${baseUrl}${basePath}#/availability/${token}`;
    try {
      await navigator.clipboard.writeText(fullLink);
      toast({ title: 'Stable link copied', description: 'You can reuse this link anytime.' });
    } catch (err) {
      toast({ title: 'Failed to copy', description: 'Could not copy link to clipboard.', variant: 'destructive' });
    }
  };

  // Load availability links on component mount
  useEffect(() => {
    getAllAvailabilityLinks();
  }, []);

  const availableMonths = getAvailableMonths();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <Calendar className="w-6 h-6" />
        <h2 className="text-2xl font-bold">Availability Management</h2>
      </div>

      {/* Create New Links Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Link className="w-5 h-5" />
            <span>Send Availability Links via LINE</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Month Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Month</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a month" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(month => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cleaner Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Select Cleaners</label>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAllCleaners}
                disabled={cleanersLoading}
              >
                {selectedCleaners.length === cleaners.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            {cleanersLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {cleaners.map(cleaner => (
                  <div key={cleaner.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={cleaner.id}
                      checked={selectedCleaners.includes(cleaner.id)}
                      onCheckedChange={() => toggleCleaner(cleaner.id)}
                    />
                    <label
                      htmlFor={cleaner.id}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {cleaner.name}
                    </label>
                    {selectedMonth && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyStableLink(cleaner.id, selectedMonth)}
                        title="Copy stable link for this cleaner and month"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Send Button */}
          <Button
            onClick={handleCreateLinks}
            disabled={creatingLinks || selectedCleaners.length === 0 || !selectedMonth}
            className="w-full"
          >
            {creatingLinks ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Sending Links...
              </>
            ) : (
              <>
                <Link className="w-4 h-4 mr-2" />
                Send Links via LINE
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Links Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Cleaner Availability</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cleanersLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : cleaners.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No cleaners found.</p>
            </div>
          ) : (
            <Tabs defaultValue={cleaners[0]?.id ?? ''} className="w-full">
              <TabsList className="flex overflow-x-auto">
                {cleaners.map((cleaner) => (
                  <TabsTrigger key={cleaner.id} value={cleaner.id} className="truncate max-w-[150px]">
                    {cleaner.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {cleaners.map((cleaner) => (
                <TabsContent key={cleaner.id} value={cleaner.id} className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">Generate stable link for:</div>
                    <div className="flex items-center gap-2">
                      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Choose a month" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableMonths.map(month => (
                            <SelectItem key={month.value} value={month.value}>
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyStableLink(cleaner.id, selectedMonth)}
                        disabled={!selectedMonth}
                      >
                        <Copy className="w-4 h-4 mr-2" /> Copy stable link
                      </Button>
                    </div>
                  </div>
                  <AvailabilityCalendar cleanerId={cleaner.id} cleanerName={cleaner.name} />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}; 