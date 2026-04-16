import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import * as Haptics from "expo-haptics";
import { useCreateOrder } from "@workspace/api-client-react";

import Colors from "@/constants/colors";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  error?: string;
  keyboardType?: any;
  multiline?: boolean;
  theme: any;
};

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = "default",
  multiline = false,
  theme,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>
        {label}
      </Text>
      <TextInput
        style={[
          styles.fieldInput,
          multiline && styles.fieldMultiline,
          {
            backgroundColor: theme.inputBackground,
            borderColor: error ? Colors.error : theme.border,
            color: theme.text,
            fontFamily: "Inter_400Regular",
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? "top" : "center"}
        autoCorrect={false}
      />
      {error ? (
        <Text style={[styles.errorMsg, { color: Colors.error, fontFamily: "Inter_400Regular" }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { items, totalAmount, clearCart } = useCart();
  const { t } = useLanguage();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "esewa" | "khalti">("bank");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { mutateAsync: createOrder, isPending } = useCreateOrder();

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = t.checkout.errors.name;
    if (!phone.trim()) newErrors.phone = t.checkout.errors.phone;
    else if (!/^[0-9+\-\s]{7,15}$/.test(phone.trim()))
      newErrors.phone = t.checkout.errors.phoneInvalid;
    if (!address.trim()) newErrors.address = t.checkout.errors.address;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePlaceOrder = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await createOrder({
        data: {
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerAddress: address.trim(),
          items: items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            price: i.price,
            quantity: i.quantity,
            unit: i.unit,
          })),
          paymentMethod,
          notes: notes.trim() || undefined,
        } as any,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearCart();
      Alert.alert(
        t.checkout.success,
        t.checkout.successMsg,
        [
          {
            text: t.checkout.viewPayment,
            onPress: () => router.replace("/payment-info"),
          },
          {
            text: t.checkout.backToShop,
            onPress: () => router.replace("/(tabs)"),
            style: "cancel",
          },
        ]
      );
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t.common.error, t.checkout.failedMsg);
    }
  };

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
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
          {t.checkout.title}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ORDER SUMMARY */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
              {t.checkout.orderSummary}
            </Text>
            {items.map((item) => (
              <View key={item.productId} style={styles.orderItem}>
                <Text
                  style={[styles.orderItemName, { color: theme.text, fontFamily: "Inter_500Medium" }]}
                  numberOfLines={1}
                >
                  {item.productName} × {item.quantity}
                </Text>
                <Text style={[styles.orderItemPrice, { color: Colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                  NPR {(item.price * item.quantity).toLocaleString()}
                </Text>
              </View>
            ))}
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.orderItem}>
              <Text style={[styles.totalLabel, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                {t.checkout.total}
              </Text>
              <Text style={[styles.totalValue, { color: Colors.primary, fontFamily: "Inter_700Bold" }]}>
                NPR {totalAmount.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* PAYMENT METHOD */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
              {t.checkout_payment.paymentMethod}
            </Text>
            <View style={styles.payMethodRow}>
              {[
                { key: "bank", label: t.checkout_payment.bankTransfer, icon: "credit-card" as const, color: Colors.primary },
                { key: "esewa", label: t.checkout_payment.esewa, icon: "smartphone" as const, color: "#5CB85C" },
                { key: "khalti", label: t.checkout_payment.khalti, icon: "smartphone" as const, color: "#5C2D91" },
              ].map((m) => (
                <Pressable
                  key={m.key}
                  style={[
                    styles.payMethodBtn,
                    paymentMethod === m.key
                      ? { backgroundColor: m.color + "18", borderColor: m.color, borderWidth: 2 }
                      : { backgroundColor: theme.inputBackground, borderColor: theme.border, borderWidth: 1 },
                  ]}
                  onPress={() => setPaymentMethod(m.key as any)}
                >
                  <Feather name={m.icon} size={22} color={paymentMethod === m.key ? m.color : theme.textMuted} />
                  <Text
                    style={{
                      color: paymentMethod === m.key ? m.color : theme.textMuted,
                      fontSize: 12,
                      fontFamily: paymentMethod === m.key ? "Inter_700Bold" : "Inter_500Medium",
                      textAlign: "center",
                    }}
                  >
                    {m.label}
                  </Text>
                  {paymentMethod === m.key && (
                    <Feather name="check-circle" size={14} color={m.color} style={{ position: "absolute", top: 8, right: 8 }} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          {/* DELIVERY INFO */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
              {t.checkout.deliveryDetails}
            </Text>
            <FormField
              label={t.checkout.fullName}
              value={name}
              onChangeText={setName}
              placeholder={t.checkout.fullNamePlaceholder}
              error={errors.name}
              theme={theme}
            />
            <FormField
              label={t.checkout.phone}
              value={phone}
              onChangeText={setPhone}
              placeholder={t.checkout.phonePlaceholder}
              error={errors.phone}
              keyboardType="phone-pad"
              theme={theme}
            />
            <FormField
              label={t.checkout.address}
              value={address}
              onChangeText={setAddress}
              placeholder={t.checkout.addressPlaceholder}
              error={errors.address}
              multiline
              theme={theme}
            />
            <FormField
              label={t.checkout.notes}
              value={notes}
              onChangeText={setNotes}
              placeholder={t.checkout.notesPlaceholder}
              multiline
              theme={theme}
            />
          </View>

          {/* PAYMENT NOTE */}
          <Pressable
            style={[styles.paymentNote, { backgroundColor: Colors.accent + "18" }]}
            onPress={() => router.push("/payment-info")}
          >
            <Feather name="info" size={18} color={Colors.accentDark} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.paymentNoteTitle, { color: Colors.accentDark, fontFamily: "Inter_600SemiBold" }]}>
                {t.checkout.paymentNote}
              </Text>
              <Text style={[styles.paymentNoteDesc, { color: Colors.accentDark, fontFamily: "Inter_400Regular" }]}>
                {t.checkout.viewBankDetails}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={Colors.accentDark} />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* PLACE ORDER */}
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
        <Pressable
          style={({ pressed }) => [styles.orderBtn, { opacity: pressed || isPending ? 0.85 : 1 }]}
          onPress={handlePlaceOrder}
          disabled={isPending || items.length === 0}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.orderBtnGradient}
          >
            {isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="check-circle" size={22} color="#fff" />
                <Text style={[styles.orderBtnText, { fontFamily: "Inter_700Bold" }]}>
                  {t.checkout.placeOrder} — NPR {totalAmount.toLocaleString()}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
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
  cardTitle: { fontSize: 17, marginBottom: 4 },
  orderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderItemName: { flex: 1, fontSize: 14, marginRight: 8 },
  orderItemPrice: { fontSize: 14 },
  divider: { height: 1, marginVertical: 4 },
  totalLabel: { fontSize: 16 },
  totalValue: { fontSize: 18 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13 },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  fieldMultiline: {
    minHeight: 80,
    paddingTop: 12,
  },
  errorMsg: { fontSize: 12, marginTop: -2 },
  paymentNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
  },
  paymentNoteTitle: { fontSize: 14 },
  paymentNoteDesc: { fontSize: 12, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  payMethodRow: { flexDirection: "row", gap: 10 },
  payMethodBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 6,
    position: "relative",
  },
  orderBtn: { borderRadius: 16, overflow: "hidden" },
  orderBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  orderBtnText: { color: "#fff", fontSize: 17 },
});
