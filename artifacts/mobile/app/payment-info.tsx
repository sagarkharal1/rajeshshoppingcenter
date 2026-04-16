import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Linking,
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
import { getServingUrl } from "@/utils/upload";

async function saveQrToGallery(url: string, name: string) {
  if (Platform.OS === "web") {
    Linking.openURL(url);
    return;
  }
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission needed", "Please allow photo access to save the QR code.");
    return;
  }
  try {
    const fileUri = (FileSystem.cacheDirectory ?? "") + name + "_qr.png";
    await FileSystem.downloadAsync(url, fileUri);
    await MediaLibrary.saveToLibraryAsync(fileUri);
    Alert.alert("Saved!", "QR code saved to your gallery.");
  } catch {
    Alert.alert("Error", "Could not save QR code. Try again.");
  }
}

function QrSection({
  qrPath,
  name,
  scanLabel,
  emptyLabel,
  accentColor,
  theme,
  saveLabel,
  savedLabel,
}: {
  qrPath: string | null | undefined;
  name: string;
  scanLabel: string;
  emptyLabel: string;
  accentColor: string;
  theme: any;
  saveLabel: string;
  savedLabel: string;
}) {
  const [saving, setSaving] = useState(false);
  const url = getServingUrl(qrPath);

  if (!url) {
    return (
      <View style={[styles.qrPlaceholder, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
        <MaterialIcons name="qr-code" size={72} color={theme.textMuted} />
        <Text style={[styles.qrEmptyText, { color: theme.textMuted, fontFamily: "Inter_500Medium" }]}>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    await saveQrToGallery(url, name);
    setSaving(false);
  };

  return (
    <View style={styles.qrSection}>
      <View style={[styles.qrFrame, { borderColor: accentColor + "40", backgroundColor: "#fff" }]}>
        <Image source={{ uri: url }} style={styles.qrImage} resizeMode="contain" />
      </View>
      <Text style={[styles.scanLabel, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
        {scanLabel}
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.saveBtn,
          { backgroundColor: accentColor, opacity: pressed || saving ? 0.8 : 1 },
        ]}
        onPress={handleSave}
        disabled={saving}
      >
        <Feather name={saving ? "loader" : "download"} size={16} color="#fff" />
        <Text style={[styles.saveBtnText, { fontFamily: "Inter_600SemiBold" }]}>
          {saving ? savedLabel : saveLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export default function PaymentInfoScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { data: settings } = useGetSettings();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"bank" | "esewa" | "khalti">("bank");

  const handleCall = () => {
    if (settings?.phone) Linking.openURL(`tel:${settings.phone}`);
  };

  const TAB_METHODS = [
    { key: "bank", label: t.payment.bankTransfer },
    { key: "esewa", label: "eSewa" },
    { key: "khalti", label: "Khalti" },
  ];

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
          {t.payment.title}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* TABS */}
      <View style={[styles.tabBar, { backgroundColor: theme.backgroundSecondary, borderBottomColor: theme.border }]}>
        {TAB_METHODS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && [styles.tabActive, { borderBottomColor: Colors.primary }],
            ]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === tab.key ? Colors.primary : theme.textMuted,
                  fontFamily: activeTab === tab.key ? "Inter_700Bold" : "Inter_500Medium",
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* BANK TRANSFER TAB */}
        {activeTab === "bank" && (
          <>
            <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.instrCard}>
              <MaterialIcons name="account-balance" size={32} color={Colors.accentLight} />
              <Text style={[styles.instrTitle, { fontFamily: "Inter_700Bold" }]}>
                {t.payment.bankTransfer}
              </Text>
              {[t.payment.bankStep1, t.payment.bankStep2, t.payment.bankStep3].map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={{ color: Colors.primary, fontSize: 12, fontFamily: "Inter_700Bold" }}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { fontFamily: "Inter_400Regular" }]}>{step}</Text>
                </View>
              ))}
            </LinearGradient>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                {t.payment.scanQrToPay}
              </Text>
              <QrSection
                qrPath={(settings as any)?.bankQrPath}
                name="bank"
                scanLabel={t.payment.scanWithBankingApp}
                emptyLabel={t.payment.qrNotSet}
                accentColor={Colors.primary}
                theme={theme}
                saveLabel={t.payment.saveQr}
                savedLabel={t.payment.saving}
              />
            </View>
          </>
        )}

        {/* ESEWA TAB */}
        {activeTab === "esewa" && (
          <>
            <LinearGradient colors={["#5CB85C", "#3d8b3d"]} style={styles.instrCard}>
              <MaterialIcons name="account-balance-wallet" size={32} color="#fff" />
              <Text style={[styles.instrTitle, { fontFamily: "Inter_700Bold" }]}>
                {t.payment.esewaPayment}
              </Text>
              {[t.payment.esewaStep1, t.payment.esewaStep2, t.payment.esewaStep3].map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={[styles.stepNumber, { backgroundColor: "rgba(255,255,255,0.9)" }]}>
                    <Text style={{ color: "#3d8b3d", fontSize: 12, fontFamily: "Inter_700Bold" }}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { fontFamily: "Inter_400Regular" }]}>{step}</Text>
                </View>
              ))}
            </LinearGradient>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                {t.payment.scanQrToPay}
              </Text>
              <QrSection
                qrPath={(settings as any)?.esewaQrPath}
                name="esewa"
                scanLabel={t.payment.scanWithEsewa}
                emptyLabel={t.payment.qrNotSet}
                accentColor="#3d8b3d"
                theme={theme}
                saveLabel={t.payment.saveQr}
                savedLabel={t.payment.saving}
              />
            </View>
          </>
        )}

        {/* KHALTI TAB */}
        {activeTab === "khalti" && (
          <>
            <LinearGradient colors={["#5C2D91", "#7B3DB5"]} style={styles.instrCard}>
              <MaterialIcons name="account-balance-wallet" size={32} color="#fff" />
              <Text style={[styles.instrTitle, { fontFamily: "Inter_700Bold" }]}>
                {t.payment.khaltiPayment}
              </Text>
              {[t.payment.khaltiStep1, t.payment.khaltiStep2, t.payment.khaltiStep3].map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={[styles.stepNumber, { backgroundColor: "rgba(255,255,255,0.9)" }]}>
                    <Text style={{ color: "#5C2D91", fontSize: 12, fontFamily: "Inter_700Bold" }}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { fontFamily: "Inter_400Regular" }]}>{step}</Text>
                </View>
              ))}
            </LinearGradient>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                {t.payment.scanQrToPay}
              </Text>
              <QrSection
                qrPath={(settings as any)?.khaltiQrPath}
                name="khalti"
                scanLabel={t.payment.scanWithKhalti}
                emptyLabel={t.payment.qrNotSet}
                accentColor="#5C2D91"
                theme={theme}
                saveLabel={t.payment.saveQr}
                savedLabel={t.payment.saving}
              />
            </View>
          </>
        )}

        {/* SECURITY NOTICE + CALL */}
        <View style={styles.securityCard}>
          <View style={styles.securityHeader}>
            <Feather name="shield" size={22} color="#fff" />
            <Text style={[styles.securityTitle, { fontFamily: "Inter_700Bold" }]}>
              {t.payment.note}
            </Text>
          </View>
          <Text style={[styles.securityText, { fontFamily: "Inter_400Regular" }]}>
            {t.payment.noteText}
          </Text>
          {settings?.phone && (
            <Pressable style={styles.callBtn} onPress={handleCall}>
              <Ionicons name="call" size={18} color="#fff" />
              <Text style={[styles.callBtnText, { fontFamily: "Inter_700Bold" }]}>
                {t.payment.callUs} — {settings.phone}
              </Text>
            </Pressable>
          )}
        </View>
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
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {},
  tabText: { fontSize: 13 },
  instrCard: { borderRadius: 20, padding: 20, gap: 12 },
  instrTitle: { fontSize: 20, color: "#fff", marginBottom: 4 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepText: { flex: 1, fontSize: 14, color: "rgba(255,255,255,0.9)", lineHeight: 21 },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 17 },
  qrSection: { alignItems: "center", gap: 14 },
  qrFrame: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  qrImage: { width: 220, height: 220 },
  scanLabel: { fontSize: 13, textAlign: "center" },
  qrPlaceholder: {
    height: 200,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  qrEmptyText: { fontSize: 14 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontSize: 15 },
  securityCard: {
    borderRadius: 16,
    padding: 18,
    gap: 12,
    backgroundColor: "#B45309",
  },
  securityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  securityTitle: { fontSize: 16, color: "#fff" },
  securityText: { fontSize: 14, color: "rgba(255,255,255,0.92)", lineHeight: 22 },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  callBtnText: { color: "#fff", fontSize: 14 },
});
