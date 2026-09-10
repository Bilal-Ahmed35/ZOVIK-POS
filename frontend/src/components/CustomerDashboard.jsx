import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setActiveAuthTokens } from '../services/api';
import { getSocket } from '../services/socket';
import {
  ShoppingBag,
  Sparkles,
  Search,
  ShoppingCart as CartIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  ArrowRight,
  Star,
  Mail,
  User,
  KeyRound,
  ShieldCheck,
  Flame,
  Plus,
  Minus,
} from 'lucide-react';
import FAQModal from './FAQModal';

// Helper to extract clean table display name from token or text
export const parseTableDisplay = (tokenOrName) => {
  if (!tokenOrName) return 'Dining Table';
  try {
    let clean = String(tokenOrName).trim();
    if (clean.includes('%')) clean = decodeURIComponent(clean);

    // Check for signed token format: tbl:tableNumber:branchId:nonce:signature
    const parts = clean.split(':');
    if (parts.length >= 2 && parts[0] === 'tbl') {
      const tblNum = parts[1];
      if (tblNum) {
        return tblNum.toLowerCase().startsWith('table') ? tblNum : `Table ${tblNum}`;
      }
    }

    // Check if it already starts with "Table"
    if (clean.toLowerCase().startsWith('table')) {
      const suffix = clean.slice(5).trim();
      const digitsOnly = suffix.replace(/[^0-9]/g, '');
      if (digitsOnly && digitsOnly.length > 4) {
        return 'Dining Table';
      }
      return clean;
    }

    // Check if it's a short numeric table number (1 to 4 digits, e.g. "14", "7")
    const num = clean.replace(/[^0-9]/g, '');
    if (num && num.length > 0 && num.length <= 4) {
      return `Table ${num}`;
    }

    return 'Dining Table';
  } catch {
    return 'Dining Table';
  }
};

