import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/src/lib/theme";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AppLockProvider, useAppLock } from "@/src/auth/AppLockContext";
import { LockOverlay } from "@/src/auth/LockOverlay";

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { ready } = useAppLock();
  if (!ready) return null;
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="rekening" />
        <Stack.Screen name="bagan" />
        <Stack.Screen name="kategori" />
        <Stack.Screen name="pengaturan" />
        <Stack.Screen name="pembayaran-reguler" />
        <Stack.Screen name="pengingat" />
        <Stack.Screen name="setup-pin" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen
          name="transaction"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
      </Stack>
      <LockOverlay />
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppLockProvider>
          <RootStack />
        </AppLockProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
