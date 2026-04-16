import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/context/LanguageContext";

export function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const { t } = useLanguage();

  useEffect(() => {
    if (Platform.OS === "web") return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false;
      setIsOffline(offline);
      if (!offline && isOffline) {
        setShowBack(true);
        setTimeout(() => setShowBack(false), 3000);
      }
    });

    return unsubscribe;
  }, [isOffline]);

  const visible = isOffline || showBack;
  const color = isOffline ? "#c0392b" : "#27ae60";
  const icon: any = isOffline ? "cloud-offline" : "cloud-done";
  const message = isOffline
    ? "इन्टरनेट छैन — जडान जाँच गर्नुहोस्"
    : "जडान पुनः स्थापित भयो";

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -60,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [visible]);

  return (
    <Animated.View
      style={[styles.banner, { backgroundColor: color, transform: [{ translateY: slideAnim }] }]}
      pointerEvents="none"
    >
      <Ionicons name={icon} size={16} color="#fff" />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