const CustomerDashboard = ({ user, onLogout, tableIdFromRoute }) => {
  const navigate = useNavigate();

  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('customer_cart');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [tableId, setTableId] = useState(() => {
    const saved = localStorage.getItem('customer_tableId');
    if (saved) return parseTableDisplay(saved);
    if (tableIdFromRoute) return parseTableDisplay(tableIdFromRoute);
    return 'Dining Table';
  });
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('customer_sessionId') || '');
  const [tableError, setTableError] = useState('');
  const [category, setCategory] = useState(() => localStorage.getItem('customer_category') || 'All');
  const [activeOrders, setActiveOrders] = useState([]);
  const [failedOrders, setFailedOrders] = useState([]);
  const activeOrder = activeOrders[0] || null;
  const [transferSuccessMessage, setTransferSuccessMessage] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFAQ, setShowFAQ] = useState(false);
  const [error, setError] = useState('');

  // ─── Variant / Quantity Selection State ───────────────────────────────────
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [pendingVariant, setPendingVariant] = useState({});
  const [pendingQty, setPendingQty] = useState({});

  // ─── Session OTP Verification State ──────────────────────────────────────
  const [isSessionVerified, setIsSessionVerified] = useState(() => {
    const savedUser = sessionStorage.getItem('user') || localStorage.getItem('customer_user');
    const savedToken = sessionStorage.getItem('token') || localStorage.getItem('customer_token');
    const savedSession = localStorage.getItem('customer_sessionId');
    const verifiedSessionId = localStorage.getItem('customer_verifiedSessionId');
    return Boolean(savedUser && savedToken && savedSession && verifiedSessionId === savedSession);
  });

  const [authName, setAuthName] = useState(() => {
    const saved = sessionStorage.getItem('user') || localStorage.getItem('customer_user');
    if (saved) {
      try { return JSON.parse(saved).name || ''; } catch {}
    }
    return '';
  });
  const [authEmail, setAuthEmail] = useState(() => {
    const saved = sessionStorage.getItem('user') || localStorage.getItem('customer_user');
    if (saved) {
      try { return JSON.parse(saved).email || ''; } catch {}
    }
    return '';
  });
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Table Switching Modal State
  const [showTableSwitchModal, setShowTableSwitchModal] = useState(false);
  const [pendingTableToken, setPendingTableToken] = useState(null);
  const [pendingTableNumber, setPendingTableNumber] = useState('');
  // Snapshot of the OLD table name so modal always shows correct "from" table
  const [currentTableSnapshot, setCurrentTableSnapshot] = useState('');

  // Change Delivery Table (post-order) state
  const [availableTables, setAvailableTables] = useState([]);
  const [deliveryChangeOrderId, setDeliveryChangeOrderId] = useState(null);
  const [deliveryChangePicking, setDeliveryChangePicking] = useState(false);
  const [deliveryChangeTarget, setDeliveryChangeTarget] = useState('');
  const [deliveryChangeLoading, setDeliveryChangeLoading] = useState(false);

  // Scan time calculation for header
  const [scanTime] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  const [guestName] = useState(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (!u.isGuest) return u.name;
      } catch {}
    }
    return '';
  });

  // Cooldown timer effect
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // ─── Initialize Dining Session from QR Token or Table ID ─────────────────
  useEffect(() => {
    const initSession = async () => {
      const storedSession = localStorage.getItem('customer_sessionId');
      const storedToken = localStorage.getItem('customer_tableToken');
      const storedTable = localStorage.getItem('customer_tableId');

      if (tableIdFromRoute) {
        let cleanRouteToken = String(tableIdFromRoute).trim();
        if (cleanRouteToken.includes('%')) {
          try {
            cleanRouteToken = decodeURIComponent(cleanRouteToken);
          } catch {}
        }

        const newTableDisplay = parseTableDisplay(cleanRouteToken);

        // Check if user has an active session on a DIFFERENT table
        const isDifferentTable = Boolean(
          storedSession && (
            (storedToken && storedToken !== cleanRouteToken && storedToken !== tableIdFromRoute) ||
            (storedTable && storedTable !== newTableDisplay && storedToken && storedToken !== cleanRouteToken)
          )
        );

        if (isDifferentTable) {
          // Await active orders and cart BEFORE showing modal so the correct card opens instantly without flickering
          if (storedSession) {
            await checkForExistingOrder(storedSession);
            await fetchServerCart(storedSession);
          }
          // Snapshot current table BEFORE we trigger the modal so it shows correctly
          const oldTable = storedTable ? parseTableDisplay(storedTable) : (tableId || 'your table');
          setCurrentTableSnapshot(oldTable);
          setPendingTableToken(cleanRouteToken);
          setPendingTableNumber(newTableDisplay);
          setShowTableSwitchModal(true);
          return;
        }

        // Normal flow or same table: start or refresh session with complete signed token
        try {
          const res = await api.post('/sessions/start', {
            qrToken: cleanRouteToken,
          });

          if (res.data.session) {
            const s = res.data.session;
            setSessionId(s.id);
            localStorage.setItem('customer_sessionId', s.id);
            const tName = s.table?.tableNumber || `Table ${s.table?.id}`;
            setTableId(tName);
            localStorage.setItem('customer_tableId', tName);
            localStorage.setItem('customer_tableToken', cleanRouteToken);
            setTableError('');

            const verifiedSessionId = localStorage.getItem('customer_verifiedSessionId');
            if (s.customerId && verifiedSessionId === s.id) {
              setIsSessionVerified(true);
            } else if (!s.customerId) {
              setIsSessionVerified(false);
            }

            fetchServerCart(s.id);
            checkForExistingOrder(s.id);
          }
        } catch (err) {
          console.warn('Session start error:', err.response?.data?.error || err.message);
          if (err.response?.status === 403) {
            setTableError(err.response.data.error || 'This dining table is currently disabled.');
          } else if (err.response?.status === 404 || err.response?.status === 400) {
            setTableError('Invalid or unverified table QR code. Please scan the QR code at your table.');
          }
        }
      } else {
        // Fallback when no route param is provided
        const startFreshDefaultSession = async () => {
          try {
            const res = await api.post('/sessions/start', {
              tableNumber: storedTable || 'Table 1',
            });
            if (res.data.session) {
              const s = res.data.session;
              setSessionId(s.id);
              localStorage.setItem('customer_sessionId', s.id);
              const tName = s.table?.tableNumber || `Table ${s.table?.id}`;
              setTableId(tName);
              localStorage.setItem('customer_tableId', tName);
              setIsSessionVerified(false);
              fetchServerCart(s.id);
              checkForExistingOrder(s.id);
            }
          } catch (err) {
            console.warn('Default session start fallback:', err.message);
          }
        };

        if (!storedSession) {
          await startFreshDefaultSession();
        } else {
          try {
            const checkRes = await api.get(`/sessions/${storedSession}`);
            if (checkRes.data.session && checkRes.data.session.status === 'ACTIVE') {
              fetchServerCart(storedSession);
              checkForExistingOrder(storedSession);
            } else {
              console.warn('Stored session is inactive/expired. Initializing fresh session.');
              await startFreshDefaultSession();
            }
          } catch {
            console.warn('Stored session not found in DB. Initializing fresh session.');
            await startFreshDefaultSession();
          }
        }
      }
    };

    initSession();
  }, [tableIdFromRoute]);

  const handleTransferTableAndOrders = async () => {
    const curSessionId = sessionId || localStorage.getItem('customer_sessionId');
    if (!curSessionId || !pendingTableToken) return;
    setTransferLoading(true);
    try {
      const res = await api.post('/sessions/transfer-table', {
        sessionId: curSessionId,
        qrToken: pendingTableToken,
        targetTableNumber: pendingTableNumber,
      });

      if (res.data) {
        const newTableDisplay = res.data.newTable || pendingTableNumber;
        // Update local state and storage with the new table info
        setTableId(newTableDisplay);
        localStorage.setItem('customer_tableId', newTableDisplay);
        localStorage.setItem('customer_tableToken', pendingTableToken);

        // If there were active orders, update them; otherwise just refresh order list
        if (res.data.orders && res.data.orders.length > 0) {
          setActiveOrders(res.data.orders);
        } else {
          checkForExistingOrder(curSessionId);
        }

        // Re-sync cart from server to reflect updated session table context
        fetchServerCart(curSessionId);

        setShowTableSwitchModal(false);
        setPendingTableToken(null);
        setPendingTableNumber('');
        setCurrentTableSnapshot('');
        const hasOrders = activeOrders.length > 0;
        const hasCart = totalCartQuantity > 0;
        const msg = hasOrders
          ? `Orders successfully shifted to ${newTableDisplay}! Kitchen and staff notified.`
          : hasCart
          ? `Your cart has been moved to ${newTableDisplay}. Continue ordering!`
          : `Session moved to ${newTableDisplay}. Welcome!`;
        setTransferSuccessMessage(msg);
        setTimeout(() => setTransferSuccessMessage(''), 6000);
        navigate('/customer', { replace: true });
      }
    } catch (err) {
      console.error('Transfer table error:', err);
      setTableError(err.response?.data?.error || 'Failed to transfer table.');
      setShowTableSwitchModal(false);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleConfirmTableSwitch = async () => {
    setShowTableSwitchModal(false);
    if (!pendingTableToken) return;

    try {
      const res = await api.post('/sessions/start', {
        qrToken: pendingTableToken,
      });

      if (res.data.session) {
        const s = res.data.session;
        const newSessionId = s.id;
        const newTableDisplay = s.table?.tableNumber || `Table ${s.table?.id}`;

        setSessionId(newSessionId);
        setTableId(newTableDisplay);
        localStorage.setItem('customer_sessionId', newSessionId);
        localStorage.setItem('customer_tableId', newTableDisplay);
        localStorage.setItem('customer_tableToken', pendingTableToken);
        localStorage.removeItem('customer_verifiedSessionId');

        setIsSessionVerified(false);
        setOtpSent(false);
        setOtpCode('');

        setCart({});
        localStorage.removeItem('customer_cart');
        setTableError('');
        setPendingTableToken(null);
        setPendingTableNumber('');
        setCurrentTableSnapshot('');

        fetchServerCart(newSessionId);
        checkForExistingOrder(newSessionId);
        navigate('/customer', { replace: true });
      }
    } catch (err) {
      console.error('Table switch confirmation error:', err);
      setTableError(err.response?.data?.error || 'Failed to switch dining table.');
    }
  };

  const handleCancelTableSwitch = () => {
    setShowTableSwitchModal(false);
    setPendingTableToken(null);
    setPendingTableNumber('');
    setCurrentTableSnapshot('');
    const storedTable = localStorage.getItem('customer_tableId');
    if (storedTable) {
      setTableId(parseTableDisplay(storedTable));
    }
    navigate('/customer', { replace: true });
  };

  // Change delivery table for a specific already-placed order (no QR scan needed)
  const handleDeliveryTableChange = async (orderId, newTableNumber) => {
    if (!newTableNumber || !orderId) return;
    setDeliveryChangeLoading(true);
    try {
      const res = await api.put(`/orders/${orderId}/transfer-table`, {
        targetTableNumber: newTableNumber,
      });
      if (res.data?.order) {
        setActiveOrders(prev =>
          prev.map(o => o.id === orderId ? { ...o, tableNumber: newTableNumber } : o)
        );
        setTransferSuccessMessage(`🍽️ Order delivery rerouted to ${newTableNumber}! Kitchen & cashier notified.`);
        setTimeout(() => setTransferSuccessMessage(''), 6000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change delivery table.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setDeliveryChangeLoading(false);
      setDeliveryChangeOrderId(null);
      setDeliveryChangePicking(false);
      setDeliveryChangeTarget('');
    }
  };

  const fetchServerCart = async (sId) => {
    if (!sId) return;
    try {
      const res = await api.get(`/cart/${sId}`);
      if (res.data.cart?.items) {
        const mapped = {};
        res.data.cart.items.forEach((i) => {
          mapped[i.menuItemId] = {
            id: i.menuItemId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            description: i.description,
            category: i.category,
            stock: i.stock,
            imageUrl: i.imageUrl || i.menuItem?.imageUrl,
          };
        });
        setCart(mapped);
      }
    } catch (e) {
      console.warn('Could not sync server cart:', e.message);
    }
  };

  // ─── OTP Handlers ────────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!authEmail) {
      setOtpError('Please enter your email address.');
      return;
    }
    setOtpError('');
    setOtpSuccess('');
    setOtpLoading(true);

    try {
      const curSessionId = sessionId || localStorage.getItem('customer_sessionId');
      const res = await api.post('/auth/send-otp', {
        email: authEmail.trim(),
        name: authName.trim() || 'Guest Customer',
        sessionId: curSessionId || undefined,
      });

      if (res.data.success) {
        setOtpSent(true);
        setOtpSuccess('Verification code sent to your email. Check inbox.');
        setCooldown(30);
      }
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Failed to send OTP code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    if (!otpCode || otpCode.trim().length < 4) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }
    setOtpError('');
    setOtpSuccess('');
    setOtpLoading(true);

    try {
      const curSessionId = sessionId || localStorage.getItem('customer_sessionId');
      const res = await api.post('/auth/verify-otp', {
        email: authEmail.trim(),
        name: authName.trim() || 'Guest Customer',
        otp: otpCode.trim(),
        sessionId: curSessionId || undefined,
      });

      if (res.data.success) {
        const { user: verifiedUser, accessToken, refreshToken } = res.data;
        setActiveAuthTokens(accessToken, refreshToken);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('user', JSON.stringify(verifiedUser));
        }
        localStorage.setItem('customer_user', JSON.stringify(verifiedUser));
        localStorage.setItem('user', JSON.stringify(verifiedUser));
        if (curSessionId) {
          localStorage.setItem('customer_verifiedSessionId', curSessionId);
        }

        setIsSessionVerified(true);
        setOtpError('');
        setOtpSuccess('Verified successfully! Loading menu...');
        fetchServerCart(curSessionId);
        checkForExistingOrder(curSessionId);
      }
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Invalid or expired verification code.');
    } finally {
      setOtpLoading(false);
    }
  };

  // ─── Image helper ─────────────────────────────────────────────────────────
  const getItemImage = (item) => {
    if (item?.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.trim() !== '') {
      const url = item.imageUrl.trim();
      if (url.startsWith('/uploads/')) {
        return `http://localhost:5001${url}`;
      }
      return url;
    }
    const name = (item?.name || '').toLowerCase();
    const cat = (item?.category || '').toLowerCase();
    if (name.includes('biryani') || name.includes('rice') || name.includes('pulao'))
      return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=700&auto=format&fit=crop&q=80';
    if (name.includes('burger') || name.includes('zinger') || name.includes('patty'))
      return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=700&auto=format&fit=crop&q=80';
    if (name.includes('pizza') || name.includes('calzone'))
      return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=700&auto=format&fit=crop&q=80';
    if (name.includes('sandwich') || name.includes('club'))
      return 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=700&auto=format&fit=crop&q=80';
    if (name.includes('fries') || name.includes('chips'))
      return 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=700&auto=format&fit=crop&q=80';
    if (name.includes('cake') || name.includes('brownie') || name.includes('chocolate') || name.includes('dessert'))
      return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=700&auto=format&fit=crop&q=80';
    if (name.includes('tea') || name.includes('chai') || name.includes('coffee') || name.includes('coke') || name.includes('drink') || cat.includes('beverage'))
      return 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=700&auto=format&fit=crop&q=80';
    if (name.includes('naan') || name.includes('bread') || name.includes('roti') || name.includes('paratha') || name.includes('chapati'))
      return 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=700&auto=format&fit=crop&q=80';
    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&auto=format&fit=crop&q=80';
  };

  const [checkoutStep, setCheckoutStep] = useState(
    () => localStorage.getItem('customer_checkoutStep') || 'menu'
  );

  useEffect(() => { localStorage.setItem('customer_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('customer_tableId', tableId); }, [tableId]);
  useEffect(() => { localStorage.setItem('customer_category', category); }, [category]);
  useEffect(() => { localStorage.setItem('customer_checkoutStep', checkoutStep); }, [checkoutStep]);

  // Fetch available active tables for delivery change picker
  useEffect(() => {
    api.get('/tables/active').then(r => {
      if (r.data?.tables) setAvailableTables(r.data.tables);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchMenu();
    const curSessionId = sessionId || localStorage.getItem('customer_sessionId');
    if (curSessionId) {
      checkForExistingOrder(curSessionId);
    }

    const socket = getSocket();
    if (socket) {
      const ACTIVE_ORDER_STATUSES = ['PENDING', 'PAYMENT_PENDING', 'PAID', 'PREPARING', 'READY'];

      const handleOrderUpdate = (updatedOrder) => {
        setActiveOrders((prev) => {
          if (!ACTIVE_ORDER_STATUSES.includes(updatedOrder.status)) {
            return prev.filter((o) => o.id !== updatedOrder.id);
          }
          const exists = prev.some((o) => o.id === updatedOrder.id);
          if (exists) {
            return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
          }
          const activeSId = sessionId || localStorage.getItem('customer_sessionId');
          if (updatedOrder.sessionId === activeSId) {
            return [updatedOrder, ...prev];
          }
          return prev;
        });

        if (updatedOrder.status === 'PAYMENT_FAILED') {
          const dismissedIds = JSON.parse(localStorage.getItem('customer_dismissed_failed') || '[]');
          if (!dismissedIds.includes(updatedOrder.id)) {
            setFailedOrders((prev) => {
              const exists = prev.some((o) => o.id === updatedOrder.id);
              return exists ? prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)) : [updatedOrder, ...prev];
            });
          }
        } else {
          setFailedOrders((prev) => prev.filter((o) => o.id !== updatedOrder.id));
        }
      };

      const handleTableShift = (data) => {
        console.log('⚡ Table shift socket event received:', data);
        const curSessionId = sessionId || localStorage.getItem('customer_sessionId');
        if (curSessionId) checkForExistingOrder(curSessionId);
      };

      const handleMenuUpdate = (payload) => {
        console.log('⚡ Real-time menu update received on Customer Dashboard:', payload);
        fetchMenu();
      };

      socket.on('order:update', handleOrderUpdate);
      socket.on('table:shift', handleTableShift);
      socket.on('menu:update', handleMenuUpdate);
      socket.on('inventory:update', handleMenuUpdate);
      socket.on('connect', handleMenuUpdate);

      return () => {
        socket.off('order:update', handleOrderUpdate);
        socket.off('table:shift', handleTableShift);
        socket.off('menu:update', handleMenuUpdate);
        socket.off('inventory:update', handleMenuUpdate);
        socket.off('connect', handleMenuUpdate);
      };
    }
  }, [sessionId]);

  const fetchMenu = async () => {
    try {
      const response = await api.get('/menu');
      const items = response.data.items || [];
      setMenu(items);
    } catch (err) {
      console.error('Fetch menu failed:', err);
    }
  };

  const checkForExistingOrder = async (sId) => {
    const curSessionId = sId || sessionId || localStorage.getItem('customer_sessionId');
    if (!curSessionId) {
      setActiveOrders([]);
      setFailedOrders([]);
      return;
    }
    try {
      const response = await api.get(`/orders?sessionId=${curSessionId}`);
      const orders = response.data.orders || [];
      const ACTIVE_ORDER_STATUSES = ['PENDING', 'PAYMENT_PENDING', 'PAID', 'PREPARING', 'READY'];
      const unfinished = orders.filter((o) =>
        ACTIVE_ORDER_STATUSES.includes(o.status)
      );
      const dismissedIds = JSON.parse(localStorage.getItem('customer_dismissed_failed') || '[]');
      const failed = orders.filter(
        (o) => o.status === 'PAYMENT_FAILED' && !dismissedIds.includes(o.id)
      );
      setActiveOrders(unfinished);
      setFailedOrders(failed);
    } catch (err) {
      console.error('Check orders failed:', err);
    }
  };

  const handleDismissFailedOrders = async () => {
    const dismissedIds = JSON.parse(localStorage.getItem('customer_dismissed_failed') || '[]');
    for (const fo of failedOrders) {
      if (!dismissedIds.includes(fo.id)) dismissedIds.push(fo.id);
      api.put(`/orders/${fo.id}/status`, { status: 'CANCELLED', note: 'Customer dismissed failed payment' }).catch(() => {});
    }
    localStorage.setItem('customer_dismissed_failed', JSON.stringify(dismissedIds));
    setFailedOrders([]);
  };

  // ─── Cart handlers (syncs with backend session cart) ──────────────────────
  const addToCart = async (item) => {
    setCart((prev) => ({
      ...prev,
      [item.id]: { ...item, quantity: (prev[item.id]?.quantity || 0) + 1 },
    }));

    if (sessionId) {
      try {
        await api.post(`/cart/${sessionId}/items`, {
          menuItemId: item.id,
          quantity: (cart[item.id]?.quantity || 0) + 1,
        });
      } catch (err) {
        console.warn('Backend cart add warning:', err.message);
      }
    }
  };

  const removeFromCart = async (itemId) => {
    const currentQty = cart[itemId]?.quantity || 0;
    if (currentQty <= 1) {
      const updated = { ...cart };
      delete updated[itemId];
      setCart(updated);
      if (sessionId) {
        try {
          await api.delete(`/cart/${sessionId}/items/${itemId}`);
        } catch (err) {
          console.warn('Backend cart remove warning:', err.message);
        }
      }
    } else {
      setCart((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], quantity: currentQty - 1 },
      }));
      if (sessionId) {
        try {
          await api.post(`/cart/${sessionId}/items`, {
            menuItemId: itemId,
            quantity: currentQty - 1,
          });
        } catch (err) {
          console.warn('Backend cart decrement warning:', err.message);
        }
      }
    }
  };

  // Add a specific variant with a chosen quantity to cart
  const handleAddWithVariantAndQty = async (item, qty, groupKey) => {
    const existingQty = cart[item.id]?.quantity || 0;
    const newQty = existingQty + qty;
    setCart((prev) => ({
      ...prev,
      [item.id]: { ...item, quantity: newQty },
    }));
    if (sessionId) {
      try {
        await api.post(`/cart/${sessionId}/items`, {
          menuItemId: item.id,
          quantity: newQty,
        });
      } catch (err) {
        console.warn('Backend cart add warning:', err.message);
      }
    }
    setExpandedGroup(null);
    setPendingQty((prev) => ({ ...prev, [groupKey]: 1 }));
  };

  const totalCartQuantity = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  const totalCartPrice = Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Default Categories List
  const defaultCategories = ['All', 'Lunch', 'Breakfast', 'Fast Food', 'Refreshment'];
  const dynamicCategories = Array.from(new Set(menu.map((i) => i.category).filter(Boolean)));
  const combinedCategories = Array.from(new Set([...defaultCategories, ...dynamicCategories]));

  // Filtering
  const filteredMenu = menu.filter((item) => {
    const matchesCategory = category === 'All' || item.category === category;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Group items by groupName or name so multi-portion dishes (like Biryani 250g/500g) render as 1 card
  const filteredGrouped = useMemo(() => {
    const groups = {};
    filteredMenu.forEach((item) => {
      const key = item.groupName || item.name;
      if (!groups[key]) groups[key] = { groupKey: key, variants: [] };
      groups[key].variants.push(item);
    });
    return Object.values(groups);
  }, [filteredMenu]);

  const heroFoodImage = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80';

  return (
    <div className="min-h-screen bg-[#F7F8FC] text-[#171923] flex flex-col font-sans selection:bg-[#5B45F5]/20">
      {/* ── Top Application Header ─────────────────────────────────────────────── */}
      <header className="bg-white/90 backdrop-blur-md border-b border-[#E7E8EF] px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center z-30 sticky top-0 shadow-sm transition-all">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#5B45F5] to-[#7C3AED] flex items-center justify-center text-white text-lg font-black shadow-md shadow-[#5B45F5]/20">
              🍽️
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-[#171923] font-display">
                  SWIPEBITE
                </h2>
                <span className="text-[11px] bg-[#5B45F5]/10 text-[#5B45F5] border border-[#5B45F5]/20 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                  {tableId}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-[#6B7280] font-medium">
                <span>Scan Time: {scanTime}</span>
                <span>•</span>
                <span>Welcome, {authName || guestName || 'Customer'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={() => setShowFAQ(true)}
            className="p-2 sm:px-3 sm:py-2 text-xs font-bold text-[#6B7280] hover:text-[#5B45F5] hover:bg-[#5B45F5]/5 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
            title="Help & FAQ"
          >
            <HelpCircle className="w-4 h-4 text-[#5B45F5]" />
            <span className="hidden sm:inline">Help</span>
          </button>

          {/* Cart Header Button */}
          <button
            onClick={() => navigate('/customer/cart')}
            className="relative px-4 py-2 sm:py-2.5 bg-[#5B45F5] hover:bg-[#4C38E8] active:scale-95 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-[#5B45F5]/25 flex items-center space-x-2 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Cart</span>
            {totalCartQuantity > 0 && (
              <span className="bg-white text-[#5B45F5] w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shadow-sm animate-scale-up">
                {totalCartQuantity}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* FAQ Modal */}
      {showFAQ && <FAQModal onClose={() => setShowFAQ(false)} />}

      {/* Table Switching Confirmation Modal */}
      {showTableSwitchModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-5 animate-scale-up">
            <div className="w-12 h-12 bg-indigo-50 text-[#5B45F5] rounded-2xl flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-gray-900">
                {activeOrders.length > 0
                  ? `Deliver to ${pendingTableNumber}?`
                  : totalCartQuantity > 0
                  ? `Take your cart to ${pendingTableNumber}?`
                  : `Switch to ${pendingTableNumber}?`}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {activeOrders.length > 0 ? (
                  <>
                    You scanned <strong className="text-[#5B45F5] font-bold">{pendingTableNumber}</strong>, but you have{' '}
                    <strong className="text-emerald-700 font-bold">{activeOrders.length} active order(s)</strong>{' '}
                    placed from <strong className="text-gray-800">{currentTableSnapshot || tableId}</strong>.
                    {totalCartQuantity > 0 && (
                      <> Your cart with <strong className="text-amber-600 font-bold">{totalCartQuantity} item(s)</strong> will also move.</>
                    )}
                    {' '}Do you want to transfer your current session &amp; active orders to <strong className="text-[#5B45F5] font-bold">{pendingTableNumber}</strong>, or start a fresh session?
                  </>
                ) : totalCartQuantity > 0 ? (
                  <>
                    You have <strong className="text-amber-600 font-bold">{totalCartQuantity} item(s)</strong> in your cart from{' '}
                    <strong className="text-gray-800 font-bold">{currentTableSnapshot || tableId}</strong>. Transfer your session to{' '}
                    <strong className="text-[#5B45F5] font-bold">{pendingTableNumber}</strong> to keep your items!
                  </>
                ) : (
                  <>
                    Switch your active session from <strong className="text-gray-800 font-bold">{currentTableSnapshot || tableId}</strong> to{' '}
                    <strong className="text-[#5B45F5] font-bold">{pendingTableNumber}</strong>.
                  </>
                )}
              </p>
            </div>
            <div className="space-y-2.5 pt-2">
              {/* Primary Option 1: Move/Transfer current session & orders to new table */}
              {(activeOrders.length > 0 || totalCartQuantity > 0) && (
                <button
                  disabled={transferLoading}
                  onClick={handleTransferTableAndOrders}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {transferLoading
                      ? 'Transferring...'
                      : activeOrders.length > 0
                      ? `Transfer Session & Orders to ${pendingTableNumber}`
                      : `Move Cart to ${pendingTableNumber}`}
                  </span>
                </button>
              )}

              {/* Primary Option 2: Start Fresh */}
              <button
                onClick={handleConfirmTableSwitch}
                className="w-full py-3 bg-[#5B45F5] hover:bg-[#4C38E8] text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-2"
              >
                <span>{totalCartQuantity > 0 || activeOrders.length > 0 ? `Start Fresh Session at ${pendingTableNumber}` : `Switch to ${pendingTableNumber}`}</span>
              </button>

              {/* Cancel Option */}
              <button
                onClick={handleCancelTableSwitch}
                className="w-full py-2 text-gray-400 hover:text-gray-600 font-bold text-xs transition-all cursor-pointer text-center"
              >
                Cancel & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* Table QR Error */}
        {tableError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-semibold flex items-center space-x-2.5 shadow-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{tableError}</span>
          </div>
        )}

        {/* System Error */}
        {error && !tableError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-semibold flex items-center space-x-2.5 shadow-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── EMAIL + OTP VERIFICATION VIEW (Required before ordering) ────────── */}
        {!isSessionVerified ? (
          <div className="max-w-md mx-auto my-8 bg-white border border-[#E7E8EF] rounded-[32px] p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 bg-[#5B45F5]/10 text-[#5B45F5] rounded-3xl flex items-center justify-center mx-auto ring-8 ring-[#5B45F5]/5">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div>
              <span className="px-3 py-1 bg-[#5B45F5]/10 text-[#5B45F5] rounded-full text-[10px] font-black uppercase tracking-wider">
                {tableId} • Smart Dining Session
              </span>
              <h2 className="text-2xl font-black text-[#171923] mt-2">Welcome to {tableId}</h2>
              <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
                Please verify your email address to unlock the menu and place your order.
              </p>
            </div>

            {otpError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold flex items-center space-x-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            {otpSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl text-xs font-bold flex items-center space-x-2 text-left">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{otpSuccess}</span>
              </div>
            )}

            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4 text-left">
                <div>
                  <label className="text-[11px] font-bold text-[#171923] block mb-1">Your Full Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-[#F7F8FC] border border-[#E7E8EF] rounded-xl px-4 py-3 text-xs text-[#171923] focus:outline-none focus:border-[#5B45F5] focus:bg-white transition-all"
                    />
                    <User className="w-4 h-4 text-[#6B7280] absolute right-3.5 top-3.5" />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#171923] block mb-1">Email Address (for Receipt & OTP)</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="name@university.edu"
                      className="w-full bg-[#F7F8FC] border border-[#E7E8EF] rounded-xl px-4 py-3 text-xs text-[#171923] focus:outline-none focus:border-[#5B45F5] focus:bg-white transition-all"
                    />
                    <Mail className="w-4 h-4 text-[#6B7280] absolute right-3.5 top-3.5" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={otpLoading}
                  className="w-full py-3.5 bg-[#5B45F5] hover:bg-[#4C38E8] active:scale-[0.98] text-white font-black text-xs rounded-xl shadow-lg shadow-[#5B45F5]/25 transition-all cursor-pointer flex items-center justify-center space-x-2"
                >
                  {otpLoading ? (
                    <span>Sending Code...</span>
                  ) : (
                    <>
                      <span>Send 6-Digit Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4 text-left">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold text-[#171923]">Enter 6-Digit Code</label>
                    <span className="text-[10px] text-[#6B7280] font-mono">{authEmail}</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="••••••"
                      className="w-full text-center tracking-[8px] text-lg font-black bg-[#F7F8FC] border border-[#E7E8EF] rounded-xl px-4 py-3 text-[#171923] focus:outline-none focus:border-[#5B45F5] focus:bg-white transition-all"
                    />
                    <KeyRound className="w-4 h-4 text-[#6B7280] absolute right-3.5 top-3.5" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={otpLoading}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all cursor-pointer flex items-center justify-center space-x-2"
                >
                  {otpLoading ? <span>Verifying...</span> : <span>Verify &amp; Enter Menu</span>}
                </button>

                <div className="flex justify-between items-center text-[11px] pt-1">
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-[#6B7280] hover:text-[#171923] cursor-pointer"
                  >
                    Change Email
                  </button>
                  <button
                    type="button"
                    disabled={cooldown > 0 || otpLoading}
                    onClick={handleSendOtp}
                    className="text-[#5B45F5] font-bold hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <>
            {/* Transfer Success Notification */}
            {transferSuccessMessage && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center space-x-3 text-xs font-bold shadow-sm animate-fade-in">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span>{transferSuccessMessage}</span>
              </div>
            )}

            {/* Active Order Banner(s) - Single or Multi-Order Tracking */}
            {activeOrders.length === 1 && (
              <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex flex-col space-y-3 text-xs shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                    <div>
                      <strong className="text-emerald-800 font-bold block text-sm">
                        Active Order {activeOrders[0].orderNumber || `#000${activeOrders[0].id}`} in Progress
                      </strong>
                      <span className="text-[#6B7280]">
                        Status: <span className="font-bold text-emerald-700">{activeOrders[0].status}</span> • Delivering to: <strong className="text-emerald-900 font-bold bg-emerald-100/80 px-2 py-0.5 rounded">{activeOrders[0].tableNumber || tableId}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => {
                        if (deliveryChangeOrderId === activeOrders[0].id) {
                          setDeliveryChangeOrderId(null);
                        } else {
                          setDeliveryChangeOrderId(activeOrders[0].id);
                          setDeliveryChangeTarget(activeOrders[0].tableNumber || tableId);
                        }
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center space-x-1"
                    >
                      <span>📍 Change Seat/Table</span>
                    </button>
                    <button
                      onClick={() => navigate(`/customer/track/${activeOrders[0].trackingToken || activeOrders[0].id}`)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                    >
                      Track Live Order →
                    </button>
                  </div>
                </div>

                {/* Inline Delivery Table Picker */}
                {deliveryChangeOrderId === activeOrders[0].id && (
                  <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-center gap-2.5 animate-fade-in">
                    <span className="text-xs font-bold text-gray-700 whitespace-nowrap">
                      Select new delivery seat/table:
                    </span>
                    <select
                      value={deliveryChangeTarget}
                      onChange={(e) => setDeliveryChangeTarget(e.target.value)}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg px-2.5 py-1.5 font-bold focus:outline-none focus:border-[#5B45F5]"
                    >
                      <option value="">Select Table...</option>
                      {availableTables.map(t => (
                        <option key={t.id} value={t.tableNumber}>
                          {t.tableNumber}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={deliveryChangeLoading || !deliveryChangeTarget}
                      onClick={() => handleDeliveryTableChange(activeOrders[0].id, deliveryChangeTarget)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
                    >
                      {deliveryChangeLoading ? 'Updating...' : 'Confirm Delivery Location Change'}
                    </button>
                    <button
                      onClick={() => setDeliveryChangeOrderId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeOrders.length > 1 && (
              <div className="bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80 border border-indigo-100 p-4 sm:p-5 rounded-3xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                      Active Orders in Progress ({activeOrders.length})
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#5B45F5] bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                    Live Kitchen Sync
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {activeOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-white p-3.5 rounded-2xl border border-gray-100 flex flex-col space-y-2.5 shadow-xs hover:border-indigo-200 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <strong className="text-xs font-bold text-gray-900">
                              {ord.orderNumber || `#000${ord.id}`}
                            </strong>
                            <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-emerald-100 text-emerald-800">
                              {ord.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500">
                            Delivering to: <strong className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">{ord.tableNumber || tableId}</strong> • {ord.orderItems?.length || 0} items
                          </p>
                        </div>
                        <button
                          onClick={() => navigate(`/customer/track/${ord.trackingToken || ord.id}`)}
                          className="px-3 py-1.5 bg-[#5B45F5] hover:bg-[#4C38E8] text-white font-bold rounded-xl text-[11px] transition-all shadow-xs cursor-pointer shrink-0 ml-2"
                        >
                          Track →
                        </button>
                      </div>

                      {/* Change Location Button / Picker for multi-orders */}
                      {deliveryChangeOrderId === ord.id ? (
                        <div className="p-2.5 bg-indigo-50/70 rounded-xl border border-indigo-100 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-950 text-[11px]">Select Delivery Table:</span>
                            <button onClick={() => setDeliveryChangeOrderId(null)} className="text-[10px] font-bold text-gray-400 hover:text-gray-600">✕ Close</button>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={deliveryChangeTarget}
                              onChange={(e) => setDeliveryChangeTarget(e.target.value)}
                              className="bg-white border border-gray-300 text-gray-900 text-xs rounded-lg px-2 py-1 font-bold flex-1 focus:outline-none"
                            >
                              <option value="">Select Table...</option>
                              {availableTables.map(t => (
                                <option key={t.id} value={t.tableNumber}>
                                  {t.tableNumber}
                                </option>
                              ))}
                            </select>
                            <button
                              disabled={deliveryChangeLoading || !deliveryChangeTarget}
                              onClick={() => handleDeliveryTableChange(ord.id, deliveryChangeTarget)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-[11px] rounded-lg transition-all"
                            >
                              {deliveryChangeLoading ? '...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setDeliveryChangeOrderId(ord.id);
                            setDeliveryChangeTarget(ord.tableNumber || tableId);
                          }}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline self-start flex items-center space-x-1"
                        >
                          <span>📍 Change delivery seat/table for this order</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed Payment Notice with 1-Click Dismiss */}
            {failedOrders.length > 0 && (
              <div className="bg-rose-50/90 border border-rose-200/90 p-4 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs animate-fade-in">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-rose-900 font-bold block text-sm">
                      Payment Incomplete ({failedOrders.length} order{failedOrders.length > 1 ? 's' : ''})
                    </strong>
                    <span className="text-rose-700/80 text-[11px]">
                      {failedOrders.map(f => f.orderNumber).join(', ')} — Not sent to kitchen. You can re-order from cart or dismiss this notice.
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleDismissFailedOrders}
                  className="px-3.5 py-1.5 bg-white hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-[11px] border border-rose-200 transition-all shadow-xs cursor-pointer shrink-0 self-end sm:self-auto"
                >
                  ✕ Dismiss Notice
                </button>
              </div>
            )}

            {/* ── MENU VIEW ──────────────────────────────────────────────────────── */}
            <div className="space-y-8">
              {/* HERO BANNER — PREMIUM POLISH */}
              <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#5B45F5] via-[#4F36E3] to-[#7C3AED] text-white p-6 sm:p-10 shadow-2xl shadow-[#5B45F5]/20 border border-white/10">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

                <div className="grid md:grid-cols-12 items-center gap-6 sm:gap-8 relative z-10">
                  <div className="md:col-span-7 space-y-4">
                    <div className="inline-flex items-center space-x-2 px-3.5 py-1 bg-white/15 backdrop-blur-md rounded-full text-[11px] font-extrabold tracking-wider uppercase border border-white/20">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Fresh &amp; Smart Canteen</span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight font-display">
                      Good food.<br />Great mood. ✨
                    </h1>

                    <p className="text-xs sm:text-sm text-indigo-100 max-w-md leading-relaxed">
                      Freshly prepared. Just for you.<br />
                      <span className="text-indigo-200 font-medium text-[11px]">AI powered kitchen • Faster queue handling</span>
                    </p>

                    <button
                      onClick={() => navigate('/customer/cart')}
                      className="inline-flex items-center space-x-2 px-6 py-3 bg-white hover:bg-slate-50 text-[#5B45F5] font-extrabold text-xs rounded-2xl shadow-xl hover:shadow-2xl active:scale-95 transition-all cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4 text-[#5B45F5]" />
                      <span>View Cart {totalCartQuantity > 0 ? `(${totalCartQuantity})` : ''}</span>
                      <ArrowRight className="w-4 h-4 text-[#5B45F5]" />
                    </button>
                  </div>

                  <div className="md:col-span-5 relative flex justify-center items-center">
                    <div className="relative w-56 h-56 sm:w-64 sm:h-64 lg:w-72 lg:h-72 rounded-3xl overflow-hidden border-4 border-white/20 shadow-2xl transition-transform duration-500 hover:scale-105">
                      <img
                        src={heroFoodImage}
                        alt="Featured Food"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    </div>
                    <div className="absolute top-3 right-3 sm:right-6 bg-white/95 backdrop-blur-md text-[#171923] px-4 py-2.5 rounded-2xl shadow-2xl flex items-center space-x-2.5 border border-[#E7E8EF]">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <div>
                        <strong className="text-xs font-black block leading-none">4.9 ⭐</strong>
                        <span className="text-[9px] text-[#6B7280] font-bold">100+ reviews</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SEARCH BAR — PROFESSIONAL INPUT */}
              <div className="space-y-5">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for biryani, zinger burgers, chai, fries..."
                    className="w-full bg-white border border-[#E7E8EF] rounded-2xl px-5 py-4 pl-12 text-xs text-[#171923] placeholder-[#6B7280] focus:outline-none focus:border-[#5B45F5] focus:ring-4 focus:ring-[#5B45F5]/10 transition-all shadow-sm font-medium"
                  />
                  <Search className="w-5 h-5 text-[#6B7280] absolute left-4 top-3.5" />
                </div>

                {/* CATEGORY FILTERS */}
                <div className="flex items-center space-x-2.5 overflow-x-auto pb-2 scrollbar-none">
                  {combinedCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                        category === cat
                          ? 'bg-[#5B45F5] text-white shadow-md shadow-[#5B45F5]/25 border border-[#5B45F5]'
                          : 'bg-white border border-[#E7E8EF] text-[#6B7280] hover:border-[#5B45F5]/40 hover:text-[#5B45F5]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* FOOD PRODUCTS GRID — Grouped by variant */}
              {filteredGrouped.length === 0 ? (
                <div className="py-16 text-center text-xs font-bold text-[#6B7280] bg-white border border-[#E7E8EF] rounded-[24px] p-8 shadow-sm">
                  <p className="text-sm font-extrabold text-[#171923]">No dishes found</p>
                  <p className="text-xs text-[#6B7280] mt-1">Try searching for another dish or selecting a different category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 items-start">
                  {filteredGrouped.map(({ groupKey, variants }) => {
                    const isExpanded = expandedGroup === groupKey;
                    const selectedVariant = pendingVariant[groupKey] || variants[0];
                    const qty = pendingQty[groupKey] || 1;
                    const inCartQty = variants.reduce((sum, v) => sum + (cart[v.id]?.quantity || 0), 0);
                    const isOutOfStock = selectedVariant.stock <= 0;

                    return (
                      <div
                        key={groupKey}
                        className={`bg-white rounded-[24px] overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl group ${
                          isExpanded
                            ? 'border-2 border-[#5B45F5]/50 shadow-xl ring-4 ring-[#5B45F5]/5'
                            : 'border border-[#E7E8EF] hover:border-[#5B45F5]/30'
                        } ${isOutOfStock ? 'opacity-60' : ''}`}
                      >
                        {/* Food Image */}
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 shrink-0">
                          <img
                            src={getItemImage(selectedVariant)}
                            alt={groupKey}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&auto=format&fit=crop&q=80';
                            }}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                            {selectedVariant.category}
                          </div>
                          {selectedVariant.prepTime && (
                            <div className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur-md text-[#171923] text-[10px] font-bold px-2 py-1 rounded-full flex items-center space-x-1 shadow-sm">
                              <Clock className="w-3 h-3 text-[#5B45F5]" />
                              <span>{selectedVariant.prepTime}m</span>
                            </div>
                          )}
                          {inCartQty > 0 && !isExpanded && (
                            <div className="absolute bottom-2 right-2.5 bg-[#5B45F5] text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-md">
                              {inCartQty} in cart
                            </div>
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="p-3 sm:p-4 flex-1 flex flex-col space-y-2">
                          <div>
                            <h3 className="font-extrabold text-xs sm:text-sm text-[#171923] group-hover:text-[#5B45F5] transition-colors line-clamp-2 leading-tight flex items-center gap-1.5 flex-wrap">
                              <span>{groupKey}</span>
                              {variants.length === 1 && selectedVariant.unit && (
                                <span className="px-1.5 py-0.5 bg-[#5B45F5]/10 text-[#5B45F5] rounded text-[10px] font-bold">
                                  {selectedVariant.unit}
                                </span>
                              )}
                            </h3>
                            {!isExpanded && (
                              <p className="text-[10px] text-[#6B7280] mt-0.5 line-clamp-1 leading-relaxed">
                                {selectedVariant.description || 'Freshly prepared.'}
                              </p>
                            )}
                          </div>

                          {/* ── COLLAPSED STATE ── */}
                          {!isExpanded && (
                            <div className="flex items-center justify-between pt-2 mt-auto border-t border-[#F3F4F8]">
                              <div>
                                <span className="text-[9px] text-[#6B7280] block font-semibold">
                                  {variants.length > 1 ? variants.map((v) => v.unit).join(' / ') : selectedVariant.unit}
                                </span>
                                <span className="text-sm font-black text-[#5B45F5]">
                                  Rs. {selectedVariant.price}
                                </span>
                                {variants.length > 1 && (
                                  <span className="text-[9px] text-amber-600 font-bold block">{variants.length} portion sizes ▾</span>
                                )}
                              </div>
                              {isOutOfStock ? (
                                <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-xl border border-rose-100">Sold Out</span>
                              ) : (
                                <button
                                  onClick={() => setExpandedGroup(groupKey)}
                                  className="px-3 py-2 bg-[#5B45F5] hover:bg-[#4C38E8] active:scale-95 text-white font-bold text-[11px] rounded-xl transition-all shadow-md shadow-[#5B45F5]/15 cursor-pointer flex items-center space-x-1"
                                >
                                  <CartIcon className="w-3 h-3" />
                                  <span>{inCartQty > 0 ? 'More' : 'Add'}</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* ── EXPANDED STATE ── */}
                          {isExpanded && (
                            <div className="space-y-3 pt-1">
                              {/* Variant selector */}
                              {variants.length > 1 && (
                                <div>
                                  <p className="text-[9px] font-extrabold text-[#6B7280] uppercase tracking-wider mb-1.5">Choose Portion</p>
                                  <div className="flex flex-col gap-1.5">
                                    {variants.map((v) => (
                                      <button
                                        key={v.id}
                                        onClick={() => setPendingVariant((prev) => ({ ...prev, [groupKey]: v }))}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-2 flex justify-between items-center ${
                                          selectedVariant.id === v.id
                                            ? 'bg-[#5B45F5] text-white border-[#5B45F5] shadow-md'
                                            : 'bg-[#F7F8FC] text-[#171923] border-[#E7E8EF] hover:border-[#5B45F5]/50'
                                        }`}
                                      >
                                        <span>{v.unit}</span>
                                        <span className={selectedVariant.id === v.id ? 'text-indigo-200 font-black' : 'text-[#5B45F5] font-black'}>
                                          Rs. {v.price}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Single variant: show unit + price pill */}
                              {variants.length === 1 && (
                                <div className="flex justify-between items-center px-3 py-2 bg-[#F7F8FC] rounded-xl border border-[#E7E8EF]">
                                  <span className="text-xs font-bold text-[#171923]">{selectedVariant.unit}</span>
                                  <span className="text-sm font-black text-[#5B45F5]">Rs. {selectedVariant.price}</span>
                                </div>
                              )}

                              {/* Quantity stepper */}
                              <div>
                                <p className="text-[9px] font-extrabold text-[#6B7280] uppercase tracking-wider mb-1.5">Quantity</p>
                                <div className="flex items-center space-x-3 bg-[#F7F8FC] border border-[#E7E8EF] rounded-xl px-3 py-2 w-fit">
                                  <button
                                    onClick={() => setPendingQty((prev) => ({ ...prev, [groupKey]: Math.max(1, (prev[groupKey] || 1) - 1) }))}
                                    className="w-7 h-7 bg-white border border-[#E7E8EF] text-[#5B45F5] font-black rounded-lg flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-all cursor-pointer shadow-sm"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="text-sm font-black text-[#171923] w-5 text-center">{qty}</span>
                                  <button
                                    onClick={() => setPendingQty((prev) => ({ ...prev, [groupKey]: (prev[groupKey] || 1) + 1 }))}
                                    className="w-7 h-7 bg-[#5B45F5] text-white font-black rounded-lg flex items-center justify-center hover:bg-[#4C38E8] transition-all cursor-pointer shadow-sm"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Price preview */}
                              <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F8]">
                                <span className="text-[10px] text-[#6B7280] font-semibold">
                                  {qty} × Rs. {selectedVariant.price}
                                </span>
                                <span className="text-base font-black text-[#5B45F5]">
                                  Rs. {(selectedVariant.price * qty).toFixed(0)}
                                </span>
                              </div>

                              {/* Action buttons */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setExpandedGroup(null)}
                                  className="flex-1 py-2.5 bg-[#F7F8FC] hover:bg-[#E7E8EF] text-[#6B7280] font-bold text-xs rounded-xl transition-all cursor-pointer border border-[#E7E8EF]"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleAddWithVariantAndQty(selectedVariant, qty, groupKey)}
                                  className="flex-[2] py-2.5 bg-[#5B45F5] hover:bg-[#4C38E8] active:scale-95 text-white font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-[#5B45F5]/25 cursor-pointer flex items-center justify-center space-x-1.5"
                                >
                                  <CartIcon className="w-3.5 h-3.5" />
                                  <span>Add to Cart</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* STICKY CART FOOTER BAR (Preserved Sticky Behavior & Badge) */}
      {totalCartQuantity > 0 && isSessionVerified && (
        <div className="sticky bottom-4 z-40 max-w-2xl mx-auto px-4 w-full animate-slide-up">
          <div className="bg-[#171923] text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between border border-slate-700/50 backdrop-blur-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#5B45F5] text-white flex items-center justify-center font-black text-sm shadow-md">
                {totalCartQuantity}
              </div>
              <div>
                <strong className="text-xs font-bold block">Cart Subtotal</strong>
                <span className="text-sm font-black text-emerald-400 font-mono">Rs. {totalCartPrice.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/customer/cart')}
              className="px-5 py-2.5 bg-[#5B45F5] hover:bg-[#4C38E8] text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all flex items-center space-x-2 cursor-pointer"
            >
              <span>View Cart &amp; Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;
