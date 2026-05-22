"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Image from "next/image";
import styles from "./page.module.css";
import LiveDropsSidebar from "./components/LiveDropsSidebar";
import Navbar from "./components/Navbar";
import TopUpModal from "./components/TopUpModal";
import { getSkinRarityColor, getSkinRarityKey } from "./lib/rarity";
import {
  clearScheduledSounds,
  playAddSound,
  playBuySound,
  playDeselectSound,
  playRemoveSound,
  playSelectSound,
  scheduleSpinTicks,
} from "./lib/sfx";

type AuthUser = {
  id: number;
  steamId: string;
  displayName: string;
  avatar?: string | null;
  profileUrl?: string | null;
  steamTradeUrl?: string | null;
  steamTradeUrlVerifiedAt?: string | null;
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
  rarityColor?: string | null;
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

type BuySkinsBulkResponse = {
  items: InventoryItem[];
  wallet: Wallet;
  totalPriceRub: string;
};

type UpgradeChanceTier = 10 | 25 | 50 | 75;

const UPGRADER_CHANCE_TIERS: UpgradeChanceTier[] = [10, 25, 50, 75];
const INVENTORY_PAGE_SIZE = 12;
const SHOP_PAGE_SIZE = 12;
const TARGET_PAGE_SIZE = 12;
const WHEEL_SPIN_DURATION_MS = 3400;
const WHEEL_FINALIZE_MS = 3500;

type UpgradeOptionSkin = Skin & {
  receivedValueRub: string | number;
  displayedChancePercent: string | number;
};

type UpgradeOptionsResponse = {
  sourceValueRub: string | number;
  requestedChancePercent?: string | number;
  displayedChancePercent: string | number;
  targetValueRub: string | number;
  items: UpgradeOptionSkin[];
};

type UpgradeAttemptResponse = {
  result: "win" | "loss";
  displayedChancePercent: string | number;
  targetReceivedValueRub: string | number;
  sourceItem: InventoryItem;
  wonItem?: InventoryItem | null;
  targetSkin: Skin;
  attempt: {
    id: number;
    result: string;
    createdAt: string;
  };
};

type InventorySort = "price-desc" | "price-asc" | "name";
type WheelState = "idle" | "spinning" | "win" | "loss";
type InventoryTab = "mine" | "shop";

type ToastVariant = "success" | "error";

type ToastMessage = {
  id: number;
  message: string;
  variant: ToastVariant;
};

const TOAST_DURATION_MS = 2200;

function ToastSuccessIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="4 12 10 18 20 6" />
    </svg>
  );
}

function ToastErrorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function UpgraderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 19 19 5" />
      <path d="M8 5h11v11" />
      <path d="M6.5 13.5 4 16l4 4 2.5-2.5" />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <ellipse cx="12" cy="12" rx="4" ry="8.5" />
      <path d="M5.2 9h13.6M5.2 15h13.6" />
    </svg>
  );
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

const FREE_MODE = process.env.NEXT_PUBLIC_FREE_MODE === "true";

const FREE_MODE_AGENT_IMAGE_URL =
  "https://steamcommunity-a.akamaihd.net/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIa-2lmxU-LR0dnuNm6E8Vl45Iv181z1fgn8oYby8iRe_OGnZ6psLM-FD3WZj7wuseM-GnG2lh4h5m2EmderdX7DaA9zW8N2QuBbtBG-mty2N-i0tADAy9USaSI87As/512fx384f";

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

