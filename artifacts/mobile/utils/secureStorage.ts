import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    return AsyncStorage.setItem(key, value);
  }
  return SecureStore.setItemAsync(key, value);
}

export async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    return AsyncStorage.removeItem(key);
  }
  return SecureStore.deleteItemAsync(key);
}
