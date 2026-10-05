const { prisma: defaultPrisma } = require('../config/db');
const { convertUnit } = require('../utils/unitConverter');
const { emitToAdmin, emitToVendor } = require('../sockets/socket');

/**
 * Deducts inventory for a confirmed order (status: PAID).
 * Executes stock deductions using recipe mappings or name fallback,
 * creates atomic USAGE InventoryLogs, and updates MenuItem stock.
 * 
 * @param {number} orderId Order ID to deduct stock for
 * @param {number|null} userId Staff/System User ID triggering deduction
 * @param {object} [tx] Optional Prisma Transaction Client
 */
const deductInventoryForConfirmedOrder = async (orderId, userId = null, tx = null) => {
  const db = tx || defaultPrisma;

  const order = await db.order.findUnique({
    where: { id: parseInt(orderId, 10) },
    include: {
      orderItems: {
        include: {
          menuItem: {
            include: {
              recipeItems: {
                include: {
                  inventoryItem: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!order) {
    throw new Error(`Order #${orderId} not found for inventory deduction.`);
  }

  // Idempotency check: if USAGE logs already exist for this orderId, skip double deduction
  const existingUsageLogs = await db.inventoryLog.findMany({
    where: {
      orderId: order.id,
      type: 'USAGE'
    }
  });

  if (existingUsageLogs.length > 0) {
    console.log(`[InventoryDeduction] Order #${order.orderNumber} already has USAGE logs. Skipping redundant deduction.`);
    return { success: true, message: 'Already deducted.' };
  }

  const itemsToEmit = [];

  for (const orderItem of order.orderItems) {
    const menuItem = orderItem.menuItem;
    const itemQty = orderItem.quantity;

    // Deduct MenuItem front-end display stock
    if (menuItem) {
      const updatedMenuItemStock = Math.max(0, menuItem.stock - itemQty);
      await db.menuItem.update({
        where: { id: menuItem.id },
        data: { stock: updatedMenuItemStock }
      });
    }

    // Check if menuItem has explicit RecipeItems mapped
    const recipes = menuItem?.recipeItems || [];

    if (recipes.length > 0) {
      for (const recipe of recipes) {
        const invItem = recipe.inventoryItem;
        if (!invItem) continue;

        // Branch consistency check
        if (order.branchId && invItem.branchId && invItem.branchId !== order.branchId) {
          console.warn(`[InventoryDeduction] Branch mismatch: Order branch ${order.branchId} vs Inventory branch ${invItem.branchId} for ${invItem.name}`);
        }

        const rawNeededQty = recipe.quantity * itemQty;
        const convertedQty = convertUnit(rawNeededQty, recipe.unit, invItem.unit);

        const qtyBefore = invItem.stockLevel;
        const qtyAfter = Math.max(0, qtyBefore - convertedQty);

        // Update InventoryItem stockLevel
        const updatedInv = await db.inventoryItem.update({
          where: { id: invItem.id },
          data: { stockLevel: qtyAfter }
        });

        // Record atomic USAGE InventoryLog
        await db.inventoryLog.create({
          data: {
            inventoryItemId: invItem.id,
            quantityBefore: qtyBefore,
            quantityAfter: qtyAfter,
            changeQty: -convertedQty,
            type: 'USAGE',
            reason: `Order #${order.orderNumber} confirmed (${orderItem.nameSnapshot} x${itemQty})`,
            orderId: order.id,
            orderItemId: orderItem.id,
            userId: userId || order.userId || null
          }
        });

        itemsToEmit.push(updatedInv);
      }
    } else {
      console.log(`[InventoryDeduction] No recipe items configured for "${orderItem.nameSnapshot}". Skipping raw ingredient deduction.`);
    }
  }

  // Emit socket events asynchronously after DB operations complete
  setImmediate(() => {
    for (const item of itemsToEmit) {
      emitToAdmin('inventory:update', item);
      emitToVendor('inventory:update', item);
    }
  });

  return { success: true, message: `Inventory deducted for Order #${order.orderNumber}` };
};

/**
 * Restores inventory for a cancelled or refunded order.
 * Ensures strict idempotency at (orderId, orderItemId, inventoryItemId) level.
 * 
 * @param {number} orderId Order ID to restore stock for
 * @param {number|null} userId Staff/System User ID triggering restoration
 * @param {string} reason Reason for restoration
 * @param {object} [tx] Optional Prisma Transaction Client
 */
const restoreInventoryForOrder = async (orderId, userId = null, reason = 'Order cancelled', tx = null) => {
  const db = tx || defaultPrisma;

  const order = await db.order.findUnique({
    where: { id: parseInt(orderId, 10) },
    include: {
      orderItems: {
        include: {
          menuItem: true
        }
      }
    }
  });

  if (!order) {
    throw new Error(`Order #${orderId} not found for inventory restoration.`);
  }

  // Find all USAGE logs generated for this order
  const usageLogs = await db.inventoryLog.findMany({
    where: {
      orderId: order.id,
      type: 'USAGE'
    }
  });

  // Find any existing RESTORATION logs for this order to guarantee idempotency
  const existingRestorations = await db.inventoryLog.findMany({
    where: {
      orderId: order.id,
      type: 'RESTORATION'
    }
  });

  // Restore MenuItem stock if not already restored
  for (const orderItem of order.orderItems) {
    if (orderItem.menuItem) {
      await db.menuItem.update({
        where: { id: orderItem.menuItemId },
        data: { stock: { increment: orderItem.quantity } }
      });
    }
  }

  const itemsToEmit = [];

  // Restore raw inventory stock based on USAGE logs
  for (const usageLog of usageLogs) {
    // Check if this exact usage log has already been restored
    const alreadyRestored = existingRestorations.some(
      r => r.orderItemId === usageLog.orderItemId && r.inventoryItemId === usageLog.inventoryItemId
    );

    if (alreadyRestored) {
      console.log(`[InventoryRestoration] Usage log ID ${usageLog.id} already restored for Order #${order.orderNumber}. Skipping.`);
      continue;
    }

    const invItem = await db.inventoryItem.findUnique({
      where: { id: usageLog.inventoryItemId }
    });

    if (invItem) {
      const restoreQty = Math.abs(usageLog.changeQty);
      const qtyBefore = invItem.stockLevel;
      const qtyAfter = qtyBefore + restoreQty;

      const updatedInv = await db.inventoryItem.update({
        where: { id: invItem.id },
        data: { stockLevel: qtyAfter }
      });

      await db.inventoryLog.create({
        data: {
          inventoryItemId: invItem.id,
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
          changeQty: restoreQty,
          type: 'RESTORATION',
          reason: `${reason} - Order #${order.orderNumber}`,
          orderId: order.id,
          orderItemId: usageLog.orderItemId,
          userId: userId || null
        }
      });

      itemsToEmit.push(updatedInv);
    }
  }

  setImmediate(() => {
    for (const item of itemsToEmit) {
      emitToAdmin('inventory:update', item);
      emitToVendor('inventory:update', item);
    }
  });

  return { success: true, message: `Inventory restored for Order #${order.orderNumber}` };
};

module.exports = {
  deductInventoryForConfirmedOrder,
  restoreInventoryForOrder
};
