import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useOffline } from '../../contexts/OfflineContext';

function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing } = useOffline();
  
  if (isOnline && pendingCount === 0) return null;
  
  return (
    <View style={styles.offlineBar}>
      <Ionicons 
        name={isOnline ? (isSyncing ? 'sync' : 'cloud-upload-outline') : 'cloud-offline-outline'} 
        size={16} 
        color={isOnline ? '#4ade80' : '#f59e0b'} 
      />
      <Text style={[styles.offlineText, { color: isOnline ? '#4ade80' : '#f59e0b' }]}>
        {!isOnline 
          ? 'Offline Mode' 
          : isSyncing 
            ? 'Syncing...' 
            : `${pendingCount} pending`}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <>
      <OfflineIndicator />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#4ade80',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: {
            backgroundColor: '#1a1a2e',
            borderTopColor: '#2d2d44',
            borderTopWidth: 1,
            paddingTop: 5,
            paddingBottom: Platform.OS === 'ios' ? 25 : 10,
            height: Platform.OS === 'ios' ? 85 : 65,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          headerStyle: {
            backgroundColor: '#1a1a2e',
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Tabs.Screen
          name="today"
          options={{
            title: 'Today',
            headerTitle: 'Daily Entry',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="today-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="week"
          options={{
            title: 'Week',
            headerTitle: 'Weekly Summary',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            headerTitle: 'Past Entries',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d2d44',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  offlineText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
