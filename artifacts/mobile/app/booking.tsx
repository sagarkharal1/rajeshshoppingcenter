import { Feather, Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
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
import { useCreateBooking } from "@workspace/api-client-react";

import Colors from "@/constants/colors";
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
          multiline && styles.multiline,
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
      {error && (
        <Text style={[styles.errorMsg, { color: Colors.error, fontFamily: "Inter_400Regular" }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

export default function BookingScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const params = useLocalSearchParams<{ serviceType?: string }>();
  const { t } = useLanguage();
  const [serviceType, setServiceType] = useState<"jeep" | "tractor">(
    (params.serviceType as any) ?? "jeep"
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { mutateAsync: createBooking, isPending } = useCreateBooking();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t.booking.errors.name;
    if (!phone.trim()) e.phone = t.booking.errors.phone;
    if (!pickup.trim()) e.pickup = t.booking.errors.pickup;
    if (!destination.trim()) e.destination = t.booking.errors.destination;
    if (!date.trim()) e.date = t.booking.errors.date;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleBooking = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await createBooking({
        data: {
          serviceType,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          pickupLocation: pickup.trim(),
          destination: destination.trim(),
          bookingDate: date.trim(),
          notes: notes.trim() || undefined,
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t.booking.successTitle,
        t.booking.successMsg,
        [{ text: t.common.ok, onPress: () => router.back() }]
      );
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t.common.error, t.booking.failedMsg);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 12) }]}
      >
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold" }]}>
          {t.booking.title}
        </Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* SERVICE TYPE */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
              {t.booking.serviceType}
            </Text>
            <View style={styles.serviceToggle}>
              <Pressable
                style={[
                  styles.serviceOption,
                  serviceType === "jeep"
                    ? { backgroundColor: Colors.primary }
                    : { backgroundColor: theme.inputBackground, borderColor: theme.border, borderWidth: 1 },
                ]}
                onPress={() => setServiceType("jeep")}
              >
                <MaterialIcons name="directions-car" size={22} color={serviceType === "jeep" ? "#fff" : theme.text} />
                <Text
                  style={[
                    styles.serviceOptionText,
                    { color: serviceType === "jeep" ? "#fff" : theme.text, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {t.booking.jeep}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.serviceOption,
                  serviceType === "tractor"
                    ? { backgroundColor: Colors.primary }
                    : { backgroundColor: theme.inputBackground, borderColor: theme.border, borderWidth: 1 },
                ]}
                onPress={() => setServiceType("tractor")}
              >
                <MaterialCommunityIcons name="tractor" size={22} color={serviceType === "tractor" ? "#fff" : theme.text} />
                <Text
                  style={[
                    styles.serviceOptionText,
                    { color: serviceType === "tractor" ? "#fff" : theme.text, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {t.booking.tractor}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* YOUR DETAILS */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
              {t.booking.yourDetails}
            </Text>
            <FormField
              label={t.booking.fullName}
              value={name}
              onChangeText={setName}
              placeholder={t.booking.fullNamePlaceholder}
              error={errors.name}
              theme={theme}
            />
            <FormField
              label={t.booking.phone}
              value={phone}
              onChangeText={setPhone}
              placeholder={t.booking.phonePlaceholder}
              error={errors.phone}
              keyboardType="phone-pad"
              theme={theme}
            />
          </View>

          {/* TRIP INFO */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
              {t.booking.tripDetails}
            </Text>
            <FormField
              label={t.booking.pickup}
              value={pickup}
              onChangeText={setPickup}
              placeholder={t.booking.pickupPlaceholder}
              error={errors.pickup}
              theme={theme}
            />
            <FormField
              label={t.booking.destination}
              value={destination}
              onChangeText={setDestination}
              placeholder={t.booking.destinationPlaceholder}
              error={errors.destination}
              theme={theme}
            />
            <FormField
              label={t.booking.date}
              value={date}
              onChangeText={setDate}
              placeholder={t.booking.datePlaceholder}
              error={errors.date}
              theme={theme}
            />
            <FormField
              label={t.booking.notes}
              value={notes}
              onChangeText={setNotes}
              placeholder={t.booking.notesPlaceholder}
              multiline
              theme={theme}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SUBMIT */}
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
          style={({ pressed }) => [styles.bookBtn, { opacity: pressed || isPending ? 0.9 : 1 }]}
          onPress={handleBooking}
          disabled={isPending}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bookBtnGradient}
          >
            {isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="event-available" size={22} color="#fff" />
                <Text style={[styles.bookBtnText, { fontFamily: "Inter_700Bold" }]}>
                  {t.booking.confirmBooking}
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
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 20, color: "#fff" },
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
  serviceToggle: { flexDirection: "row", gap: 12 },
  serviceOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  serviceOptionText: { fontSize: 16 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13 },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  multiline: { minHeight: 80, paddingTop: 12 },
  errorMsg: { fontSize: 12 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  bookBtn: { borderRadius: 16, overflow: "hidden" },
  bookBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  bookBtnText: { color: "#fff", fontSize: 17 },
});
