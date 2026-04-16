import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { items, totalAmount, updateQuantity, removeItem, totalItems } = useCart();
  const { t } = useLanguage();

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
        <Text style={[styles.headerTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
          {t.cart.title}
        </Text>
        {totalItems > 0 && (
          <Text style={[styles.headerSubtitle, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
            {totalItems} {totalItems !== 1 ? t.cart.items : t.cart.item}
          </Text>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={72} color={theme.border} />
          <Text style={[styles.emptyTitle, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>
            {t.cart.empty}
          </Text>
          <Text style={[styles.emptyDesc, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
            {t.cart.emptyDesc}
          </Text>
          <Pressable
            style={styles.shopBtn}
            onPress={() => router.push("/catalog")}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight]}
              style={styles.shopBtnGradient}
            >
              <Text style={[styles.shopBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                {t.cart.browseProducts}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.productId.toString()}
            contentContainerStyle={{
              padding: 16,
              gap: 12,
              paddingBottom: 140,
            }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View
                style={[styles.cartItem, { backgroundColor: theme.card, shadowColor: "#000" }]}
              >
                <View style={styles.cartItemLeft}>
                  <Text
                    style={[styles.cartItemName, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}
                    numberOfLines={2}
                  >
                    {item.productName}
                  </Text>
                  <Text style={[styles.cartItemUnit, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                    NPR {item.price.toLocaleString()} / {(t.units as any)[item.unit ?? ""] ?? item.unit}
                  </Text>
                  <Text style={[styles.cartItemSubtotal, { color: Colors.primary, fontFamily: "Inter_700Bold" }]}>
                    NPR {(item.price * item.quantity).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.cartItemRight}>
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => removeItem(item.productId)}
                  >
                    <Feather name="trash-2" size={16} color={Colors.error} />
                  </Pressable>
                  <View style={styles.quantityRow}>
                    <Pressable
                      style={[styles.qtyBtn, { borderColor: theme.border }]}
                      onPress={() => updateQuantity(item.productId, item.quantity - 1)}
                    >
                      <Feather name="minus" size={14} color={theme.text} />
                    </Pressable>
                    <Text style={[styles.qtyText, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                      {item.quantity}
                    </Text>
                    <Pressable
                      style={[styles.qtyBtn, { backgroundColor: Colors.primary }]}
                      onPress={() => updateQuantity(item.productId, item.quantity + 1)}
                    >
                      <Feather name="plus" size={14} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          />

          {/* CHECKOUT FOOTER */}
          <View
            style={[
              styles.footer,
              {
                backgroundColor: theme.backgroundSecondary,
                borderTopColor: theme.border,
                paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8),
              },
            ]}
          >
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
                {t.cart.totalAmount}
              </Text>
              <Text style={[styles.totalAmount, { color: Colors.primary, fontFamily: "Inter_700Bold" }]}>
                NPR {totalAmount.toLocaleString()}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.checkoutBtn, { opacity: pressed ? 0.9 : 1 }]}
              onPress={() => router.push("/checkout")}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.checkoutGradient}
              >
                <Text style={[styles.checkoutText, { fontFamily: "Inter_700Bold" }]}>
                  {t.cart.checkout}
                </Text>
                <Feather name="arrow-right" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 28 },
  headerSubtitle: { fontSize: 14, marginTop: 2 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 20 },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  shopBtn: { borderRadius: 14, overflow: "hidden", marginTop: 8 },
  shopBtnGradient: { paddingHorizontal: 32, paddingVertical: 14 },
  shopBtnText: { color: "#fff", fontSize: 16 },
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cartItemLeft: { flex: 1, marginRight: 12, gap: 4 },
  cartItemName: { fontSize: 15, lineHeight: 20 },
  cartItemUnit: { fontSize: 12 },
  cartItemSubtotal: { fontSize: 16, marginTop: 4 },
  cartItemRight: { alignItems: "flex-end", gap: 12 },
  removeBtn: { padding: 4 },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  qtyText: { fontSize: 16, minWidth: 20, textAlign: "center" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 15 },
  totalAmount: { fontSize: 22 },
  checkoutBtn: { borderRadius: 14, overflow: "hidden" },
  checkoutGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  checkoutText: { color: "#fff", fontSize: 17 },
});
