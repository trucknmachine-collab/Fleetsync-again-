import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineProvider } from '../contexts/OfflineContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <OfflineProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#1a1a2e' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </OfflineProvider>
    </SafeAreaProvider>
  );
}
