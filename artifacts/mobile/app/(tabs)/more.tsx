import { Feather, Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Linking,
  Modal,
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
import { useLanguage, LANGUAGES, type LanguageCode } from "@/context/LanguageContext";

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  onPress: () => void;
  theme: any;
  showArrow?: boolean;
  danger?: boolean;
};

function MenuItem({ icon, label, subtitle, onPress, theme, showArrow = true, danger }: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={[styles.menuIconWrap, { backgroundColor: danger ? Colors.error + "18" : Colors.primary + "12" }]}>
        {icon}
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, { color: danger ? Colors.error : theme.text, fontFamily: "Inter_600SemiBold" }]}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={[styles.menuSubtitle, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {showArrow && <Feather name="chevron-right" size={18} color={theme.textMuted} />}
    </Pressable>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { data: settings } = useGetSettings();
  const { t, language, setLanguage } = useLanguage();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [secretTaps, setSecretTaps] = useState(0);
  const secretTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSecretTap = () => {
    setSecretTaps((n) => {
      const next = n + 1;
      if (secretTimer.current) clearTimeout(secretTimer.current);
      if (next >= 7) {
        setSecretTaps(0);
        router.push("/admin");
        return 0;
      }
      secretTimer.current = setTimeout(() => setSecretTaps(0), 2000);
      return next;
    });
  };

  const handleCall = () => {
    if (settings?.phone) {
      Linking.openURL(`tel:${settings.phone}`);
    }
  };

  const currentLang = LANGUAGES.find((l) => l.code === language);

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
          {t.more.title}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Platform.OS === "web" ? 118 : 80,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* SHOP CARD — secret tap: tap logo 7 times to access admin */}
        <Pressable onPress={handleSecretTap}>
          <LinearGradient
            colors={[Colors.primaryDark, Colors.primary]}
            style={styles.shopCard}
          >
            <Ionicons name="storefront" size={36} color={Colors.accentLight} />
            <Text style={[styles.shopCardName, { fontFamily: "Inter_700Bold" }]}>
              {settings?.shopName ?? "Rajesh Shopping Center"}
            </Text>
            <Text style={[styles.shopCardAddress, { fontFamily: "Inter_400Regular" }]}>
              {settings?.address ?? "Musikot-5, Aapchaur, Gulmi, Nepal"}
            </Text>
            {settings?.phone ? (
              <Pressable style={styles.callBtn} onPress={handleCall}>
                <Ionicons name="call" size={16} color={Colors.primary} />
                <Text style={[styles.callBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                  {settings.phone}
                </Text>
              </Pressable>
            ) : null}
            {secretTaps > 2 && (
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 4, fontFamily: "Inter_400Regular" }}>
                {7 - secretTaps} more tap{7 - secretTaps !== 1 ? "s" : ""} for admin
              </Text>
            )}
          </LinearGradient>
        </Pressable>

        {/* LANGUAGE SWITCHER */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
          {t.more.language.toUpperCase()}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.langCard,
            { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => setLangModalVisible(true)}
        >
          <View style={[styles.menuIconWrap, { backgroundColor: Colors.accent + "20" }]}>
            <MaterialIcons name="language" size={20} color={Colors.accent} />
          </View>
          <View style={styles.menuText}>
            <Text style={[styles.menuLabel, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>
              {t.more.selectLanguage}
            </Text>
            <Text style={[styles.menuSubtitle, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
              {currentLang?.flag} {currentLang?.nativeLabel}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={theme.textMuted} />
        </Pressable>

        {/* SERVICES */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold", marginTop: 8 }]}>
          {t.more.services}
        </Text>

        <MenuItem
          icon={<MaterialIcons name="directions-car" size={20} color={Colors.accent} />}
          label={t.more.bookJeep}
          subtitle={t.more.bookJeepSub}
          onPress={() => router.push({ pathname: "/booking", params: { serviceType: "jeep" } })}
          theme={theme}
        />
        <MenuItem
          icon={<MaterialCommunityIcons name="tractor" size={20} color={Colors.primary} />}
          label={t.more.bookTractor}
          subtitle={t.more.bookTractorSub}
          onPress={() => router.push({ pathname: "/booking", params: { serviceType: "tractor" } })}
          theme={theme}
        />

        {/* INFORMATION */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold", marginTop: 8 }]}>
          {t.more.information}
        </Text>

        <MenuItem
          icon={<MaterialIcons name="payment" size={20} color={Colors.primary} />}
          label={t.more.howToPay}
          subtitle={t.more.howToPaySub}
          onPress={() => router.push("/payment-info")}
          theme={theme}
        />
        <MenuItem
          icon={<MaterialCommunityIcons name="truck-delivery" size={20} color={Colors.primary} />}
          label={t.more.deliveryPolicy}
          subtitle={t.more.deliveryPolicySub}
          onPress={() => router.push("/delivery-policy")}
          theme={theme}
        />
        <MenuItem
          icon={<MaterialIcons name="gavel" size={20} color={Colors.primary} />}
          label={t.more.termsConditions}
          subtitle={t.more.termsConditionsSub}
          onPress={() => router.push("/terms")}
          theme={theme}
        />

      </ScrollView>

      {/* LANGUAGE PICKER MODAL */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setLangModalVisible(false)}
        />
        <View style={[styles.langModal, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={[styles.langModalHandle, { backgroundColor: theme.border }]} />
          <Text style={[styles.langModalTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
            {t.more.selectLanguage}
          </Text>
          {LANGUAGES.map((lang) => {
            const isActive = lang.code === language;
            return (
              <Pressable
                key={lang.code}
                style={[
                  styles.langOption,
                  {
                    backgroundColor: isActive ? Colors.primary + "15" : "transparent",
                    borderColor: isActive ? Colors.primary : theme.border,
                  },
                ]}
                onPress={() => {
                  setLanguage(lang.code as LanguageCode);
                  setLangModalVisible(false);
                }}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.langNative, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>
                    {lang.nativeLabel}
                  </Text>
                  <Text style={[styles.langEnglish, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                    {lang.label}
                  </Text>
                </View>
                {isActive && (
                  <Feather name="check-circle" size={22} color={Colors.primary} />
                )}
              </Pressable>
            );
          })}
        </View>
      </Modal>
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
  shopCard: {
    borderRadius: 20,
    padding: 20,
    gap: 8,
    alignItems: "flex-start",
  },
  shopCardName: { fontSize: 20, color: "#fff" },
  shopCardAddress: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 19,
  },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  callBtnText: { color: Colors.primaryDark, fontSize: 14 },
  sectionLabel: { fontSize: 11, letterSpacing: 1, marginBottom: -4 },
  langCard: {
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
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: { flex: 1, gap: 2 },
  menuLabel: { fontSize: 15 },
  menuSubtitle: { fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  langModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    gap: 12,
  },
  langModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  langModalTitle: { fontSize: 20, marginBottom: 4 },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 14,
  },
  langFlag: { fontSize: 28 },
  langNative: { fontSize: 17 },
  langEnglish: { fontSize: 13, marginTop: 2 },
});