function formatMoneyAmount(value: string | number) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return String(value);
  }

  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatChancePercent(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return amount.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function MoneyLabel({ value }: { value: string | number }) {
  return (
    <span className={styles.moneyLabel}>
      <CoinIcon />
      <span>{formatMoneyAmount(value)}</span>
    </span>
  );
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

function sortInventoryItems(
  items: InventoryItem[],
  sort: InventorySort,
): InventoryItem[] {
  const copy = items.slice();
  if (sort === "price-desc") {
    copy.sort((a, b) => Number(b.sellPriceRub) - Number(a.sellPriceRub));
  } else if (sort === "price-asc") {
    copy.sort((a, b) => Number(a.sellPriceRub) - Number(b.sellPriceRub));
  } else if (sort === "name") {
    copy.sort((a, b) => a.skin.name.localeCompare(b.skin.name));
  }
  return copy;
}

function filterInventoryItems(
  items: InventoryItem[],
  search: string,
  min: number | null,
  max: number | null,
): InventoryItem[] {
  const q = search.trim().toLowerCase();
  return items.filter((item) => {
    const price = Number(item.sellPriceRub);
    if (min !== null && Number.isFinite(price) && price < min) return false;
    if (max !== null && Number.isFinite(price) && price > max) return false;
    if (q !== "") {
      const hay = [
        item.skin.name,
        item.skin.weapon,
        item.skin.exterior,
        item.skin.marketHashName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function computeNextWheelRotation(
  currentRotation: number,
  chancePercent: number,
  win: boolean,
): number {
  const chanceFrac = Math.max(0, Math.min(1, chancePercent / 100));
  const winEnd = chanceFrac * 360;
  const segStart = win ? 0 : winEnd;
  const segEnd = win ? winEnd : 360;
  const segSize = Math.max(0, segEnd - segStart);
  const margin = Math.max(2, segSize * 0.1);
  const usable = Math.max(0, segSize - 2 * margin);
  const target = segStart + margin + Math.random() * usable;
  const currentMod = (((-currentRotation) % 360) + 360) % 360;
  const delta = 5 * 360 + target - currentMod;
  return currentRotation - delta;
}

function SkinTileImage({ skin }: { skin: Skin }) {
  if (!skin.imageUrl) {
    return (
      <div className={styles.skinTileImagePlaceholder}>No image</div>
    );
  }

  return (
    <div className={styles.skinTileImage}>
      <Image
        src={skin.imageUrl}
        alt={skin.name}
        fill
        sizes="(max-width: 540px) 50vw, (max-width: 1200px) 33vw, 25vw"
        style={{ objectFit: "contain" }}
      />
    </div>
  );
}

function UpgraderSlotImage({ skin }: { skin: Skin }) {
  if (!skin.imageUrl) {
    return null;
  }

  return (
    <div className={styles.upgraderSlotImage}>
      <Image
        src={skin.imageUrl}
        alt={skin.name}
        fill
        sizes="220px"
        style={{ objectFit: "contain" }}
      />
    </div>
  );
}

type SkinTileProps = {
  skin: Skin;
  rarityKey: string;
  priceLabel: ReactNode;
  priceSubLabel?: string;
  wearLabel?: string | null;
  statusLabel?: string | null;
  selected?: boolean;
  disabled?: boolean;
  selectable?: boolean;
  onSelect?: () => void;
  actions?: ReactNode;
};

function SkinTile({
  skin,
  rarityKey,
  priceLabel,
  priceSubLabel,
  wearLabel,
  statusLabel,
  selected,
  disabled,
  selectable,
  onSelect,
  actions,
}: SkinTileProps) {
  const classes = [styles.skinTile];
  if (selected) classes.push(styles.skinTileSelected);
  if (disabled) classes.push(styles.skinTileDisabled);

  const rarityColor = getSkinRarityColor(skin.rarityColor);
  const style = rarityColor
    ? ({ "--_rarity": rarityColor } as CSSProperties)
    : undefined;

  return (
    <article
      className={classes.join(" ")}
      data-rarity={rarityKey}
      style={style}
    >
      <button
        type="button"
        className={styles.skinTileButton}
        onClick={selectable ? onSelect : undefined}
        disabled={disabled || !selectable}
        aria-pressed={selected ? true : undefined}
      >
        <div className={styles.skinTileMain}>
          <span className={styles.skinTileBar} aria-hidden="true" />
          <SkinTileImage skin={skin} />
          {wearLabel && (
            <span className={styles.skinTileWear}>{wearLabel}</span>
          )}
          {statusLabel && (
            <span className={styles.skinTileStatus}>{statusLabel}</span>
          )}
          <div className={styles.skinTileInfo}>
            <span className={styles.skinTileName}>{skin.name}</span>
            <span className={styles.skinTilePrice}>{priceLabel}</span>
            {priceSubLabel && (
              <span className={styles.skinTilePriceSub}>{priceSubLabel}</span>
            )}
          </div>
        </div>
      </button>
      {actions && <div className={styles.skinTileActions}>{actions}</div>}
    </article>
  );
}

type SkinContainerProps = {
  title?: ReactNode;
  headerLeft?: ReactNode;
  count?: number;
  total?: ReactNode;
  totalLabel?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

function SkinContainer({
  title,
  headerLeft,
  count,
  total,
  totalLabel,
  toolbar,
  children,
  footer,
}: SkinContainerProps) {
  return (
    <section className={styles.skinContainer}>
      <header className={styles.skinContainerHead}>
        {headerLeft ?? (title ? <h3>{title}</h3> : null)}
        {typeof count === "number" && (
          <span className={styles.skinContainerCount}>{count}</span>
        )}
        {total && (
          <span className={styles.skinContainerTotal}>
            <span className={styles.skinContainerTotalIcon} aria-hidden="true">
              <CoinIcon />
            </span>
            {totalLabel && <small>{totalLabel}</small>}
            {total}
          </span>
        )}
      </header>
      {toolbar && <div className={styles.skinToolbar}>{toolbar}</div>}
      <div className={styles.skinContainerBody}>{children}</div>
      {footer}
    </section>
  );
}

type SkinPagerProps = {
  page: number;
  totalPages: number;
  rangeFrom: number;
  rangeTo: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
};

function SkinPager({
  page,
  totalPages,
  rangeFrom,
  rangeTo,
  total,
  onPrev,
  onNext,
}: SkinPagerProps) {
  if (total === 0) return null;
  return (
    <div className={styles.skinPager}>
      <span className={styles.skinPagerInfo}>
        <b>
          {rangeFrom}–{rangeTo}
        </b>{" "}
        of <b>{total}</b>
      </span>
      <div className={styles.skinPagerCtrls}>
        <button
          type="button"
          className={styles.skinPagerBtn}
          onClick={onPrev}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 6 9 12 15 18" />
          </svg>
        </button>
        <span className={styles.skinPagerPage}>
          <span>{page}</span>
          <span className="of">/</span>
          <span>{totalPages}</span>
        </span>
        <button
          type="button"
          className={styles.skinPagerBtn}
          onClick={onNext}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

type UpgraderSlotProps = {
  side: "source" | "target";
  skin: Skin | null;
  priceLabel?: ReactNode;
};

function UpgraderSlot({ side, skin, priceLabel }: UpgraderSlotProps) {
  const classes = [styles.upgraderSlot];
  if (skin) classes.push(styles.upgraderSlotFilled);
  const label = side === "source" ? "Your Skin" : "Target";
  const rarityKey = skin ? getSkinRarityKey(skin.rarity) : undefined;
  const rarityColor = skin ? getSkinRarityColor(skin.rarityColor) : null;
  const style = rarityColor
    ? ({ "--_rarity": rarityColor } as CSSProperties)
    : undefined;

  return (
    <div
      className={classes.join(" ")}
      data-rarity={rarityKey}
      style={style}
    >
      <span className={styles.upgraderSlotLabel}>{label}</span>
      {skin ? (
        <>
          <UpgraderSlotImage skin={skin} />
          <div className={styles.upgraderSlotInfo}>
            <span className={styles.upgraderSlotName}>{skin.name}</span>
            {priceLabel && (
              <span className={styles.upgraderSlotPrice}>{priceLabel}</span>
            )}
          </div>
        </>
      ) : (
        <div className={styles.upgraderSlotPlaceholder}>
          <svg
            viewBox="0 0 24 24"
            width="28"
            height="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {side === "source" ? (
              <>
                <path d="M4 8h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="1.4" fill="currentColor" />
              </>
            )}
          </svg>
          <span>
            Pick from
            <br />
            {side === "source" ? "My Skins" : "Target"}
          </span>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const [selectedShopSkins, setSelectedShopSkins] = useState<Map<number, Skin>>(
    () => new Map(),
  );
  const [bulkBuying, setBulkBuying] = useState(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const toastTimeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Shop filters (server-side)
  const [shopSearchInput, setShopSearchInput] = useState("");
  const [shopMinInput, setShopMinInput] = useState("");
  const [shopMaxInput, setShopMaxInput] = useState("");
  const [shopPage, setShopPage] = useState(1);
  const [shopFilterError, setShopFilterError] = useState<string | null>(null);
  const [shopFilterActive, setShopFilterActive] = useState(false);

  // My Skins client-side filters
  const [inventorySearchInput, setInventorySearchInput] = useState("");
  const [inventoryMinInput, setInventoryMinInput] = useState("");
  const [inventoryMaxInput, setInventoryMaxInput] = useState("");
  const [inventorySort, setInventorySort] =
    useState<InventorySort>("price-desc");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>("mine");

  // Upgrader
  const [selectedUpgradeItemId, setSelectedUpgradeItemId] = useState<
    number | null
  >(null);
  const [selectedUpgradeChance, setSelectedUpgradeChance] =
    useState<UpgradeChanceTier>(25);
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOptionSkin[]>([]);
  const [targetPage, setTargetPage] = useState(1);
  const [selectedTargetSkinId, setSelectedTargetSkinId] = useState<
    number | null
  >(null);
  const [upgradeOptionsLoading, setUpgradeOptionsLoading] = useState(false);
  const [upgradeOptionsError, setUpgradeOptionsError] = useState<string | null>(
    null,
  );
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  // Wheel
  const [wheelState, setWheelState] = useState<WheelState>("idle");
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelChancePercent, setWheelChancePercent] = useState<number>(25);
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundTimeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const upgradeOptionsRequestId = useRef(0);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpKey, setTopUpKey] = useState(0);
  const [freeModeModalOpen, setFreeModeModalOpen] = useState(false);

  useEffect(() => {
    if (!FREE_MODE) return;
    let shouldOpen = true;
    try {
      if (window.localStorage.getItem("freeModeModalSeen") === "1") {
        shouldOpen = false;
      } else {
        window.localStorage.setItem("freeModeModalSeen", "1");
      }
    } catch {
      // localStorage unavailable — still show the modal
    }
    if (shouldOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFreeModeModalOpen(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
      for (const handle of toastTimeoutRefs.current) {
        clearTimeout(handle);
      }
      toastTimeoutRefs.current = [];
      clearScheduledSounds(soundTimeoutRefs.current);
      soundTimeoutRefs.current = [];
    };
  }, []);

  function showToast(message: string, variant: ToastVariant = "success") {
    const id = ++toastIdRef.current;
    setToasts((current) => [...current, { id, message, variant }]);
    const handle = setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
      toastTimeoutRefs.current = toastTimeoutRefs.current.filter(
        (h) => h !== handle,
      );
    }, TOAST_DURATION_MS);
    toastTimeoutRefs.current.push(handle);
  }

  function handleTopUp() {
    if (FREE_MODE) {
      showToast("Deposits are disabled in free mode.", "error");
      return;
    }
    if (!user) {
      window.location.assign(`${API_BASE}/auth/steam`);
      return;
    }
    setTopUpKey((k) => k + 1);
    setTopUpOpen(true);
  }

  function updateWallet(updatedWallet: Wallet) {
    setWallet((current) => ({
      wallet: updatedWallet,
      deposits: current?.deposits ?? [],
    }));
  }

  function clearSessionState() {
    setUser(null);
    setWallet(null);
    setInventory([]);
    setInventoryError(null);
    setSelectedUpgradeItemId(null);
    setSelectedTargetSkinId(null);
    setUpgradeOptions([]);
    setTargetPage(1);
    setUpgradeOptionsError(null);
    setTopUpOpen(false);
    setSelectedShopSkins(new Map());
  }

  function toggleShopSkinSelection(skin: Skin) {
    if (bulkBuying) return;
    setSelectedShopSkins((current) => {
      const next = new Map(current);
      if (next.has(skin.id)) {
        next.delete(skin.id);
        playRemoveSound();
      } else {
        next.set(skin.id, skin);
        playAddSound();
      }
      return next;
    });
  }

  useEffect(() => {
    let ignore = false;

    async function loadWallet() {
      setWalletLoading(true);

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
          return false;
        }
      } catch {
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

    doFetchSkins("", "", "", 1);
    checkAuth();

    return () => {
      ignore = true;
    };
  }, []);

  async function doFetchSkins(
    search: string,
    min: string,
    max: string,
    page: number,
  ) {
    const requestId = ++skinsRequestId.current;
    const params = new URLSearchParams({
      limit: String(SHOP_PAGE_SIZE),
      page: String(page),
    });
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

  function applyShopFilter() {
    const search = shopSearchInput.trim();
    const min = shopMinInput.trim();
    const max = shopMaxInput.trim();

    if (min !== "") {
      const v = Number(min);
      if (!Number.isFinite(v) || v < 0) {
        setShopFilterError("Min price must be a number ≥ 0.");
        return;
      }
    }
    if (max !== "") {
      const v = Number(max);
      if (!Number.isFinite(v) || v < 0) {
        setShopFilterError("Max price must be a number ≥ 0.");
        return;
      }
    }
    if (min !== "" && max !== "" && Number(min) > Number(max)) {
      setShopFilterError("Min price cannot be greater than max price.");
      return;
    }

    setShopFilterError(null);
    setShopFilterActive(search !== "" || min !== "" || max !== "");
    setShopPage(1);
    doFetchSkins(search, min, max, 1);
  }

  function changeShopPage(nextPage: number) {
    setShopPage(nextPage);
    doFetchSkins(
      shopSearchInput.trim(),
      shopMinInput.trim(),
      shopMaxInput.trim(),
      nextPage,
    );
  }

  async function logout() {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        clearSessionState();
        setWalletLoading(false);
        setInventoryLoading(false);
      } else {
        setError("Logout failed.");
      }
    } catch {
      setError("Could not reach the server.");
    }
  }

  async function buySelectedShopSkins() {
    if (!user) {
      window.location.href = `${API_BASE}/auth/steam`;
      return;
    }
    if (selectedShopSkins.size === 0 || bulkBuying) {
      return;
    }

    const skinIds = Array.from(selectedShopSkins.keys());
    setBulkBuying(true);

    try {
      const res = await fetch(`${API_BASE}/inventory/buy-bulk`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skinIds }),
      });

      if (res.status === 401) {
        clearSessionState();
        showToast("Please log in with Steam to buy skins.", "error");
        return;
      }

      if (!res.ok) {
        showToast(
          await getResponseError(res, "Could not buy skins."),
          "error",
        );
        return;
      }

      const data = (await res.json()) as BuySkinsBulkResponse;
      updateWallet(data.wallet);
      setInventory((current) => [...data.items, ...current]);
      setSelectedShopSkins(new Map());
      const count = data.items.length;
      playBuySound();
      showToast(
        count === 1
          ? `${data.items[0].skin.name} added to your inventory.`
          : `${count} skins added to your inventory.`,
      );
    } catch {
      showToast("Could not reach the server.", "error");
    } finally {
      setBulkBuying(false);
    }
  }

  function handleDepositCreated(deposit: Deposit) {
    setWallet((current) =>
      current
        ? { wallet: current.wallet, deposits: [deposit, ...current.deposits] }
        : current,
    );
  }

  async function loadUpgradeOptions(
    itemId: number | null,
    chance: UpgradeChanceTier | null,
  ) {
    if (itemId === null || chance === null) {
      ++upgradeOptionsRequestId.current;
      setUpgradeOptionsLoading(false);
      setUpgradeOptions([]);
      setTargetPage(1);
      setUpgradeOptionsError(null);
      return;
    }

    const requestId = ++upgradeOptionsRequestId.current;
    setUpgradeOptionsLoading(true);
    setUpgradeOptionsError(null);
    setUpgradeOptions([]);
    setTargetPage(1);

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
    if (upgradeLoading) return;
    setSelectedTargetSkinId(null);
    setWheelChancePercent(selectedUpgradeChance);
    setWheelState("idle");
    const next = selectedUpgradeItemId === itemId ? null : itemId;
    if (next === null) {
      playDeselectSound();
    } else {
      playSelectSound();
    }
    setSelectedUpgradeItemId(next);
    void loadUpgradeOptions(next, selectedUpgradeChance);
  }

  function selectUpgradeChance(chance: UpgradeChanceTier) {
    if (upgradeLoading) return;
    if (chance === selectedUpgradeChance) return;
    setSelectedTargetSkinId(null);
    setWheelState("idle");
    playSelectSound();
    setSelectedUpgradeChance(chance);
    setWheelChancePercent(chance);
    void loadUpgradeOptions(selectedUpgradeItemId, chance);
  }

  function selectUpgradeTarget(skinId: number) {
    if (upgradeLoading) return;
    setWheelState("idle");
    const isDeselecting = selectedTargetSkinId === skinId;
    if (isDeselecting) {
      playDeselectSound();
      setSelectedTargetSkinId(null);
      setWheelChancePercent(selectedUpgradeChance);
      return;
    }
    playSelectSound();
    setSelectedTargetSkinId(skinId);
    const target = upgradeOptions.find((s) => s.id === skinId);
    const chance = target ? Number(target.displayedChancePercent) : NaN;
    setWheelChancePercent(
      Number.isFinite(chance) ? chance : selectedUpgradeChance,
    );
  }

  async function performUpgrade() {
    if (
      selectedUpgradeItemId === null ||
      selectedTargetSkinId === null ||
      selectedUpgradeChance === null ||
      upgradeLoading
    ) {
      return;
    }

    if (wheelTimeoutRef.current) {
      clearTimeout(wheelTimeoutRef.current);
      wheelTimeoutRef.current = null;
    }
    clearScheduledSounds(soundTimeoutRefs.current);
    soundTimeoutRefs.current = [];

    setUpgradeLoading(true);
    setWheelState("idle");

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
        showToast("Please log in with Steam to upgrade skins.", "error");
        setUpgradeLoading(false);
        return;
      }

      if (!res.ok) {
        showToast(
          await getResponseError(res, "Could not run the upgrade."),
          "error",
        );
        setUpgradeLoading(false);
        return;
      }

      const data = (await res.json()) as UpgradeAttemptResponse;

      const chancePercent = Number(data.displayedChancePercent);
      const safeChancePercent = Number.isFinite(chancePercent)
        ? chancePercent
        : selectedUpgradeChance;
      setWheelChancePercent(safeChancePercent);
      setWheelState("spinning");
      setWheelRotation((current) =>
        computeNextWheelRotation(current, safeChancePercent, data.result === "win"),
      );
      soundTimeoutRefs.current = scheduleSpinTicks(WHEEL_SPIN_DURATION_MS);

      wheelTimeoutRef.current = setTimeout(() => {
        wheelTimeoutRef.current = null;
        clearScheduledSounds(soundTimeoutRefs.current);
        soundTimeoutRefs.current = [];
        setWheelState(data.result);
        setInventory((current) => {
          const withoutSource = current.filter(
            (item) => item.id !== data.sourceItem.id,
          );
          if (data.result === "win" && data.wonItem) {
            return [data.wonItem, ...withoutSource];
          }
          return withoutSource;
        });
        setSelectedUpgradeItemId(null);
        setSelectedTargetSkinId(null);
        setUpgradeOptions([]);
        setTargetPage(1);
        if (data.result === "win") {
          playBuySound();
          showToast(
            `Won! ${data.targetSkin.name} added to your inventory.`,
          );
        } else {
          playRemoveSound();
          showToast(`Lost ${data.sourceItem.skin.name}.`, "error");
        }
        setUpgradeLoading(false);
      }, WHEEL_FINALIZE_MS);
    } catch {
      clearScheduledSounds(soundTimeoutRefs.current);
      soundTimeoutRefs.current = [];
      showToast("Could not reach the server.", "error");
      setUpgradeLoading(false);
    }
  }

  // Derived data
  const inventoryMinNum = useMemo(() => {
    const v = Number(inventoryMinInput);
    return inventoryMinInput.trim() !== "" && Number.isFinite(v) ? v : null;
  }, [inventoryMinInput]);
  const inventoryMaxNum = useMemo(() => {
    const v = Number(inventoryMaxInput);
    return inventoryMaxInput.trim() !== "" && Number.isFinite(v) ? v : null;
  }, [inventoryMaxInput]);

  const ownedInventory = useMemo(
    () => inventory.filter((item) => item.status === "owned"),
    [inventory],
  );

  const filteredInventory = useMemo(() => {
    const filtered = filterInventoryItems(
      ownedInventory,
      inventorySearchInput,
      inventoryMinNum,
      inventoryMaxNum,
    );
    return sortInventoryItems(filtered, inventorySort);
  }, [
    ownedInventory,
    inventorySearchInput,
    inventoryMinNum,
    inventoryMaxNum,
    inventorySort,
  ]);

  const inventoryTotalPages = Math.max(
    1,
    Math.ceil(filteredInventory.length / INVENTORY_PAGE_SIZE),
  );
  const safeInventoryPage = Math.min(
    Math.max(1, inventoryPage),
    inventoryTotalPages,
  );

  const inventoryPageItems = useMemo(() => {
    const start = (safeInventoryPage - 1) * INVENTORY_PAGE_SIZE;
    return filteredInventory.slice(start, start + INVENTORY_PAGE_SIZE);
  }, [filteredInventory, safeInventoryPage]);

  const inventoryTotalValue = useMemo(() => {
    return ownedInventory.reduce(
      (sum, item) => sum + (Number(item.sellPriceRub) || 0),
      0,
    );
  }, [ownedInventory]);

  const selectedSource = useMemo(
    () =>
      ownedInventory.find((item) => item.id === selectedUpgradeItemId) ?? null,
    [ownedInventory, selectedUpgradeItemId],
  );
  const selectedTarget = useMemo(
    () => upgradeOptions.find((s) => s.id === selectedTargetSkinId) ?? null,
    [upgradeOptions, selectedTargetSkinId],
  );

  const sourceLocked = upgradeLoading;
  const chanceLocked = upgradeLoading;
  const targetSelectionLocked = upgradeLoading;

  const multiplier = useMemo(() => {
    if (selectedTarget) {
      const chance = Number(selectedTarget.displayedChancePercent);
      if (Number.isFinite(chance) && chance > 0) {
        return 100 / chance;
      }
    }
    if (selectedUpgradeChance && selectedUpgradeChance > 0) {
      return 100 / selectedUpgradeChance;
    }
    return 0;
  }, [selectedTarget, selectedUpgradeChance]);

  const upgradeReady =
    selectedSource && selectedTarget && !upgradeLoading;

  const wheelChanceFrac = Math.max(
    0,
    Math.min(1, wheelChancePercent / 100),
  );
  const wheelStyle: CSSProperties = {
    transform: `rotate(${wheelRotation}deg)`,
    transition:
      wheelState === "spinning"
        ? `transform ${WHEEL_SPIN_DURATION_MS}ms cubic-bezier(0.16, 0.85, 0.18, 1)`
        : "none",
    ["--chance" as string]: wheelChanceFrac.toFixed(3),
  };

  const wheelClasses = [styles.upgraderWheel];
  if (wheelState === "win") wheelClasses.push(styles.upgraderWheelWin);
  if (wheelState === "loss") wheelClasses.push(styles.upgraderWheelLoss);

  const readoutPctClasses = [styles.upgraderReadoutPct];
  if (wheelState === "win") readoutPctClasses.push(styles.upgraderReadoutPctWin);
  if (wheelState === "loss")
    readoutPctClasses.push(styles.upgraderReadoutPctLoss);

  const readoutLabel =
    wheelState === "spinning"
      ? "Spinning…"
      : wheelState === "win"
        ? "Won"
        : wheelState === "loss"
          ? "Lost"
          : "Chance";

  const selectedShopCount = selectedShopSkins.size;
  const selectedShopTotal = useMemo(() => {
    let sum = 0;
    for (const skin of selectedShopSkins.values()) {
      const v = Number(skin.priceRub);
      if (Number.isFinite(v)) sum += v;
    }
    return sum;
  }, [selectedShopSkins]);

  const walletBalanceNum = wallet ? Number(wallet.wallet.balance) : null;
  const isWalletLoading = Boolean(user && walletLoading);
  const hasEnoughBalanceForSelected =
    !user ||
    (walletBalanceNum !== null &&
      Number.isFinite(walletBalanceNum) &&
      walletBalanceNum >= selectedShopTotal);
  const bulkBuyDisabled =
    !user ||
    selectedShopCount === 0 ||
    isWalletLoading ||
    !hasEnoughBalanceForSelected ||
    bulkBuying;
  const bulkBuyLabel = !user
    ? "Log in to buy"
    : bulkBuying
      ? "Buying…"
      : isWalletLoading
        ? "Loading wallet…"
        : selectedShopCount === 0
          ? "Select skins"
          : !hasEnoughBalanceForSelected
            ? "Not enough balance"
            : `Buy selected (${selectedShopCount}) ${formatMoney(selectedShopTotal, "RUB")}`;

  const shopTotalPages = skinsPagination
    ? Math.max(1, skinsPagination.totalPages)
    : 1;

  const inventoryRangeFrom =
    filteredInventory.length === 0
      ? 0
      : (safeInventoryPage - 1) * INVENTORY_PAGE_SIZE + 1;
  const inventoryRangeTo = Math.min(
    safeInventoryPage * INVENTORY_PAGE_SIZE,
    filteredInventory.length,
  );

  const targetTotalPages = Math.max(
    1,
    Math.ceil(upgradeOptions.length / TARGET_PAGE_SIZE),
  );
  const safeTargetPage = Math.min(Math.max(1, targetPage), targetTotalPages);

  const targetPageItems = useMemo(() => {
    const start = (safeTargetPage - 1) * TARGET_PAGE_SIZE;
    return upgradeOptions.slice(start, start + TARGET_PAGE_SIZE);
  }, [upgradeOptions, safeTargetPage]);

  const targetRangeFrom =
    upgradeOptions.length === 0 ? 0 : (safeTargetPage - 1) * TARGET_PAGE_SIZE + 1;
  const targetRangeTo = Math.min(
    safeTargetPage * TARGET_PAGE_SIZE,
    upgradeOptions.length,
  );

  const shopRangeFrom =
    skinsPagination && skinsPagination.total > 0
      ? (shopPage - 1) * SHOP_PAGE_SIZE + 1
      : 0;
  const shopRangeTo = skinsPagination
    ? Math.min(shopPage * SHOP_PAGE_SIZE, skinsPagination.total)
    : 0;

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
      <LiveDropsSidebar apiBase={API_BASE} />
      {toasts.length > 0 && (
        <div
          className={styles.toastZone}
          aria-live="polite"
          aria-atomic="false"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={
                toast.variant === "error"
                  ? `${styles.toast} ${styles.toastError}`
                  : styles.toast
              }
            >
              {toast.variant === "error" ? (
                <ToastErrorIcon />
              ) : (
                <ToastSuccessIcon />
              )}
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      )}
      <main className={styles.main}>
        {loading && <p>Checking login status...</p>}
        {error && <p className={styles.error}>{error}</p>}
        {!loading && !user && (
          <div className={styles.authSection}>
            <h1>CS2 Gambler</h1>
            <p className={styles.eyebrow}>
              Log in with Steam from the top navbar to get started.
            </p>
          </div>
        )}

        {!loading && (
          <div className={styles.gamePage}>
            {/* Upgrader panel */}
            <section className={styles.upgraderShell}>
              <header className={styles.upgraderHead}>
                <span className={styles.upgraderTitleIcon} aria-label="Upgrader">
                  <UpgraderIcon />
                </span>
                <span className={styles.upgraderMultiplier}>
                  {" "}
                  <b>{multiplier > 0 ? `${multiplier.toFixed(2)}×` : "0×"}</b>
                </span>
              </header>

              <div className={styles.upgraderRow}>
                <UpgraderSlot
                  side="source"
                  skin={selectedSource?.skin ?? null}
                  priceLabel={
                    selectedSource
                      ? <MoneyLabel value={selectedSource.sellPriceRub} />
                      : undefined
                  }
                />

                <div className={styles.upgraderWheelWrap}>
                  <div className={styles.upgraderPointer} aria-hidden="true" />
                  <div className={wheelClasses.join(" ")} style={wheelStyle} />
                  <div className={styles.upgraderReadout}>
                    <span className={readoutPctClasses.join(" ")}>
                      {formatChancePercent(wheelChancePercent) ??
                        selectedUpgradeChance}
                      <small>%</small>
                    </span>
                    <span className={styles.upgraderReadoutLbl}>
                      {readoutLabel}
                    </span>
                  </div>
                </div>

                <UpgraderSlot
                  side="target"
                  skin={selectedTarget ?? null}
                  priceLabel={
                    selectedTarget
                      ? (
                          <MoneyLabel
                            value={selectedTarget.receivedValueRub}
                          />
                        )
                      : undefined
                  }
                />
              </div>

              <div className={styles.upgraderControls}>
                <div className={styles.upgraderChances} role="tablist">
                  {UPGRADER_CHANCE_TIERS.map((tier) => {
                    const isActive = selectedUpgradeChance === tier;
                    return (
                      <button
                        type="button"
                        key={tier}
                        role="tab"
                        aria-selected={isActive}
                        className={
                          isActive
                            ? `${styles.upgraderChancePill} ${styles.upgraderChanceActive}`
                            : styles.upgraderChancePill
                        }
                        disabled={chanceLocked}
                        onClick={() => selectUpgradeChance(tier)}
                      >
                        {tier}%
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className={styles.upgraderGoButton}
                  disabled={!upgradeReady}
                  onClick={performUpgrade}
                >
                  {upgradeLoading
                    ? wheelState === "spinning"
                      ? "Spinning…"
                      : "Upgrading…"
                    : "Upgrade"}
                </button>
              </div>

            </section>

            {/* My Skins / Shop tabs + Target */}
            <div className={styles.gameGrid}>
              <SkinContainer
                headerLeft={
                  <div className={styles.invTabs} role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={inventoryTab === "mine"}
                      className={
                        inventoryTab === "mine"
                          ? `${styles.invTab} ${styles.invTabActive}`
                          : styles.invTab
                      }
                      onClick={() => setInventoryTab("mine")}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M4 8h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
                        <path d="M9 13h6" />
                      </svg>
                      <span>My Skins</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={inventoryTab === "shop"}
                      className={
                        inventoryTab === "shop"
                          ? `${styles.invTab} ${styles.invTabActive}`
                          : styles.invTab
                      }
                      onClick={() => setInventoryTab("shop")}
                    >
                      <CoinIcon />
                      <span>Shop</span>
                    </button>
                  </div>
                }
                count={
                  inventoryTab === "mine"
                    ? ownedInventory.length
                    : skinsPagination?.total
                }
                total={
                  inventoryTab === "mine"
                    ? formatMoneyAmount(inventoryTotalValue)
                    : skins.length > 0
                      ? formatMoneyAmount(
                          Math.min(
                            ...skins.map((s) => Number(s.priceRub) || 0),
                          ),
                        )
                      : undefined
                }
                totalLabel={inventoryTab === "mine" ? "TOTAL" : "FROM"}
                toolbar={
                  inventoryTab === "mine" ? (
                    <>
                      <div
                        className={`${styles.skinField} ${styles.skinFieldSearch}`}
                      >
                        <span className={styles.skinFieldLeading}>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3.5-3.5" />
                          </svg>
                        </span>
                        <input
                          type="text"
                          placeholder="Search skins…"
                          value={inventorySearchInput}
                          onChange={(e) => {
                            setInventorySearchInput(e.target.value);
                            setInventoryPage(1);
                          }}
                        />
                      </div>
                      <div className={styles.skinField}>
                        <span className={styles.skinFieldPrefix} aria-hidden="true">
                          <CoinIcon />
                        </span>
                        <input
                          type="number"
                          placeholder="Min"
                          min="0"
                          step="0.01"
                          value={inventoryMinInput}
                          onChange={(e) => {
                            setInventoryMinInput(e.target.value);
                            setInventoryPage(1);
                          }}
                        />
                      </div>
                      <div className={styles.skinField}>
                        <span className={styles.skinFieldPrefix} aria-hidden="true">
                          <CoinIcon />
                        </span>
                        <input
                          type="number"
                          placeholder="Max"
                          min="0"
                          step="0.01"
                          value={inventoryMaxInput}
                          onChange={(e) => {
                            setInventoryMaxInput(e.target.value);
                            setInventoryPage(1);
                          }}
                        />
                      </div>
                      <div
                        className={`${styles.skinField} ${styles.skinFieldSelect}`}
                      >
                        <select
                          value={inventorySort}
                          onChange={(e) => {
                            setInventorySort(e.target.value as InventorySort);
                            setInventoryPage(1);
                          }}
                        >
                          <option value="price-desc">Price ↓</option>
                          <option value="price-asc">Price ↑</option>
                          <option value="name">Name A–Z</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        className={`${styles.skinField} ${styles.skinFieldSearch}`}
                      >
                        <span className={styles.skinFieldLeading}>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3.5-3.5" />
                          </svg>
                        </span>
                        <input
                          type="search"
                          placeholder="AK-47, Redline, Doppler"
                          value={shopSearchInput}
                          onChange={(e) => setShopSearchInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              applyShopFilter();
                            }
                          }}
                        />
                      </div>
                      <div className={styles.skinField}>
                        <span className={styles.skinFieldPrefix} aria-hidden="true">
                          <CoinIcon />
                        </span>
                        <input
                          type="number"
                          placeholder="Min"
                          min="0"
                          step="0.01"
                          value={shopMinInput}
                          onChange={(e) => setShopMinInput(e.target.value)}
                        />
                      </div>
                      <div className={styles.skinField}>
                        <span className={styles.skinFieldPrefix} aria-hidden="true">
                          <CoinIcon />
                        </span>
                        <input
                          type="number"
                          placeholder="Max"
                          min="0"
                          step="0.01"
                          value={shopMaxInput}
                          onChange={(e) => setShopMaxInput(e.target.value)}
                        />
                      </div>
                      <div className={styles.skinField}>
                        <button
                          type="button"
                          className={`${styles.skinTileActionBtn} ${styles.skinTileActionPrimary}`}
                          style={{ flex: 1, height: "100%" }}
                          onClick={applyShopFilter}
                        >
                          Apply
                        </button>
                      </div>
                    </>
                  )
                }
                footer={
                  inventoryTab === "mine" ? (
                    <SkinPager
                      page={safeInventoryPage}
                      totalPages={inventoryTotalPages}
                      rangeFrom={inventoryRangeFrom}
                      rangeTo={inventoryRangeTo}
                      total={filteredInventory.length}
                      onPrev={() =>
                        setInventoryPage(Math.max(1, safeInventoryPage - 1))
                      }
                      onNext={() =>
                        setInventoryPage(
                          Math.min(inventoryTotalPages, safeInventoryPage + 1),
                        )
                      }
                    />
                  ) : (
                    <>
                      <div className={styles.shopBulkBar}>
                        <button
                          type="button"
                          className={`${styles.skinTileActionBtn} ${styles.skinTileActionPrimary} ${styles.shopBulkBuyBtn}`}
                          disabled={bulkBuyDisabled}
                          onClick={buySelectedShopSkins}
                        >
                          {bulkBuyLabel}
                        </button>
                      </div>
                      <SkinPager
                        page={shopPage}
                        totalPages={shopTotalPages}
                        rangeFrom={shopRangeFrom}
                        rangeTo={shopRangeTo}
                        total={skinsPagination?.total ?? 0}
                        onPrev={() => changeShopPage(Math.max(1, shopPage - 1))}
                        onNext={() =>
                          changeShopPage(Math.min(shopTotalPages, shopPage + 1))
                        }
                      />
                    </>
                  )
                }
              >
                {inventoryTab === "mine" ? (
                  !user ? (
                    <p className={styles.skinContainerEmpty}>
                      Log in with Steam to see your skins.
                    </p>
                  ) : inventoryLoading ? (
                    <p className={styles.skinContainerLoading}>
                      Loading inventory…
                    </p>
                  ) : inventoryError ? (
                    <p className={styles.skinContainerError}>
                      {inventoryError}
                    </p>
                  ) : ownedInventory.length === 0 ? (
                    <p className={styles.skinContainerEmpty}>
                      No available skins. Switch to the Shop tab to buy one.
                    </p>
                  ) : inventoryPageItems.length === 0 ? (
                    <p className={styles.skinContainerEmpty}>
                      No skins match the filters.
                    </p>
                  ) : (
                    <div className={styles.skinTileGrid}>
                      {inventoryPageItems.map((item) => {
                        const isOwned = item.status === "owned";
                        const isSelected = item.id === selectedUpgradeItemId;
                        const statusLabel =
                          item.status === "withdraw_pending"
                            ? "Pending"
                            : item.status === "owned"
                              ? null
                              : item.status;
                        return (
                          <SkinTile
                            key={item.id}
                            skin={item.skin}
                            rarityKey={getSkinRarityKey(item.skin.rarity)}
                            priceLabel={
                              <MoneyLabel value={item.sellPriceRub} />
                            }
                            wearLabel={formatWearLabel(item.skin.exterior)}
                            statusLabel={statusLabel}
                            selected={isSelected}
                            disabled={!isOwned || sourceLocked}
                            selectable={isOwned && !sourceLocked}
                            onSelect={() => selectUpgradeItem(item.id)}
                          />
                        );
                      })}
                    </div>
                  )
                ) : (
                  <>
                    {shopFilterError && (
                      <p className={styles.skinContainerError}>
                        {shopFilterError}
                      </p>
                    )}
                    {skinsLoading ? (
                      <p className={styles.skinContainerLoading}>
                        Loading skins…
                      </p>
                    ) : skinsError ? (
                      <p className={styles.skinContainerError}>{skinsError}</p>
                    ) : skins.length === 0 ? (
                      <p className={styles.skinContainerEmpty}>
                        {shopFilterActive
                          ? "No skins match the selected filters."
                          : "No skins available."}
                      </p>
                    ) : (
                      <div className={styles.skinTileGrid}>
                        {skins.map((skin) => {
                          const isSelected = selectedShopSkins.has(skin.id);
                          return (
                            <SkinTile
                              key={skin.id}
                              skin={skin}
                              rarityKey={getSkinRarityKey(skin.rarity)}
                              priceLabel={
                                <MoneyLabel value={skin.priceRub} />
                              }
                              wearLabel={formatWearLabel(skin.exterior)}
                              selected={isSelected}
                              selectable={!bulkBuying}
                              disabled={bulkBuying}
                              onSelect={() => toggleShopSkinSelection(skin)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </SkinContainer>

              <SkinContainer
                title="Target"
                count={upgradeOptions.length}
                footer={
                  upgradeOptions.length > TARGET_PAGE_SIZE ? (
                    <SkinPager
                      page={safeTargetPage}
                      totalPages={targetTotalPages}
                      rangeFrom={targetRangeFrom}
                      rangeTo={targetRangeTo}
                      total={upgradeOptions.length}
                      onPrev={() =>
                        setTargetPage(Math.max(1, safeTargetPage - 1))
                      }
                      onNext={() =>
                        setTargetPage(
                          Math.min(targetTotalPages, safeTargetPage + 1),
                        )
                      }
                    />
                  ) : null
                }
              >
                {!user ? (
                  <p className={styles.skinContainerEmpty}>
                    Log in with Steam to see upgrade targets.
                  </p>
                ) : selectedUpgradeItemId === null ? (
                  <p className={styles.skinContainerEmpty}>
                    Select a skin from My Skins to see targets.
                  </p>
                ) : upgradeOptionsLoading ? (
                  <p className={styles.skinContainerLoading}>
                    Loading targets…
                  </p>
                ) : upgradeOptionsError ? (
                  <p className={styles.skinContainerError}>
                    {upgradeOptionsError}
                  </p>
                ) : upgradeOptions.length === 0 ? (
                  <p className={styles.skinContainerEmpty}>
                    No target skins available for this chance.
                  </p>
                ) : (
                  <div className={styles.skinTileGrid}>
                    {targetPageItems.map((skin) => {
                      const isSelected = skin.id === selectedTargetSkinId;
                      const chanceFormatted = formatChancePercent(
                        skin.displayedChancePercent,
                      );
                      const chanceLabel =
                        chanceFormatted !== null
                          ? `${chanceFormatted}%`
                          : undefined;
                      return (
                        <SkinTile
                          key={skin.id}
                          skin={skin}
                          rarityKey={getSkinRarityKey(skin.rarity)}
                          priceLabel={
                            <MoneyLabel
                              value={skin.receivedValueRub}
                            />
                          }
                          priceSubLabel={chanceLabel}
                          wearLabel={formatWearLabel(skin.exterior)}
                          selected={isSelected}
                          selectable={!targetSelectionLocked}
                          disabled={targetSelectionLocked}
                          onSelect={() => selectUpgradeTarget(skin.id)}
                        />
                      );
                    })}
                  </div>
                )}
              </SkinContainer>
            </div>
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
      {FREE_MODE && freeModeModalOpen && (
        <div
          className={styles.freeModeOverlay}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setFreeModeModalOpen(false);
            }
          }}
        >
          <section
            className={styles.freeModeModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="free-mode-title"
          >
            <button
              type="button"
              className={styles.freeModeClose}
              aria-label="Close"
              onClick={() => setFreeModeModalOpen(false)}
            >
              <span aria-hidden="true">×</span>
            </button>
            <div className={styles.freeModeAgent}>
              <Image
                src={FREE_MODE_AGENT_IMAGE_URL}
                alt="Free mode agent"
                width={256}
                height={192}
                priority
              />
            </div>
            <h2 id="free-mode-title" className={styles.freeModeTitle}>
              FREE MODE
            </h2>
            <p className={styles.freeModeText}>
              100,000 demo coins included. Deposits and withdrawals are
              disabled.
            </p>
            <button
              type="button"
              className={styles.freeModeCta}
              onClick={() => setFreeModeModalOpen(false)}
            >
              Play free
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
