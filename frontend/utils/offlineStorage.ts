import AsyncStorage from '@react-native-async-storage/async-storage';

const ENTRIES_KEY = 'offline_entries';
const PENDING_SYNC_KEY = 'pending_sync';
const LAST_SYNC_KEY = 'last_sync';

export interface PendingSyncItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  date: string;
  data?: any;
  timestamp: number;
}

// Save entry locally
export const saveEntryLocally = async (date: string, entry: any): Promise<void> => {
  try {
    const entries = await getLocalEntries();
    entries[date] = entry;
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Error saving entry locally:', error);
    throw error;
  }
};

// Get all local entries
export const getLocalEntries = async (): Promise<Record<string, any>> => {
  try {
    const data = await AsyncStorage.getItem(ENTRIES_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error getting local entries:', error);
    return {};
  }
};

// Get entry for specific date
export const getLocalEntry = async (date: string): Promise<any | null> => {
  try {
    const entries = await getLocalEntries();
    return entries[date] || null;
  } catch (error) {
    console.error('Error getting local entry:', error);
    return null;
  }
};

// Delete local entry
export const deleteLocalEntry = async (date: string): Promise<void> => {
  try {
    const entries = await getLocalEntries();
    delete entries[date];
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Error deleting local entry:', error);
    throw error;
  }
};

// Add item to pending sync queue
export const addToPendingSync = async (item: Omit<PendingSyncItem, 'id' | 'timestamp'>): Promise<void> => {
  try {
    const pending = await getPendingSync();
    
    // Remove any existing pending items for same date (to avoid duplicates)
    const filtered = pending.filter(p => p.date !== item.date || p.action !== item.action);
    
    filtered.push({
      ...item,
      id: `${item.date}_${item.action}_${Date.now()}`,
      timestamp: Date.now(),
    });
    
    await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error adding to pending sync:', error);
    throw error;
  }
};

// Get pending sync items
export const getPendingSync = async (): Promise<PendingSyncItem[]> => {
  try {
    const data = await AsyncStorage.getItem(PENDING_SYNC_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting pending sync:', error);
    return [];
  }
};

// Remove item from pending sync
export const removeFromPendingSync = async (id: string): Promise<void> => {
  try {
    const pending = await getPendingSync();
    const filtered = pending.filter(p => p.id !== id);
    await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing from pending sync:', error);
    throw error;
  }
};

// Clear all pending sync items
export const clearPendingSync = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify([]));
  } catch (error) {
    console.error('Error clearing pending sync:', error);
    throw error;
  }
};

// Update last sync time
export const setLastSyncTime = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error setting last sync time:', error);
  }
};

// Get last sync time
export const getLastSyncTime = async (): Promise<number | null> => {
  try {
    const data = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return data ? parseInt(data, 10) : null;
  } catch (error) {
    console.error('Error getting last sync time:', error);
    return null;
  }
};

// Merge server entries with local entries (local takes priority for pending items)
export const mergeEntries = async (serverEntries: any[]): Promise<void> => {
  try {
    const localEntries = await getLocalEntries();
    const pending = await getPendingSync();
    const pendingDates = new Set(pending.map(p => p.date));
    
    // Add server entries that don't have pending local changes
    for (const entry of serverEntries) {
      if (!pendingDates.has(entry.date)) {
        localEntries[entry.date] = entry;
      }
    }
    
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(localEntries));
  } catch (error) {
    console.error('Error merging entries:', error);
  }
};

// Get most recent entry (for auto-fill)
export const getMostRecentEntry = async (): Promise<any | null> => {
  try {
    const entries = await getLocalEntries();
    const dates = Object.keys(entries).sort().reverse();
    if (dates.length > 0) {
      return entries[dates[0]];
    }
    return null;
  } catch (error) {
    console.error('Error getting most recent entry:', error);
    return null;
  }
};
