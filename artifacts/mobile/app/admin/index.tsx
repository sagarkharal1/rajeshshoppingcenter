import { Feather, Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { secureSet } from "@/utils/secureStorage";

import Colors from "@/constants/colors";
import { AdminProvider } from "@/context/AdminContext";
import { getApiBase } from "@/utils/upload";

const ADMIN_TOKEN_KEY = "rajesh_admin_token";

function LoginScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showTotp, setShowTotp] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpRequired, setTotpRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingTotp, setCheckingTotp] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const base = getApiBase();
        const res = await fetch(`${base}/admin/totp-status`);
        const data = await res.json();
        setTotpEnabled(!!data.totpEnabled);
      } catch {
        setTotpEnabled(false);
      } finally {
        setCheckingTotp(false);
      }
    };
    check();
  }, []);

  const handleLogin = async () => {
    if (!identifier.trim()) {
      Alert.alert("Error", "Please enter your username, email, or phone number");
      return;
    }
    if (!password) {
      Alert.alert("Error", "Please enter your password");
      return;
    }
    if ((totpEnabled || totpRequired) && !totp.trim()) {
      Alert.alert("Error", "Please enter the 6-digit code from Google Authenticator");
      return;
    }

    setIsLoading(true);
    try {
      const base = getApiBase();
      const body: any = { identifier: identifier.trim(), password };
      if (totpEnabled || totpRequired) body.totp = totp.trim();

      const res = await fetch(`${base}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.status === 428 && data.totpRequired) {
        setTotpRequired(true);
        setTotpEnabled(true);
        Alert.alert("Authenticator Required", "Please enter your 6-digit Google Authenticator code.");
        return;
      }

      if (!res.ok) {
        Alert.alert("Login Failed", data.error || "Invalid credentials. Please try again.");
        return;
      }

      await secureSet(ADMIN_TOKEN_KEY, data.token);
      router.replace("/admin/dashboard");
    } catch {
      Alert.alert("Error", "Could not connect to server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingTotp) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20) }]}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <MaterialIcons name="admin-panel-settings" size={60} color={Colors.accentLight} />
        <Text style={[styles.title, { fontFamily: "Inter_700Bold" }]}>Admin Access</Text>
        <Text style={[styles.subtitle, { fontFamily: "Inter_400Regular" }]}>
          Rajesh Shopping Center
        </Text>
      </LinearGradient>

      <View style={[styles.form, { backgroundColor: theme.backgroundSecondary }]}>
        <Text style={[styles.formTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
          Sign In
        </Text>
        <Text style={[styles.formDesc, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
          Enter your credentials to access the admin panel.
        </Text>

        {/* Identifier */}
        <Text style={[styles.label, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>
          Username / Email / Phone
        </Text>
        <View style={[styles.inputRow, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
          <MaterialIcons name="person" size={20} color={theme.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.input, { color: theme.text, fontFamily: "Inter_400Regular" }]}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="admin / email / phone"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        {/* Password */}
        <Text style={[styles.label, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>
          Password
        </Text>
        <View style={[styles.inputRow, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
          <MaterialIcons name="lock" size={20} color={theme.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.input, { color: theme.text, fontFamily: "Inter_400Regular" }]}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor={theme.textMuted}
            secureTextEntry={!showPassword}
            returnKeyType={totpEnabled ? "next" : "done"}
            onSubmitEditing={totpEnabled ? undefined : handleLogin}
          />
          <Pressable onPress={() => setShowPassword(!showPassword)}>
            <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={theme.textMuted} />
          </Pressable>
        </View>

        {/* Google Authenticator */}
        {(totpEnabled || totpRequired) && (
          <>
            <View style={[styles.totpBadge, { backgroundColor: Colors.primary + "15", borderColor: Colors.primary + "30" }]}>
              <MaterialCommunityIcons name="shield-key" size={18} color={Colors.primary} />
              <Text style={[styles.totpBadgeText, { color: Colors.primary, fontFamily: "Inter_500Medium" }]}>
                2-Factor Authentication enabled
              </Text>
            </View>
            <Text style={[styles.label, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>
              Google Authenticator Code
            </Text>
            <View style={[styles.inputRow, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
              <Feather name="key" size={20} color={theme.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.input, { color: theme.text, fontFamily: "Inter_700Bold", letterSpacing: 4 }]}
                value={totp}
                onChangeText={(v) => setTotp(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="• • • • • •"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                secureTextEntry={!showTotp}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                maxLength={6}
              />
              <Pressable onPress={() => setShowTotp(!showTotp)}>
                <Feather name={showTotp ? "eye-off" : "eye"} size={18} color={theme.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.totpHint, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
              Open Google Authenticator and enter the current 6-digit code.
            </Text>
          </>
        )}

        <Pressable
          style={({ pressed }) => [styles.btn, { opacity: pressed || isLoading ? 0.85 : 1 }]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnGradient}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="login" size={20} color="#fff" />
                <Text style={[styles.btnText, { fontFamily: "Inter_700Bold" }]}>Sign In</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

      </View>
    </View>
  );
}

export default function AdminScreen() {
  return (
    <AdminProvider>
      <LoginScreen />
    </AdminProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: "center",
    gap: 10,
    position: "relative",
  },
  backBtn: { position: "absolute", top: 20, left: 20 },
  title: { fontSize: 26, color: "#fff" },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.75)" },
  form: {
    flex: 1,
    margin: 16,
    borderRadius: 24,
    padding: 24,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  formTitle: { fontSize: 20, textAlign: "center" },
  formDesc: { fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 4 },
  label: { fontSize: 13 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 12 },
  totpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  totpBadgeText: { fontSize: 13 },
  totpHint: { fontSize: 12, textAlign: "center" },
  btn: { borderRadius: 16, overflow: "hidden", marginTop: 4 },
  btnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  btnText: { color: "#fff", fontSize: 16 },
  hint: { textAlign: "center", fontSize: 12, marginTop: 4 },
});
