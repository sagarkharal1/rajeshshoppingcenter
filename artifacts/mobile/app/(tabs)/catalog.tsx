import { Ionicons, MaterialIcons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetCategories, useGetProducts } from "@workspace/api-client-react";

import Colors from "@/constants/colors";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function CategoryIcon({ name, color, size }: { name: string; color: string; size: number }) {
  if (name === "Groceries") return <MaterialCommunityIcons name="basket" size={size} color={color} />;
  if (name === "Lifestyle") return <Ionicons name="shirt" size={size} color={color} />;
  if (name === "Hardware") return <MaterialCommunityIcons name="hammer" size={size} color={color} />;
  if (name === "Services") return <MaterialIcons name="directions-car" size={size} color={color} />;
  return <MaterialIcons name="storefront" size={size} color={color} />;
}

export default function CatalogScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const params = useLocalSearchParams<{ categoryId?: string }>();

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(
    params.categoryId ? Number(params.categoryId) : undefined
  );
  const [search, setSearch] = useState("");

  const { data: categories } = useGetCategories();
  const { data: products, isLoading, refetch } = useGetProducts({
    categoryId: selectedCategoryId,
    search: search.trim() || undefined,
  });

  const { addItem, items, totalItems, totalAmount } = useCart();
  const { t } = useLanguage();

  const getCartQty = useCallback(
    (productId: number) => items.find((i) => i.productId === productId)?.quantity ?? 0,
    [items]
  );

  const handleAddToCart = useCallback(
    (product: any) => {
      addItem({
        productId: product.id,
        productName: product.name,
        price: Number(product.price),
        quantity: 1,
        unit: product.unit,
      });
    },
    [addItem]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
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
        <Text style={[styles.headerTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>{t.catalog.title}</Text>

        <View style={[styles.searchBox, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
          <Feather name="search" size={16} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text, fontFamily: "Inter_400Regular" }]}
            placeholder={t.catalog.searchPlaceholder}
            placeholderTextColor={theme.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={theme.textMuted} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabs}
        >
          <Pressable
            style={[
              styles.categoryTab,
              {
                backgroundColor: !selectedCategoryId ? Colors.primary : theme.inputBackground,
                borderColor: !selectedCategoryId ? Colors.primary : theme.border,
              },
            ]}
            onPress={() => setSelectedCategoryId(undefined)}
          >
            <Text
              style={[
                styles.categoryTabText,
                { color: !selectedCategoryId ? "#fff" : theme.textSecondary, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {t.catalog.all}
            </Text>
          </Pressable>
          {(categories ?? []).map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryTab,
                  {
                    backgroundColor: isSelected ? Colors.primary : theme.inputBackground,
                    borderColor: isSelected ? Colors.primary : theme.border,
                  },
                ]}
                onPress={() => setSelectedCategoryId(cat.id)}
              >
                <CategoryIcon name={cat.name} color={isSelected ? "#fff" : theme.textSecondary} size={14} />
                <Text
                  style={[
                    styles.categoryTabText,
                    { color: isSelected ? "#fff" : theme.textSecondary, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {(t.categories as any)[cat.name] ?? cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* PRODUCT GRID */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={products ?? []}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={{
            padding: 12,
            paddingBottom: totalItems > 0 ? 130 : (Platform.OS === "web" ? 118 : 80),
          }}
          columnWrapperStyle={{ gap: 10 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          renderItem={({ item }) => {
            const cartQty = getCartQty(item.id);
            const isService = item.categoryName === "Services";
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.productCard,
                  { backgroundColor: theme.card, opacity: pressed ? 0.92 : 1 },
                ]}
                onPress={() => router.push(`/product/${item.id}`)}
              >
                {/* IMAGE OR ICON */}
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={[Colors.primary + "18", Colors.accent + "10"]}
                    style={styles.productImagePlaceholder}
                  >
                    <CategoryIcon name={item.categoryName ?? ""} color={Colors.primary} size={34} />
                  </LinearGradient>
                )}
                {!item.inStock && (
                  <View style={styles.outOfStockBadge}>
                    <Text style={styles.outOfStockText}>{t.catalog.outOfStock}</Text>
                  </View>
                )}
                <View style={styles.productInfo}>
                  <Text
                    style={[styles.productName, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                  <Text style={[styles.productCategory, { color: theme.textMuted }]}>
                    {(t.categories as any)[item.categoryName ?? ""] ?? item.categoryName}
                  </Text>
                  <View style={styles.productBottom}>
                    <View>
                      <Text style={[styles.productPrice, { color: Colors.primary, fontFamily: "Inter_700Bold" }]}>
                        NPR {Number(item.price).toLocaleString()}
                      </Text>
                      <Text style={[styles.productUnit, { color: theme.textMuted }]}>/{(t.units as any)[item.unit ?? ""] ?? item.unit}</Text>
                    </View>
                    {isService ? (
                      <Pressable
                        style={styles.bookBtn}
                        onPress={() =>
                          router.push({
                            pathname: "/booking",
                            params: {
                              serviceType: item.name.toLowerCase().includes("jeep") ? "jeep" : "tractor",
                            },
                          })
                        }
                      >
                        <MaterialIcons name="event" size={16} color="#fff" />
                      </Pressable>
                    ) : item.inStock ? (
                      <Pressable
                        style={[styles.addBtn, cartQty > 0 && styles.addBtnActive]}
                        onPress={() => handleAddToCart(item)}
                      >
                        {cartQty > 0 ? (
                          <Text style={[styles.addBtnText, { color: "#fff" }]}>{cartQty}</Text>
                        ) : (
                          <Feather name="plus" size={18} color="#fff" />
                        )}
                      </Pressable>
                    ) : (
                      <View style={[styles.addBtn, { backgroundColor: theme.border }]}>
                        <Feather name="minus" size={18} color={theme.textMuted} />
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="inventory-2" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>
                {t.catalog.noProducts}
              </Text>
              <Text style={[styles.emptyDesc, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                {search ? t.catalog.tryDifferent : t.catalog.checkBack}
              </Text>
            </View>
          }
        />
      )}

      {/* FLOATING CART BAR */}
      {totalItems > 0 && (
        <Pressable
          style={[
            styles.cartBar,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 90 : 64) },
          ]}
          onPress={() => router.push("/(tabs)/cart")}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cartBarGradient}
          >
            <View style={styles.cartBarLeft}>
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalItems}</Text>
              </View>
              <Text style={[styles.cartBarLabel, { fontFamily: "Inter_600SemiBold" }]}>
                {totalItems} item{totalItems !== 1 ? "s" : ""} in cart
              </Text>
            </View>
            <View style={styles.cartBarRight}>
              <Text style={[styles.cartBarAmount, { fontFamily: "Inter_700Bold" }]}>
                NPR {totalAmount.toLocaleString()}
              </Text>
              <Feather name="chevron-right" size={18} color="#fff" />
            </View>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 28, marginBottom: 12 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  categoryTabs: { gap: 8, paddingRight: 4 },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryTabText: { fontSize: 13 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  productCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  productImage: {
    width: "100%",
    height: 110,
  },
  productImagePlaceholder: {
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  outOfStockBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: Colors.error + "CC",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  outOfStockText: { color: "#fff", fontSize: 9, fontFamily: "Inter_600SemiBold" },
  productInfo: { padding: 12, gap: 3 },
  productName: { fontSize: 14, lineHeight: 19 },
  productCategory: { fontSize: 11, fontFamily: "Inter_400Regular" },
  productBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 6,
  },
  productPrice: { fontSize: 14 },
  productUnit: { fontSize: 10, fontFamily: "Inter_400Regular" },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnActive: { backgroundColor: Colors.success },
  addBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  bookBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18 },
  emptyDesc: { fontSize: 14, textAlign: "center", maxWidth: 260 },
  // Floating cart bar
  cartBar: {
    position: "absolute",
    bottom: 0,
    left: 12,
    right: 12,
  },
  cartBarGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  cartBarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  cartBadge: {
    backgroundColor: Colors.accent,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  cartBarLabel: { color: "#fff", fontSize: 14 },
  cartBarRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  cartBarAmount: { color: "#fff", fontSize: 16 },
});
