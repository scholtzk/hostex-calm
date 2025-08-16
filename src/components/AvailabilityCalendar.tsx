import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useAvailability } from '@/hooks/useAvailability';
import { useParams, useNavigate } from 'react-router-dom';

interface AvailabilityCalendarProps {
  cleanerId?: string;
  cleanerName?: string;
  month?: string;
}

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  cleanerId,
  cleanerName,
  month: initialMonth
}) => {
  const params = useParams();
  const navigate = useNavigate();
  const { getAvailabilityLink, getCleanerAvailability, updateCleanerAvailability, availability, loading, error } = useAvailability();
  
  const FUNCTIONS_BASE_URL = 'https://us-central1-property-manager-cf570.cloudfunctions.net';
  const fetchCleanerName = async (id: string): Promise<string | null> => {
    try {
      const resp = await fetch(`${FUNCTIONS_BASE_URL}/getCleaners`);
      if (!resp.ok) return null;
      const data = await resp.json();
      const found = (data.cleaners || []).find((c: any) => c.id === id);
      return found?.name || null;
    } catch {
      return null;
    }
  };

  const [currentMonth, setCurrentMonth] = useState<string>(initialMonth || getCurrentMonth());
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [linkData, setLinkData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restrictedMonth, setRestrictedMonth] = useState<string>(''); // The month this link is for

  // Get current month in YYYY-MM format
  function getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // Helpers to support stable numeric token: YYYYMM + cleanerId encoded as 3-digit ASCII codes
  const isNumericToken = (value: string) => /^\d{9,}$/.test(value); // at least YYYYMM + one char (3 digits)

  const decodeCleanerIdFromNumeric = (numeric: string): string => {
    if (numeric.length % 3 !== 0) return '';
    let decoded = '';
    for (let i = 0; i < numeric.length; i += 3) {
      const code = parseInt(numeric.slice(i, i + 3), 10);
      if (Number.isNaN(code)) return '';
      decoded += String.fromCharCode(code);
    }
    return decoded;
  };

  const parseNumericToken = (token: string): { cleanerId: string; month: string } | null => {
    if (!isNumericToken(token) || token.length < 9) return null;
    const yyyymm = token.slice(0, 6);
    const encodedId = token.slice(6);
    const month = `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}`;
    const decodedCleanerId = decodeCleanerIdFromNumeric(encodedId);
    if (!decodedCleanerId) return null;
    return { cleanerId: decodedCleanerId, month };
  };

  // Get days in month
  function getDaysInMonth(year: number, month: number): Date[] {
    const days: Date[] = [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    
    // Add days from previous month to fill first week
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(firstDay);
      prevDate.setDate(prevDate.getDate() - (i + 1));
      days.push(prevDate);
    }
    
    // Add all days in current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month - 1, i));
    }
    
    // Add days from next month to fill last week
    const lastDayOfWeek = lastDay.getDay();
    for (let i = 1; i <= 6 - lastDayOfWeek; i++) {
      const nextDate = new Date(lastDay);
      nextDate.setDate(nextDate.getDate() + i);
      days.push(nextDate);
    }
    
    return days;
  }

  // Format date to YYYY-MM-DD
  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Check if date is in current month
  function isCurrentMonth(date: Date, year: number, month: number): boolean {
    return date.getFullYear() === year && date.getMonth() === month - 1;
  }

  // Check if date is in the restricted month (the month this link is for)
  function isRestrictedMonth(date: Date): boolean {
    if (!restrictedMonth) return true; // If no restriction, allow all dates
    
    const [restrictedYear, restrictedMonthNum] = restrictedMonth.split('-').map(Number);
    return date.getFullYear() === restrictedYear && date.getMonth() === restrictedMonthNum - 1;
  }

  // Handle date selection
  const toggleDate = (date: string) => {
    // Only allow selection if the date is in the restricted month
    const dateObj = new Date(date);
    if (!isRestrictedMonth(dateObj)) {
      return; // Don't allow selection of dates outside the restricted month
    }

    setSelectedDates(prev => 
      prev.includes(date) 
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  // Handle month navigation - allow unrestricted navigation when not limited by restrictedMonth
  const changeMonth = (direction: 'prev' | 'next') => {
    // If a restricted month is set, the user is only allowed to view that single month
    if (restrictedMonth) {
      if (currentMonth !== restrictedMonth) {
        setCurrentMonth(restrictedMonth);
      }
      return;
    }

    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1));
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(newMonth);
  };

  // Submit availability
  const handleSubmit = async () => {
    if (!linkData?.cleanerId) return;
    
    try {
      setSubmitting(true);
      await updateCleanerAvailability(linkData.cleanerId, currentMonth, selectedDates);
      alert('Availability updated successfully!');
    } catch (err) {
      alert('Failed to update availability. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Load link data and availability
  useEffect(() => {
    const loadData = async () => {
      try {
        // If we have a unique link in params, it can be either a legacy UUID or a stable numeric token
        if (params.uniqueLink) {
          const numericParsed = parseNumericToken(params.uniqueLink);
          if (numericParsed) {
            const { cleanerId: parsedCleanerId, month } = numericParsed;
            const name = await fetchCleanerName(parsedCleanerId);
            setLinkData({ cleanerId: parsedCleanerId, cleanerName: name || cleanerName });
            setRestrictedMonth(month);
            setCurrentMonth(month);

            const availabilityData = await getCleanerAvailability(parsedCleanerId, month);
            setSelectedDates(availabilityData.availableDates || []);
          } else {
            // Legacy: look up link document
            const linkData = await getAvailabilityLink(params.uniqueLink);
            setLinkData(linkData);
            setRestrictedMonth(linkData.month); // Set the restricted month
            
            // Load existing availability
            const availabilityData = await getCleanerAvailability(linkData.cleanerId, linkData.month);
            setCurrentMonth(linkData.month); // Set to the correct month
            setSelectedDates(availabilityData.availableDates || []);
          }
        } else if (cleanerId) {
          // Direct access with cleaner ID
          let name = cleanerName;
          if (!name) {
            name = (await fetchCleanerName(cleanerId)) || undefined;
          }
          setLinkData({ cleanerId, cleanerName: name });
          const availabilityData = await getCleanerAvailability(cleanerId, currentMonth);
          setSelectedDates(availabilityData.availableDates || []);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };

    loadData();
  }, [params.uniqueLink, cleanerId]);

  // Refetch availability whenever the displayed month changes (for unrestricted calendars)
  useEffect(() => {
    if (!linkData?.cleanerId) return;

    const fetchAvailability = async () => {
      try {
        const availabilityData = await getCleanerAvailability(linkData.cleanerId, currentMonth);
        setSelectedDates(availabilityData.availableDates || []);
      } catch (err) {
        console.error('Error refreshing availability:', err);
      }
    };

    fetchAvailability();
  }, [currentMonth, linkData?.cleanerId]);

  // Update selected dates when availability changes
  useEffect(() => {
    if (availability) {
      setSelectedDates(availability.availableDates || []);
    }
  }, [availability]);

  const [year, month] = currentMonth.split('-').map(Number);
  const days = getDaysInMonth(year, month);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <div className="container mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-center mb-2">
            {`${linkData?.cleanerName || 'クリーナー'}の空き状況`}
          </h1>
          <p className="text-center text-muted-foreground">
            {`${year}年${month}月の稼働可能日を選択してください`}
          </p>
          {restrictedMonth && (
            <p className="text-center text-sm text-muted-foreground mt-1">
              {`${restrictedMonth.split('-')[0]}年${parseInt(restrictedMonth.split('-')[1])}月専用のリンクです`}
            </p>
          )}
        </div>

        {/* Month Navigation - Only show if not restricted or if not on restricted month */}
        {(!restrictedMonth || currentMonth !== restrictedMonth) && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => changeMonth('prev')}
                  className="flex items-center space-x-1"
                  disabled={restrictedMonth && currentMonth === restrictedMonth}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                
                <h2 className="text-lg font-semibold">
                  {monthNames[month - 1]} {year}
                </h2>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => changeMonth('next')}
                  className="flex items-center space-x-1"
                  disabled={restrictedMonth && currentMonth === restrictedMonth}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Calendar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, index) => {
                const dateString = formatDate(date);
                const isSelected = selectedDates.includes(dateString);
                const isCurrentMonthDay = isCurrentMonth(date, year, month);
                const isRestrictedMonthDay = isRestrictedMonth(date);
                const isToday = dateString === formatDate(new Date());
                const isSelectable = isCurrentMonthDay && isRestrictedMonthDay;
                
                return (
                  <button
                    key={index}
                    onClick={() => isSelectable && toggleDate(dateString)}
                    disabled={!isSelectable}
                    className={`
                      aspect-square rounded-lg border-2 transition-all duration-200
                      ${isSelectable 
                        ? (isSelected ? 'cursor-pointer hover:brightness-90' : 'cursor-pointer hover:bg-primary/10') 
                        : 'opacity-30 cursor-not-allowed'
                      }
                      ${isSelected 
                        ? 'bg-primary border-primary text-primary-foreground' 
                        : 'border-border hover:border-primary'
                      }
                      ${isToday ? 'ring-2 ring-primary/50' : ''}
                      ${!isRestrictedMonthDay ? 'bg-gray-100' : ''}
                      flex items-center justify-center relative
                    `}
                  >
                    <span className="text-sm font-medium">
                      {date.getDate()}
                    </span>
                    {isSelected && (
                      <Check className="absolute top-1 right-1 w-3 h-3" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Dates Summary */}
        {selectedDates.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Selected Dates ({selectedDates.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {selectedDates.sort().map(date => (
                  <span
                    key={date}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                  >
                    {new Date(date).toLocaleDateString()}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={submitting || selectedDates.length === 0}
            size="lg"
            className="w-full max-w-md"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                更新中...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                空き状況を確定
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}; 