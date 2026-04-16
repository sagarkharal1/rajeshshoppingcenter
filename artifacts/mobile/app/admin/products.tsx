import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { secureGet } from "@/utils/secureStorage";
import {
  setAuthTokenGetter,
  useAdminGetProducts,
  useAdminCreateProduct,
  useAdminUpdateProduct,
  useAdminDeleteProduct,
  useGetCategories,
} from "@workspace/api-client-react";

import Colors from "@/constants/colors";
import { pickAndUploadMedia, pickAndUploadFromCamera } from "@/utils/upload";

const ADMIN_TOKEN_KEY = "rajesh_admin_token";

function ProductImagePicker({
  imageUrl,
  onImageUrl,
  theme,
}: {
  imageUrl: string;
  onImageUrl: (url: string) => void;
  theme: any;
}) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = () => {
    Alert.alert("Product Image", "Choose source", [
      {
        text: "Camera",
        onPress: async () => {
          setUploading(true);
          try {
            const result = await pickAndUploadFromCamera({ allowsEditing: true, aspect: [4, 3] });
            if (result) onImageUrl(result.servingUrl);
          } catch {
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
            const result = await pickAndUploadMedia({ mediaTypes: "image", allowsEditing: true, aspect: [4, 3] });
            if (result) onImageUrl(result.servingUrl);
          } catch {
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
    <View style={imgPickerStyles.wrapper}>
      <Text style={[imgPickerStyles.label, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>
        Product Image
      </Text>
      <Pressable
        style={[imgPickerStyles.uploadBtn, { backgroundColor: Colors.primary + "15", borderColor: Colors.primary + "40" }]}
        onPress={handleUpload}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={[imgPickerStyles.uploadBtnText, { color: Colors.primary, fontFamily: "Inter_600SemiBold" }]}>Uploading...</Text>
          </>
        ) : (
          <>
            <MaterialIcons name="add-photo-alternate" size={20} color={Colors.primary} />
            <Text style={[imgPickerStyles.uploadBtnText, { color: Colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              {imageUrl ? "Change Photo" : "Upload Photo"}
            </Text>
          </>
        )}
      </Pressable>
      {imageUrl.trim().length > 0 && (
        <Image
          source={{ uri: imageUrl.trim() }}
          style={[imgPickerStyles.preview, { backgroundColor: theme.inputBackground }]}
          resizeMode="cover"
        />
      )}
      <Text style={[imgPickerStyles.orLabel, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>— or paste a URL —</Text>
      <TextInput
        style={[imgPickerStyles.urlInput, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text, fontFamily: "Inter_400Regular" }]}
        value={imageUrl}
        onChangeText={onImageUrl}
        placeholder="https://example.com/image.jpg"
        placeholderTextColor={theme.textMuted}
        keyboardType="url"
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}

const imgPickerStyles = StyleSheet.create({
  wrapper: { gap: 8 },
  label: { fontSize: 13 },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 12,
  },
  uploadBtnText: { fontSize: 15 },
  preview: { width: "100%", height: 160, borderRadius: 12 },
  orLabel: { textAlign: "center", fontSize: 12 },
  urlInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
});

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: any;
  multiline?: boolean;
  theme: any;
};

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline = false,
  theme,
}: FormFieldProps) {
  return (
    <View style={styles.formField}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>
        {label}
      </Text>
      <TextInput
        style={[
          styles.fieldInput,
          multiline && styles.fieldMultiline,
          {
            backgroundColor: theme.inputBackground,
            borderColor: theme.border,
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
    </View>
  );
}

type FormState = {
  name: string;
  description: string;
  price: string;
  unit: string;
  categoryId: number;
  imageUrl: string;
  inStock: boolean;
  featured: boolean;
};

const DEFAULT_FORM: FormState = {
  name: "",
  description: "",
  price: "",
  unit: "piece",
  categoryId: 1,
  imageUrl: "",
  inStock: true,
  featured: false,
};

export default function AdminProductsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  useEffect(() => {
    setAuthTokenGetter(async () => secureGet(ADMIN_TOKEN_KEY));
  }, []);

  const { data: products, isLoading, refetch } = useAdminGetProducts();
  const { data: categories } = useGetCategories();
  const { mutateAsync: createProduct } = useAdminCreateProduct();
  const { mutateAsync: updateProduct } = useAdminUpdateProduct();
  const { mutateAsync: deleteProduct } = useAdminDeleteProduct();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const setField = (key: keyof FormState) => (value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...DEFAULT_FORM, categoryId: categories?.[0]?.id ?? 1 });
    setShowModal(true);
  };

  const openEdit = (product: any) => {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description ?? "",
      price: String(product.price),
      unit: product.unit,
      categoryId: product.categoryId,
      imageUrl: product.imageUrl ?? "",
      inStock: product.inStock,
      featured: product.featured,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price.trim()) {
      Alert.alert("Error", "Name and price are required");
      return;
    }
    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: Number(form.price),
        unit: form.unit.trim() || "piece",
        categoryId: form.categoryId,
        imageUrl: form.imageUrl.trim() || undefined,
        inStock: form.inStock,
        featured: form.featured,
      };
      if (editing) {
        await updateProduct({ id: editing.id, data });
      } else {
        await createProduct({ data });
      }
      setShowModal(false);
      refetch();
    } catch {
      Alert.alert("Error", "Failed to save product");
    }
  };

  const handleDelete = (product: any) => {
    Alert.alert(
      "Delete Product",
      `Delete "${product.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProduct({ id: product.id });
              refetch();
            } catch {
              Alert.alert("Error", "Failed to delete product");
            }
          },
        },
      ]
    );
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
          Products
        </Text>
        <Pressable
          style={[styles.addBtn, { backgroundColor: Colors.primary }]}
          onPress={openCreate}
        >
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={products ?? []}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          renderItem={({ item }) => (
            <View style={[styles.productRow, { backgroundColor: theme.card }]}>
              {/* Thumbnail or placeholder */}
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumbPlaceholder, { backgroundColor: Colors.primary + "15" }]}>
                  <MaterialIcons name="image" size={22} color={Colors.primary + "80"} />
                </View>
              )}
              <View style={styles.productInfo}>
                <Text
                  style={[styles.productName, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text style={[styles.productMeta, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                  {item.categoryName} • NPR {Number(item.price).toLocaleString()}/{item.unit}
                </Text>
                <View style={styles.badges}>
                  {item.inStock ? (
                    <View style={[styles.badge, { backgroundColor: Colors.success + "20" }]}>
                      <Text style={[styles.badgeText, { color: Colors.success }]}>In Stock</Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, { backgroundColor: Colors.error + "20" }]}>
                      <Text style={[styles.badgeText, { color: Colors.error }]}>Out of Stock</Text>
                    </View>
                  )}
                  {item.featured && (
                    <View style={[styles.badge, { backgroundColor: Colors.accent + "20" }]}>
                      <Text style={[styles.badgeText, { color: Colors.accentDark }]}>Featured</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.productActions}>
                <Pressable style={styles.actionBtn} onPress={() => openEdit(item)}>
                  <Feather name="edit-2" size={18} color={Colors.primary} />
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => handleDelete(item)}>
                  <Feather name="trash-2" size={18} color={Colors.error} />
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="inventory" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: "Inter_500Medium" }]}>
                No products yet
              </Text>
              <Pressable style={[styles.emptyBtn, { backgroundColor: Colors.primary }]} onPress={openCreate}>
                <Text style={[styles.emptyBtnText, { fontFamily: "Inter_600SemiBold" }]}>Add First Product</Text>
              </Pressable>
            </View>
          }
        />
      )}

      {/* ADD/EDIT MODAL */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          <View
            style={[
              styles.modalHeader,
              { backgroundColor: theme.backgroundSecondary, borderBottomColor: theme.border },
            ]}
          >
            <Pressable onPress={() => setShowModal(false)}>
              <Text style={[styles.modalCancel, { color: Colors.error, fontFamily: "Inter_500Medium" }]}>
                Cancel
              </Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
              {editing ? "Edit Product" : "New Product"}
            </Text>
            <Pressable onPress={handleSave}>
              <Text style={[styles.modalSave, { color: Colors.primary, fontFamily: "Inter_700Bold" }]}>
                Save
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 14 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <FormField
              label="Product Name *"
              value={form.name}
              onChangeText={setField("name")}
              placeholder="e.g. Basmati Rice"
              theme={theme}
            />
            <FormField
              label="Price (NPR) *"
              value={form.price}
              onChangeText={setField("price")}
              placeholder="e.g. 120"
              keyboardType="numeric"
              theme={theme}
            />
            <FormField
              label="Unit"
              value={form.unit}
              onChangeText={setField("unit")}
              placeholder="kg, piece, litre, bag..."
              theme={theme}
            />
            <FormField
              label="Description"
              value={form.description}
              onChangeText={setField("description")}
              placeholder="Brief product description..."
              multiline
              theme={theme}
            />
            {/* IMAGE UPLOAD */}
            <ProductImagePicker
              imageUrl={form.imageUrl}
              onImageUrl={setField("imageUrl")}
              theme={theme}
            />

            {/* CATEGORY */}
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>
                Category
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {(categories ?? []).map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={[
                      styles.catOption,
                      {
                        backgroundColor: form.categoryId === cat.id ? Colors.primary : theme.inputBackground,
                        borderColor: form.categoryId === cat.id ? Colors.primary : theme.border,
                      },
                    ]}
                    onPress={() => setField("categoryId")(cat.id)}
                  >
                    <Text
                      style={[
                        styles.catOptionText,
                        {
                          color: form.categoryId === cat.id ? "#fff" : theme.text,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* TOGGLES */}
            <View style={[styles.toggleRow, { backgroundColor: theme.card }]}>
              <Text style={[styles.toggleLabel, { color: theme.text, fontFamily: "Inter_500Medium" }]}>
                In Stock
              </Text>
              <Switch
                value={form.inStock}
                onValueChange={setField("inStock")}
                trackColor={{ false: theme.border, true: Colors.success }}
                thumbColor="#fff"
              />
            </View>
            <View style={[styles.toggleRow, { backgroundColor: theme.card }]}>
              <Text style={[styles.toggleLabel, { color: theme.text, fontFamily: "Inter_500Medium" }]}>
                Featured on Home
              </Text>
              <Switch
                value={form.featured}
                onValueChange={setField("featured")}
                trackColor={{ false: theme.border, true: Colors.accent }}
                thumbColor="#fff"
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#eee",
  },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  productInfo: { flex: 1, gap: 4 },
  productName: { fontSize: 15 },
  productMeta: { fontSize: 12 },
  badges: { flexDirection: "row", gap: 6, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  productActions: { flexDirection: "row", gap: 8 },
  actionBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 14 },
  emptyText: { fontSize: 16 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: "#fff", fontSize: 14 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  modalCancel: { fontSize: 16 },
  modalTitle: { fontSize: 18 },
  modalSave: { fontSize: 16 },
  formField: { gap: 6 },
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
  imagePreviewWrap: { gap: 6 },
  imagePreview: {
    width: "100%",
    height: 160,
    borderRadius: 12,
  },
  catOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  catOptionText: { fontSize: 14 },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
  },
  toggleLabel: { fontSize: 15 },
});
