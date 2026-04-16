import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  setAuthTokenGetter,
  useAdminGetOrders,
  useAdminUpdateOrderStatus,
} from "@workspace/api-client-react";

import Colors from "@/constants/colors";

const ADMIN_TOKEN_KEY = "rajesh_admin_token";

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.warning,
  confirmed: Colors.primary,
  processing: Colors.primaryLight,
  delivered: Colors.success,
  cancelled: Colors.error,
};

export default function AdminOrdersScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  useEffect(() => {
    setAuthTokenGetter(async () => secureGet(ADMIN_TOKEN_KEY));
  }, []);

  const { data: orders, isLoading, refetch } = useAdminGetOrders();
  const { mutateAsync: updateStatus } = useAdminUpdateOrderStatus();

  const handleStatusChange = (order: any) => {
    const statuses = ["pending", "confirmed", "processing", "delivered", "cancelled"];
    Alert.alert(
      "Update Status",
      `Order #${order.id} - ${order.customerName}`,
      statuses.map((s) => ({
        text: s.charAt(0).toUpperCase() + s.slice(1),
        style: s === "cancelled" ? "destructive" : "default",
        onPress: async () => {
          try {
            await updateStatus({ id: order.id, data: { status: s as any } });
            refetch();
          } catch {
            Alert.alert("Error", "Failed to update status");
          }
        },
      }))
    );
  };

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
          Orders
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={(orders ?? []).slice().reverse()}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          renderItem={({ item }) => {
            const statusColor = STATUS_COLORS[item.status] ?? Colors.primary;
            return (
              <View style={[styles.orderCard, { backgroundColor: theme.card }]}>
                <View style={styles.orderTop}>
                  <View>
                    <Text style={[styles.orderId, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                      Order #{item.id}
                    </Text>
                    <Text style={[styles.customerName, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                      {item.customerName}
                    </Text>
                    <Text style={[styles.customerPhone, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                      {item.customerPhone}
                    </Text>
                  </View>
                  <View style={styles.orderRight}>
                    <Pressable
                      style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}
                      onPress={() => handleStatusChange(item)}
                    >
                      <Text style={[styles.statusText, { color: statusColor, fontFamily: "Inter_600SemiBold" }]}>
                        {item.status}
                      </Text>
                      <Feather name="chevron-down" size={12} color={statusColor} />
                    </Pressable>
                    <Text style={[styles.orderAmount, { color: Colors.primary, fontFamily: "Inter_700Bold" }]}>
                      NPR {Number(item.totalAmount).toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <Text style={[styles.itemsLabel, { color: theme.textMuted, fontFamily: "Inter_500Medium" }]}>
                  Items ({(item.items as any[]).length}):
                </Text>
                {(item.items as any[]).map((i: any, idx: number) => (
                  <Text key={idx} style={[styles.itemLine, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
                    • {i.productName} × {i.quantity} — NPR {(i.price * i.quantity).toLocaleString()}
                  </Text>
                ))}

                <Text style={[styles.address, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                  Deliver to: {item.customerAddress}
                </Text>
                {item.notes ? (
                  <Text style={[styles.notes, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                    Note: {item.notes}
                  </Text>
                ) : null}
                <Text style={[styles.orderDate, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                  {new Date(item.createdAt ?? "").toLocaleString()}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="shopping-bag" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: "Inter_500Medium" }]}>
                No orders yet
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
  orderCard: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderId: { fontSize: 11, marginBottom: 2 },
  customerName: { fontSize: 16 },
  customerPhone: { fontSize: 13, marginTop: 2 },
  orderRight: { alignItems: "flex-end", gap: 8 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: { fontSize: 12 },
  orderAmount: { fontSize: 18 },
  divider: { height: 1 },
  itemsLabel: { fontSize: 12 },
  itemLine: { fontSize: 13, lineHeight: 20 },
  address: { fontSize: 12, marginTop: 4 },
  notes: { fontSize: 12 },
  orderDate: { fontSize: 11, marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 60, gap: 14 },
  emptyText: { fontSize: 16 },
});
