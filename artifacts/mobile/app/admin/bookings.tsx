import { Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { secureGet } from "@/utils/secureStorage";
import { setAuthTokenGetter, useAdminGetBookings } from "@workspace/api-client-react";

import Colors from "@/constants/colors";

const ADMIN_TOKEN_KEY = "rajesh_admin_token";

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.warning,
  confirmed: Colors.primary,
  completed: Colors.success,
  cancelled: Colors.error,
};

export default function AdminBookingsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  useEffect(() => {
    setAuthTokenGetter(async () => secureGet(ADMIN_TOKEN_KEY));
  }, []);

  const { data: bookings, isLoading, refetch } = useAdminGetBookings();

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
          Bookings
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={(bookings ?? []).slice().reverse()}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          renderItem={({ item }) => {
            const statusColor = STATUS_COLORS[item.status] ?? Colors.primary;
            const isJeep = item.serviceType === "jeep";
            return (
              <View style={[styles.card, { backgroundColor: theme.card }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.serviceIcon, { backgroundColor: isJeep ? Colors.accent + "20" : Colors.primary + "15" }]}>
                    {isJeep
                      ? <MaterialIcons name="directions-car" size={22} color={isJeep ? Colors.accentDark : Colors.primary} />
                      : <MaterialCommunityIcons name="tractor" size={22} color={Colors.primary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.serviceType, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                      {item.serviceType.charAt(0).toUpperCase() + item.serviceType.slice(1)} Booking #{item.id}
                    </Text>
                    <Text style={[styles.customerName, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>
                      {item.customerName}
                    </Text>
                    <Text style={[styles.customerPhone, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                      {item.customerPhone}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                    <Text style={[styles.statusText, { color: statusColor, fontFamily: "Inter_600SemiBold" }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.tripInfo}>
                  <View style={styles.tripRow}>
                    <Ionicons name="location-outline" size={14} color={Colors.primary} />
                    <Text style={[styles.tripText, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
                      From: {item.pickupLocation}
                    </Text>
                  </View>
                  <View style={styles.tripRow}>
                    <Ionicons name="navigate-outline" size={14} color={Colors.success} />
                    <Text style={[styles.tripText, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
                      To: {item.destination}
                    </Text>
                  </View>
                  <View style={styles.tripRow}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.accent} />
                    <Text style={[styles.tripText, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>
                      {item.bookingDate}
                    </Text>
                  </View>
                  {item.notes ? (
                    <View style={styles.tripRow}>
                      <Ionicons name="document-text-outline" size={14} color={theme.textMuted} />
                      <Text style={[styles.tripText, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                        {item.notes}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={[styles.date, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                  Booked: {new Date(item.createdAt ?? "").toLocaleString()}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="event-note" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: "Inter_500Medium" }]}>
                No bookings yet
              </Text>
            </View>
          }
        />
      )}
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
  headerTitle: { fontSize: 22 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceType: { fontSize: 13, marginBottom: 2 },
  customerName: { fontSize: 16 },
  customerPhone: { fontSize: 13 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: { fontSize: 12 },
  divider: { height: 1 },
  tripInfo: { gap: 8 },
  tripRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tripText: { fontSize: 13, flex: 1 },
  date: { fontSize: 11 },
  empty: { alignItems: "center", paddingTop: 60, gap: 14 },
  emptyText: { fontSize: 16 },
});
