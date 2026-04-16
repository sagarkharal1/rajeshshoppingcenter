import { Ionicons, MaterialIcons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetCategories, useGetProducts, useGetSettings } from "@workspace/api-client-react";

import Colors from "@/constants/colors";
import { useLanguage, LANGUAGES } from "@/context/LanguageContext";
import { getServingUrl } from "@/utils/upload";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function CategoryIcon({ name, color, size }: { name: string; color: string; size: number }) {
  if (name === "Groceries") return <MaterialCommunityIcons name="basket" size={size} color={color} />;
  if (name === "Lifestyle") return <Ionicons name="shirt" size={size} color={color} />;
  if (name === "Hardware") return <MaterialCommunityIcons name="hammer" size={size} color={color} />;
  if (name === "Services") return <MaterialIcons name="directions-car" size={size} color={color} />;
  return <MaterialIcons name="storefront" size={size} color={color} />;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { t, language, setLanguage } = useLanguage();

  const {
    data: categories,
    isLoading: catsLoading,
    refetch: refetchCats,
  } = useGetCategories();
  const {
    data: featuredProducts,
    isLoading: featuredLoading,
    refetch: refetchFeatured,
  } = useGetProducts({ featured: true });
  const { data: settings } = useGetSettings();

  const isLoading = catsLoading || featuredLoading;

  const onRefresh = useCallback(() => {
    refetchCats();
    refetchFeatured();
  }, [refetchCats, refetchFeatured]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 118 : 80,
        }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        }
      >
        {/* HERO BANNER */}
        <View style={[styles.heroWrapper, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20) }]}>
          {/* LANGUAGE SWITCHER */}
          <View
            style={[
              styles.langSwitcher,
              {
                top: insets.top + (Platform.OS === "web" ? 72 : 10),
              },
            ]}
          >
            {LANGUAGES.map((lang) => {
              const isActive = language === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  onPress={() => setLanguage(lang.code)}
                  style={[
                    styles.langBtn,
                    isActive
                      ? styles.langBtnActive
                      : styles.langBtnInactive,
                  ]}
                >
                  <Text style={[
                    styles.langBtnText,
                    { color: isActive ? Colors.primary : "rgba(255,255,255,0.85)", fontFamily: isActive ? "Inter_700Bold" : "Inter_500Medium" },
                  ]}>
                    {lang.code === "ne" ? "नेपाली" : lang.code === "en" ? "EN" : "हिन्दी"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {/* Custom home banner photo (full width, above hero card) */}
          {getServingUrl((settings as any)?.homeBannerPath) ? (
            <View style={styles.bannerPhotoWrapper}>
              <Image
                source={{ uri: getServingUrl((settings as any)?.homeBannerPath)! }}
                style={styles.bannerPhoto}
                resizeMode="cover"
              />
              <LinearGradient
                colors={["transparent", "rgba(10,30,70,0.55)"]}
                style={styles.bannerPhotoFade}
              />
            </View>
          ) : null}

          <LinearGradient
            colors={[Colors.primaryDark, Colors.primary, Colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.hero,
              getServingUrl((settings as any)?.homeBannerPath)
                ? styles.heroWithBanner
                : null,
            ]}
          >
            {!getServingUrl((settings as any)?.homeBannerPath) &&
              getServingUrl((settings as any)?.shopPhotoPath) ? (
              <Image
                source={{ uri: getServingUrl((settings as any)?.shopPhotoPath)! }}
                style={styles.heroPhoto}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.heroOverlay} />
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{t.home.established}</Text>
            </View>
            <Text style={styles.heroTitle}>{t.home.shopName}</Text>
            <Text style={styles.heroSubtitle}>
              {settings?.address ?? "Musikot-5, Aapchaur, Gulmi, Nepal"}
            </Text>
            <Text style={styles.heroTagline}>{t.home.tagline}</Text>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNumber}>{t.home.yearsCount}</Text>
                <Text style={styles.heroStatLabel}>{t.home.yearsService}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNumber}>{t.home.categoriesCount}</Text>
                <Text style={styles.heroStatLabel}>{t.home.categories}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNumber}>{t.home.productsCount}</Text>
                <Text style={styles.heroStatLabel}>{t.home.products}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* QUICK SEARCH */}
        <Pressable
          style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.push("/catalog")}
        >
          <Feather name="search" size={18} color={theme.textMuted} />
          <Text style={[styles.searchPlaceholder, { color: theme.textMuted }]}>
            {t.home.searchPlaceholder}
          </Text>
        </Pressable>

        {/* CATEGORIES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
              {t.home.categories}
            </Text>
            <Pressable onPress={() => router.push("/catalog")}>
              <Text style={[styles.seeAll, { color: Colors.primary }]}>{t.home.seeAll}</Text>
            </Pressable>
          </View>

          {catsLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <View style={styles.categoriesGrid}>
              {(categories ?? []).map((cat) => (
                <Pressable
                  key={cat.id}
                  style={({ pressed }) => [
                    styles.categoryCard,
                    { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/catalog",
                      params: { categoryId: cat.id.toString() },
                    })
                  }
                >
                  <LinearGradient
                    colors={[Colors.primary + "20", Colors.accent + "15"]}
                    style={styles.categoryIconCircle}
                  >
                    <CategoryIcon name={cat.name} color={Colors.primary} size={26} />
                  </LinearGradient>
                  <Text
                    style={[styles.categoryName, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}
                    numberOfLines={1}
                  >
                    {(t.categories as any)[cat.name] ?? cat.name}
                  </Text>
                  {cat.description ? (
                    <Text
                      style={[styles.categoryDesc, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}
                      numberOfLines={2}
                    >
                      {(t.categories as any)[cat.name + "Desc"] ?? cat.description}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* FEATURED PRODUCTS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
              {t.home.featuredItems}
            </Text>
            <Pressable onPress={() => router.push("/catalog")}>
              <Text style={[styles.seeAll, { color: Colors.primary }]}>{t.home.viewAll}</Text>
            </Pressable>
          </View>

          {featuredLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <FlatList
              data={featuredProducts ?? []}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.featuredCard,
                    { backgroundColor: theme.card, opacity: pressed ? 0.9 : 1 },
                  ]}
                  onPress={() => router.push(`/product/${item.id}`)}
                >
                  <LinearGradient
                    colors={[Colors.primary + "18", Colors.accent + "10"]}
                    style={styles.featuredImagePlaceholder}
                  >
                    <CategoryIcon name={item.categoryName ?? ""} color={Colors.primary} size={36} />
                  </LinearGradient>
                  <View style={styles.featuredInfo}>
                    <Text
                      style={[styles.featuredName, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                    <Text style={[styles.featuredCategory, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                      {(t.categories as any)[item.categoryName ?? ""] ?? item.categoryName}
                    </Text>
                    <View style={styles.featuredPriceRow}>
                      <Text style={[styles.featuredPrice, { color: Colors.primary, fontFamily: "Inter_700Bold" }]}>
                        NPR {Number(item.price).toLocaleString()}
                      </Text>
                      <Text style={[styles.featuredUnit, { color: theme.textMuted }]}>/{(t.units as any)[item.unit ?? ""] ?? item.unit}</Text>
                    </View>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  {t.home.noFeatured}
                </Text>
              }
            />
          )}
        </View>

        {/* ABOUT SECTION */}
        <View style={[styles.section, styles.aboutSection]}>
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            style={styles.aboutCard}
          >
            {getServingUrl((settings as any)?.ownerPhotoPath) ? (
              <Image
                source={{ uri: getServingUrl((settings as any)?.ownerPhotoPath)! }}
                style={styles.ownerPhoto}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="information-circle" size={32} color={Colors.accentLight} />
            )}
            <Text style={[styles.aboutTitle, { fontFamily: "Inter_700Bold" }]}>{t.home.aboutUs}</Text>
            <Text style={[styles.aboutText, { fontFamily: "Inter_400Regular" }]}>
              {t.home.aboutDefault}
            </Text>
            <View style={styles.aboutLocation}>
              <Ionicons name="location" size={16} color={Colors.accentLight} />
              <Text style={[styles.aboutLocationText, { fontFamily: "Inter_500Medium" }]}>
                {settings?.address ?? "Musikot-5, Aapchaur, Gulmi, Nepal"}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* SERVICES PROMO */}
        <View style={[styles.section, { paddingBottom: 8 }]}>
          <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: "Inter_700Bold", paddingHorizontal: 16, marginBottom: 12 }]}>
            {t.home.transportServices}
          </Text>
          <View style={styles.servicesRow}>
            <Pressable
              style={({ pressed }) => [
                styles.serviceCard,
                { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() =>
                router.push({ pathname: "/booking", params: { serviceType: "jeep" } })
              }
            >
              <LinearGradient
                colors={[Colors.accent + "25", Colors.accentLight + "15"]}
                style={styles.serviceIconBg}
              >
                <MaterialIcons name="directions-car" size={30} color={Colors.accentDark} />
              </LinearGradient>
              <Text style={[styles.serviceName, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                {t.home.jeepRental}
              </Text>
              <Text style={[styles.serviceDesc, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                {t.home.jeepDesc}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.serviceCard,
                { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() =>
                router.push({ pathname: "/booking", params: { serviceType: "tractor" } })
              }
            >
              <LinearGradient
                colors={[Colors.primary + "20", Colors.primaryLight + "15"]}
                style={styles.serviceIconBg}
              >
                <MaterialCommunityIcons name="tractor" size={30} color={Colors.primary} />
              </LinearGradient>
              <Text style={[styles.serviceName, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                {t.home.tractorRental}
              </Text>
              <Text style={[styles.serviceDesc, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                {t.home.tractorDesc}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroWrapper: { overflow: "hidden" },
  langSwitcher: {
    position: "absolute",
    right: 14,
    zIndex: 20,
    flexDirection: "row",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 20,
    padding: 3,
  },
  langBtn: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  langBtnActive: {
    backgroundColor: "#fff",
  },
  langBtnInactive: {
    backgroundColor: "transparent",
  },
  langBtnText: {
    fontSize: 12,
  },
  bannerPhotoWrapper: {
    width: "100%",
    height: 220,
    position: "relative",
  },
  bannerPhoto: {
    width: "100%",
    height: "100%",
  },
  bannerPhotoFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  heroWithBanner: { paddingTop: 16 },
  heroPhoto: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  heroOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(10,30,70,0.62)" },
  ownerPhoto: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: Colors.accentLight, marginBottom: 4 },
  heroBadge: {
    backgroundColor: Colors.accent + "30",
    borderWidth: 1,
    borderColor: Colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  heroBadgeText: { color: Colors.accentLight, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  heroTitle: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    lineHeight: 42,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  heroTagline: {
    fontSize: 15,
    color: Colors.accentLight,
    fontFamily: "Inter_500Medium",
    marginBottom: 20,
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatNumber: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.accentLight },
  heroStatLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  heroStatDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchPlaceholder: { fontSize: 15, fontFamily: "Inter_400Regular" },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 20 },
  seeAll: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 10,
  },
  categoryCard: {
    width: (SCREEN_WIDTH - 24 - 10) / 2,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  categoryName: { fontSize: 15, marginBottom: 4 },
  categoryDesc: { fontSize: 12, lineHeight: 17 },
  featuredCard: {
    width: 165,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  featuredImagePlaceholder: {
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredInfo: { padding: 12 },
  featuredName: { fontSize: 14, lineHeight: 19, marginBottom: 3 },
  featuredCategory: { fontSize: 11, marginBottom: 8 },
  featuredPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  featuredPrice: { fontSize: 15 },
  featuredUnit: { fontSize: 11 },
  emptyText: { fontSize: 14, paddingHorizontal: 16, fontFamily: "Inter_400Regular" },
  aboutSection: { paddingHorizontal: 16 },
  aboutCard: { borderRadius: 20, padding: 20, gap: 10 },
  aboutTitle: { fontSize: 20, color: "#FFFFFF" },
  aboutText: { fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 22 },
  aboutLocation: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  aboutLocationText: { fontSize: 13, color: Colors.accentLight },
  servicesRow: { flexDirection: "row", paddingHorizontal: 16, gap: 12 },
  serviceCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  serviceIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  serviceName: { fontSize: 15, textAlign: "center", marginBottom: 4 },
  serviceDesc: { fontSize: 12, textAlign: "center", lineHeight: 17 },
});
