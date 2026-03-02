import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

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

export default function HistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/entries`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data);
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEntries();
  };

  const deleteEntry = async (date: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/entries/${date}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                setEntries(entries.filter(e => e.date !== date));
                Alert.alert('Success', 'Entry deleted successfully');
              } else {
                Alert.alert('Error', 'Failed to delete entry');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete entry');
            }
          },
        },
      ]
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ade80" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4ade80"
            colors={['#4ade80']}
          />
        }
      >
        <Text style={styles.headerText}>
          {entries.length} {entries.length === 1 ? 'Entry' : 'Entries'}
        </Text>

        {entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyText}>No entries yet</Text>
            <Text style={styles.emptySubtext}>Start by creating today's entry</Text>
          </View>
        ) : (
          entries.map(entry => {
            const isExpanded = expandedId === entry.id;
            const entryDate = parseISO(entry.date);
            
            return (
              <View key={entry.id} style={styles.entryCard}>
                <TouchableOpacity
                  style={styles.entryHeader}
                  onPress={() => toggleExpand(entry.id)}
                >
                  <View style={styles.entryHeaderLeft}>
                    <Text style={styles.entryDate}>
                      {format(entryDate, 'EEE, MMM d, yyyy')}
                    </Text>
                    <View style={styles.entryBadges}>
                      {entry.pre_start_completed && (
                        <View style={styles.badge}>
                          <Ionicons name="checkmark-circle" size={14} color="#4ade80" />
                          <Text style={styles.badgeText}>Pre-Start</Text>
                        </View>
                      )}
                      {entry.total_hours > 0 && (
                        <View style={[styles.badge, styles.hoursBadge]}>
                          <Text style={styles.hoursBadgeText}>
                            {entry.total_hours.toFixed(1)} hrs
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color="#9ca3af"
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.entryContent}>
                    {/* Worker */}
                    <View style={styles.detailRow}>
                      <Ionicons name="person-outline" size={18} color="#9ca3af" />
                      <Text style={styles.detailLabel}>Worker:</Text>
                      <Text style={styles.detailValue}>{entry.worker_name}</Text>
                    </View>

                    {/* Fleet Number */}
                    {entry.fleet_number && (
                      <View style={styles.detailRow}>
                        <Ionicons name="car-outline" size={18} color="#9ca3af" />
                        <Text style={styles.detailLabel}>Fleet #:</Text>
                        <Text style={styles.detailValue}>{entry.fleet_number}</Text>
                      </View>
                    )}

                    {/* Time */}
                    {entry.start_time && entry.end_time && (
                      <View style={styles.detailRow}>
                        <Ionicons name="time-outline" size={18} color="#9ca3af" />
                        <Text style={styles.detailLabel}>Time:</Text>
                        <Text style={styles.detailValue}>
                          {entry.start_time} - {entry.end_time}
                        </Text>
                      </View>
                    )}

                    {/* Hours */}
                    <View style={styles.detailRow}>
                      <Ionicons name="hourglass-outline" size={18} color="#9ca3af" />
                      <Text style={styles.detailLabel}>Hours:</Text>
                      <Text style={styles.detailValue}>
                        {entry.total_hours.toFixed(2)}
                        {entry.overtime_hours > 0 && (
                          <Text style={styles.overtimeText}>
                            {' '}(+{entry.overtime_hours.toFixed(2)} OT)
                          </Text>
                        )}
                      </Text>
                    </View>

                    {/* Break */}
                    <View style={styles.detailRow}>
                      <Ionicons name="cafe-outline" size={18} color="#9ca3af" />
                      <Text style={styles.detailLabel}>Break:</Text>
                      <Text style={styles.detailValue}>{entry.break_duration} mins</Text>
                    </View>

                    {/* Job */}
                    {entry.job_project && (
                      <View style={styles.detailRow}>
                        <Ionicons name="briefcase-outline" size={18} color="#9ca3af" />
                        <Text style={styles.detailLabel}>Job:</Text>
                        <Text style={styles.detailValue}>{entry.job_project}</Text>
                      </View>
                    )}

                    {/* Engine Hours */}
                    {(entry.engine_hours_start !== null || entry.engine_hours_end !== null) && (
                      <View style={styles.detailRow}>
                        <Ionicons name="speedometer-outline" size={18} color="#9ca3af" />
                        <Text style={styles.detailLabel}>Engine:</Text>
                        <Text style={styles.detailValue}>
                          {entry.engine_hours_start ?? '-'} - {entry.engine_hours_end ?? '-'}
                        </Text>
                      </View>
                    )}

                    {/* Fuel Usage */}
                    {entry.fuel_usage !== null && entry.fuel_usage !== undefined && (
                      <View style={styles.detailRow}>
                        <Ionicons name="water-outline" size={18} color="#9ca3af" />
                        <Text style={styles.detailLabel}>Fuel:</Text>
                        <Text style={styles.detailValue}>{entry.fuel_usage} L</Text>
                      </View>
                    )}

                    {/* Pre-Start Checklist */}
                    <View style={styles.checklistSection}>
                      <Text style={styles.checklistTitle}>Pre-Start Checklist</Text>
                      {entry.pre_start_checklist.map((item, index) => (
                        <View key={index} style={styles.checklistItem}>
                          <View style={styles.checklistItemHeader}>
                            <Ionicons
                              name={item.passed ? 'checkmark-circle' : 'close-circle'}
                              size={16}
                              color={item.passed ? '#4ade80' : '#ef4444'}
                            />
                            <Text style={styles.checklistItemName}>{item.name}</Text>
                          </View>
                          {item.defects && (
                            <Text style={styles.defectsText}>Defects: {item.defects}</Text>
                          )}
                        </View>
                      ))}
                    </View>

                    {/* Notes */}
                    {entry.notes && (
                      <View style={styles.notesSection}>
                        <Text style={styles.notesTitle}>Notes</Text>
                        <Text style={styles.notesText}>{entry.notes}</Text>
                      </View>
                    )}

                    {/* Delete Button */}
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteEntry(entry.date)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      <Text style={styles.deleteButtonText}>Delete Entry</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
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
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 10,
    fontSize: 16,
  },
  headerText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 16,
    marginBottom: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
  },
  entryCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  entryHeaderLeft: {
    flex: 1,
  },
  entryDate: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  entryBadges: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#4ade80',
    fontSize: 12,
    marginLeft: 4,
  },
  hoursBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  hoursBadgeText: {
    color: '#3b82f6',
    fontSize: 12,
  },
  entryContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#3d3d5c',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginLeft: 8,
    width: 70,
  },
  detailValue: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
  },
  overtimeText: {
    color: '#f59e0b',
  },
  checklistSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
  },
  checklistTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  checklistItem: {
    marginBottom: 8,
  },
  checklistItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checklistItemName: {
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 8,
  },
  defectsText: {
    color: '#f59e0b',
    fontSize: 12,
    marginLeft: 24,
    marginTop: 4,
  },
  notesSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
  },
  notesTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  notesText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 20,
  },
});
