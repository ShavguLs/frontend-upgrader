"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "../components/Navbar";
import TopUpModal from "../components/TopUpModal";
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

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

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
          void loadUpgradeHistory(1);
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
          <div className={styles.dashboard}>
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
                  {user.profileUrl && (
                    <p className={styles.meta}>
                      <a
                        href={user.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Steam profile
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className={styles.card}>
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

            <section className={styles.card}>
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

              {walletLoading && !wallet && <p>Loading deposits...</p>}
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

            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.eyebrow}>History</p>
                  <h2>Upgrade history</h2>
                </div>
                {upgradeHistoryPagination && (
                  <p className={styles.meta}>
                    {upgradeHistoryPagination.total} attempts
                  </p>
                )}
              </div>

              {upgradeHistoryError && (
                <p className={styles.error}>{upgradeHistoryError}</p>
              )}
              {upgradeHistoryLoading && upgradeHistory.length === 0 && (
                <p>Loading history...</p>
              )}
              {!upgradeHistoryLoading &&
                !upgradeHistoryError &&
                upgradeHistory.length === 0 && (
                  <p className={styles.emptyState}>
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
                            Source {formatMoney(attempt.sourceValueRub, "RUB")}
                          </span>
                          <span>
                            Target {formatMoney(attempt.targetPriceRub, "RUB")}
                          </span>
                          <span>
                            Chance{" "}
                            {Number(attempt.displayedChancePercent).toFixed(2)}%
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
                    className={styles.actionButton}
                    disabled={upgradeHistoryLoading}
                    onClick={() =>
                      loadUpgradeHistory(upgradeHistoryPagination.page + 1)
                    }
                  >
                    {upgradeHistoryLoading ? "Loading..." : "Load more"}
                  </button>
                )}
            </section>
          </div>
        )}
      </main>
      <TopUpModal
        key={topUpKey}
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        apiBase={API_BASE}
        onDepositCreated={handleDepositCreated}
      />
    </div>
  );
}
