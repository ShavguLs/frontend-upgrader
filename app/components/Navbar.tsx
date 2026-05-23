"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./Navbar.module.css";

type WalletShape = {
  wallet: { balance: string | number; currency: string };
};

type AuthUserShape = {
  displayName: string;
  avatar?: string | null;
} | null;

type NavbarProps = {
  user: AuthUserShape;
  wallet: WalletShape | null;
  walletLoading: boolean;
  apiBase: string;
  onLogout: () => void;
  onTopUp: () => void;
  freeMode?: boolean;
};

function formatNavbarAmount(value: string | number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return String(value);
  }
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function useDecorativeOnlineCount(): string {
  const [count, setCount] = useState(26);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCount((current) => {
        const drift = Math.round((Math.random() - 0.5) * 4);
        const next = current + drift;
        if (next < 20) return 20;
        if (next > 30) return 30;
        return next;
      });
    }, 3500);
    return () => window.clearInterval(id);
  }, []);

  return count.toLocaleString();
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

export default function Navbar({
  user,
  wallet,
  walletLoading,
  apiBase,
  onLogout,
  onTopUp,
  freeMode = false,
}: NavbarProps) {
  const onlineCount = useDecorativeOnlineCount();
  const isLoggedIn = Boolean(user);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  return (
    <header className={styles.nav} role="banner">
      <Link className={styles.brand} href="/" aria-label="Upgrader home">
        <span className={styles.brandName}>
          UPGRADER<span className={styles.brandDot}>.</span>
        </span>
      </Link>

      <div className={styles.online} title="Players online">
        <span className={styles.onlineDot} aria-hidden="true" />
        <span className={styles.onlineCount}>{onlineCount}</span>
      </div>

      <nav className={styles.repoLinks} aria-label="Source code">
        <a
          className={styles.repoLink}
          href="https://github.com/ShavguLs/frontend-upgrader"
          target="_blank"
          rel="noopener noreferrer"
          title="Frontend repository"
        >
          <GitHubIcon />
          <span className={styles.repoLinkLabel}>Frontend</span>
        </a>
        <a
          className={styles.repoLink}
          href="https://github.com/ShavguLs/backend-upgrader"
          target="_blank"
          rel="noopener noreferrer"
          title="Backend repository"
        >
          <GitHubIcon />
          <span className={styles.repoLinkLabel}>Backend</span>
        </a>
      </nav>

      <div className={styles.spacer} />

      {isLoggedIn && (
        <div className={styles.wallet}>
          <div className={styles.balance} title="Your balance">
            <span className={styles.coin} aria-hidden="true">
              <CoinIcon />
            </span>
            <span
              className={
                walletLoading && !wallet
                  ? `${styles.amount} ${styles.amountLoading}`
                  : styles.amount
              }
            >
              {wallet ? formatNavbarAmount(wallet.wallet.balance) : "—"}
            </span>
          </div>
          {!freeMode && (
            <button
              className={styles.topup}
              type="button"
              onClick={onTopUp}
              aria-label="Top up balance"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className={styles.topupLabel}>Top Up</span>
            </button>
          )}
          {freeMode && (
            <span className={styles.freeModeBadge} title="Free mode">
              Free mode
            </span>
          )}
        </div>
      )}

      {isLoggedIn && user ? (
        <div className={styles.userMenu} ref={menuRef}>
          <button
            type="button"
            className={styles.avatarButton}
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Open account menu"
          >
            {user.avatar ? (
              <Image
                className={styles.avatarImage}
                src={user.avatar}
                alt={user.displayName}
                width={36}
                height={36}
              />
            ) : (
              <span className={styles.avatarFallback} aria-hidden="true">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </button>

          {menuOpen && (
            <div className={styles.menu} role="menu">
              <div className={styles.menuHeader}>
                <span className={styles.menuName}>{user.displayName}</span>
              </div>
              <Link
                href="/profile"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => setMenuOpen(false)}
              >
                <ProfileIcon />
                Profile
              </Link>
              <button
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
              >
                <LogoutIcon />
                Logout
              </button>
            </div>
          )}
        </div>
      ) : (
        <a className={styles.btnLogin} href={`${apiBase}/auth/steam`}>
          <SteamIcon />
          Login
        </a>
      )}
    </header>
  );
}

function SteamIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-9.94 9.06l5.27 2.18a2.8 2.8 0 0 1 1.58-.48h.13l2.35-3.4v-.05a3.74 3.74 0 1 1 3.74 3.74h-.09l-3.35 2.39v.1a2.81 2.81 0 0 1-5.55.6l-3.77-1.56A10 10 0 1 0 12 2Zm-3.13 15.13-1.21-.5a2.13 2.13 0 0 0 1.1 1.18 2.12 2.12 0 1 0 .11-3.91l1.25.51a1.56 1.56 0 1 1-1.25 2.73Zm9.6-5.43a2.49 2.49 0 1 1 2.49-2.49 2.49 2.49 0 0 1-2.49 2.49Zm-1.87-2.5a1.87 1.87 0 1 0 1.87-1.87 1.87 1.87 0 0 0-1.87 1.88Z" />
    </svg>
  );
}

function ProfileIcon() {
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
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.56 9.56 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .26.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

function LogoutIcon() {
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
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}
