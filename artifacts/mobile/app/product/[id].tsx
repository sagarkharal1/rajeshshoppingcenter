import { Feather, Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetProduct } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";

function CategoryIcon({ name, color, size }: { name: string; color: string; size: number }) {
  if (name === "Groceries") return <MaterialCommunityIcons name="basket" size={size} color={color} />;
  if (name === "Lifestyle") return <Ionicons name="shirt" size={size} color={color} />;
  if (name === "Hardware") return <MaterialCommunityIcons name="hammer" size={size} color={color} />;
  if (name === "Services") return <MaterialIcons name="directions-car" size={size} color={color} />;
  return <MaterialIcons name="storefront" size={size} color={color} />;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { data: product, isLoading, error } = useGetProduct(Number(id));
  const { addItem, items, totalItems, totalAmount } = useCart();
  const { t } = useLanguage();
  const [quantity, setQuantity] = useState(1);

  const cartItem = items.find((i) => i.productId === Number(id));
  const isService = product?.categoryName === "Services";

  const handleAddToCart = () => {
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addItem({
      productId: product.id,
      productName: product.name,
      price: Number(product.price),
      quantity,
      unit: product.unit,
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <MaterialIcons name="error-outline" size={48} color={Colors.error} />
        <Text style={[styles.errorText, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>
          {t.product.notFound}
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: Colors.primary, fontFamily: "Inter_600SemiBold" }}>{t.product.goBack}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HERO / IMAGE */}
      {product.imageUrl ? (
        <View style={[styles.imageContainer, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
          <Image
            source={{ uri: product.imageUrl }}
            style={styles.productImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.35)"]}
            style={styles.imageOverlay}
          />
        </View>
      ) : (
        <LinearGradient
          colors={[Colors.primary + "25", Colors.accent + "15"]}
          style={[styles.hero, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 12) }]}
        >
          <CategoryIcon name={product.categoryName ?? ""} color={Colors.primary} size={80} />
          {!product.inStock && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Out of Stock</Text>
            </View>
          )}
        </LinearGradient>
      )}

      {/* BACK BUTTON */}
      <Pressable
        style={[
          styles.backBtn,
          {
            backgroundColor: theme.card,
            top: insets.top + (Platform.OS === "web" ? 67 : 12),
          },
        ]}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={22} color={theme.text} />
      </Pressable>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: totalItems > 0 ? 180 : 130,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* CATEGORY TAG */}
        <View style={[styles.categoryTag, { backgroundColor: Colors.primary + "15" }]}>
          <Text style={[styles.categoryTagText, { color: Colors.primary, fontFamily: "Inter_600SemiBold" }]}>
            {(t.categories as any)[product.categoryName ?? ""] ?? product.categoryName}
          </Text>
        </View>

        {/* NAME */}
        <Text style={[styles.productName, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
          {product.name}
        </Text>

        {/* PRICE */}
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: Colors.primary, fontFamily: "Inter_700Bold" }]}>
            NPR {Number(product.price).toLocaleString()}
          </Text>
          <Text style={[styles.unit, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
            {t.product.per} {(t.units as any)[product.unit ?? ""] ?? product.unit}
          </Text>
        </View>

        {/* DESCRIPTION */}
        {product.description ? (
          <View style={[styles.descCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.descLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
              {t.product.description}
            </Text>
            <Text style={[styles.descText, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
              {product.description}
            </Text>
          </View>
        ) : null}

        {/* AVAILABILITY */}
        <View style={[styles.infoRow, { backgroundColor: theme.card }]}>
          <Feather
            name={product.inStock ? "check-circle" : "x-circle"}
            size={18}
            color={product.inStock ? Colors.success : Colors.error}
          />
          <Text
            style={[
              styles.infoText,
              {
                color: product.inStock ? Colors.success : Colors.error,
                fontFamily: "Inter_500Medium",
              },
            ]}
          >
            {product.inStock ? t.product.inStock : t.product.outOfStock}
          </Text>
        </View>

        {/* QUANTITY */}
        {!isService && product.inStock && (
          <View style={[styles.qtySection, { backgroundColor: theme.card }]}>
            <Text style={[styles.qtyLabel, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>
              {t.product.quantity}
            </Text>
            <View style={styles.qtyControls}>
              <Pressable
                style={[styles.qtyBtn, { borderColor: theme.border }]}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Feather name="minus" size={16} color={theme.text} />
              </Pressable>
              <Text style={[styles.qtyValue, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                {quantity}
              </Text>
              <Pressable
                style={[styles.qtyBtn, { backgroundColor: Colors.primary }]}
                onPress={() => setQuantity(quantity + 1)}
              >
                <Feather name="plus" size={16} color="#fff" />
              </Pressable>
            </View>
          </View>
        )}

        {cartItem && !isService && (
          <View style={[styles.cartNotice, { backgroundColor: Colors.success + "15" }]}>
            <Feather name="shopping-cart" size={16} color={Colors.success} />
            <Text style={[styles.cartNoticeText, { color: Colors.success, fontFamily: "Inter_500Medium" }]}>
              {cartItem.quantity} {t.product.alreadyInCart}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* BOTTOM ACTIONS */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.backgroundSecondary,
            borderTopColor: theme.border,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8),
          },
        ]}
      >
        {/* PERSISTENT CART ROW */}
        {totalItems > 0 && (
          <Pressable onPress={() => router.push("/(tabs)/cart")}>
            <LinearGradient
              colors={[Colors.primaryDark, Colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cartSummaryRow}
            >
              <View style={styles.cartSummaryLeft}>
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{totalItems}</Text>
                </View>
                <Text style={[styles.cartSummaryLabel, { fontFamily: "Inter_500Medium" }]}>
                  {t.product.viewCart}
                </Text>
              </View>
              <View style={styles.cartSummaryRight}>
                <Text style={[styles.cartSummaryAmount, { fontFamily: "Inter_700Bold" }]}>
                  NPR {totalAmount.toLocaleString()}
                </Text>
                <Feather name="chevron-right" size={16} color="#fff" />
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {/* PRIMARY ACTION */}
        {isService ? (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.9 : 1 }]}
            onPress={() =>
              router.push({
                pathname: "/booking",
                params: {
                  serviceType: product.name.toLowerCase().includes("jeep") ? "jeep" : "tractor",
                },
              })
            }
          >
            <LinearGradient
              colors={[Colors.accent, Colors.accentDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtnGradient}
            >
              <MaterialIcons name="event-available" size={22} color="#fff" />
              <Text style={[styles.actionBtnText, { fontFamily: "Inter_700Bold" }]}>{t.product.bookNow}</Text>
            </LinearGradient>
          </Pressable>
        ) : product.inStock ? (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.9 : 1 }]}
            onPress={handleAddToCart}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtnGradient}
            >
              <Feather name="shopping-cart" size={22} color="#fff" />
              <Text style={[styles.actionBtnText, { fontFamily: "Inter_700Bold" }]}>
                {t.product.addToCart} — NPR {(Number(product.price) * quantity).toLocaleString()}
              </Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <View style={[styles.actionBtn, { backgroundColor: theme.border }]}>
            <Text style={[styles.actionBtnText, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
              Out of Stock
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 18 },
  imageContainer: {
    height: 240,
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  hero: {
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  outOfStockBadge: {
    position: "absolute",
    bottom: 12,
    backgroundColor: Colors.error + "CC",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  outOfStockText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  categoryTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  categoryTagText: { fontSize: 12 },
  productName: { fontSize: 26, lineHeight: 34, marginBottom: 10 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 20 },
  price: { fontSize: 28 },
  unit: { fontSize: 15 },
  descCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  descLabel: { fontSize: 12, letterSpacing: 0.5 },
  descText: { fontSize: 14, lineHeight: 22 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  infoText: { fontSize: 15 },
  qtySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  qtyLabel: { fontSize: 16 },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 16 },
  qtyBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: { fontSize: 20, minWidth: 30, textAlign: "center" },
  cartNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  cartNoticeText: { fontSize: 14 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  cartSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  cartSummaryLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  cartBadge: {
    backgroundColor: Colors.accent,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  cartSummaryLabel: { color: "#fff", fontSize: 14 },
  cartSummaryRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  cartSummaryAmount: { color: "#fff", fontSize: 15 },
  actionBtn: { borderRadius: 16, overflow: "hidden" },
  actionBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  actionBtnText: { color: "#fff", fontSize: 17 },
});
