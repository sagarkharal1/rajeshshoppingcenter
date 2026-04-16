import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkBanner } from "@/components/NetworkBanner";
import { CartProvider } from "@/context/CartContext";
import { LanguageProvider } from "@/context/LanguageContext";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error: any) => {
        const status = error?.response?.status ?? error?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
    mutations: {
      retry: false,
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="product/[id]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="checkout"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="booking"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="payment-info"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="terms"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="delivery-policy"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="admin/index"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="admin/dashboard"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="admin/products"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="admin/orders"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="admin/bookings"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="admin/settings"
        options={{ headerShown: false, presentation: "card" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <CartProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <RootLayoutNav />
                <NetworkBanner />
              </GestureHandlerRootView>
            </CartProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
