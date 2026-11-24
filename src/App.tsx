import { useCallback, useEffect, useState } from 'react';
import { AccountPage, AccountTab } from './components/AccountPage';
import { CartPage } from './components/CartPage';
import { CheckoutPage } from './components/CheckoutPage';
import { HomePage } from './components/HomePage';
import { SizeSelectorPage } from './components/SizeSelectorPage';
import { StudioPage } from './components/studio/StudioPage';
import { BAG_SIZES } from './data/catalog';
import { apiClient } from './services/apiClient';
import { storageService } from './services/storageService';
import {
  AppView,
  BagConfiguration,
  BagSizeId,
  CartItem,
  CustomerProfile,
  Order,
} from './types';

function createFreshBagConfig(size: BagSizeId): BagConfiguration {
  return {
    id: `bag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    size,
    bodyColor: '#DBD6BE',
    handleColor: '#DBD6BE',
    unifiedColor: true,
    elements: [],
    drawingStrokes: [],
    drawingVisible: true,
    modelProvider: 'procedural-v1',
    updatedAt: new Date().toISOString(),
  };
}

function cloneConfig(cfg: BagConfiguration): BagConfiguration {
  return JSON.parse(JSON.stringify(cfg)) as BagConfiguration;
}

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [cartItems, setCartItems] = useState<CartItem[]>(() =>
    storageService.getCart()
  );
  const [customer, setCustomer] = useState<CustomerProfile | null>(() =>
    storageService.getActiveCustomer()
  );
  const [allOrders, setAllOrders] = useState<Order[]>(() =>
    storageService.getAllOrders()
  );
  const [complaints, setComplaints] = useState(() => {
    const active = storageService.getActiveCustomer();
    return active ? storageService.getComplaintsByCustomer(active.id) : [];
  });

  const [studioConfig, setStudioConfig] = useState<BagConfiguration>(() =>
    createFreshBagConfig('M')
  );
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(
    null
  );
  const [accountInitialTab, setAccountInitialTab] =
    useState<AccountTab>('orders');
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(
    null
  );
  const [confirmedBannerCode, setConfirmedBannerCode] = useState<string | null>(
    null
  );

  const [, setCatalogSyncTick] = useState(0);

  const refreshCustomerData = useCallback(
    (nextCustomer: CustomerProfile | null) => {
      setCustomer(nextCustomer);
      setAllOrders(storageService.getAllOrders());
      setComplaints(
        nextCustomer
          ? storageService.getComplaintsByCustomer(nextCustomer.id)
          : []
      );
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getProdutos()
      .then((res) => {
        if (cancelled || !res?.sizes) return;
        (['P', 'M', 'G'] as BagSizeId[]).forEach((id) => {
          if (res.sizes[id]) {
            BAG_SIZES[id] = { ...BAG_SIZES[id], ...res.sizes[id] };
          }
        });
        setCatalogSyncTick((t) => t + 1);
      })
      .catch(() => {
        // Preserva catálogo padrão caso NocoDB ainda não esteja configurado
      });

    const active = storageService.getActiveCustomer();
    if (active?.email) {
      apiClient
        .loginByEmail(active.email)
        .then(({ customer: remoteCust, orders: remoteOrders }) => {
          if (cancelled) return;
          const cached = storageService.upsertCustomer(remoteCust);
          const mergedOrders = storageService.mergeOrdersFromServer(remoteOrders);
          setCustomer(cached);
          setAllOrders(mergedOrders);
        })
        .catch(() => {
          // Mantém dados locais se backend ainda estiver sem credenciais
        });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const handleConfirmSize = (size: BagSizeId) => {
    setEditingCartItemId(null);
    setStudioConfig(createFreshBagConfig(size));
    setView('studio');
  };

  const handleAddToCartFromStudio = (
    config: BagConfiguration,
    previewDataUrl: string
  ) => {
    const cloned = cloneConfig(config);
    const unitPrice = BAG_SIZES[cloned.size].price;

    setCartItems((prev) => {
      let next: CartItem[];
      if (editingCartItemId) {
        next = prev.map((item) =>
          item.id === editingCartItemId
            ? {
                ...item,
                configuration: cloned,
                unitPrice,
                previewDataUrl: previewDataUrl || item.previewDataUrl,
              }
            : item
        );
      } else {
        const newItem: CartItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          configuration: cloned,
          quantity: 1,
          unitPrice,
          previewDataUrl,
          createdAt: new Date().toISOString(),
        };
        next = [...prev, newItem];
      }
      storageService.saveCart(next);
      return next;
    });

    setEditingCartItemId(null);
    setView('cart');
  };

  const handleEditCartItem = (item: CartItem) => {
    setEditingCartItemId(item.id);
    setStudioConfig(cloneConfig(item.configuration));
    setView('studio');
  };

  const handleUpdateCartQuantity = (itemId: string, quantity: number) => {
    setCartItems((prev) => {
      const next =
        quantity <= 0
          ? prev.filter((i) => i.id !== itemId)
          : prev.map((i) => (i.id === itemId ? { ...i, quantity } : i));
      storageService.saveCart(next);
      return next;
    });
  };

  const handleRemoveCartItem = (itemId: string) => {
    setCartItems((prev) => {
      const next = prev.filter((i) => i.id !== itemId);
      storageService.saveCart(next);
      return next;
    });
  };

  const handleOrderConfirmed = (
    order: Order,
    updatedCustomer: CustomerProfile
  ) => {
    storageService.upsertCustomer(updatedCustomer);
    storageService.upsertOrderFromServer(order);
    storageService.clearCart();
    setCartItems([]);
    refreshCustomerData(updatedCustomer);
    setAccountInitialTab('orders');
    setHighlightedOrderId(order.id);
    setConfirmedBannerCode(order.code);
    setView('account');
  };

  const totalCartUnits = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const customerOrders = customer
    ? allOrders.filter((o) => o.customerId === customer.id)
    : [];

  return (
    <div className="min-h-screen bg-white">
      {confirmedBannerCode && view === 'account' && (
        <div className="bg-[#536895] text-white px-4 py-2.5 text-center text-xs font-medium flex items-center justify-center gap-3">
          <span>
            Pedido <strong className="font-mono">{confirmedBannerCode}</strong>{' '}
            confirmado com sucesso (modo demonstrativo)!
          </span>
          <button
            type="button"
            onClick={() => setConfirmedBannerCode(null)}
            className="underline opacity-90 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      )}

      {view === 'home' && (
        <HomePage
          cartCount={totalCartUnits}
          hasCustomer={Boolean(customer)}
          onStartPersonalize={() => setView('size-select')}
          onOpenCart={() => setView('cart')}
          onOpenAccount={() => {
            setAccountInitialTab('orders');
            setView('account');
          }}
        />
      )}

      {view === 'size-select' && (
        <SizeSelectorPage
          initialSize={studioConfig.size}
          cartCount={totalCartUnits}
          onBack={() => setView('home')}
          onConfirmSize={handleConfirmSize}
          onOpenCart={() => setView('cart')}
          onOpenAccount={() => {
            setAccountInitialTab('orders');
            setView('account');
          }}
        />
      )}

      {view === 'studio' && (
        <StudioPage
          key={studioConfig.id}
          initialConfig={studioConfig}
          editingCartItemId={editingCartItemId}
          onBack={() =>
            setView(editingCartItemId ? 'cart' : 'size-select')
          }
          onAddToCart={handleAddToCartFromStudio}
        />
      )}

      {view === 'cart' && (
        <CartPage
          items={cartItems}
          customer={customer}
          customerOrders={customerOrders}
          allOrders={allOrders}
          onBackToSizes={() => setView('size-select')}
          onAddAnotherBag={() => setView('size-select')}
          onEditItem={handleEditCartItem}
          onUpdateQuantity={handleUpdateCartQuantity}
          onRemoveItem={handleRemoveCartItem}
          onProceedToCheckout={() => setView('checkout')}
        />
      )}

      {view === 'checkout' && (
        <CheckoutPage
          items={cartItems}
          customer={customer}
          allOrders={allOrders}
          onBackToCart={() => setView('cart')}
          onCustomerAuthenticated={(c) => refreshCustomerData(c)}
          onOrderConfirmed={handleOrderConfirmed}
        />
      )}

      {view === 'account' && (
        <AccountPage
          customer={customer}
          orders={customerOrders}
          complaints={complaints}
          initialTab={accountInitialTab}
          highlightedOrderId={highlightedOrderId}
          onBackHome={() => setView('home')}
          onStartPersonalize={() => setView('size-select')}
          onCustomerChange={refreshCustomerData}
          onOrdersChange={() => setAllOrders(storageService.getAllOrders())}
          onComplaintsChange={() =>
            setComplaints(
              customer
                ? storageService.getComplaintsByCustomer(customer.id)
                : []
            )
          }
        />
      )}
    </div>
  );
}
