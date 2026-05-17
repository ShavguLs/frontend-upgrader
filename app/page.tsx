"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";

type AuthUser = {
  id: number;
  steamId: string;
  displayName: string;
  avatar?: string | null;
  profileUrl?: string | null;
};

type Wallet = {
  id: number;
  userId: number;
  balance: string | number;
  currency: string;
  createdAt?: string;
  updatedAt?: string;
};

type Deposit = {
  id: number;
  amountRub: string | number;
  sourceCurrency: string;
  paymentCurrency?: string | null;
  status: string;
  invoiceUrl?: string | null;
  createdAt: string;
  creditedAt?: string | null;
};

type WalletResponse = {
  wallet: Wallet;
  deposits: Deposit[];
};

type Skin = {
  id: number;
  marketHashName: string;
  name: string;
  weapon?: string | null;
  category?: string | null;
  rarity?: string | null;
  exterior?: string | null;
  imageUrl?: string | null;
  priceRub: string | number;
  provider?: string | null;
  providerItemId?: string | null;
  lastSyncedAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type SkinsResponse = {
  items: Skin[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type InventoryItem = {
  id: number;
  userId: number;
  skinId: number;
  purchasePriceRub: string | number;
  sellPriceRub: string | number;
  status: string;
  source: string;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
  skin: Skin;
};

type BuySkinResponse = {
  item: InventoryItem;
  wallet: Wallet;
};

type SellInventoryItemResponse = {
  item: InventoryItem;
  wallet: Wallet;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

function formatMoney(value: string | number, currency: string) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${value} ${currency}`;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

async function getResponseError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { message?: string | string[] };

    if (typeof data.message === "string") {
      return data.message;
    }

    if (Array.isArray(data.message) && data.message[0]) {
      return data.message[0];
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function SkinImage({ skin }: { skin: Skin }) {
  if (!skin.imageUrl) {
    return <div className={styles.skinImagePlaceholder}>No image</div>;
  }

  return (
    <Image
      className={styles.skinImage}
      src={skin.imageUrl}
      alt={skin.name}
      fill
      sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 25vw"
    />
  );
}

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [skins, setSkins] = useState<Skin[]>([]);
  const [skinsPagination, setSkinsPagination] = useState<
    SkinsResponse["pagination"] | null
  >(null);
  const [skinsLoading, setSkinsLoading] = useState(true);
  const [skinsError, setSkinsError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [buyingSkinId, setBuyingSkinId] = useState<number | null>(null);
  const [sellingItemId, setSellingItemId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  function updateWallet(updatedWallet: Wallet) {
    setWallet((current) => ({
      wallet: updatedWallet,
      deposits: current?.deposits ?? [],
    }));
  }

  function clearSessionState() {
    setUser(null);
    setWallet(null);
    setWalletError(null);
    setInventory([]);
    setInventoryError(null);
  }

  useEffect(() => {
    let ignore = false;

    async function loadWallet() {
      setWalletLoading(true);
      setWalletError(null);

      try {
        const res = await fetch(`${API_BASE}/wallet`, {
          credentials: "include",
        });

        if (ignore) {
          return;
        }

        if (res.status === 401) {
          clearSessionState();
          return false;
        } else if (res.ok) {
          const data = (await res.json()) as WalletResponse;
          setWallet(data);
        } else {
          setWalletError("Failed to load wallet.");
          return false;
        }
      } catch {
        if (!ignore) {
          setWalletError("Could not reach the server.");
        }
        return false;
      } finally {
        if (!ignore) {
          setWalletLoading(false);
        }
      }

      return true;
    }

    async function loadInventory() {
      setInventoryLoading(true);
      setInventoryError(null);

      try {
        const res = await fetch(`${API_BASE}/inventory`, {
          credentials: "include",
        });

        if (ignore) {
          return;
        }

        if (res.status === 401) {
          clearSessionState();
          return false;
        } else if (res.ok) {
          const data = (await res.json()) as InventoryItem[];
          setInventory(data);
        } else {
          setInventoryError("Failed to load inventory.");
          return false;
        }
      } catch {
        if (!ignore) {
          setInventoryError("Could not load inventory.");
        }
        return false;
      } finally {
        if (!ignore) {
          setInventoryLoading(false);
        }
      }

      return true;
    }

    async function loadSkins() {
      setSkinsLoading(true);
      setSkinsError(null);

      try {
        const res = await fetch(`${API_BASE}/skins?limit=24`);

        if (ignore) {
          return;
        }

        if (res.ok) {
          const data = (await res.json()) as SkinsResponse;
          setSkins(data.items);
          setSkinsPagination(data.pagination);
        } else {
          setSkinsError("Failed to load skins catalog.");
        }
      } catch {
        if (!ignore) {
          setSkinsError("Could not load skins catalog.");
        }
      } finally {
        if (!ignore) {
          setSkinsLoading(false);
        }
      }
    }

    async function checkAuth() {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
        });
        if (ignore) {
          return;
        }

        if (res.status === 401) {
          clearSessionState();
        } else if (res.ok) {
          const data = (await res.json()) as AuthUser;
          setUser(data);
          setLoading(false);
          const walletLoaded = await loadWallet();

          if (walletLoaded) {
            await loadInventory();
          }
        } else {
          setError("Failed to check login status.");
        }
      } catch {
        if (!ignore) {
          setError("Could not reach the server.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadSkins();
    checkAuth();

    return () => {
      ignore = true;
    };
  }, []);

  async function logout() {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setUser(null);
        setWallet(null);
        setWalletLoading(false);
        setWalletError(null);
        setInventory([]);
        setInventoryLoading(false);
        setInventoryError(null);
        setActionMessage(null);
        setActionError(null);
      } else {
        setError("Logout failed.");
      }
    } catch {
      setError("Could not reach the server.");
    }
  }

  async function buySkin(skinId: number) {
    if (!user) {
      window.location.href = `${API_BASE}/auth/steam`;
      return;
    }

    setActionError(null);
    setActionMessage(null);
    setBuyingSkinId(skinId);

    try {
      const res = await fetch(`${API_BASE}/inventory/buy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skinId }),
      });

      if (res.status === 401) {
        clearSessionState();
        setActionError("Please log in with Steam to buy skins.");
        return;
      }

      if (!res.ok) {
        setActionError(await getResponseError(res, "Could not buy skin."));
        return;
      }

      const data = (await res.json()) as BuySkinResponse;
      updateWallet(data.wallet);
      setInventory((current) => [data.item, ...current]);
      setActionMessage(`${data.item.skin.name} added to your inventory.`);
    } catch {
      setActionError("Could not reach the server.");
    } finally {
      setBuyingSkinId(null);
    }
  }

  async function sellInventoryItem(inventoryItemId: number) {
    setActionError(null);
    setActionMessage(null);
    setSellingItemId(inventoryItemId);

    try {
      const res = await fetch(`${API_BASE}/inventory/sell`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryItemId }),
      });

      if (res.status === 401) {
        clearSessionState();
        setActionError("Please log in with Steam to sell skins.");
        return;
      }

      if (!res.ok) {
        setActionError(await getResponseError(res, "Could not sell skin."));
        return;
      }

      const data = (await res.json()) as SellInventoryItemResponse;
      updateWallet(data.wallet);
      setInventory((current) =>
        current.filter((item) => item.id !== data.item.id),
      );
      setActionMessage(`${data.item.skin.name} sold successfully.`);
    } catch {
      setActionError("Could not reach the server.");
    } finally {
      setSellingItemId(null);
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        {loading && <p>Checking login status...</p>}
        {error && <p className={styles.error}>{error}</p>}
        {!loading && !user && (
          <div className={styles.authSection}>
            <h1>CS2 Gambler</h1>
            <a
              className={styles.loginLink}
              href={`${API_BASE}/auth/steam`}
            >
              Login with Steam
            </a>
          </div>
        )}
        {!loading && user && (
          <div className={styles.dashboard}>
            <header className={styles.dashboardHeader}>
              <h1>CS2 Gambler</h1>
              <button className={styles.logoutButton} onClick={logout}>
                Logout
              </button>
            </header>

            <section className={styles.card}>
              <div className={styles.accountRow}>
                {user.avatar && (
                  <Image
                    className={styles.avatar}
                    src={user.avatar}
                    alt={user.displayName}
                    width={64}
                    height={64}
                  />
                )}
                <div>
                  <p className={styles.eyebrow}>Steam account</p>
                  <h2>{user.displayName}</h2>
                  <p className={styles.meta}>Steam ID: {user.steamId}</p>
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <p className={styles.eyebrow}>Wallet balance</p>
              {walletLoading && <p>Loading wallet...</p>}
              {walletError && <p className={styles.error}>{walletError}</p>}
              {!walletLoading && wallet && (
                <>
                  <p className={styles.balance}>
                    {formatMoney(wallet.wallet.balance, wallet.wallet.currency)}
                  </p>

                  <div className={styles.depositsHeader}>
                    <h2>Recent deposits</h2>
                  </div>

                  {wallet.deposits.length > 0 ? (
                    <ul className={styles.depositList}>
                      {wallet.deposits.map((deposit) => (
                        <li className={styles.depositItem} key={deposit.id}>
                          <div>
                            <strong>
                              {formatMoney(deposit.amountRub, "RUB")}
                            </strong>
                            <p className={styles.meta}>
                              {formatDate(deposit.createdAt)}
                            </p>
                          </div>
                          <span className={styles.status}>{deposit.status}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.emptyState}>No recent deposits.</p>
                  )}
                </>
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.eyebrow}>Inventory</p>
                  <h2>Your skins</h2>
                </div>
              </div>

              {inventoryLoading && <p>Loading inventory...</p>}
              {inventoryError && (
                <p className={styles.error}>{inventoryError}</p>
              )}
              {!inventoryLoading && !inventoryError && inventory.length === 0 && (
                <p className={styles.emptyState}>No inventory items yet.</p>
              )}
              {!inventoryLoading && inventory.length > 0 && (
                <div className={styles.skinGrid}>
                  {inventory.map((item) => (
                    <article className={styles.skinCard} key={item.id}>
                      <div className={styles.skinImageWrap}>
                        <SkinImage skin={item.skin} />
                      </div>
                      <div className={styles.skinCardBody}>
                        <h3>{item.skin.name}</h3>
                        <p className={styles.meta}>
                          {item.status} / {item.source}
                        </p>
                        <div className={styles.skinMetaGrid}>
                          <span>Buy {formatMoney(item.purchasePriceRub, "RUB")}</span>
                          <span>Sell {formatMoney(item.sellPriceRub, "RUB")}</span>
                        </div>
                        <p className={styles.meta}>
                          Acquired {formatDate(item.createdAt)}
                        </p>
                        <button
                          className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
                          disabled={sellingItemId === item.id}
                          onClick={() => sellInventoryItem(item.id)}
                        >
                          {sellingItemId === item.id
                            ? "Selling..."
                            : `Sell for ${formatMoney(item.sellPriceRub, "RUB")}`}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {(actionMessage || actionError) && (
          <div className={`${styles.card} ${styles.actionNotice}`}>
            {actionMessage && (
              <p className={styles.actionMessage}>{actionMessage}</p>
            )}
            {actionError && <p className={styles.error}>{actionError}</p>}
          </div>
        )}

        <section className={`${styles.card} ${styles.catalogSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Catalog</p>
              <h2>Public skins</h2>
            </div>
            {skinsPagination && (
              <p className={styles.meta}>{skinsPagination.total} items</p>
            )}
          </div>

          {skinsLoading && <p>Loading skins catalog...</p>}
          {skinsError && <p className={styles.error}>{skinsError}</p>}
          {!skinsLoading && !skinsError && skins.length === 0 && (
            <p className={styles.emptyState}>No skins available.</p>
          )}
          {!skinsLoading && skins.length > 0 && (
            <div className={styles.skinGrid}>
              {skins.map((skin) => {
                const balance = wallet ? Number(wallet.wallet.balance) : null;
                const price = Number(skin.priceRub);
                const isWalletLoading = Boolean(user && walletLoading);
                const hasEnoughBalance =
                  !user ||
                  (balance !== null &&
                    Number.isFinite(balance) &&
                    Number.isFinite(price) &&
                    balance >= price);
                const isBuying = buyingSkinId === skin.id;

                return (
                  <article className={styles.skinCard} key={skin.id}>
                    <div className={styles.skinImageWrap}>
                      <SkinImage skin={skin} />
                    </div>
                    <div className={styles.skinCardBody}>
                      <h3>{skin.name}</h3>
                      <p className={styles.meta}>
                        {[skin.weapon, skin.category]
                          .filter(Boolean)
                          .join(" / ") || skin.marketHashName}
                      </p>
                      <p className={styles.meta}>
                        {[skin.rarity, skin.exterior]
                          .filter(Boolean)
                          .join(" / ") || "Standard"}
                      </p>
                      <p className={styles.skinPrice}>
                        {formatMoney(skin.priceRub, "RUB")}
                      </p>
                      <button
                        className={styles.actionButton}
                        disabled={isBuying || isWalletLoading || !hasEnoughBalance}
                        onClick={() => buySkin(skin.id)}
                      >
                        {isBuying
                          ? "Buying..."
                          : isWalletLoading
                            ? "Loading..."
                          : hasEnoughBalance
                            ? `Buy for ${formatMoney(skin.priceRub, "RUB")}`
                            : "Not enough balance"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
