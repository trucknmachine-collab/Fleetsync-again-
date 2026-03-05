import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { format } from 'date-fns';
import { useOffline } from '../../contexts/OfflineContext';

interface ChecklistItem {
  name: string;
  passed: boolean;
  defects: string;
}

interface LocationData {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
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
  location: LocationData | null;
  notes: string;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { name: 'Lights', passed: false, defects: '' },
  { name: 'Brakes', passed: false, defects: '' },
  { name: 'Tyres/Tracks', passed: false, defects: '' },
  { name: 'Engine Oil', passed: false, defects: '' },
  { name: 'Hydraulic Oil', passed: false, defects: '' },
  { name: 'Coolant', passed: false, defects: '' },
  { name: 'Mirrors', passed: false, defects: '' },
  { name: 'Seatbelts', passed: false, defects: '' },
  { name: 'UHF', passed: false, defects: '' },
  { name: 'Leaks', passed: false, defects: '' },
  { name: 'Steering', passed: false, defects: '' },
  { name: 'Windscreen/Windows', passed: false, defects: '' },
];

export default function TodayScreen() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { saveEntry: saveEntryOffline, getEntry, getRecentEntry, isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState<DailyEntry | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [preStartCompleted, setPreStartCompleted] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [breakDuration, setBreakDuration] = useState('0');
  const [jobProject, setJobProject] = useState('');
  const [engineHoursStart, setEngineHoursStart] = useState('');
  const [engineHoursEnd, setEngineHoursEnd] = useState('');
  const [fuelUsage, setFuelUsage] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [workerName, setWorkerName] = useState('Worker');
  const [fleetNumber, setFleetNumber] = useState('');

  const fetchEntry = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getEntry(today);
      if (data) {
        setEntry(data);
        setChecklist(data.pre_start_checklist && data.pre_start_checklist.length > 0 ? data.pre_start_checklist : DEFAULT_CHECKLIST);
        setPreStartCompleted(data.pre_start_completed);
        setStartTime(data.start_time || '');
        setEndTime(data.end_time || '');
        setBreakDuration(String(data.break_duration || 0));
        setJobProject(data.job_project || '');
        setEngineHoursStart(data.engine_hours_start ? String(data.engine_hours_start) : '');
        setEngineHoursEnd(data.engine_hours_end ? String(data.engine_hours_end) : '');
        setFuelUsage(data.fuel_usage ? String(data.fuel_usage) : '');
        setNotes(data.notes || '');
        setLocation(data.location);
        setWorkerName(data.worker_name || 'Worker');
        setFleetNumber(data.fleet_number || '');
      } else {
        // No entry for today - try to get previous day's data to pre-fill
        await fetchPreviousDayData();
      }
    } catch (error) {
      console.log('No existing entry for today');
      // Try to get previous day's data
      await fetchPreviousDayData();
    } finally {
      setLoading(false);
    }
  }, [today, getEntry]);

  // Fetch previous day's data to pre-fill name, fleet number, and engine hours
  const fetchPreviousDayData = async () => {
    try {
      const lastEntry = await getRecentEntry();
      if (lastEntry) {
        // Pre-fill worker name and fleet number
        if (lastEntry.worker_name) {
          setWorkerName(lastEntry.worker_name);
        }
        if (lastEntry.fleet_number) {
          setFleetNumber(lastEntry.fleet_number);
        }
        
        // Use previous day's engine end hours as today's start hours
        if (lastEntry.engine_hours_end) {
          setEngineHoursStart(String(lastEntry.engine_hours_end));
        }
        
        // Pre-fill job/project if it exists
        if (lastEntry.job_project) {
          setJobProject(lastEntry.job_project);
        }
      }
    } catch (error) {
      console.log('Could not fetch previous day data');
    }
  };

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      const addressStr = address[0]
        ? `${address[0].street || ''}, ${address[0].city || ''}, ${address[0].region || ''}`
        : 'Unknown location';

      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address: addressStr,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not get location');
    }
  };

  const toggleChecklistItem = (index: number) => {
    const newChecklist = [...checklist];
    newChecklist[index].passed = !newChecklist[index].passed;
    setChecklist(newChecklist);
  };

  const updateDefects = (index: number, defects: string) => {
    const newChecklist = [...checklist];
    newChecklist[index].defects = defects;
    setChecklist(newChecklist);
  };

  const calculateHours = (start: string, end: string, breakMins: number): { total: number; overtime: number } => {
    if (!start || !end) return { total: 0, overtime: 0 };
    
    // Parse time - handle HH:MM, H:MM, HHMM, and HMM formats
    const parseTime = (timeStr: string): { hours: number; mins: number } | null => {
      let hours: number, mins: number;
      
      if (timeStr.includes(':')) {
        const parts = timeStr.split(':');
        if (parts.length !== 2) return null;
        hours = parseInt(parts[0], 10);
        mins = parseInt(parts[1], 10);
      } else if (timeStr.length === 4) {
        // HHMM format
        hours = parseInt(timeStr.substring(0, 2), 10);
        mins = parseInt(timeStr.substring(2, 4), 10);
      } else if (timeStr.length === 3) {
        // HMM format (e.g., "620" for 6:20)
        hours = parseInt(timeStr.substring(0, 1), 10);
        mins = parseInt(timeStr.substring(1, 3), 10);
      } else {
        return null;
      }
      
      if (isNaN(hours) || isNaN(mins)) return null;
      if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null;
      return { hours, mins };
    };
    
    const startParsed = parseTime(start);
    const endParsed = parseTime(end);
    
    if (!startParsed || !endParsed) return { total: 0, overtime: 0 };
    
    let totalMinutes = (endParsed.hours * 60 + endParsed.mins) - (startParsed.hours * 60 + startParsed.mins) - breakMins;
    if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight shifts
    
    const totalHours = totalMinutes / 60;
    const overtime = Math.max(0, totalHours - 8);
    
    return { total: Math.round(totalHours * 100) / 100, overtime: Math.round(overtime * 100) / 100 };
  };

  // Format time input as user types
  const formatTimeInput = (text: string): string => {
    // Remove non-numeric characters except colon
    let cleaned = text.replace(/[^0-9:]/g, '');
    
    // Auto-insert colon after 2 digits if not present
    if (cleaned.length === 2 && !cleaned.includes(':')) {
      cleaned = cleaned + ':';
    }
    
    // Limit to 5 characters (HH:MM)
    if (cleaned.length > 5) {
      cleaned = cleaned.substring(0, 5);
    }
    
    return cleaned;
  };

  const handleStartTimeChange = (text: string) => {
    setStartTime(formatTimeInput(text));
  };

  const handleEndTimeChange = (text: string) => {
    setEndTime(formatTimeInput(text));
  };

  // Quick time presets
  const setQuickStartTime = (time: string) => {
    setStartTime(time);
  };

  const setQuickEndTime = (time: string) => {
    setEndTime(time);
  };

  const saveEntry = async () => {
    try {
      setSaving(true);
      const breakMins = parseInt(breakDuration) || 0;
      const { total, overtime } = calculateHours(startTime, endTime, breakMins);

      const entryData = {
        date: today,
        worker_name: workerName,
        fleet_number: fleetNumber,
        pre_start_checklist: checklist,
        pre_start_completed: preStartCompleted,
        start_time: startTime || null,
        end_time: endTime || null,
        break_duration: breakMins,
        total_hours: total,
        overtime_hours: overtime,
        job_project: jobProject,
        engine_hours_start: engineHoursStart ? parseFloat(engineHoursStart) : null,
        engine_hours_end: engineHoursEnd ? parseFloat(engineHoursEnd) : null,
        fuel_usage: fuelUsage ? parseFloat(fuelUsage) : null,
        location: location,
        notes: notes,
      };

      const isNew = !entry;
      const savedEntry = await saveEntryOffline(today, entryData, isNew);
      setEntry(savedEntry);
      
      if (isOnline) {
        Alert.alert('Success', 'Entry saved successfully');
      } else {
        Alert.alert('Saved Offline', 'Entry saved locally. Will sync when back online.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const completePreStart = () => {
    const allPassed = checklist.every(item => item.passed);
    if (!allPassed) {
      Alert.alert(
        'Incomplete Checklist',
        'Not all items are checked. Do you want to continue anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => setPreStartCompleted(true) },
        ]
      );
    } else {
      setPreStartCompleted(true);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ade80" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Date Header */}
          <View style={styles.dateHeader}>
            <Ionicons name="calendar" size={24} color="#4ade80" />
            <Text style={styles.dateText}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</Text>
          </View>

          {/* Worker Name */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Worker Name</Text>
            <TextInput
              style={styles.input}
              value={workerName}
              onChangeText={setWorkerName}
              placeholder="Enter your name"
              placeholderTextColor="#6b7280"
            />
          </View>

          {/* Fleet Number */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fleet Number</Text>
            <TextInput
              style={styles.input}
              value={fleetNumber}
              onChangeText={setFleetNumber}
              placeholder="Enter fleet/vehicle number"
              placeholderTextColor="#6b7280"
            />
          </View>

          {/* Pre-Start Checklist */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pre-Start Checklist</Text>
              {preStartCompleted && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              )}
            </View>

            {checklist.map((item, index) => (
              <View key={item.name} style={styles.checklistItem}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => toggleChecklistItem(index)}
                  disabled={preStartCompleted}
                >
                  <View style={[styles.checkbox, item.passed && styles.checkboxChecked]}>
                    {item.passed && <Ionicons name="checkmark" size={18} color="#1a1a2e" />}
                  </View>
                  <Text style={[styles.checklistText, item.passed && styles.checklistTextChecked]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.defectsInput}
                  value={item.defects}
                  onChangeText={(text) => updateDefects(index, text)}
                  placeholder="Defects (if any)"
                  placeholderTextColor="#6b7280"
                  editable={!preStartCompleted}
                />
              </View>
            ))}

            {/* Defects Summary List */}
            {checklist.some(item => item.defects.trim() !== '') && (
              <View style={styles.defectsSummary}>
                <View style={styles.defectsSummaryHeader}>
                  <Ionicons name="warning" size={20} color="#f59e0b" />
                  <Text style={styles.defectsSummaryTitle}>Defects List</Text>
                </View>
                {checklist
                  .filter(item => item.defects.trim() !== '')
                  .map((item, index) => (
                    <View key={index} style={styles.defectsSummaryItem}>
                      <Text style={styles.defectsSummaryItemName}>{item.name}:</Text>
                      <Text style={styles.defectsSummaryItemText}>{item.defects}</Text>
                    </View>
                  ))}
              </View>
            )}

            {!preStartCompleted && (
              <TouchableOpacity style={styles.completeButton} onPress={completePreStart}>
                <Ionicons name="checkmark-done" size={20} color="#1a1a2e" />
                <Text style={styles.completeButtonText}>Complete Pre-Start</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Timesheet Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timesheet</Text>

            <View style={styles.timeRow}>
              <View style={styles.timeInput}>
                <Text style={styles.inputLabel}>Start Time</Text>
                <TextInput
                  style={styles.input}
                  value={startTime}
                  onChangeText={handleStartTimeChange}
                  placeholder="HH:MM"
                  placeholderTextColor="#6b7280"
                  keyboardType="numeric"
                  maxLength={5}
                />
                <View style={styles.quickTimeRow}>
                  <TouchableOpacity style={styles.quickTimeBtn} onPress={() => setQuickStartTime('06:00')}>
                    <Text style={styles.quickTimeBtnText}>6am</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickTimeBtn} onPress={() => setQuickStartTime('07:00')}>
                    <Text style={styles.quickTimeBtnText}>7am</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickTimeBtn} onPress={() => setQuickStartTime('08:00')}>
                    <Text style={styles.quickTimeBtnText}>8am</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.timeInput}>
                <Text style={styles.inputLabel}>End Time</Text>
                <TextInput
                  style={styles.input}
                  value={endTime}
                  onChangeText={handleEndTimeChange}
                  placeholder="HH:MM"
                  placeholderTextColor="#6b7280"
                  keyboardType="numeric"
                  maxLength={5}
                />
                <View style={styles.quickTimeRow}>
                  <TouchableOpacity style={styles.quickTimeBtn} onPress={() => setQuickEndTime('15:00')}>
                    <Text style={styles.quickTimeBtnText}>3pm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickTimeBtn} onPress={() => setQuickEndTime('16:00')}>
                    <Text style={styles.quickTimeBtnText}>4pm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickTimeBtn} onPress={() => setQuickEndTime('17:00')}>
                    <Text style={styles.quickTimeBtnText}>5pm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.timeRow}>
              <View style={styles.timeInput}>
                <Text style={styles.inputLabel}>Break (mins)</Text>
                <TextInput
                  style={styles.input}
                  value={breakDuration}
                  onChangeText={setBreakDuration}
                  placeholder="0"
                  placeholderTextColor="#6b7280"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.timeInput}>
                <Text style={styles.inputLabel}>Total Hours</Text>
                <View style={styles.hoursDisplay}>
                  <Text style={styles.hoursText}>
                    {calculateHours(startTime, endTime, parseInt(breakDuration) || 0).total.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Overtime Display */}
            <View style={styles.overtimeRow}>
              <Text style={styles.overtimeLabel}>Overtime Hours:</Text>
              <Text style={styles.overtimeValue}>
                {calculateHours(startTime, endTime, parseInt(breakDuration) || 0).overtime.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Job/Project */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job / Project</Text>
            <TextInput
              style={styles.input}
              value={jobProject}
              onChangeText={setJobProject}
              placeholder="Enter job or project name"
              placeholderTextColor="#6b7280"
            />
          </View>

          {/* Engine Hours */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Engine Hours</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeInput}>
                <Text style={styles.inputLabel}>Start</Text>
                <TextInput
                  style={styles.input}
                  value={engineHoursStart}
                  onChangeText={setEngineHoursStart}
                  placeholder="0.0"
                  placeholderTextColor="#6b7280"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.timeInput}>
                <Text style={styles.inputLabel}>End</Text>
                <TextInput
                  style={styles.input}
                  value={engineHoursEnd}
                  onChangeText={setEngineHoursEnd}
                  placeholder="0.0"
                  placeholderTextColor="#6b7280"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          {/* Fuel Usage */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fuel Usage</Text>
            <TextInput
              style={styles.input}
              value={fuelUsage}
              onChangeText={setFuelUsage}
              placeholder="Enter litres"
              placeholderTextColor="#6b7280"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <TouchableOpacity style={styles.locationButton} onPress={getLocation}>
              <Ionicons name="location" size={20} color="#4ade80" />
              <Text style={styles.locationButtonText}>Get Current Location</Text>
            </TouchableOpacity>
            {location && (
              <View style={styles.locationDisplay}>
                <Text style={styles.locationText}>{location.address}</Text>
                <Text style={styles.locationCoords}>
                  {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
                </Text>
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes..."
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={saveEntry}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#1a1a2e" />
            ) : (
              <>
                <Ionicons name="save" size={20} color="#1a1a2e" />
                <Text style={styles.saveButtonText}>Save Entry</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  keyboardView: {
    flex: 1,
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
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    marginVertical: 16,
  },
  dateText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  section: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  checklistItem: {
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4ade80',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#4ade80',
  },
  checklistText: {
    color: '#ffffff',
    fontSize: 16,
    flex: 1,
    flexWrap: 'wrap',
  },
  checklistTextChecked: {
    color: '#4ade80',
  },
  defectsInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 10,
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 40,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ade80',
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  completeButtonText: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 14,
    color: '#ffffff',
    fontSize: 16,
  },
  inputLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timeInput: {
    flex: 1,
  },
  hoursDisplay: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  hoursText: {
    color: '#4ade80',
    fontSize: 18,
    fontWeight: '700',
  },
  overtimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 14,
  },
  overtimeLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  overtimeValue: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '700',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  locationButtonText: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  locationDisplay: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
  },
  locationText: {
    color: '#ffffff',
    fontSize: 14,
  },
  locationCoords: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ade80',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 20,
  },
  quickTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 4,
  },
  quickTimeBtn: {
    flex: 1,
    backgroundColor: '#3d3d5c',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  quickTimeBtnText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  defectsSummary: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  defectsSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  defectsSummaryTitle: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  defectsSummaryItem: {
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#f59e0b',
  },
  defectsSummaryItemName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  defectsSummaryItemText: {
    color: '#fbbf24',
    fontSize: 14,
    marginTop: 2,
  },
});
