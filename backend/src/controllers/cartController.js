const { prisma } = require('../config/db');

/**
 * Helper to ensure a cart exists for a session
 */
const getOrCreateCart = async (sessionId) => {
  let cart = await prisma.cart.findUnique({
    where: { sessionId },
    include: {
      items: {
        include: { menuItem: true },
      },
    },
  });

  if (!cart) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new Error('Invalid dining session.');
    }
    cart = await prisma.cart.create({
      data: { sessionId },
      include: {
        items: {
          include: { menuItem: true },
        },
      },
    });
  }

  return cart;
};

/**
 * Get current session cart with up-to-date pricing and calculations
 */
const getCart = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const cart = await getOrCreateCart(sessionId);

    // Calculate totals and check stock freshness
    let subtotal = 0.0;
    const items = cart.items.map((item) => {
      const itemPrice = item.menuItem?.price ?? item.price;
      const itemSubtotal = itemPrice * item.quantity;
      subtotal += itemSubtotal;

      return {
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.menuItem?.name || 'Unknown Item',
        description: item.menuItem?.description,
        price: itemPrice,
        quantity: item.quantity,
        subtotal: itemSubtotal,
        category: item.menuItem?.category,
        imageUrl: item.menuItem?.imageUrl,
        stock: item.menuItem?.stock ?? 0,
        isActive: item.menuItem?.isActive ?? true,
        prepTime: item.menuItem?.prepTime ?? 5,
      };
    });

    const tax = 0.0; // Can be adjusted if tax config is enabled
    const total = subtotal + tax;

    return res.json({
      cart: {
        id: cart.id,
        sessionId: cart.sessionId,
        items,
        subtotal,
        tax,
        total,
        itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
        updatedAt: cart.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get cart error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch cart.' });
  }
};

/**
 * Add an item to the session cart or increment quantity
 */
const addItemToCart = async (req, res) => {
  const { sessionId } = req.params;
  const { menuItemId, quantity = 1 } = req.body;

  if (!menuItemId) {
    return res.status(400).json({ error: 'menuItemId is required.' });
  }

  try {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: parseInt(menuItemId, 10) },
    });

    if (!menuItem || !menuItem.isActive) {
      return res.status(404).json({ error: 'Menu item is unavailable or deactivated.' });
    }

    if (menuItem.stock < quantity) {
      return res.status(400).json({ error: `Only ${menuItem.stock} units available in stock.` });
    }

    const cart = await getOrCreateCart(sessionId);

    // Check if item already exists in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        menuItemId: menuItem.id,
      },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + parseInt(quantity, 10);
      if (menuItem.stock < newQuantity) {
        return res.status(400).json({ error: `Cannot add more. Stock limit is ${menuItem.stock}.` });
      }

      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          price: menuItem.price,
        },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          menuItemId: menuItem.id,
          quantity: parseInt(quantity, 10),
          price: menuItem.price,
        },
      });
    }

    // Touch cart updated timestamp
    await prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    return getCart(req, res);
  } catch (error) {
    console.error('Add item to cart error:', error);
    return res.status(500).json({ error: error.message || 'Failed to add item to cart.' });
  }
};

/**
 * Update quantity of a specific cart item
 */
const updateCartItem = async (req, res) => {
  const { sessionId, itemId } = req.params;
  const { quantity } = req.body;

  try {
    const cart = await getOrCreateCart(sessionId);
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: parseInt(itemId, 10),
        cartId: cart.id,
      },
      include: { menuItem: true },
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    const newQty = parseInt(quantity, 10);
    if (newQty <= 0) {
      await prisma.cartItem.delete({ where: { id: cartItem.id } });
    } else {
      if (cartItem.menuItem && cartItem.menuItem.stock < newQty) {
        return res.status(400).json({ error: `Stock limit exceeded. Only ${cartItem.menuItem.stock} available.` });
      }

      await prisma.cartItem.update({
        where: { id: cartItem.id },
        data: {
          quantity: newQty,
          price: cartItem.menuItem?.price ?? cartItem.price,
        },
      });
    }

    await prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    return getCart(req, res);
  } catch (error) {
    console.error('Update cart item error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update cart item.' });
  }
};

/**
 * Remove an item from the cart
 */
const removeCartItem = async (req, res) => {
  const { sessionId, itemId } = req.params;

  try {
    const cart = await getOrCreateCart(sessionId);
    await prisma.cartItem.deleteMany({
      where: {
        id: parseInt(itemId, 10),
        cartId: cart.id,
      },
    });

    await prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    return getCart(req, res);
  } catch (error) {
    console.error('Remove cart item error:', error);
    return res.status(500).json({ error: error.message || 'Failed to remove cart item.' });
  }
};

/**
 * Clear the entire cart for a session
 */
const clearCart = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const cart = await getOrCreateCart(sessionId);
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    return res.json({ message: 'Cart cleared successfully.', items: [], total: 0 });
  } catch (error) {
    console.error('Clear cart error:', error);
    return res.status(500).json({ error: error.message || 'Failed to clear cart.' });
  }
};

module.exports = {
  getCart,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};
