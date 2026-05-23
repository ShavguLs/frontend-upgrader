"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "../components/Navbar";
import TopUpModal from "../components/TopUpModal";
import { getSkinRarityColor, getSkinRarityKey } from "../lib/rarity";
import styles from "../page.module.css";

type AuthUser = {
  id: number;
  steamId: string;
  displayName: string;
  avatar?: string | null;
  profileUrl?: string | null;
  steamTradeUrl?: string | null;
  steamTradeUrlVerifiedAt?: string | null;
};

type TradeUrlResponse = {
  id: number;
  steamTradeUrl: string;
  steamTradeUrlVerifiedAt: string;
};

type Wallet = {
  id: number;
  userId: number;
  balance: string | number;
  currency: string;
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
  rarityColor?: string | null;
  exterior?: string | null;
  imageUrl?: string | null;
  priceRub: string | number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type InventoryItem = {
  id: number;
  userId: number;
  skinId: number;
  purchasePriceRub: string | number;
  sellPriceRub: string | number;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  skin: Skin;
};

type SellInventoryItemResponse = {
  item: InventoryItem;
  wallet: Wallet;
};

type WithdrawInventoryItemResponse = {
  item: InventoryItem;
  withdrawal: { id: number; status: string; provider: string };
};

type TopDropWonItem = {
  id: number;
  status: string;
  skin: Skin;
};

type TopDrop = {
  id: number;
  createdAt: string;
  priceRub: string | number;
  wonItem: TopDropWonItem;
};

type TopDropResponse = {
  topDrop: TopDrop | null;
};

type UpgradeHistoryItem = {
  id: number;
  result: "win" | "loss";
  displayedChancePercent: string | number;
  sourceValueRub: string | number;
  targetPriceRub: string | number;
  createdAt: string;
  sourceItem: InventoryItem | null;
  targetSkin: Skin | null;
  wonItem: InventoryItem | null;
};

type UpgradeHistoryResponse = {
  items: UpgradeHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const UPGRADE_HISTORY_PAGE_SIZE = 20;

type ProfileActivityTab = "inventory" | "history";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

const FREE_MODE = process.env.NEXT_PUBLIC_FREE_MODE === "true";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatMoney(value: string | number, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency}`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

function formatSkinDisplayName(skin: {
  weapon?: string | null;
  name: string;
}): string {
  const name = skin.name;
  const weapon = skin.weapon;
  if (!weapon) return name;
  const trimmedName = name.trim();
  const trimmedWeapon = weapon.trim();
  if (
    trimmedName.toLowerCase().startsWith(trimmedWeapon.toLowerCase())
  ) {
    return trimmedName;
  }
  return `${trimmedWeapon} | ${trimmedName}`;
}

function formatWearLabel(exterior?: string | null): string | null {
  if (!exterior) return null;

  const normalized = exterior.toLowerCase().replace(/[-_]+/g, " ").trim();

  if (normalized === "factory new") return "FN";
  if (normalized === "minimal wear") return "MW";
  if (normalized === "field tested") return "FT";
  if (normalized === "well worn") return "WW";
  if (normalized === "battle scarred") return "BS";

  return exterior;
}

async function getResponseError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { message?: string | string[] };
    if (typeof data.message === "string") return data.message;
    if (Array.isArray(data.message) && data.message[0]) return data.message[0];
  } catch {
    return fallback;
  }
  return fallback;
}

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tradeUrlInput, setTradeUrlInput] = useState("");
  const [tradeUrlSaving, setTradeUrlSaving] = useState(false);
  const [tradeUrlError, setTradeUrlError] = useState<string | null>(null);
  const [tradeUrlMessage, setTradeUrlMessage] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpKey, setTopUpKey] = useState(0);
  const [upgradeHistory, setUpgradeHistory] = useState<UpgradeHistoryItem[]>([]);
  const [upgradeHistoryPagination, setUpgradeHistoryPagination] =
    useState<UpgradeHistoryResponse["pagination"] | null>(null);
  const [upgradeHistoryLoading, setUpgradeHistoryLoading] = useState(false);
  const [upgradeHistoryError, setUpgradeHistoryError] = useState<string | null>(
    null,
  );
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [sellingItemId, setSellingItemId] = useState<number | null>(null);
  const [withdrawingItemId, setWithdrawingItemId] = useState<number | null>(
    null,
  );
  const [inventoryActionMessage, setInventoryActionMessage] = useState<
    string | null
  >(null);
  const [inventoryActionError, setInventoryActionError] = useState<
    string | null
  >(null);
  const [topDrop, setTopDrop] = useState<TopDrop | null>(null);
  const [topDropLoading, setTopDropLoading] = useState(false);
  const [topDropError, setTopDropError] = useState<string | null>(null);
  const [activityTab, setActivityTab] = useState<ProfileActivityTab>(
    "inventory",
  );

  async function loadTopDrop() {
    setTopDropLoading(true);
    setTopDropError(null);
    try {
      const res = await fetch(`${API_BASE}/upgrader/top-drop`, {
        credentials: "include",
      });
      if (res.status === 401) {
        setUser(null);
        return;
      }
      if (!res.ok) {
        setTopDropError(
          await getResponseError(res, "Could not load top drop."),
        );
        return;
      }
      const data = (await res.json()) as TopDropResponse;
      setTopDrop(data.topDrop);
    } catch {
      setTopDropError("Could not load top drop.");
    } finally {
      setTopDropLoading(false);
    }
  }

  async function loadInventory() {
    setInventoryLoading(true);
    setInventoryError(null);
    try {
      const res = await fetch(`${API_BASE}/inventory`, {
        credentials: "include",
      });
      if (res.status === 401) {
        setUser(null);
        return;
      }
      if (!res.ok) {
        setInventoryError(
          await getResponseError(res, "Could not load inventory."),
        );
        return;
      }
      const data = (await res.json()) as InventoryItem[];
      setInventory(data);
    } catch {
      setInventoryError("Could not load inventory.");
    } finally {
      setInventoryLoading(false);
    }
  }

  async function loadUpgradeHistory(page = 1) {
    setUpgradeHistoryLoading(true);
    setUpgradeHistoryError(null);
    try {
      const res = await fetch(
        `${API_BASE}/upgrader/history?page=${page}&limit=${UPGRADE_HISTORY_PAGE_SIZE}`,
        { credentials: "include" },
      );
      if (res.status === 401) {
        setUser(null);
        return;
      }
      if (!res.ok) {
        setUpgradeHistoryError(
          await getResponseError(res, "Could not load upgrade history."),
        );
        return;
      }
      const data = (await res.json()) as UpgradeHistoryResponse;
      setUpgradeHistory((current) =>
        page === 1 ? data.items : [...current, ...data.items],
      );
      setUpgradeHistoryPagination(data.pagination);
    } catch {
      setUpgradeHistoryError("Could not load upgrade history.");
    } finally {
      setUpgradeHistoryLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadWallet() {
      setWalletLoading(true);
      try {
        const res = await fetch(`${API_BASE}/wallet`, {
          credentials: "include",
        });
        if (ignore) return;
        if (res.ok) {
          setWallet((await res.json()) as WalletResponse);
        }
      } catch {
        // wallet is optional for this page; silently ignore
      } finally {
        if (!ignore) setWalletLoading(false);
      }
    }

    async function loadUser() {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
        });
        if (ignore) return;
        if (res.status === 401) {
          setUser(null);
        } else if (res.ok) {
          const data = (await res.json()) as AuthUser;
          setUser(data);
          setTradeUrlInput(data.steamTradeUrl ?? "");
          void loadWallet();
          void loadInventory();
          void loadUpgradeHistory(1);
          void loadTopDrop();
        } else {
          setError("Failed to check login status.");
        }
      } catch {
        if (!ignore) setError("Could not reach the server.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadUser();
    return () => {
      ignore = true;
    };
  }, []);

  async function logout() {
    try {
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        window.location.assign("/");
      } else {
        setError("Logout failed.");
      }
    } catch {
      setError("Could not reach the server.");
    }
  }

  function handleTopUp() {
    if (FREE_MODE) {
      setInventoryActionError("Deposits are disabled in free mode.");
      setInventoryActionMessage(null);
      return;
    }
    if (!user) {
      window.location.assign(`${API_BASE}/auth/steam`);
      return;
    }
    setTopUpKey((k) => k + 1);
    setTopUpOpen(true);
  }

  function handleDepositCreated(deposit: Deposit) {
    setWallet((current) =>
      current
        ? { wallet: current.wallet, deposits: [deposit, ...current.deposits] }
        : current,
    );
  }

  function updateWalletBalance(updatedWallet: Wallet) {
    setWallet((current) =>
      current
        ? { wallet: updatedWallet, deposits: current.deposits }
        : current,
    );
  }

  async function sellInventoryItem(inventoryItemId: number) {
    setInventoryActionError(null);
    setInventoryActionMessage(null);
    setSellingItemId(inventoryItemId);

    try {
      const res = await fetch(`${API_BASE}/inventory/sell`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryItemId }),
      });

      if (res.status === 401) {
        setUser(null);
        setInventoryActionError("Please log in with Steam to sell skins.");
        return;
      }

      if (!res.ok) {
        setInventoryActionError(
          await getResponseError(res, "Could not sell skin."),
        );
        return;
      }

      const data = (await res.json()) as SellInventoryItemResponse;
      setInventory((current) =>
        current.filter((item) => item.id !== data.item.id),
      );
      setTopDrop((current) =>
        current && current.wonItem.id === data.item.id
          ? {
              ...current,
              wonItem: { ...current.wonItem, status: data.item.status },
            }
          : current,
      );
      if (wallet) {
        updateWalletBalance(data.wallet);
      }
      setInventoryActionMessage(`${data.item.skin.name} sold successfully.`);
    } catch {
      setInventoryActionError("Could not reach the server.");
    } finally {
      setSellingItemId(null);
    }
  }

  async function withdrawInventoryItem(inventoryItemId: number) {
    setInventoryActionError(null);
    setInventoryActionMessage(null);
    setWithdrawingItemId(inventoryItemId);

    try {
      const res = await fetch(`${API_BASE}/inventory/withdraw`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryItemId }),
      });

      if (res.status === 401) {
        setUser(null);
        setInventoryActionError(
          "Please log in with Steam to withdraw skins.",
        );
        return;
      }

      if (!res.ok) {
        setInventoryActionError(
          await getResponseError(res, "Could not start withdrawal."),
        );
        return;
      }

      const data = (await res.json()) as WithdrawInventoryItemResponse;
      setInventory((current) =>
        current.map((item) =>
          item.id === data.item.id
            ? { ...item, status: data.item.status }
            : item,
        ),
      );
      setTopDrop((current) =>
        current && current.wonItem.id === data.item.id
          ? {
              ...current,
              wonItem: { ...current.wonItem, status: data.item.status },
            }
          : current,
      );
      setInventoryActionMessage(
        "Withdrawal started. Accept the Steam trade offer before it expires.",
      );
    } catch {
      setInventoryActionError("Could not reach the server.");
    } finally {
      setWithdrawingItemId(null);
    }
  }

  async function saveTradeUrl(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const value = tradeUrlInput.trim();
    if (value === "") {
      setTradeUrlError("Trade URL is required.");
      return;
    }

    setTradeUrlSaving(true);
    setTradeUrlError(null);
    setTradeUrlMessage(null);

    try {
      const res = await fetch(`${API_BASE}/auth/me/trade-url`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamTradeUrl: value }),
      });

      if (res.status === 401) {
        setUser(null);
        setTradeUrlError("Please log in with Steam to save your trade URL.");
        return;
      }

      if (!res.ok) {
        setTradeUrlError(
          await getResponseError(res, "Could not save trade URL."),
        );
        return;
      }

      const data = (await res.json()) as TradeUrlResponse;
      setUser((current) =>
        current
          ? {
              ...current,
              steamTradeUrl: data.steamTradeUrl,
              steamTradeUrlVerifiedAt: data.steamTradeUrlVerifiedAt,
            }
          : current,
      );
      setTradeUrlInput(data.steamTradeUrl);
      setTradeUrlMessage("Trade URL saved.");
    } catch {
      setTradeUrlError("Could not reach the server.");
    } finally {
      setTradeUrlSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <Navbar
        user={user}
        wallet={wallet}
        walletLoading={walletLoading}
        apiBase={API_BASE}
        onLogout={logout}
        onTopUp={handleTopUp}
        freeMode={FREE_MODE}
      />
      <main className={styles.main}>
        {loading && <p>Loading profile...</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!loading && !user && (
          <div className={styles.authSection}>
            <h1>Profile</h1>
            <p className={styles.eyebrow}>
              You need to be logged in to view your profile.
            </p>
            <Link className={styles.loginLink} href="/">
              Back to home
            </Link>
          </div>
        )}

        {!loading && user && (
          <div className={`${styles.dashboard} ${styles.profileDashboard}`}>
            <div className={styles.profileHero}>
              <section
                className={`${styles.profileCard} ${styles.profileAccount}`}
              >
                <div className={styles.profileAccountRow}>
                  {user.avatar && (
                    <Image
                      className={styles.profileAccountAvatar}
                      src={user.avatar}
                      alt={user.displayName}
                      width={72}
                      height={72}
                    />
                  )}
                  <div className={styles.profileAccountInfo}>
                    <p className={styles.eyebrow}>Steam account</p>
                    <h2 className={styles.profileAccountName}>
                      {user.displayName}
                    </h2>
                    <p className={styles.profileAccountId}>
                      ID {user.steamId}
                    </p>
                  </div>
                </div>
                {user.profileUrl && (
                  <a
                    href={user.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.profileAccountLink}
                  >
                    Open Steam profile
                  </a>
                )}
              </section>

              <section
                className={`${styles.profileCard} ${styles.profileTopDrop}`}
              >
                <div className={styles.profileTopDropHeader}>
                  <div>
                    <p className={styles.profileTopDropEyebrowGold}>
                      Best Win
                    </p>
                    <h2>Top drop</h2>
                  </div>
                  {topDrop && (
                    <p className={styles.profileTopDropDate}>
                      {formatDate(topDrop.createdAt)}
                    </p>
                  )}
                </div>

                {topDropError && (
                  <p className={styles.error}>{topDropError}</p>
                )}
                {topDropLoading && !topDrop && !topDropError && (
                  <p className={styles.profileTopDropEmpty}>
                    Loading top drop...
                  </p>
                )}
                {!topDropLoading && !topDropError && !topDrop && (
                  <p className={styles.profileTopDropEmpty}>
                    No upgrader wins yet. Win an upgrader attempt to set your
                    top drop.
                  </p>
                )}
                {topDrop && (() => {
                  const skin = topDrop.wonItem.skin;
                  const rarityColor = getSkinRarityColor(skin.rarityColor);
                  const trophyStyle = rarityColor
                    ? ({ "--_rarity": rarityColor } as CSSProperties)
                    : undefined;
                  const wearLabel = formatWearLabel(skin.exterior);
                  const displayName = formatSkinDisplayName(skin);
                  const status = topDrop.wonItem.status;
                  const statusLabel =
                    status === "owned"
                      ? "Owned"
                      : status === "withdraw_pending"
                        ? "Pending withdrawal"
                        : status;
                  const statusChipClass =
                    status === "owned"
                      ? `${styles.profileTopDropChip} ${styles.profileTopDropStatusOk}`
                      : status === "withdraw_pending"
                        ? `${styles.profileTopDropChip} ${styles.profileTopDropStatusPending}`
                        : styles.profileTopDropChip;
                  return (
                    <div
                      className={styles.profileTopDropTrophy}
                      data-rarity={getSkinRarityKey(skin.rarity)}
                      style={trophyStyle}
                    >
                      <div className={styles.profileTopDropImage}>
                        {skin.imageUrl ? (
                          <Image
                            src={skin.imageUrl}
                            alt={displayName}
                            fill
                            sizes="180px"
                            style={{ objectFit: "contain" }}
                          />
                        ) : (
                          <div className={styles.skinTileImagePlaceholder}>
                            No image
                          </div>
                        )}
                      </div>
                      <div className={styles.profileTopDropDetails}>
                        <p className={styles.profileTopDropName}>
                          {displayName}
                        </p>
                        <p className={styles.profileTopDropValue}>
                          {formatMoney(topDrop.priceRub, "RUB")}
                        </p>
                        <div className={styles.profileTopDropChips}>
                          {wearLabel && (
                            <span className={styles.profileTopDropChip}>
                              {wearLabel}
                            </span>
                          )}
                          <span className={statusChipClass}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </section>
            </div>

            {!FREE_MODE && (
            <section className={styles.profileCard}>
              <p className={styles.eyebrow}>Settings</p>
              <h2>Steam trade URL</h2>
              <p className={styles.meta}>
                Required to withdraw skins to your Steam account.
              </p>
              <form className={styles.tradeUrlForm} onSubmit={saveTradeUrl}>
                <label htmlFor="steamTradeUrl" className={styles.eyebrow}>
                  Trade URL
                </label>
                <div className={styles.tradeUrlRow}>
                  <input
                    id="steamTradeUrl"
                    className={styles.tradeUrlInput}
                    type="url"
                    placeholder="https://steamcommunity.com/tradeoffer/new/?partner=...&token=..."
                    value={tradeUrlInput}
                    onChange={(e) => setTradeUrlInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className={styles.actionButton}
                    disabled={tradeUrlSaving}
                  >
                    {tradeUrlSaving ? "Saving..." : "Save"}
                  </button>
                </div>
                {user.steamTradeUrlVerifiedAt && (
                  <p className={styles.tradeUrlStatus}>
                    Verified {formatDate(user.steamTradeUrlVerifiedAt)}
                  </p>
                )}
                {tradeUrlMessage && (
                  <p className={styles.tradeUrlStatus}>{tradeUrlMessage}</p>
                )}
                {tradeUrlError && (
                  <p className={styles.error}>{tradeUrlError}</p>
                )}
              </form>
            </section>
            )}

            <section
              className={`${styles.skinContainer} ${styles.profileActivityContainer}`}
            >
              <header className={styles.skinContainerHead}>
                <div
                  className={styles.invTabs}
                  role="tablist"
                  aria-label="Profile activity"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activityTab === "inventory"}
                    className={
                      activityTab === "inventory"
                        ? `${styles.invTab} ${styles.invTabActive}`
                        : styles.invTab
                    }
                    onClick={() => setActivityTab("inventory")}
                  >
                    <span>My Skins</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activityTab === "history"}
                    className={
                      activityTab === "history"
                        ? `${styles.invTab} ${styles.invTabActive}`
                        : styles.invTab
                    }
                    onClick={() => setActivityTab("history")}
                  >
                    <span>Game History</span>
                  </button>
                </div>
                <span className={styles.skinContainerCount}>
                  {activityTab === "inventory"
                    ? `${inventory.length} items`
                    : `${upgradeHistoryPagination?.total ?? upgradeHistory.length} attempts`}
                </span>
              </header>
              <div className={styles.skinContainerBody}>
                {activityTab === "inventory" && (
                  <div className={styles.profileActivityPane}>
                    {FREE_MODE ? (
                      <p className={styles.profileActivityNotice}>
                        Withdrawals are disabled in free mode.
                      </p>
                    ) : (
                      !user?.steamTradeUrl && (
                        <p className={styles.profileActivityNotice}>
                          Save a Steam trade URL above to enable withdrawals.
                        </p>
                      )
                    )}

                    {inventoryActionMessage && (
                      <p className={styles.tradeUrlStatus}>
                        {inventoryActionMessage}
                      </p>
                    )}
                    {inventoryActionError && (
                      <p className={styles.error}>{inventoryActionError}</p>
                    )}
                    {inventoryError && (
                      <p className={styles.error}>{inventoryError}</p>
                    )}

                    {inventoryLoading && inventory.length === 0 ? (
                      <p className={styles.skinContainerLoading}>
                        Loading inventory...
                      </p>
                    ) : !inventoryError && inventory.length === 0 ? (
                      <p className={styles.skinContainerEmpty}>
                        No skins yet. Buy one from the shop to get started.
                      </p>
                    ) : (
                      <div className={styles.skinTileGrid}>
                        {inventory.map((item) => {
                          const isOwned = item.status === "owned";
                          const isSelling = sellingItemId === item.id;
                          const isWithdrawing = withdrawingItemId === item.id;
                          const statusLabel =
                            item.status === "withdraw_pending"
                              ? "Pending"
                              : item.status === "owned"
                                ? null
                                : item.status;
                          const tileClasses = [styles.skinTile];
                          if (!isOwned)
                            tileClasses.push(styles.skinTileDisabled);
                          const rarityColor = getSkinRarityColor(
                            item.skin.rarityColor,
                          );
                          const tileStyle = rarityColor
                            ? ({ "--_rarity": rarityColor } as CSSProperties)
                            : undefined;
                          return (
                            <article
                              key={item.id}
                              className={tileClasses.join(" ")}
                              data-rarity={getSkinRarityKey(item.skin.rarity)}
                              style={tileStyle}
                            >
                              <div className={styles.skinTileMain}>
                                <span
                                  className={styles.skinTileBar}
                                  aria-hidden="true"
                                />
                                {item.skin.imageUrl ? (
                                  <div className={styles.skinTileImage}>
                                    <Image
                                      src={item.skin.imageUrl}
                                      alt={item.skin.name}
                                      fill
                                      sizes="(max-width: 540px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                      style={{ objectFit: "contain" }}
                                    />
                                  </div>
                                ) : (
                                  <div
                                    className={styles.skinTileImagePlaceholder}
                                  >
                                    No image
                                  </div>
                                )}
                                {formatWearLabel(item.skin.exterior) && (
                                  <span className={styles.skinTileWear}>
                                    {formatWearLabel(item.skin.exterior)}
                                  </span>
                                )}
                                {statusLabel && (
                                  <span className={styles.skinTileStatus}>
                                    {statusLabel}
                                  </span>
                                )}
                                <div className={styles.skinTileInfo}>
                                  {item.skin.weapon && (
                                    <span className={styles.skinTileWeapon}>
                                      {item.skin.weapon}
                                    </span>
                                  )}
                                  <span className={styles.skinTileName}>
                                    {item.skin.name}
                                  </span>
                                  <span className={styles.skinTilePrice}>
                                    {formatMoney(item.sellPriceRub, "RUB")}
                                  </span>
                                </div>
                              </div>
                              <div className={styles.skinTileActions}>
                                <button
                                  type="button"
                                  className={styles.skinTileActionBtn}
                                  disabled={
                                    !isOwned || isSelling || isWithdrawing
                                  }
                                  onClick={() => sellInventoryItem(item.id)}
                                  title={`Sell for ${formatMoney(
                                    item.sellPriceRub,
                                    "RUB",
                                  )}`}
                                >
                                  {isSelling ? "Selling..." : "Sell"}
                                </button>
                                {!FREE_MODE && (
                                  <button
                                    type="button"
                                    className={`${styles.skinTileActionBtn} ${styles.skinTileActionDanger}`}
                                    disabled={
                                      !isOwned ||
                                      isSelling ||
                                      isWithdrawing ||
                                      !user.steamTradeUrl
                                    }
                                    onClick={() =>
                                      withdrawInventoryItem(item.id)
                                    }
                                    title={
                                      user.steamTradeUrl
                                        ? "Withdraw to Steam"
                                        : "Save a Steam trade URL to enable withdrawals"
                                    }
                                  >
                                    {isWithdrawing
                                      ? "Withdrawing..."
                                      : "Withdraw"}
                                  </button>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activityTab === "history" && (
                  <div
                    className={`${styles.profileActivityPane} ${styles.profileHistoryPane}`}
                  >
                    {upgradeHistoryError && (
                      <p className={styles.error}>{upgradeHistoryError}</p>
                    )}
                    {upgradeHistoryLoading &&
                      upgradeHistory.length === 0 && (
                        <p className={styles.skinContainerLoading}>
                          Loading history...
                        </p>
                      )}
                    {!upgradeHistoryLoading &&
                      !upgradeHistoryError &&
                      upgradeHistory.length === 0 && (
                        <p className={styles.skinContainerEmpty}>
                          No upgrade attempts yet.
                        </p>
                      )}
                    {upgradeHistory.length > 0 && (
                      <ul className={styles.upgradeHistoryList}>
                        {upgradeHistory.map((attempt) => {
                          const sourceName =
                            attempt.sourceItem?.skin?.name ?? "Unknown skin";
                          const targetName =
                            attempt.targetSkin?.name ?? "Unknown skin";
                          const wonName = attempt.wonItem?.skin?.name;
                          const resultClass =
                            attempt.result === "win"
                              ? `${styles.status} ${styles.upgradeHistoryResultWin}`
                              : `${styles.status} ${styles.upgradeHistoryResultLoss}`;

                          return (
                            <li
                              className={styles.upgradeHistoryItem}
                              key={attempt.id}
                            >
                              <div className={styles.upgradeHistoryMain}>
                                <span className={resultClass}>
                                  {attempt.result === "win" ? "Won" : "Lost"}
                                </span>
                                <strong>{sourceName}</strong>
                                <span className={styles.meta}>→</span>
                                <strong>{targetName}</strong>
                              </div>
                              <div className={styles.upgradeHistoryDetails}>
                                <span>
                                  Source{" "}
                                  {formatMoney(attempt.sourceValueRub, "RUB")}
                                </span>
                                <span>
                                  Target{" "}
                                  {formatMoney(attempt.targetPriceRub, "RUB")}
                                </span>
                                <span>
                                  Chance{" "}
                                  {Number(
                                    attempt.displayedChancePercent,
                                  ).toFixed(2)}
                                  %
                                </span>
                                <span>{formatDate(attempt.createdAt)}</span>
                                {attempt.result === "win" && wonName && (
                                  <span>Won {wonName}</span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {upgradeHistoryPagination &&
                      upgradeHistoryPagination.page <
                        upgradeHistoryPagination.totalPages && (
                        <button
                          type="button"
                          className={`${styles.actionButton} ${styles.profileHistoryLoadMore}`}
                          disabled={upgradeHistoryLoading}
                          onClick={() =>
                            loadUpgradeHistory(
                              upgradeHistoryPagination.page + 1,
                            )
                          }
                        >
                          {upgradeHistoryLoading
                            ? "Loading..."
                            : "Load more"}
                        </button>
                      )}
                  </div>
                )}
              </div>
            </section>

            {!FREE_MODE && (
              <section className={styles.profileCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p className={styles.eyebrow}>Wallet</p>
                    <h2>Recent deposits</h2>
                  </div>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={handleTopUp}
                  >
                    Top up
                  </button>
                </div>

                {walletLoading && !wallet && (
                  <p className={styles.meta}>Loading deposits...</p>
                )}
                {wallet &&
                  (wallet.deposits.length > 0 ? (
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
                  ))}
              </section>
            )}
          </div>
        )}
      </main>
      {!FREE_MODE && (
        <TopUpModal
          key={topUpKey}
          open={topUpOpen}
          onClose={() => setTopUpOpen(false)}
          apiBase={API_BASE}
          onDepositCreated={handleDepositCreated}
        />
      )}
    </div>
  );
}
