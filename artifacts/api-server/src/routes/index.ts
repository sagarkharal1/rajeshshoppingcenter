import { Router } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import ordersRouter from "./orders";
import settingsRouter from "./settings";
import adminRouter from "./admin";
import businessRouter from "./business";
import searchRouter from "./search";
import customersRouter from "./customers";
import cronRouter from "./cron";

const router = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(settingsRouter);
router.use(adminRouter);
router.use(businessRouter);
router.use(cronRouter);
router.use("/search", searchRouter);
router.use("/customers", customersRouter);

export default router;
