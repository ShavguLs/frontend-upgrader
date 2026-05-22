"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";
import { getSkinRarityColor, getSkinRarityKey } from "../lib/rarity";
import styles from "./LiveDropsSidebar.module.css";

type LiveDropSkin = {
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
};

type LiveDrop = {
  id: number;
  createdAt: string;
  priceRub: string | number;
  skin: LiveDropSkin;
};

type LiveDropsResponse = {
  items: LiveDrop[];
};

type LiveDropsSidebarProps = {
  apiBase: string;
  limit?: number;
  pollIntervalMs?: number;
};

const DEFAULT_LIMIT = 16;
const DEFAULT_POLL_MS = 12000;
const TIME_UPDATE_MS = 30000;

function formatMoneyAmount(value: string | number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatRelativeTime(createdAt: string, nowMs: number): string {
  const then = Date.parse(createdAt);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (seconds < 10) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
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

function DropImage({ skin }: { skin: LiveDropSkin }) {
  if (!skin.imageUrl) {
    return <div className={styles.dropImagePlaceholder} aria-hidden="true" />;
  }
  return (
    <div className={styles.dropImage}>
      <Image
        src={skin.imageUrl}
        alt=""
        fill
        sizes="56px"
        style={{ objectFit: "contain" }}
      />
    </div>
  );
}

export default function LiveDropsSidebar({
  apiBase,
  limit = DEFAULT_LIMIT,
  pollIntervalMs = DEFAULT_POLL_MS,
}: LiveDropsSidebarProps) {
  const [drops, setDrops] = useState<LiveDrop[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function fetchDrops() {
      try {
        const res = await fetch(
          `${apiBase}/upgrader/drops?limit=${limit}`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (!res.ok) {
          setFailed(true);
          setLoaded(true);
          return;
        }
        const data = (await res.json()) as LiveDropsResponse;
        if (cancelled) return;
        setDrops(data.items.slice(0, limit));
        setFailed(false);
        setLoaded(true);
      } catch {
        if (cancelled) return;
        setFailed(true);
        setLoaded(true);
      }
    }

    fetchDrops();
    const handle = setInterval(fetchDrops, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [apiBase, limit, pollIntervalMs]);

  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), TIME_UPDATE_MS);
    return () => clearInterval(handle);
  }, []);

  return (
    <aside className={styles.sidebar} aria-label="Latest drops">
      {loaded && drops.length === 0 ? (
        <p className={styles.empty}>
          {failed ? "Drops unavailable" : "No recent drops"}
        </p>
      ) : (
        <ul className={styles.list}>
          {drops.map((drop) => {
            const rarityKey = getSkinRarityKey(drop.skin.rarity);
            const rarityColor = getSkinRarityColor(drop.skin.rarityColor);
            const dropStyle = rarityColor
              ? ({ "--_rarity": rarityColor } as CSSProperties)
              : undefined;
            return (
              <li
                key={drop.id}
                className={styles.drop}
                data-rarity={rarityKey}
                style={dropStyle}
              >
                <DropImage skin={drop.skin} />
                <div className={styles.info}>
                  <span className={styles.name}>{drop.skin.name}</span>
                  <div className={styles.row}>
                    <span className={styles.price}>
                      <span className={styles.priceIcon} aria-hidden="true">
                        <CoinIcon />
                      </span>
                      {formatMoneyAmount(drop.priceRub)}
                    </span>
                    <span className={styles.time}>
                      {formatRelativeTime(drop.createdAt, now)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
