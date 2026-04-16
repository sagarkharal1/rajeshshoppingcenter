import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
import { useLanguage } from "@/context/LanguageContext";

type PolicyCardProps = { icon: React.ReactNode; title: string; content: string; theme: any };

function PolicyCard({ icon, title, content, theme }: PolicyCardProps) {
  return (
    <View style={[styles.policyCard, { backgroundColor: theme.card }]}>
      <View style={styles.policyHeader}>
        {icon}
        <Text style={[styles.policyTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
          {title}
        </Text>
      </View>
      <Text style={[styles.policyContent, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
        {content}
      </Text>
    </View>
  );
}

export default function DeliveryPolicyScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { data: settings } = useGetSettings();
  const { t } = useLanguage();

  const isCustom = !!settings?.deliveryPolicy;

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
          {t.deliveryPolicy.title}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          style={styles.banner}
        >
          <MaterialCommunityIcons name="truck-delivery" size={36} color={Colors.accentLight} />
          <Text style={[styles.bannerTitle, { fontFamily: "Inter_700Bold" }]}>
            {t.deliveryPolicy.bannerTitle}
          </Text>
          <Text style={[styles.bannerSubtitle, { fontFamily: "Inter_400Regular" }]}>
            {t.deliveryPolicy.bannerSubtitle}
          </Text>
        </LinearGradient>

        {isCustom ? (
          <View style={[styles.policyCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.policyContent, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
              {settings?.deliveryPolicy}
            </Text>
          </View>
        ) : (
          <>
            <PolicyCard
              icon={<MaterialCommunityIcons name="clock-fast" size={20} color={Colors.primary} />}
              title={t.deliveryPolicy.timelines}
              content={t.deliveryPolicy.timelinesContent}
              theme={theme}
            />
            <PolicyCard
              icon={<Ionicons name="location" size={20} color={Colors.primary} />}
              title={t.deliveryPolicy.coverage}
              content={t.deliveryPolicy.coverageContent}
              theme={theme}
            />
            <PolicyCard
              icon={<MaterialCommunityIcons name="currency-npr" size={20} color={Colors.primary} />}
              title={t.deliveryPolicy.charges}
              content={t.deliveryPolicy.chargesContent}
              theme={theme}
            />
            <PolicyCard
              icon={<MaterialCommunityIcons name="leaf" size={20} color={Colors.success} />}
              title={t.deliveryPolicy.perishable}
              content={t.deliveryPolicy.perishableContent}
              theme={theme}
            />
            <PolicyCard
              icon={<MaterialCommunityIcons name="hammer" size={20} color={Colors.accent} />}
              title={t.deliveryPolicy.hardware}
              content={t.deliveryPolicy.hardwareContent}
              theme={theme}
            />
          </>
        )}
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
  banner: {
    borderRadius: 20,
    padding: 20,
    gap: 8,
    alignItems: "center",
  },
  bannerTitle: { fontSize: 22, color: "#fff" },
  bannerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.75)" },
  policyCard: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  policyHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  policyTitle: { fontSize: 16 },
  policyContent: { fontSize: 14, lineHeight: 22 },
});
