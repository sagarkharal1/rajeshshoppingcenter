import { Feather, Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { secureGet } from "@/utils/secureStorage";
import {
  setAuthTokenGetter,
  useGetSettings,
  useAdminUpdateSettings,
  useAdminChangePassword,
} from "@workspace/api-client-react";

import Colors from "@/constants/colors";
import { pickAndUploadMedia, pickAndUploadFromCamera, getServingUrl, getApiBase } from "@/utils/upload";

const ADMIN_TOKEN_KEY = "rajesh_admin_token";

function PhotoUploadCard({
  label,
  currentPath,
  onUploaded,
  theme,
  aspectRatio,
}: {
  label: string;
  currentPath: string | null | undefined;
  onUploaded: (objectPath: string) => void;
  theme: any;
  aspectRatio?: [number, number];
}) {
  const [uploading, setUploading] = useState(false);
  const servingUrl = getServingUrl(currentPath);

  const handlePick = (useCamera?: boolean) => {
    Alert.alert(label, "Choose source", [
      {
        text: "Camera",
        onPress: async () => {
          setUploading(true);
          try {
            const result = await pickAndUploadFromCamera({ allowsEditing: true, aspect: aspectRatio });
            if (result) onUploaded(result.objectPath);
          } catch (e) {
            Alert.alert("Error", "Upload failed. Try again.");
          } finally {
            setUploading(false);
          }
        },
      },
      {
        text: "Gallery",
        onPress: async () => {
          setUploading(true);
          try {
            const result = await pickAndUploadMedia({ mediaTypes: "image", allowsEditing: true, aspect: aspectRatio });
            if (result) onUploaded(result.objectPath);
          } catch (e) {
            Alert.alert("Error", "Upload failed. Try again.");
          } finally {
            setUploading(false);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={photoStyles.card}>
      <Text style={[photoStyles.label, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>{label}</Text>
      <Pressable
        style={({ pressed }) => [
          photoStyles.photoBox,
          { backgroundColor: theme.inputBackground, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={() => handlePick()}
        disabled={uploading}
      >
        {uploading ? (
          <View style={photoStyles.uploadingOverlay}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={[photoStyles.uploadingText, { fontFamily: "Inter_500Medium" }]}>Uploading...</Text>
          </View>
        ) : servingUrl ? (
          <>
            <Image source={{ uri: servingUrl }} style={photoStyles.photo} resizeMode="cover" />
            <View style={photoStyles.changeOverlay}>
              <MaterialIcons name="camera-alt" size={20} color="#fff" />
              <Text style={[photoStyles.changeText, { fontFamily: "Inter_600SemiBold" }]}>Change Photo</Text>
            </View>
          </>
        ) : (
          <View style={photoStyles.placeholder}>
            <MaterialIcons name="add-photo-alternate" size={36} color={Colors.primary + "80"} />
            <Text style={[photoStyles.placeholderText, { color: theme.textMuted, fontFamily: "Inter_500Medium" }]}>
              Tap to add photo
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const photoStyles = StyleSheet.create({
  card: { gap: 8 },
  label: { fontSize: 13 },
  photoBox: {
    height: 180,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  photo: { width: "100%", height: "100%", position: "absolute" },
  changeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
  },
  changeText: { color: "#fff", fontSize: 14 },
  placeholder: { alignItems: "center", gap: 8 },
  placeholderText: { fontSize: 14 },
  uploadingOverlay: { alignItems: "center", gap: 10 },
  uploadingText: { color: Colors.primary, fontSize: 14 },
});

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  keyboardType = "default",
  theme,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: any;
  theme: any;
}) {
  return (
    <View style={fieldStyles.field}>
      <Text style={[fieldStyles.fieldLabel, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>{label}</Text>
      <TextInput
        style={[
          fieldStyles.fieldInput,
          multiline && fieldStyles.multiline,
          { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text, fontFamily: "Inter_400Regular" },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  field: { gap: 6 },
  fieldLabel: { fontSize: 13 },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
});

export default function AdminSettingsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  useEffect(() => {
    setAuthTokenGetter(async () => secureGet(ADMIN_TOKEN_KEY));
  }, []);

  const { data: settings, refetch } = useGetSettings();
  const { mutateAsync: updateSettings, isPending } = useAdminUpdateSettings();
  const { mutateAsync: changePassword, isPending: isChangingPassword } = useAdminChangePassword();

  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });

  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSetup, setTotpSetup] = useState<{ uri: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);

  useEffect(() => {
    const checkTotp = async () => {
      try {
        const res = await fetch(`${getApiBase()}/admin/totp-status`);
        const data = await res.json();
        setTotpEnabled(!!data.totpEnabled);
      } catch {}
    };
    checkTotp();
  }, []);

  const handleStartTotpSetup = async () => {
    setTotpLoading(true);
    try {
      const token = await secureGet(ADMIN_TOKEN_KEY);
      const res = await fetch(`${getApiBase()}/admin/totp-setup`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTotpSetup({ uri: data.uri, secret: data.secret });
      setTotpCode("");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not start setup");
    } finally {
      setTotpLoading(false);
    }
  };

  const handleEnableTotp = async () => {
    if (!totpCode.trim() || totpCode.length < 6) {
      Alert.alert("Error", "Please enter the 6-digit code from Google Authenticator");
      return;
    }
    setTotpLoading(true);
    try {
      const token = await secureGet(ADMIN_TOKEN_KEY);
      const res = await fetch(`${getApiBase()}/admin/totp-enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: totpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTotpEnabled(true);
      setTotpSetup(null);
      setTotpCode("");
      Alert.alert("2FA Enabled!", "Google Authenticator is now active. You will need your code every time you log in.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not enable 2FA");
    } finally {
      setTotpLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    if (!disableCode.trim() || disableCode.length < 6) {
      Alert.alert("Error", "Please enter your current authenticator code to confirm");
      return;
    }
    Alert.alert(
      "Disable 2FA?",
      "This will remove Google Authenticator protection from your admin account. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disable",
          style: "destructive",
          onPress: async () => {
            setTotpLoading(true);
            try {
              const token = await secureGet(ADMIN_TOKEN_KEY);
              const res = await fetch(`${getApiBase()}/admin/totp-disable`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ code: disableCode.trim() }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);
              setTotpEnabled(false);
              setDisableCode("");
              Alert.alert("2FA Disabled", "Google Authenticator has been removed.");
            } catch (e: any) {
              Alert.alert("Error", e.message || "Could not disable 2FA");
            } finally {
              setTotpLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      Alert.alert("Error", "Please fill in all password fields");
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      Alert.alert("Error", "New password and confirmation do not match");
      return;
    }
    if (pwForm.newPw.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters");
      return;
    }
    try {
      await changePassword({ data: { currentPassword: pwForm.current, newPassword: pwForm.newPw } });
      setPwForm({ current: "", newPw: "", confirm: "" });
      Alert.alert("Success", "Password changed successfully! Use your new password next time you log in.");
    } catch {
      Alert.alert("Failed", "Current password is incorrect. Please try again.");
    }
  };

  const [form, setForm] = useState({
    shopName: "",
    phone: "",
    email: "",
    address: "",
    bankName: "",
    accountName: "",
    accountNumber: "",
    bankBranch: "",
    aboutText: "",
    deliveryPolicy: "",
    termsConditions: "",
    shopPhotoPath: null as string | null,
    ownerPhotoPath: null as string | null,
    homeBannerPath: null as string | null,
    bankQrPath: null as string | null,
    esewaId: "",
    esewaQrPath: null as string | null,
    khaltiId: "",
    khaltiQrPath: null as string | null,
    whatsappPhone: "",
    whatsappApiKey: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        shopName: settings.shopName ?? "",
        phone: settings.phone ?? "",
        email: settings.email ?? "",
        address: settings.address ?? "",
        bankName: settings.bankName ?? "",
        accountName: settings.accountName ?? "",
        accountNumber: settings.accountNumber ?? "",
        bankBranch: settings.bankBranch ?? "",
        aboutText: settings.aboutText ?? "",
        deliveryPolicy: settings.deliveryPolicy ?? "",
        termsConditions: settings.termsConditions ?? "",
        shopPhotoPath: (settings as any).shopPhotoPath ?? null,
        ownerPhotoPath: (settings as any).ownerPhotoPath ?? null,
        homeBannerPath: (settings as any).homeBannerPath ?? null,
        bankQrPath: (settings as any).bankQrPath ?? null,
        esewaId: (settings as any).esewaId ?? "",
        esewaQrPath: (settings as any).esewaQrPath ?? null,
        khaltiId: (settings as any).khaltiId ?? "",
        khaltiQrPath: (settings as any).khaltiQrPath ?? null,
        whatsappPhone: (settings as any).whatsappPhone ?? "",
        whatsappApiKey: (settings as any).whatsappApiKey ?? "",
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings({
        data: {
          shopName: form.shopName,
          phone: form.phone,
          email: form.email,
          address: form.address,
          bankName: form.bankName,
          accountName: form.accountName,
          accountNumber: form.accountNumber,
          bankBranch: form.bankBranch,
          aboutText: form.aboutText,
          deliveryPolicy: form.deliveryPolicy,
          termsConditions: form.termsConditions,
          shopPhotoPath: form.shopPhotoPath ?? null,
          ownerPhotoPath: form.ownerPhotoPath ?? null,
          homeBannerPath: form.homeBannerPath ?? null,
          bankQrPath: form.bankQrPath ?? null,
          esewaId: form.esewaId,
          esewaQrPath: form.esewaQrPath ?? null,
          khaltiId: form.khaltiId,
          khaltiQrPath: form.khaltiQrPath ?? null,
          whatsappPhone: form.whatsappPhone,
          whatsappApiKey: form.whatsappApiKey,
        } as any,
      });
      refetch();
      Alert.alert("Saved!", "Settings updated successfully.");
    } catch {
      Alert.alert("Error", "Failed to save settings");
    }
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
          Shop Settings
        </Text>
        <Pressable
          style={[styles.saveBtn, { backgroundColor: Colors.primary, opacity: isPending ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={isPending}
        >
          {isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Feather name="save" size={18} color="#fff" />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* HOME BANNER PHOTO */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
          HOME SCREEN BANNER
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[{ color: theme.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular" }]}>
            This photo appears at the top of the home screen. Best size: wide landscape photo (e.g. 1200×600).
          </Text>
          <PhotoUploadCard
            label="Home Screen Banner Photo"
            currentPath={form.homeBannerPath}
            onUploaded={(path) => setForm((f) => ({ ...f, homeBannerPath: path }))}
            theme={theme}
            aspectRatio={[2, 1]}
          />
        </View>

        {/* PHOTOS */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
          SHOP PHOTOS
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <PhotoUploadCard
            label="Shop / Store Photo"
            currentPath={form.shopPhotoPath}
            onUploaded={(path) => setForm((f) => ({ ...f, shopPhotoPath: path }))}
            theme={theme}
            aspectRatio={[16, 9]}
          />
          <PhotoUploadCard
            label="Owner Photo"
            currentPath={form.ownerPhotoPath}
            onUploaded={(path) => setForm((f) => ({ ...f, ownerPhotoPath: path }))}
            theme={theme}
            aspectRatio={[1, 1]}
          />
        </View>

        {/* CONTACT INFO */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
          CONTACT INFO
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Field label="Shop Name" value={form.shopName} onChange={(v) => setForm(f => ({ ...f, shopName: v }))} placeholder="Rajesh Shopping Center" theme={theme} />
          <Field label="Phone Number" value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} placeholder="+977-XXXXXXXXXX" keyboardType="phone-pad" theme={theme} />
          <Field label="Email" value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} placeholder="shop@example.com" keyboardType="email-address" theme={theme} />
          <Field label="Address" value={form.address} onChange={(v) => setForm(f => ({ ...f, address: v }))} placeholder="Musikot-5, Aapchaur, Gulmi, Nepal" multiline theme={theme} />
        </View>

        {/* BANK QR */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
          BANK QR CODE
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[{ color: theme.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular" }]}>
            Upload your bank QR code. Customers will scan this to transfer money directly to your account.
          </Text>
          <PhotoUploadCard
            label="Bank QR Code"
            currentPath={form.bankQrPath}
            onUploaded={(path) => setForm((f) => ({ ...f, bankQrPath: path }))}
            theme={theme}
            aspectRatio={[1, 1]}
          />
        </View>

        {/* ESEWA */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
          ESEWA QR CODE
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[{ color: theme.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular" }]}>
            Upload your eSewa QR code. Customers will scan this to pay via eSewa.
          </Text>
          <PhotoUploadCard
            label="eSewa QR Code"
            currentPath={form.esewaQrPath}
            onUploaded={(path) => setForm((f) => ({ ...f, esewaQrPath: path }))}
            theme={theme}
            aspectRatio={[1, 1]}
          />
        </View>

        {/* KHALTI */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
          KHALTI QR CODE
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[{ color: theme.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular" }]}>
            Upload your Khalti QR code. Customers will scan this to pay via Khalti.
          </Text>
          <PhotoUploadCard
            label="Khalti QR Code"
            currentPath={form.khaltiQrPath}
            onUploaded={(path) => setForm((f) => ({ ...f, khaltiQrPath: path }))}
            theme={theme}
            aspectRatio={[1, 1]}
          />
        </View>

        {/* WHATSAPP NOTIFICATIONS */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
          WHATSAPP NOTIFICATIONS
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, backgroundColor: "#25D366" + "18", borderRadius: 10, marginBottom: 4 }}>
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={{ flex: 1, fontSize: 12, color: theme.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18 }}>
              {"Get notified on WhatsApp for every new order & booking.\n\n1. Open WhatsApp and add this contact:\n   +34 644 59 78 23\n2. Send them this exact message:\n   \"I allow callmebot to send me messages\"\n3. You'll receive an API key in reply — paste it below."}
            </Text>
          </View>
          <Field
            label="Your WhatsApp Number"
            value={form.whatsappPhone}
            onChange={(v) => setForm(f => ({ ...f, whatsappPhone: v }))}
            placeholder="+9779XXXXXXXXX (with country code)"
            theme={theme}
          />
          <Field
            label="CallMeBot API Key"
            value={form.whatsappApiKey}
            onChange={(v) => setForm(f => ({ ...f, whatsappApiKey: v }))}
            placeholder="e.g. 1234567"
            theme={theme}
          />
        </View>

        {/* CONTENT */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
          CONTENT
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Field label="About Us" value={form.aboutText} onChange={(v) => setForm(f => ({ ...f, aboutText: v }))} placeholder="Tell customers about your shop..." multiline theme={theme} />
          <Field label="Delivery Policy" value={form.deliveryPolicy} onChange={(v) => setForm(f => ({ ...f, deliveryPolicy: v }))} placeholder="Describe delivery areas and timelines..." multiline theme={theme} />
          <Field label="Terms & Conditions" value={form.termsConditions} onChange={(v) => setForm(f => ({ ...f, termsConditions: v }))} placeholder="Your shop's terms..." multiline theme={theme} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveBtnFull, { opacity: pressed || isPending ? 0.9 : 1 }]}
          onPress={handleSave}
          disabled={isPending}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtnGradient}
          >
            {isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="save" size={20} color="#fff" />
                <Text style={[styles.saveBtnText, { fontFamily: "Inter_700Bold" }]}>Save All Settings</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        {/* 2-FACTOR AUTHENTICATION */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
          2-FACTOR AUTHENTICATION
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <MaterialCommunityIcons
              name="shield-check"
              size={24}
              color={totpEnabled ? Colors.accent : theme.textMuted}
            />
            <View style={{ flex: 1 }}>
              <Text style={[{ color: theme.text, fontFamily: "Inter_600SemiBold", fontSize: 15 }]}>
                Google Authenticator
              </Text>
              <Text style={[{ color: totpEnabled ? Colors.accent : theme.textMuted, fontSize: 12, fontFamily: "Inter_500Medium" }]}>
                {totpEnabled ? "Enabled — Active on this account" : "Not enabled"}
              </Text>
            </View>
          </View>

          {!totpEnabled && !totpSetup && (
            <>
              <Text style={[{ color: theme.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 }]}>
                Add an extra layer of security. Install Google Authenticator on your phone, then tap the button below to link it.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.changePwBtn, { opacity: pressed || totpLoading ? 0.8 : 1, backgroundColor: Colors.primary }]}
                onPress={handleStartTotpSetup}
                disabled={totpLoading}
              >
                {totpLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="key" size={18} color="#fff" />
                    <Text style={[styles.changePwBtnText, { fontFamily: "Inter_600SemiBold" }]}>Set Up Google Authenticator</Text>
                  </>
                )}
              </Pressable>
            </>
          )}

          {!totpEnabled && totpSetup && (
            <>
              <Text style={[{ color: theme.text, fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 2 }]}>
                Step 1: Scan this QR code
              </Text>
              <Text style={[{ color: theme.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 8 }]}>
                Open Google Authenticator → tap "+" → scan the QR code below.
              </Text>
              <Image
                source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpSetup.uri)}` }}
                style={{ width: 180, height: 180, alignSelf: "center", borderRadius: 12, marginBottom: 10 }}
                resizeMode="contain"
              />
              <Text style={[{ color: theme.textMuted, fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 4 }]}>
                Can't scan? Enter this key manually:
              </Text>
              <Text style={[{ color: theme.text, fontFamily: "Inter_700Bold", fontSize: 13, textAlign: "center", letterSpacing: 2, marginBottom: 10 }]}>
                {totpSetup.secret}
              </Text>

              <Text style={[{ color: theme.text, fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 4 }]}>
                Step 2: Enter the 6-digit code
              </Text>
              <View style={[styles.passwordRow, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                <Feather name="key" size={18} color={theme.textMuted} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.passwordInput, { color: theme.text, fontFamily: "Inter_700Bold", letterSpacing: 4 }]}
                  value={totpCode}
                  onChangeText={(v) => setTotpCode(v.replace(/\D/g, "").slice(0, 6))}
                  placeholder="• • • • • •"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <Pressable
                  style={({ pressed }) => [styles.changePwBtn, { flex: 1, opacity: pressed ? 0.8 : 1, backgroundColor: theme.border }]}
                  onPress={() => { setTotpSetup(null); setTotpCode(""); }}
                >
                  <Text style={[styles.changePwBtnText, { fontFamily: "Inter_600SemiBold", color: theme.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.changePwBtn, { flex: 2, opacity: pressed || totpLoading ? 0.8 : 1, backgroundColor: Colors.primary }]}
                  onPress={handleEnableTotp}
                  disabled={totpLoading}
                >
                  {totpLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <MaterialIcons name="verified-user" size={18} color="#fff" />
                      <Text style={[styles.changePwBtnText, { fontFamily: "Inter_600SemiBold" }]}>Verify & Enable</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}

          {totpEnabled && (
            <>
              <Text style={[{ color: theme.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 }]}>
                To disable Google Authenticator, enter your current authenticator code below.
              </Text>
              <View style={[styles.passwordRow, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                <Feather name="key" size={18} color={theme.textMuted} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.passwordInput, { color: theme.text, fontFamily: "Inter_700Bold", letterSpacing: 4 }]}
                  value={disableCode}
                  onChangeText={(v) => setDisableCode(v.replace(/\D/g, "").slice(0, 6))}
                  placeholder="• • • • • •"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
              <Pressable
                style={({ pressed }) => [styles.changePwBtn, { opacity: pressed || totpLoading ? 0.8 : 1, backgroundColor: "#C0392B" }]}
                onPress={handleDisableTotp}
                disabled={totpLoading}
              >
                {totpLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="shield-off" size={18} color="#fff" />
                    <Text style={[styles.changePwBtnText, { fontFamily: "Inter_600SemiBold" }]}>Disable 2FA</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </View>

        {/* CHANGE PASSWORD */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
          CHANGE PASSWORD
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[{ color: theme.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular" }]}>
            Update your admin login password. You will need to enter your current password to confirm.
          </Text>

          {(["current", "newPw", "confirm"] as const).map((key) => (
            <View key={key} style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>
                {key === "current" ? "Current Password" : key === "newPw" ? "New Password" : "Confirm New Password"}
              </Text>
              <View style={[styles.passwordRow, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.passwordInput, { color: theme.text, fontFamily: "Inter_400Regular" }]}
                  value={pwForm[key]}
                  onChangeText={(v) => setPwForm((f) => ({ ...f, [key]: v }))}
                  placeholder={key === "current" ? "Enter current password" : key === "newPw" ? "Enter new password" : "Re-enter new password"}
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry={!showPw[key]}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowPw((s) => ({ ...s, [key]: !s[key] }))}>
                  <Feather name={showPw[key] ? "eye-off" : "eye"} size={18} color={theme.textMuted} />
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable
            style={({ pressed }) => [styles.changePwBtn, { opacity: pressed || isChangingPassword ? 0.8 : 1 }]}
            onPress={handleChangePassword}
            disabled={isChangingPassword}
          >
            {isChangingPassword ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialIcons name="lock" size={18} color="#fff" />
                <Text style={[styles.changePwBtnText, { fontFamily: "Inter_600SemiBold" }]}>Change Password</Text>
              </>
            )}
          </Pressable>
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
  headerTitle: { fontSize: 22 },
  saveBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: { fontSize: 11, letterSpacing: 1 },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  saveBtnFull: { borderRadius: 16, overflow: "hidden", marginTop: 8 },
  saveBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 17 },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  passwordInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  changePwBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 4,
  },
  changePwBtnText: { color: "#fff", fontSize: 15 },
});
