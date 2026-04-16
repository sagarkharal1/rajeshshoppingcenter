import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme, Text } from "react-native";

import Colors from "@/constants/colors";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";

function CartBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View
      style={{
        position: "absolute",
        top: -4,
        right: -8,
        backgroundColor: Colors.accent,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
        zIndex: 10,
      }}
    >
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}

function NativeTabLayout() {
  const { t } = useLanguage();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>{t.tabs.home}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="catalog">
        <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
        <Label>{t.tabs.shop}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cart">
        <Icon sf={{ default: "cart", selected: "cart.fill" }} />
        <Label>{t.tabs.cart}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <Icon sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }} />
        <Label>{t.tabs.more}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { totalItems } = useCart();
  const { t } = useLanguage();
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : theme.backgroundSecondary,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          elevation: 0,
          height: isWeb ? 84 : 60,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundSecondary }]}
            />
          ) : null,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.home,
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={size} />
            ) : (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: t.tabs.shop,
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="square.grid.2x2" tintColor={color} size={size} />
            ) : (
              <MaterialIcons name="storefront" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t.tabs.cart,
          tabBarIcon: ({ color, size }) => (
            <View>
              {isIOS ? (
                <SymbolView name="cart" tintColor={color} size={size} />
              ) : (
                <Ionicons name="cart-outline" size={size} color={color} />
              )}
              <CartBadge count={totalItems} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t.tabs.more,
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="ellipsis.circle" tintColor={color} size={size} />
            ) : (
              <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={size} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
