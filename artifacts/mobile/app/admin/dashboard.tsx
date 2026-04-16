import { Feather, Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { secureGet, secureDelete } from "@/utils/secureStorage";
import { useAdminGetOrders, useAdminGetBookings, useAdminGetProducts } from "@workspace/api-client-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import Colors from "@/constants/colors";

const ADMIN_TOKEN_KEY = "rajesh_admin_token";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  useEffect(() => {
    setAuthTokenGetter(async () => {
      return await secureGet(ADMIN_TOKEN_KEY);
    });
  }, []);

  const { data: orders } = useAdminGetOrders();
  const { data: bookings } = useAdminGetBookings();
  const { data: products } = useAdminGetProducts();

  const pendingOrders = (orders ?? []).filter((o: any) => o.status === "pending").length;
  const pendingBookings = (bookings ?? []).filter((b: any) => b.status === "pending").length;
  const totalRevenue = (orders ?? []).reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await secureDelete(ADMIN_TOKEN_KEY);
          setAuthTokenGetter(async () => null);
          router.replace("/admin");
        },
      },
    ]);
  };

  type StatCardProps = { label: string; value: string; icon: React.ReactNode; color: string };
  function StatCard({ label, value, icon, color }: StatCardProps) {
    return (
      <View style={[styles.statCard, { backgroundColor: theme.card }]}>
        <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>{icon}</View>
        <Text style={[styles.statValue, { color: theme.text, fontFamily: "Inter_700Bold" }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>{label}</Text>
      </View>
    );
  }

  type MenuItemProps = { icon: React.ReactNode; label: string; subtitle: string; onPress: () => void; badge?: number };
  function MenuItem({ icon, label, subtitle, onPress, badge }: MenuItemProps) {
    return (
      <Pressable
        style={({ pressed }) => [styles.menuItem, { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 }]}
        onPress={onPress}
      >
        <View style={[styles.menuIcon, { backgroundColor: Colors.primary + "15" }]}>{icon}</View>
        <View style={styles.menuText}>
          <Text style={[styles.menuLabel, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
          <Text style={[styles.menuSub, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>{subtitle}</Text>
        </View>
        {badge !== undefined && badge > 0 && (
          <View style={[styles.badge, { backgroundColor: Colors.error }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        <Feather name="chevron-right" size={18} color={theme.textMuted} />
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 12) }]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold" }]}>Dashboard</Text>
          <Pressable onPress={handleLogout}>
            <MaterialIcons name="logout" size={24} color="#fff" />
          </Pressable>
        </View>
        <Text style={[styles.headerSub, { fontFamily: "Inter_400Regular" }]}>Rajesh Shopping Center</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: Platform.OS === "web" ? 60 : 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* STATS */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Total Products"
            value={(products ?? []).length.toString()}
            icon={<MaterialIcons name="inventory-2" size={22} color={Colors.primary} />}
            color={Colors.primary}
          />
          <StatCard
            label="Pending Orders"
            value={pendingOrders.toString()}
            icon={<MaterialIcons name="pending-actions" size={22} color={Colors.warning} />}
            color={Colors.warning}
          />
          <StatCard
            label="Total Revenue"
            value={`NPR ${totalRevenue.toLocaleString()}`}
            icon={<MaterialCommunityIcons name="cash" size={22} color={Colors.success} />}
            color={Colors.success}
          />
          <StatCard
            label="Pending Bookings"
            value={pendingBookings.toString()}
            icon={<MaterialIcons name="event-note" size={22} color={Colors.accent} />}
            color={Colors.accent}
          />
        </View>

        {/* MANAGEMENT */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
          MANAGEMENT
        </Text>
        <MenuItem
          icon={<MaterialIcons name="inventory-2" size={22} color={Colors.primary} />}
          label="Products"
          subtitle="Add, edit & delete products"
          onPress={() => router.push("/admin/products")}
        />
        <MenuItem
          icon={<MaterialIcons name="shopping-bag" size={22} color={Colors.primary} />}
          label="Orders"
          subtitle="View & manage customer orders"
          badge={pendingOrders}
          onPress={() => router.push("/admin/orders")}
        />
        <MenuItem
          icon={<MaterialIcons name="event" size={22} color={Colors.primary} />}
          label="Bookings"
          subtitle="View service bookings"
          badge={pendingBookings}
          onPress={() => router.push("/admin/bookings")}
        />
        <MenuItem
          icon={<MaterialIcons name="settings" size={22} color={Colors.primary} />}
          label="Shop Settings"
          subtitle="Update contact, bank & content"
          onPress={() => router.push("/admin/settings")}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 22, color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.75)" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "47%",
    borderRadius: 16,
    padding: 14,
    alignItems: "flex-start",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 18 },
  statLabel: { fontSize: 11 },
  sectionLabel: { fontSize: 11, letterSpacing: 1, marginTop: 4 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: { flex: 1, gap: 3 },
  menuLabel: { fontSize: 15 },
  menuSub: { fontSize: 12 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
});
