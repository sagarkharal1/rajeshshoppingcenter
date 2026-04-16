import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetSettings } from "@workspace/api-client-react";

import Colors from "@/constants/colors";

const DEFAULT_TERMS = `1. ACCEPTANCE OF TERMS
By placing an order with Rajesh Shopping Center, you agree to these Terms & Conditions.

2. PRICING
All prices are listed in Nepali Rupees (NPR). Prices may change without prior notice. The price displayed at the time of order confirmation is the final price.

3. ORDERS
Orders are subject to availability. We reserve the right to cancel orders if items are out of stock or if there are pricing errors.

4. PAYMENT
Payment is accepted via bank transfer or cash on delivery. Bank transfer must be completed before delivery for orders above NPR 5,000.

5. CANCELLATION
Orders may be cancelled before dispatch. Once items are dispatched, cancellation is not possible.

6. RETURNS
Perishable items (food, vegetables) are non-returnable. Hardware and non-perishable items may be returned within 7 days in original condition.

7. SERVICES
Jeep and tractor bookings must be cancelled at least 24 hours in advance for a full refund. Last-minute cancellations may incur charges.

8. LIABILITY
Rajesh Shopping Center is not liable for delays caused by weather, road conditions, or other circumstances beyond our control.

9. CONTACT
For any issues, contact us at the shop or call our number directly.`;

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { data: settings } = useGetSettings();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 12),
            backgroundColor: theme.backgroundSecondary,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
          Terms & Conditions
        </Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.updated, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
          Last updated: {new Date().toLocaleDateString("en-NP", { year: "numeric", month: "long" })}
        </Text>
        <Text style={[styles.content, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
          {settings?.termsConditions ?? DEFAULT_TERMS}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20 },
  updated: { fontSize: 12, marginBottom: 16 },
  content: { fontSize: 14, lineHeight: 24 },
});
