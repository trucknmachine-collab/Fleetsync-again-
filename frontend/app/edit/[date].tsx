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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { format, parseISO } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

export default function EditEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const editDate = params.date as string;
  
  const { saveEntry: saveEntryOffline, getEntry, getRecentEntry, isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNewEntry, setIsNewEntry] = useState(false);
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

  useEffect(() => {
    loadEntry();
  }, [editDate]);

  const loadEntry = async () => {
    if (!editDate) {
      router.back();
      return;
    }
    
    try {
      setLoading(true);
      const data = await getEntry(editDate);
      if (data) {
        // Existing entry - load data
        setIsNewEntry(false);
        setChecklist(data.pre_start_checklist?.length > 0 ? data.pre_start_checklist : DEFAULT_CHECKLIST);
        setPreStartCompleted(data.pre_start_completed || false);
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
        // New entry - try to prefill from recent entry
        setIsNewEntry(true);
        try {
          const lastEntry = await getRecentEntry();
          if (lastEntry) {
            if (lastEntry.worker_name) setWorkerName(lastEntry.worker_name);
            if (lastEntry.fleet_number) setFleetNumber(lastEntry.fleet_number);
            if (lastEntry.engine_hours_end) setEngineHoursStart(String(lastEntry.engine_hours_end));
            if (lastEntry.job_project) setJobProject(lastEntry.job_project);
          }
        } catch (e) {
          // Ignore - just use defaults
        }
      }
    } catch (error) {
      // Entry doesn't exist - treat as new
      setIsNewEntry(true);
      try {
        const lastEntry = await getRecentEntry();
        if (lastEntry) {
          if (lastEntry.worker_name) setWorkerName(lastEntry.worker_name);
          if (lastEntry.fleet_number) setFleetNumber(lastEntry.fleet_number);
          if (lastEntry.engine_hours_end) setEngineHoursStart(String(lastEntry.engine_hours_end));
          if (lastEntry.job_project) setJobProject(lastEntry.job_project);
        }
      } catch (e) {
        // Ignore
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateHours = (start: string, end: string, breakMins: number): { total: number; overtime: number } => {
    if (!start || !end) return { total: 0, overtime: 0 };
    
    const parseTime = (timeStr: string): { hours: number; mins: number } | null => {
      const parts = timeStr.split(':');
      if (parts.length !== 2) return null;
      const hours = parseInt(parts[0], 10);
      const mins = parseInt(parts[1], 10);
      if (isNaN(hours) || isNaN(mins)) return null;
      return { hours, mins };
    };
    
    const startParsed = parseTime(start);
    const endParsed = parseTime(end);
    
    if (!startParsed || !endParsed) return { total: 0, overtime: 0 };
    
    let totalMinutes = (endParsed.hours * 60 + endParsed.mins) - (startParsed.hours * 60 + startParsed.mins) - breakMins;
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    
    const totalHours = totalMinutes / 60;
    const overtime = Math.max(0, totalHours - 8);
    
    return { total: Math.round(totalHours * 100) / 100, overtime: Math.round(overtime * 100) / 100 };
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

      console.log('Saving entry for date:', editDate, 'isNew:', isNewEntry);
      console.log('Hours calculated - total:', total, 'overtime:', overtime);

      const entryData = {
        date: editDate,
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

      console.log('Entry data to save:', JSON.stringify(entryData, null, 2));

      const result = await saveEntryOffline(editDate, entryData, isNewEntry);
      console.log('Save result:', result);
      
      Alert.alert('Success', isNewEntry ? 'Entry created successfully' : 'Entry updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error saving entry:', error);
      Alert.alert('Error', 'Failed to save entry: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ade80" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isNewEntry ? 'Add Entry' : 'Edit Entry'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Date Display */}
          <View style={styles.dateHeader}>
            <Ionicons name="calendar" size={24} color="#f59e0b" />
            <Text style={styles.dateText}>
              {editDate ? format(parseISO(editDate), 'EEEE, MMMM d, yyyy') : ''}
            </Text>
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
            <Text style={styles.sectionTitle}>Pre-Start Checklist</Text>
            {checklist.map((item, index) => (
              <View key={item.name} style={styles.checklistItem}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => toggleChecklistItem(index)}
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
                />
              </View>
            ))}
          </View>

          {/* Timesheet */}
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
                <Ionicons name={isNewEntry ? "add-circle" : "save"} size={20} color="#1a1a2e" />
                <Text style={styles.saveButtonText}>{isNewEntry ? 'Create Entry' : 'Save Changes'}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
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
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  section: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
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
});
