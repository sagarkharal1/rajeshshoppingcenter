import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable, productsTable } from "@workspace/db/schema";
import { eq, ilike, and, type SQL } from "drizzle-orm";

const router: IRouter = Router();

router.get("/categories", async (_req, res) => {
  try {
    const categories = await db
      .select()
      .from(categoriesTable)
      .orderBy(categoriesTable.sortOrder);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: "Failed to get categories" });
  }
});

router.get("/products", async (req, res) => {
  try {
    const { categoryId, search, featured } = req.query;
    const conditions: SQL[] = [];

    const parsedCategoryId = categoryId ? Number(categoryId) : NaN;
    if (!isNaN(parsedCategoryId) && parsedCategoryId > 0) {
      conditions.push(eq(productsTable.categoryId, parsedCategoryId));
    }
    if (featured === "true") {
      conditions.push(eq(productsTable.featured, true));
    }
    if (search && typeof search === "string" && search.trim().length > 0) {
      const term = search.trim().slice(0, 100);
      conditions.push(ilike(productsTable.name, `%${term}%`));
    }

    const query = db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        sku: productsTable.sku,
        price: productsTable.price,
        buyingPrice: productsTable.buyingPrice,
        transportationCost: productsTable.transportationCost,
        extraCost: productsTable.extraCost,
        stockQuantity: productsTable.stockQuantity,
        reorderLevel: productsTable.reorderLevel,
        unit: productsTable.unit,
        imageUrl: productsTable.imageUrl,
        categoryId: productsTable.categoryId,
        categoryName: categoriesTable.name,
        inStock: productsTable.inStock,
        featured: productsTable.featured,
        createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id));

    const products = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to get products" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [product] = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        sku: productsTable.sku,
        price: productsTable.price,
        buyingPrice: productsTable.buyingPrice,
        transportationCost: productsTable.transportationCost,
        extraCost: productsTable.extraCost,
        stockQuantity: productsTable.stockQuantity,
        reorderLevel: productsTable.reorderLevel,
        unit: productsTable.unit,
        imageUrl: productsTable.imageUrl,
        categoryId: productsTable.categoryId,
        categoryName: categoriesTable.name,
        inStock: productsTable.inStock,
        featured: productsTable.featured,
        createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(eq(productsTable.id, id));

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Failed to get product" });
  }
});

export default router;
