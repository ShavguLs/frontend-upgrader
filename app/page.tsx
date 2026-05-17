"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";

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

type WithdrawInventoryItemResponse = {
  item: InventoryItem;
  withdrawal: { id: number; status: string; provider: string };
};

type UpgradeChanceTier = 10 | 25 | 50 | 75;

const UPGRADER_CHANCE_TIERS: UpgradeChanceTier[] = [10, 25, 50, 75];

type UpgradeOptionsResponse = {
  sourceValueRub: string | number;
  displayedChancePercent: string | number;
  targetPriceRub: string | number;
  items: Skin[];
};

type UpgradeAttemptResponse = {
  result: "win" | "loss";
  displayedChancePercent: string | number;
  sourceItem: InventoryItem;
  wonItem?: InventoryItem | null;
  targetSkin: Skin;
  attempt: {
    id: number;
    result: string;
    createdAt: string;
  };
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
  const skinsRequestId = useRef(0);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [buyingSkinId, setBuyingSkinId] = useState<number | null>(null);
  const [sellingItemId, setSellingItemId] = useState<number | null>(null);
  const [withdrawingItemId, setWithdrawingItemId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [tradeUrlInput, setTradeUrlInput] = useState("");
  const [tradeUrlSaving, setTradeUrlSaving] = useState(false);
  const [tradeUrlError, setTradeUrlError] = useState<string | null>(null);
  const [tradeUrlMessage, setTradeUrlMessage] = useState<string | null>(null);
  const [minPriceRubInput, setMinPriceRubInput] = useState("");
  const [maxPriceRubInput, setMaxPriceRubInput] = useState("");
  const [catalogSearchInput, setCatalogSearchInput] = useState("");
  const [catalogFilterError, setCatalogFilterError] = useState<string | null>(null);
  const [catalogFilterActive, setCatalogFilterActive] = useState(false);
  const [selectedUpgradeItemId, setSelectedUpgradeItemId] = useState<number | null>(null);
  const [selectedUpgradeChance, setSelectedUpgradeChance] = useState<UpgradeChanceTier | null>(null);
  const [upgradeOptions, setUpgradeOptions] = useState<Skin[]>([]);
  const [selectedTargetSkinId, setSelectedTargetSkinId] = useState<number | null>(null);
  const [upgradeOptionsLoading, setUpgradeOptionsLoading] = useState(false);
  const [upgradeOptionsError, setUpgradeOptionsError] = useState<string | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [upgradeResult, setUpgradeResult] = useState<UpgradeAttemptResponse | null>(null);
  const upgradeOptionsRequestId = useRef(0);
  const [depositAmountInput, setDepositAmountInput] = useState("");
  const [depositCurrencyInput, setDepositCurrencyInput] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositMessage, setDepositMessage] = useState<string | null>(null);

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
    setSelectedUpgradeItemId(null);
    setSelectedUpgradeChance(null);
    setSelectedTargetSkinId(null);
    setUpgradeOptions([]);
    setUpgradeOptionsError(null);
    setUpgradeError(null);
    setUpgradeMessage(null);
    setUpgradeResult(null);
    setDepositLoading(false);
    setDepositError(null);
    setDepositMessage(null);
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
          setTradeUrlInput(data.steamTradeUrl ?? "");
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

    doFetchSkins("", "", "");
    checkAuth();

    return () => {
      ignore = true;
    };
  }, []);

  async function doFetchSkins(search: string, min: string, max: string) {
    const requestId = ++skinsRequestId.current;
    const params = new URLSearchParams({ limit: "24" });
    if (search !== "") params.set("search", search);
    if (min !== "") params.set("minPriceRub", min);
    if (max !== "") params.set("maxPriceRub", max);

    setSkinsLoading(true);
    setSkinsError(null);

    try {
      const res = await fetch(`${API_BASE}/skins?${params}`);
      if (requestId !== skinsRequestId.current) return;
      if (res.ok) {
        const data = (await res.json()) as SkinsResponse;
        setSkins(data.items);
        setSkinsPagination(data.pagination);
      } else {
        setSkinsError("Failed to load skins catalog.");
      }
    } catch {
      if (requestId !== skinsRequestId.current) return;
      setSkinsError("Could not load skins catalog.");
    } finally {
      if (requestId === skinsRequestId.current) {
        setSkinsLoading(false);
      }
    }
  }

  function applyFilter() {
    const search = catalogSearchInput.trim();
    const min = minPriceRubInput.trim();
    const max = maxPriceRubInput.trim();

    if (min !== "") {
      const v = Number(min);
      if (!Number.isFinite(v) || v < 0) {
        setCatalogFilterError("Min price must be a number ≥ 0.");
        return;
      }
    }
    if (max !== "") {
      const v = Number(max);
      if (!Number.isFinite(v) || v < 0) {
        setCatalogFilterError("Max price must be a number ≥ 0.");
        return;
      }
    }
    if (min !== "" && max !== "" && Number(min) > Number(max)) {
      setCatalogFilterError("Min price cannot be greater than max price.");
      return;
    }

    setCatalogFilterError(null);
    setCatalogFilterActive(search !== "" || min !== "" || max !== "");
    doFetchSkins(search, min, max);
  }

  function clearFilter() {
    setCatalogSearchInput("");
    setMinPriceRubInput("");
    setMaxPriceRubInput("");
    setCatalogFilterError(null);
    setCatalogFilterActive(false);
    doFetchSkins("", "", "");
  }

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
        setDepositLoading(false);
        setDepositError(null);
        setDepositMessage(null);
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
        clearSessionState();
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

  async function createDeposit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      window.location.href = `${API_BASE}/auth/steam`;
      return;
    }

    const amountTrimmed = depositAmountInput.trim();

    if (amountTrimmed === "") {
      setDepositError("Enter an amount in RUB.");
      setDepositMessage(null);
      return;
    }

    const amountRub = Number(amountTrimmed);

    if (!Number.isFinite(amountRub) || amountRub <= 0) {
      setDepositError("Amount must be a positive number.");
      setDepositMessage(null);
      return;
    }

    if (amountRub < 100) {
      setDepositError("Minimum deposit is 100 RUB.");
      setDepositMessage(null);
      return;
    }

    const currency = depositCurrencyInput.trim();

    setDepositLoading(true);
    setDepositError(null);
    setDepositMessage(null);

    try {
      const res = await fetch(`${API_BASE}/wallet/deposits`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountRub,
          ...(currency ? { currency } : {}),
        }),
      });

      if (res.status === 401) {
        clearSessionState();
        setDepositError("Please log in with Steam to create a deposit.");
        return;
      }

      if (!res.ok) {
        setDepositError(
          await getResponseError(res, "Could not create deposit."),
        );
        return;
      }

      const deposit = (await res.json()) as Deposit;

      setWallet((current) =>
        current
          ? { wallet: current.wallet, deposits: [deposit, ...current.deposits] }
          : current,
      );
      setDepositAmountInput("");

      if (deposit.invoiceUrl) {
        window.location.href = deposit.invoiceUrl;
        return;
      }

      setDepositMessage("Deposit invoice created.");
    } catch {
      setDepositError("Could not reach the server.");
    } finally {
      setDepositLoading(false);
    }
  }

  async function withdrawInventoryItem(inventoryItemId: number) {
    setActionError(null);
    setActionMessage(null);
    setWithdrawingItemId(inventoryItemId);

    try {
      const res = await fetch(`${API_BASE}/inventory/withdraw`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryItemId }),
      });

      if (res.status === 401) {
        clearSessionState();
        setActionError("Please log in with Steam to withdraw skins.");
        return;
      }

      if (!res.ok) {
        setActionError(
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
      if (
        selectedUpgradeItemId === data.item.id &&
        data.item.status !== "owned"
      ) {
        setSelectedUpgradeItemId(null);
        setSelectedTargetSkinId(null);
        setUpgradeOptions([]);
      }
      setActionMessage(
        "Withdrawal started. Accept the Steam trade offer before it expires.",
      );
    } catch {
      setActionError("Could not reach the server.");
    } finally {
      setWithdrawingItemId(null);
    }
  }

  async function loadUpgradeOptions(
    itemId: number | null,
    chance: UpgradeChanceTier | null,
  ) {
    if (itemId === null || chance === null) {
      ++upgradeOptionsRequestId.current;
      setUpgradeOptionsLoading(false);
      setUpgradeOptions([]);
      setUpgradeOptionsError(null);
      return;
    }

    const requestId = ++upgradeOptionsRequestId.current;
    setUpgradeOptionsLoading(true);
    setUpgradeOptionsError(null);
    setUpgradeOptions([]);

    const params = new URLSearchParams({
      inventoryItemId: String(itemId),
      chance: String(chance),
    });

    try {
      const res = await fetch(`${API_BASE}/upgrader/options?${params}`, {
        credentials: "include",
      });
      if (requestId !== upgradeOptionsRequestId.current) return;

      if (res.status === 401) {
        clearSessionState();
        return;
      }

      if (!res.ok) {
        setUpgradeOptionsError(
          await getResponseError(res, "Could not load upgrade options."),
        );
        return;
      }

      const data = (await res.json()) as UpgradeOptionsResponse;
      setUpgradeOptions(data.items);
    } catch {
      if (requestId !== upgradeOptionsRequestId.current) return;
      setUpgradeOptionsError("Could not load upgrade options.");
    } finally {
      if (requestId === upgradeOptionsRequestId.current) {
        setUpgradeOptionsLoading(false);
      }
    }
  }

  function selectUpgradeItem(itemId: number) {
    setUpgradeError(null);
    setUpgradeMessage(null);
    setUpgradeResult(null);
    setSelectedTargetSkinId(null);
    const next = selectedUpgradeItemId === itemId ? null : itemId;
    setSelectedUpgradeItemId(next);
    void loadUpgradeOptions(next, selectedUpgradeChance);
  }

  function selectUpgradeChance(chance: UpgradeChanceTier) {
    setUpgradeError(null);
    setUpgradeMessage(null);
    setUpgradeResult(null);
    setSelectedTargetSkinId(null);
    const next = selectedUpgradeChance === chance ? null : chance;
    setSelectedUpgradeChance(next);
    void loadUpgradeOptions(selectedUpgradeItemId, next);
  }

  async function performUpgrade() {
    if (
      selectedUpgradeItemId === null ||
      selectedTargetSkinId === null ||
      selectedUpgradeChance === null
    ) {
      return;
    }

    setUpgradeError(null);
    setUpgradeMessage(null);
    setUpgradeResult(null);
    setUpgradeLoading(true);

    try {
      const res = await fetch(`${API_BASE}/upgrader/attempt`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryItemId: selectedUpgradeItemId,
          targetSkinId: selectedTargetSkinId,
          chance: selectedUpgradeChance,
        }),
      });

      if (res.status === 401) {
        clearSessionState();
        setUpgradeError("Please log in with Steam to upgrade skins.");
        return;
      }

      if (!res.ok) {
        setUpgradeError(
          await getResponseError(res, "Could not run the upgrade."),
        );
        return;
      }

      const data = (await res.json()) as UpgradeAttemptResponse;
      setUpgradeResult(data);
      setInventory((current) => {
        const withoutSource = current.filter((item) => item.id !== data.sourceItem.id);
        if (data.result === "win" && data.wonItem) {
          return [data.wonItem, ...withoutSource];
        }
        return withoutSource;
      });
      setSelectedUpgradeItemId(null);
      setSelectedTargetSkinId(null);
      setUpgradeOptions([]);
      setUpgradeMessage(
        data.result === "win"
          ? `Upgrade won. ${data.targetSkin.name} added to your inventory.`
          : `Upgrade lost. ${data.sourceItem.skin.name} was consumed.`,
      );
    } catch {
      setUpgradeError("Could not reach the server.");
    } finally {
      setUpgradeLoading(false);
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
      if (selectedUpgradeItemId === data.item.id) {
        setSelectedUpgradeItemId(null);
        setSelectedTargetSkinId(null);
        setUpgradeOptions([]);
      }
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
              <form className={styles.tradeUrlForm} onSubmit={saveTradeUrl}>
                <label htmlFor="steamTradeUrl" className={styles.eyebrow}>
                  Steam trade URL
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
              <p className={styles.eyebrow}>Wallet balance</p>
              {walletLoading && <p>Loading wallet...</p>}
              {walletError && <p className={styles.error}>{walletError}</p>}
              {!walletLoading && wallet && (
                <>
                  <p className={styles.balance}>
                    {formatMoney(wallet.wallet.balance, wallet.wallet.currency)}
                  </p>

                  <form
                    className={styles.tradeUrlForm}
                    onSubmit={createDeposit}
                  >
                    <label htmlFor="depositAmount" className={styles.eyebrow}>
                      Deposit
                    </label>
                    <div className={styles.tradeUrlRow}>
                      <input
                        id="depositAmount"
                        className={styles.tradeUrlInput}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount in RUB"
                        value={depositAmountInput}
                        onChange={(e) =>
                          setDepositAmountInput(e.target.value)
                        }
                      />
                      <input
                        id="depositCurrency"
                        className={styles.tradeUrlInput}
                        type="text"
                        placeholder="Currency, optional"
                        value={depositCurrencyInput}
                        onChange={(e) =>
                          setDepositCurrencyInput(e.target.value)
                        }
                      />
                      <button
                        type="submit"
                        className={styles.actionButton}
                        disabled={depositLoading}
                      >
                        {depositLoading ? "Creating..." : "Deposit"}
                      </button>
                    </div>
                    {depositMessage && (
                      <p className={styles.tradeUrlStatus}>{depositMessage}</p>
                    )}
                    {depositError && (
                      <p className={styles.error}>{depositError}</p>
                    )}
                  </form>

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
                          disabled={
                            sellingItemId === item.id ||
                            item.status !== "owned" ||
                            withdrawingItemId === item.id
                          }
                          onClick={() => sellInventoryItem(item.id)}
                        >
                          {sellingItemId === item.id
                            ? "Selling..."
                            : item.status === "withdraw_pending"
                              ? "Withdrawal pending"
                              : `Sell for ${formatMoney(item.sellPriceRub, "RUB")}`}
                        </button>
                        <button
                          className={styles.actionButton}
                          disabled={
                            withdrawingItemId === item.id ||
                            item.status !== "owned" ||
                            sellingItemId === item.id ||
                            !user.steamTradeUrl
                          }
                          onClick={() => withdrawInventoryItem(item.id)}
                          title={
                            user.steamTradeUrl
                              ? undefined
                              : "Save a Steam trade URL to enable withdrawals"
                          }
                        >
                          {withdrawingItemId === item.id
                            ? "Withdrawing..."
                            : item.status === "withdraw_pending"
                              ? "Withdrawal pending"
                              : "Withdraw"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {(() => {
              const ownedItems = inventory.filter(
                (item) => item.status === "owned",
              );
              const selectedSource = ownedItems.find(
                (item) => item.id === selectedUpgradeItemId,
              );
              const selectedTarget = upgradeOptions.find(
                (skin) => skin.id === selectedTargetSkinId,
              );
              const canUpgrade =
                selectedSource && selectedTarget && !upgradeLoading;

              return (
                <section className={styles.card}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p className={styles.eyebrow}>Upgrader</p>
                      <h2>Risk a skin for a higher-priced one</h2>
                    </div>
                  </div>

                  <div className={styles.upgraderLayout}>
                    <div className={styles.upgraderSubsection}>
                      <h3>1. Choose a source skin</h3>
                      {ownedItems.length === 0 ? (
                        <p className={styles.upgraderEmpty}>
                          You need an owned skin to upgrade.
                        </p>
                      ) : (
                        <div className={styles.skinGrid}>
                          {ownedItems.map((item) => {
                            const isSelected =
                              item.id === selectedUpgradeItemId;
                            const cardClass = isSelected
                              ? `${styles.skinCard} ${styles.upgraderCard} ${styles.upgraderCardSelected}`
                              : `${styles.skinCard} ${styles.upgraderCard}`;

                            return (
                              <article
                                className={cardClass}
                                key={`upgrade-source-${item.id}`}
                                onClick={() => selectUpgradeItem(item.id)}
                              >
                                <div className={styles.skinImageWrap}>
                                  <SkinImage skin={item.skin} />
                                </div>
                                <div className={styles.skinCardBody}>
                                  <h3>{item.skin.name}</h3>
                                  <p className={styles.meta}>
                                    Sell value{" "}
                                    {formatMoney(item.sellPriceRub, "RUB")}
                                  </p>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className={styles.upgraderSubsection}>
                      <h3>2. Choose a displayed chance</h3>
                      <div className={styles.upgraderChanceRow}>
                        {UPGRADER_CHANCE_TIERS.map((tier) => {
                          const isActive = selectedUpgradeChance === tier;
                          return (
                            <button
                              type="button"
                              key={`upgrade-chance-${tier}`}
                              className={
                                isActive
                                  ? `${styles.upgraderChanceButton} ${styles.upgraderChanceButtonActive}`
                                  : styles.upgraderChanceButton
                              }
                              disabled={selectedUpgradeItemId === null}
                              onClick={() => selectUpgradeChance(tier)}
                            >
                              {tier}%
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className={styles.upgraderSubsection}>
                      <h3>3. Choose a target skin</h3>
                      {selectedUpgradeItemId === null ||
                      selectedUpgradeChance === null ? (
                        <p className={styles.upgraderEmpty}>
                          Select a source skin and a chance tier to see target
                          options.
                        </p>
                      ) : upgradeOptionsLoading ? (
                        <p>Loading target options...</p>
                      ) : upgradeOptionsError ? (
                        <p className={styles.error}>{upgradeOptionsError}</p>
                      ) : upgradeOptions.length === 0 ? (
                        <p className={styles.upgraderEmpty}>
                          No target skins available for this chance tier.
                        </p>
                      ) : (
                        <div className={styles.skinGrid}>
                          {upgradeOptions.map((skin) => {
                            const isSelected =
                              skin.id === selectedTargetSkinId;
                            const cardClass = isSelected
                              ? `${styles.skinCard} ${styles.upgraderCard} ${styles.upgraderCardSelected}`
                              : `${styles.skinCard} ${styles.upgraderCard}`;

                            return (
                              <article
                                className={cardClass}
                                key={`upgrade-target-${skin.id}`}
                                onClick={() => {
                                  setUpgradeError(null);
                                  setUpgradeResult(null);
                                  setSelectedTargetSkinId((current) =>
                                    current === skin.id ? null : skin.id,
                                  );
                                }}
                              >
                                <div className={styles.skinImageWrap}>
                                  <SkinImage skin={skin} />
                                </div>
                                <div className={styles.skinCardBody}>
                                  <h3>{skin.name}</h3>
                                  <p className={styles.skinPrice}>
                                    {formatMoney(skin.priceRub, "RUB")}
                                  </p>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className={styles.upgraderSummary}>
                      <div>
                        <strong>Source</strong>
                        {selectedSource
                          ? selectedSource.skin.name
                          : "No skin selected"}
                      </div>
                      <div>
                        <strong>Source sell value</strong>
                        {selectedSource
                          ? formatMoney(selectedSource.sellPriceRub, "RUB")
                          : "—"}
                      </div>
                      <div>
                        <strong>Target</strong>
                        {selectedTarget
                          ? selectedTarget.name
                          : "No target selected"}
                      </div>
                      <div>
                        <strong>Target price</strong>
                        {selectedTarget
                          ? formatMoney(selectedTarget.priceRub, "RUB")
                          : "—"}
                      </div>
                      <div>
                        <strong>Displayed chance</strong>
                        {selectedUpgradeChance !== null
                          ? `${selectedUpgradeChance}%`
                          : "—"}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.actionButton}
                      disabled={!canUpgrade}
                      onClick={performUpgrade}
                    >
                      {upgradeLoading ? "Upgrading..." : "Upgrade"}
                    </button>

                    {upgradeError && (
                      <p className={styles.error}>{upgradeError}</p>
                    )}
                    {upgradeMessage && (
                      <p className={styles.actionMessage}>{upgradeMessage}</p>
                    )}
                    {upgradeResult && (
                      <p
                        className={
                          upgradeResult.result === "win"
                            ? `${styles.upgraderResult} ${styles.upgraderResultWin}`
                            : `${styles.upgraderResult} ${styles.upgraderResultLoss}`
                        }
                      >
                        {upgradeResult.result === "win"
                          ? "Upgrade won"
                          : "Upgrade lost"}
                      </p>
                    )}
                  </div>
                </section>
              );
            })()}
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

          <form
            className={styles.catalogFilters}
            onSubmit={(e) => { e.preventDefault(); applyFilter(); }}
          >
            <div className={`${styles.filterField} ${styles.filterFieldSearch}`}>
              <label htmlFor="catalogSearch">Search skins</label>
              <input
                id="catalogSearch"
                className={styles.filterInput}
                type="search"
                placeholder="AK-47, Redline, Doppler"
                value={catalogSearchInput}
                onChange={(e) => setCatalogSearchInput(e.target.value)}
              />
            </div>
            <div className={styles.filterField}>
              <label htmlFor="minPriceRub">Min price (RUB)</label>
              <input
                id="minPriceRub"
                className={styles.filterInput}
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={minPriceRubInput}
                onChange={(e) => setMinPriceRubInput(e.target.value)}
              />
            </div>
            <div className={styles.filterField}>
              <label htmlFor="maxPriceRub">Max price (RUB)</label>
              <input
                id="maxPriceRub"
                className={styles.filterInput}
                type="number"
                min="0"
                step="0.01"
                placeholder="Any"
                value={maxPriceRubInput}
                onChange={(e) => setMaxPriceRubInput(e.target.value)}
              />
            </div>
            <div className={styles.filterActions}>
              <button type="submit" className={styles.actionButton}>
                Apply
              </button>
              <button
                type="button"
                className={`${styles.actionButton} ${styles.filterClearButton}`}
                onClick={clearFilter}
              >
                Clear
              </button>
            </div>
          </form>
          {catalogFilterError && (
            <p className={`${styles.error} ${styles.filterError}`}>{catalogFilterError}</p>
          )}
          {skinsLoading && <p>Loading skins catalog...</p>}
          {skinsError && <p className={styles.error}>{skinsError}</p>}
          {!skinsLoading && !skinsError && skins.length === 0 && (
            <p className={styles.emptyState}>
              {catalogFilterActive
                ? "No skins match the selected filters."
                : "No skins available."}
            </p>
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
