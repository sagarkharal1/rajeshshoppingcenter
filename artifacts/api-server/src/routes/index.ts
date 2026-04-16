import { Router } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import ordersRouter from "./orders";
import settingsRouter from "./settings";
import adminRouter from "./admin";
import storageRouter from "./storage";
import businessRouter from "./business";

const router = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(settingsRouter);
router.use(adminRouter);
router.use(businessRouter);
router.use(storageRouter);

export default router;
