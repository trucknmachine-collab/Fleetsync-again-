import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import {
  saveEntryLocally,
  getLocalEntry,
  getLocalEntries,
  deleteLocalEntry,
  addToPendingSync,
  getPendingSync,
  removeFromPendingSync,
  setLastSyncTime,
  getMostRecentEntry,
  mergeEntries,
  PendingSyncItem,
} from '../utils/offlineStorage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  syncNow: () => Promise<void>;
  saveEntry: (date: string, data: any, isNew: boolean) => Promise<any>;
  getEntry: (date: string) => Promise<any | null>;
  getAllEntries: () => Promise<any[]>;
  deleteEntry: (date: string) => Promise<void>;
  getRecentEntry: () => Promise<any | null>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

interface OfflineProviderProps {
  children: ReactNode;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online ?? false);
    });

    // Check initial state
    NetInfo.fetch().then((state) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online ?? false);
    });

    return () => unsubscribe();
  }, []);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    const pending = await getPendingSync();
    setPendingCount(pending.length);
  }, []);

  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncNow();
    }
  }, [isOnline]);

  // Sync pending items with server
  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      const pending = await getPendingSync();
      
      for (const item of pending) {
        try {
          if (item.action === 'create') {
            const response = await fetch(`${API_URL}/api/entries`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.data),
            });
            
            if (response.ok || response.status === 400) {
              // 400 means entry already exists, which is fine
              await removeFromPendingSync(item.id);
            }
          } else if (item.action === 'update') {
            const response = await fetch(`${API_URL}/api/entries/${item.date}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.data),
            });
            
            if (response.ok) {
              await removeFromPendingSync(item.id);
            } else if (response.status === 404) {
              // Entry doesn't exist on server, create it instead
              const createResponse = await fetch(`${API_URL}/api/entries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...item.data, date: item.date }),
              });
              if (createResponse.ok || createResponse.status === 400) {
                await removeFromPendingSync(item.id);
              }
            }
          } else if (item.action === 'delete') {
            const response = await fetch(`${API_URL}/api/entries/${item.date}`, {
              method: 'DELETE',
            });
            
            if (response.ok || response.status === 404) {
              await removeFromPendingSync(item.id);
            }
          }
        } catch (error) {
          console.error(`Error syncing item ${item.id}:`, error);
        }
      }

      await setLastSyncTime();
      await updatePendingCount();
    } catch (error) {
      console.error('Error during sync:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, updatePendingCount]);

  // Save entry (offline-first)
  const saveEntry = useCallback(async (date: string, data: any, isNew: boolean): Promise<any> => {
    // Always save locally first
    const entryWithDate = { ...data, date };
    await saveEntryLocally(date, entryWithDate);

    if (isOnline) {
      try {
        const url = isNew ? `${API_URL}/api/entries` : `${API_URL}/api/entries/${date}`;
        const method = isNew ? 'POST' : 'PUT';
        
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entryWithDate),
        });

        if (response.ok) {
          const serverData = await response.json();
          await saveEntryLocally(date, serverData);
          return serverData;
        } else if (response.status === 400 && isNew) {
          // Entry already exists, try update
          const updateResponse = await fetch(`${API_URL}/api/entries/${date}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entryWithDate),
          });
          if (updateResponse.ok) {
            const serverData = await updateResponse.json();
            await saveEntryLocally(date, serverData);
            return serverData;
          }
        }
        
        // If server request failed, queue for later sync
        await addToPendingSync({
          action: isNew ? 'create' : 'update',
          date,
          data: entryWithDate,
        });
        await updatePendingCount();
        return entryWithDate;
      } catch (error) {
        // Network error - queue for sync
        await addToPendingSync({
          action: isNew ? 'create' : 'update',
          date,
          data: entryWithDate,
        });
        await updatePendingCount();
        return entryWithDate;
      }
    } else {
      // Offline - queue for sync
      await addToPendingSync({
        action: isNew ? 'create' : 'update',
        date,
        data: entryWithDate,
      });
      await updatePendingCount();
      return entryWithDate;
    }
  }, [isOnline, updatePendingCount]);

  // Get entry (offline-first)
  const getEntry = useCallback(async (date: string): Promise<any | null> => {
    // First check local storage
    const localEntry = await getLocalEntry(date);
    
    if (isOnline) {
      try {
        const response = await fetch(`${API_URL}/api/entries/${date}`);
        if (response.ok) {
          const serverEntry = await response.json();
          // Check if we have pending changes for this date
          const pending = await getPendingSync();
          const hasPending = pending.some(p => p.date === date);
          
          if (!hasPending) {
            await saveEntryLocally(date, serverEntry);
            return serverEntry;
          }
          return localEntry || serverEntry;
        }
      } catch (error) {
        console.log('Error fetching from server, using local data');
      }
    }
    
    return localEntry;
  }, [isOnline]);

  // Get all entries
  const getAllEntries = useCallback(async (): Promise<any[]> => {
    const localEntries = await getLocalEntries();
    
    if (isOnline) {
      try {
        const response = await fetch(`${API_URL}/api/entries`);
        if (response.ok) {
          const serverEntries = await response.json();
          await mergeEntries(serverEntries);
          
          // Get merged local entries
          const merged = await getLocalEntries();
          return Object.values(merged).sort((a: any, b: any) => 
            b.date.localeCompare(a.date)
          );
        }
      } catch (error) {
        console.log('Error fetching entries from server');
      }
    }
    
    return Object.values(localEntries).sort((a: any, b: any) => 
      b.date.localeCompare(a.date)
    );
  }, [isOnline]);

  // Delete entry
  const deleteEntry = useCallback(async (date: string): Promise<void> => {
    await deleteLocalEntry(date);
    
    if (isOnline) {
      try {
        await fetch(`${API_URL}/api/entries/${date}`, { method: 'DELETE' });
      } catch (error) {
        await addToPendingSync({ action: 'delete', date });
        await updatePendingCount();
      }
    } else {
      await addToPendingSync({ action: 'delete', date });
      await updatePendingCount();
    }
  }, [isOnline, updatePendingCount]);

  // Get most recent entry for auto-fill
  const getRecentEntry = useCallback(async (): Promise<any | null> => {
    return getMostRecentEntry();
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        syncNow,
        saveEntry,
        getEntry,
        getAllEntries,
        deleteEntry,
        getRecentEntry,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};
