import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOffline } from '../../contexts/OfflineContext';
import '../../utils/i18n';

function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing } = useOffline();
  const { t } = useTranslation();
  
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
          ? t('offline.offlineMode')
          : isSyncing 
            ? t('offline.syncing')
            : t('offline.pending', { count: pendingCount })}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();
  
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
            title: t('common.today'),
            headerTitle: t('today.title'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="today-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="week"
          options={{
            title: t('common.week'),
            headerTitle: t('week.title'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: t('common.history'),
            headerTitle: t('history.title'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('settings.language'),
            headerTitle: t('settings.language'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
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
