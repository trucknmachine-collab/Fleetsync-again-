import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval } from 'date-fns';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface ChecklistItem {
  name: string;
  passed: boolean;
  defects: string;
}

interface DailyEntry {
  id: string;
  date: string;
  worker_name: string;
  fleet_number: string;
  pre_start_checklist: ChecklistItem[];
  pre_start_completed: boolean;
  start_time: string | null;
  end_time: string | null;
  break_duration: number;
  total_hours: number;
  overtime_hours: number;
  job_project: string;
  engine_hours_start: number | null;
  engine_hours_end: number | null;
  fuel_usage: number | null;
  notes: string;
}

interface WeeklySummary {
  week_start: string;
  week_end: string;
  total_hours: number;
  total_overtime: number;
  days_worked: number;
  entries: DailyEntry[];
}

export default function WeekScreen() {
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  useEffect(() => {
    const fetchWeeklySummary = async () => {
      try {
        setLoading(true);
        const startStr = format(currentWeekStart, 'yyyy-MM-dd');
        const endStr = format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        
        console.log('Fetching weekly summary:', `${API_URL}/api/weekly-summary?week_start=${startStr}&week_end=${endStr}`);
        
        const response = await fetch(
          `${API_URL}/api/weekly-summary?week_start=${startStr}&week_end=${endStr}`
        );
        
        if (response.ok) {
          const data = await response.json();
          console.log('Weekly summary data:', data);
          setSummary(data);
        } else {
          console.error('Response not ok:', response.status);
          setSummary(null);
        }
      } catch (error) {
        console.error('Error fetching weekly summary:', error);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWeeklySummary();
  }, [currentWeekStart]);

  const goToPreviousWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const getEntryForDate = (date: Date): DailyEntry | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return summary?.entries.find(e => e.date === dateStr);
  };

  const generateShareText = (): string => {
    if (!summary) return '';

    const workerName = summary.entries[0]?.worker_name || 'Worker';
    const fleetNum = summary.entries[0]?.fleet_number || '';
    let text = `WEEKLY TIMESHEET SUMMARY\n`;
    text += `========================\n`;
    text += `Worker: ${workerName}\n`;
    if (fleetNum) {
      text += `Fleet #: ${fleetNum}\n`;
    }
    text += `Week: ${format(currentWeekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}\n\n`;
    
    text += `SUMMARY:\n`;
    text += `Total Hours: ${summary.total_hours.toFixed(2)}\n`;
    text += `Overtime: ${summary.total_overtime.toFixed(2)}\n`;
    text += `Days Worked: ${summary.days_worked}\n\n`;
    
    text += `DAILY BREAKDOWN:\n`;
    text += `----------------\n`;
    
    weekDays.forEach(day => {
      const entry = getEntryForDate(day);
      const dayName = format(day, 'EEE MMM d');
      
      if (entry && entry.total_hours > 0) {
        text += `${dayName}:\n`;
        text += `  Time: ${entry.start_time || '-'} - ${entry.end_time || '-'}\n`;
        text += `  Hours: ${entry.total_hours.toFixed(2)} (OT: ${entry.overtime_hours.toFixed(2)})\n`;
        text += `  Break: ${entry.break_duration} mins\n`;
        if (entry.job_project) {
          text += `  Job: ${entry.job_project}\n`;
        }
        if (entry.engine_hours_start !== null && entry.engine_hours_end !== null) {
          text += `  Engine Hours: ${entry.engine_hours_start} - ${entry.engine_hours_end}\n`;
        }
        if (entry.fuel_usage !== null && entry.fuel_usage !== undefined) {
          text += `  Fuel Usage: ${entry.fuel_usage} L\n`;
        }
        text += `  Pre-Start: ${entry.pre_start_completed ? 'Completed' : 'Not Completed'}\n`;
        
        // Add defects if any
        const defects = entry.pre_start_checklist.filter(item => item.defects);
        if (defects.length > 0) {
          text += `  Defects:\n`;
          defects.forEach(d => {
            text += `    - ${d.name}: ${d.defects}\n`;
          });
        }
        text += `\n`;
      } else {
        text += `${dayName}: No entry\n`;
      }
    });
    
    text += `\n========================\n`;
    text += `Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}\n`;
    
    return text;
  };

  const shareWeeklySummary = async () => {
    if (!summary) {
      Alert.alert('No Data', 'No data to share for this week');
      return;
    }

    try {
      const shareText = generateShareText();
      
      await Share.share({
        message: shareText,
        title: `Weekly Timesheet - ${format(currentWeekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share timesheet');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Week Navigation */}
        <View style={styles.weekNav}>
          <TouchableOpacity style={styles.navButton} onPress={goToPreviousWeek}>
            <Ionicons name="chevron-back" size={24} color="#4ade80" />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={goToCurrentWeek}>
            <Text style={styles.weekTitle}>
              {format(currentWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.navButton} onPress={goToNextWeek}>
            <Ionicons name="chevron-forward" size={24} color="#4ade80" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4ade80" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Weekly Summary</Text>
              
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {summary?.total_hours.toFixed(2) || '0.00'}
                  </Text>
                  <Text style={styles.summaryLabel}>Total Hours</Text>
                </View>
                
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, styles.overtimeValue]}>
                    {summary?.total_overtime.toFixed(2) || '0.00'}
                  </Text>
                  <Text style={styles.summaryLabel}>Overtime</Text>
                </View>
                
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {summary?.days_worked || 0}
                  </Text>
                  <Text style={styles.summaryLabel}>Days Worked</Text>
                </View>
              </View>
            </View>

            {/* Daily Entries */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Daily Breakdown</Text>
              
              {weekDays.map(day => {
                const entry = getEntryForDate(day);
                const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                
                return (
                  <View
                    key={day.toISOString()}
                    style={[
                      styles.dayCard,
                      isToday && styles.todayCard,
                      entry && entry.total_hours > 0 && styles.workedCard,
                    ]}
                  >
                    <View style={styles.dayHeader}>
                      <Text style={styles.dayName}>{format(day, 'EEE')}</Text>
                      <Text style={styles.dayDate}>{format(day, 'MMM d')}</Text>
                      {isToday && (
                        <View style={styles.todayBadge}>
                          <Text style={styles.todayBadgeText}>Today</Text>
                        </View>
                      )}
                    </View>
                    
                    {entry && entry.total_hours > 0 ? (
                      <View style={styles.entryDetails}>
                        <View style={styles.entryRow}>
                          <Ionicons name="time-outline" size={16} color="#9ca3af" />
                          <Text style={styles.entryText}>
                            {entry.start_time} - {entry.end_time}
                          </Text>
                        </View>
                        
                        <View style={styles.entryRow}>
                          <Ionicons name="hourglass-outline" size={16} color="#9ca3af" />
                          <Text style={styles.entryText}>
                            {entry.total_hours.toFixed(2)} hrs
                            {entry.overtime_hours > 0 && (
                              <Text style={styles.overtimeText}>
                                {' '}(+{entry.overtime_hours.toFixed(2)} OT)
                              </Text>
                            )}
                          </Text>
                        </View>
                        
                        {entry.job_project && (
                          <View style={styles.entryRow}>
                            <Ionicons name="briefcase-outline" size={16} color="#9ca3af" />
                            <Text style={styles.entryText}>{entry.job_project}</Text>
                          </View>
                        )}
                        
                        <View style={styles.entryRow}>
                          <Ionicons
                            name={entry.pre_start_completed ? 'checkmark-circle' : 'alert-circle'}
                            size={16}
                            color={entry.pre_start_completed ? '#4ade80' : '#f59e0b'}
                          />
                          <Text
                            style={[
                              styles.entryText,
                              { color: entry.pre_start_completed ? '#4ade80' : '#f59e0b' },
                            ]}
                          >
                            Pre-Start {entry.pre_start_completed ? 'Done' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.noEntryText}>No entry</Text>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Share Button */}
            <TouchableOpacity style={styles.shareButton} onPress={shareWeeklySummary}>
              <Ionicons name="share-outline" size={24} color="#1a1a2e" />
              <Text style={styles.shareButtonText}>Share Weekly Summary</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 10,
    fontSize: 16,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    marginTop: 8,
  },
  navButton: {
    padding: 8,
  },
  weekTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  summaryTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    color: '#4ade80',
    fontSize: 28,
    fontWeight: '700',
  },
  summaryLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
  },
  overtimeValue: {
    color: '#f59e0b',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  dayCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  todayCard: {
    borderWidth: 2,
    borderColor: '#4ade80',
  },
  workedCard: {
    backgroundColor: '#2d3748',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    width: 50,
  },
  dayDate: {
    color: '#9ca3af',
    fontSize: 14,
    flex: 1,
  },
  todayBadge: {
    backgroundColor: '#4ade80',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  todayBadgeText: {
    color: '#1a1a2e',
    fontSize: 12,
    fontWeight: '600',
  },
  entryDetails: {
    marginLeft: 50,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  entryText: {
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 8,
  },
  overtimeText: {
    color: '#f59e0b',
  },
  noEntryText: {
    color: '#6b7280',
    fontSize: 14,
    marginLeft: 50,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ade80',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  shareButtonText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 20,
  },
});
