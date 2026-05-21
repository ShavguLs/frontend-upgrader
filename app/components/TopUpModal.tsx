"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./TopUpModal.module.css";

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

type TopUpModalProps = {
  open: boolean;
  onClose: () => void;
  apiBase: string;
  onDepositCreated?: (deposit: Deposit) => void;
};

type CryptoOption = {
  id: string;
  name: string;
  ticker: string;
  rate: number;
  logoClass: string;
  logo: React.ReactNode;
};

const QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000];

const CRYPTO_OPTIONS: CryptoOption[] = [
  {
    id: "btc",
    name: "Bitcoin",
    ticker: "BTC",
    rate: 0.00000016,
    logoClass: styles.cryptoLogoBtc,
    logo: (
      <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M15.4 11.5c.9-.5 1.5-1.4 1.3-2.7-.2-1.7-1.7-2.3-3.6-2.5l.1-2.4-1.5-.1-.1 2.3c-.4 0-.8 0-1.2-.1l.1-2.4-1.5 0v2.4c-.3 0-.6 0-.9 0L6 6l-.2 1.6s1.2.2 1.1.3c.6.1.7.5.7.8l-.2 2.7v3.8c0 .3-.1.6-.5.6 0 0-1.1 0-1.1 0l-.4 1.8 2 .1c.4 0 .7 0 1.1.1l-.1 2.5 1.5.1.1-2.4c.4 0 .8 0 1.2 0l-.1 2.4 1.5.1.1-2.4c2.5-.1 4.2-.7 4.5-3 .2-1.8-.7-2.7-2.1-3 .9-.4 1.4-1.1 1.3-2.6Zm-.7 4.6c0 1.7-3 1.6-3.9 1.6l.2-3.2c.9 0 3.7-.3 3.7 1.6Zm-.6-4c0 1.6-2.5 1.4-3.3 1.4l.1-2.9c.7 0 3.2-.2 3.2 1.5Z" />
      </svg>
    ),
  },
  {
    id: "eth",
    name: "Ethereum",
    ticker: "ETH",
    rate: 0.0000033,
    logoClass: styles.cryptoLogoEth,
    logo: (
      <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M12 2 5.5 12.3 12 16.2l6.5-3.9L12 2Zm-6.5 11.6L12 17.5l6.5-3.9L12 22 5.5 13.6Z" />
      </svg>
    ),
  },
  {
    id: "ltc",
    name: "Litecoin",
    ticker: "LTC",
    rate: 0.00013,
    logoClass: styles.cryptoLogoLtc,
    logo: (
      <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm-1.5 5.2 2-.6-1.4 5 2.5-.7-.4 1.4-2.5.7-.7 2.5h5.9l-.5 1.7H7.8l1.2-4-1.5.4.4-1.4 1.5-.4 1.1-3.6Z" />
      </svg>
    ),
  },
  {
    id: "sol",
    name: "Solana",
    ticker: "SOL",
    rate: 0.0038,
    logoClass: styles.cryptoLogoSol,
    logo: (
      <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M5 8.2 7.5 6h11.7L16.7 8.2H5Zm0 7.6 2.5-2.2h11.7L16.7 15.8H5Zm14-3.8L16.5 14H4.8L7.3 11.8H19Z" />
      </svg>
    ),
  },
  {
    id: "usdt",
    name: "Tether",
    ticker: "USDT",
    rate: 0.011,
    logoClass: styles.cryptoLogoUsdt,
    logo: (
      <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M13.2 11.4V9.7H17V7.1H7v2.6h3.8v1.7c-3.1.1-5.4.7-5.4 1.5s2.3 1.4 5.4 1.5v5.4h2.4v-5.4c3.1-.1 5.4-.7 5.4-1.5s-2.3-1.4-5.4-1.5Zm0 2.6v-.1c-.1 0-.5.1-1.2.1-.6 0-1 0-1.2-.1v.1c-2.7-.1-4.7-.6-4.7-1.1 0-.5 2-1 4.7-1.1V14c.2 0 .6 0 1.2 0s1 0 1.2-.1v-1.2c2.7.1 4.7.6 4.7 1.1 0 .6-2 1-4.7 1.2Z" />
      </svg>
    ),
  },
  {
    id: "usdc",
    name: "USD Coin",
    ticker: "USDC",
    rate: 0.011,
    logoClass: styles.cryptoLogoUsdc,
    logo: (
      <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1 15.4c-2.9-.9-4.4-3-4.4-5.4s1.5-4.5 4.4-5.4c.2 0 .3.1.3.3v.8c0 .2-.1.3-.2.4-2.2.8-3 2.4-3 3.9s.8 3.1 3 3.9c.1 0 .2.2.2.4v.8c0 .2-.1.3-.3.3Zm.7-3.7c0 .2-.1.3-.3.3h-.4v.6c0 .2-.1.3-.3.3h-.4c-.2 0-.3-.1-.3-.3V14h-.5c-.2 0-.3-.1-.3-.3v-.4c0-.2.1-.3.3-.3h1.6c.3 0 .5-.2.5-.6s-.2-.6-.5-.6h-1.1c-.7 0-1.3-.5-1.3-1.3v-.1c0-.7.5-1.2 1.1-1.3v-.6c0-.2.1-.3.3-.3h.4c.2 0 .3.1.3.3v.6h.5c.2 0 .3.1.3.3v.4c0 .2-.1.3-.3.3h-1.6c-.3 0-.5.2-.5.5s.2.5.5.5h1.1c.7 0 1.3.5 1.3 1.3v.2Zm1.6 3.7v-.8c0-.2.1-.3.2-.4 2.2-.8 3-2.4 3-3.9s-.8-3.1-3-3.9c-.1 0-.2-.2-.2-.4V7c0-.2.1-.3.3-.3 2.9.9 4.4 3 4.4 5.4s-1.5 4.5-4.4 5.4c-.2 0-.3-.1-.3-.3Z" />
      </svg>
    ),
  },
  {
    id: "doge",
    name: "Dogecoin",
    ticker: "DOGE",
    rate: 0.071,
    logoClass: styles.cryptoLogoDoge,
    logo: (
      <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm.4 14.2H8.6v-3.1H7v-2.2h1.6V7.8h3.5c2.8 0 4.5 1.7 4.5 4.2s-1.7 4.2-4.2 4.2Zm-.2-2.1c1.4 0 2.2-.8 2.2-2.1s-.8-2.1-2.4-2.1H11v1.9h1.8v2.2H11v.1Z" />
      </svg>
    ),
  },
  {
    id: "trx",
    name: "Tron",
    ticker: "TRX",
    rate: 0.091,
    logoClass: styles.cryptoLogoTrx,
    logo: (
      <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M19.6 6.2 3.4 3.5l8.5 17 7.7-14.3Zm-1.4.9-3.5 1.6-7.6-3 11.1 1.4ZM6.4 5.6l6.7 2.6-7.9 1.3 1.2-3.9Zm5.6 11.8L5.8 9.9l7.7-1.3-1.5 8.8Zm1.4 0 1.4-7.9L18 8 13.4 17.4Z" />
      </svg>
    ),
  },
  {
    id: "bnb",
    name: "BNB",
    ticker: "BNB",
    rate: 0.0000172,
    logoClass: styles.cryptoLogoBnb,
    logo: (
      <svg viewBox="0 0 24 24" fill="#1A1A1A" aria-hidden="true">
        <path d="M12 4 7.5 8.5 9 10l3-3 3 3 1.5-1.5L12 4ZM4 12l1.5-1.5L7 12l-1.5 1.5L4 12Zm5.5 1.5L12 11l2.5 2.5L12 16l-2.5-2.5Zm7.5 0L18.5 12 17 10.5l1.5 1.5L17 13.5l1.5-1.5h-1.5ZM12 14l-3 3 1.5 1.5L12 17l1.5 1.5L15 17l-3-3Z" />
      </svg>
    ),
  },
];

function formatCrypto(amount: number, rate: number) {
  if (!Number.isFinite(amount)) return "0";
  let decimals = 6;
  if (rate >= 1) decimals = 2;
  else if (rate >= 0.01) decimals = 4;
  if (amount >= 1000)
    return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (amount >= 1)
    return amount.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return amount.toFixed(decimals);
}

function formatRub(amount: number) {
  if (!Number.isFinite(amount)) return "0.00";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function TopUpModal({
  open,
  onClose,
  apiBase,
  onDepositCreated,
}: TopUpModalProps) {
  const [amountInput, setAmountInput] = useState("1000.00");
  const [selectedCryptoId, setSelectedCryptoId] = useState<string>("btc");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackKind, setFeedbackKind] = useState<"info" | "error">("info");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const amount = useMemo(() => {
    const parsed = parseFloat(amountInput);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amountInput]);

  const selectedCrypto =
    CRYPTO_OPTIONS.find((c) => c.id === selectedCryptoId) ?? CRYPTO_OPTIONS[0];
  const cryptoAmount = amount * selectedCrypto.rate;

  useEffect(() => {
    if (!open) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 60);

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timeout);
    };
  }, [open, onClose]);

  const activeQuick = QUICK_AMOUNTS.find((q) => q === amount);

  async function handleDeposit() {
    if (amount <= 0) return;
    if (amount < 100) {
      setFeedback("Minimum deposit is 100 RUB.");
      setFeedbackKind("error");
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch(`${apiBase}/wallet/deposits`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountRub: amount,
          currency: selectedCrypto.ticker,
        }),
      });

      if (res.status === 401) {
        setFeedback("Please log in with Steam to create a deposit.");
        setFeedbackKind("error");
        return;
      }

      if (!res.ok) {
        let message = "Could not create deposit.";
        try {
          const data = (await res.json()) as { message?: string | string[] };
          if (typeof data.message === "string") message = data.message;
          else if (Array.isArray(data.message) && data.message[0])
            message = data.message[0];
        } catch {
          // ignore parse errors
        }
        setFeedback(message);
        setFeedbackKind("error");
        return;
      }

      const deposit = (await res.json()) as Deposit;
      onDepositCreated?.(deposit);

      if (deposit.invoiceUrl) {
        window.location.assign(deposit.invoiceUrl);
        return;
      }

      setFeedback("Deposit invoice created.");
      setFeedbackKind("info");
    } catch {
      setFeedback("Could not reach the server.");
      setFeedbackKind("error");
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div
      className={open ? `${styles.modal} ${styles.open}` : styles.modal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="topup-title"
      aria-hidden={!open}
      onClick={handleBackdropClick}
    >
      <div className={styles.card} role="document">
        <div className={styles.head}>
          <h2 id="topup-title">Top Up · Crypto</h2>
          <button
            className={styles.close}
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <label className={styles.fieldLabel} htmlFor="topup-amount-input">
            Amount
          </label>
          <div className={styles.amountField}>
            <span className={styles.symbol}>₽</span>
            <input
              ref={inputRef}
              id="topup-amount-input"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amountInput}
              autoComplete="off"
              onChange={(e) => setAmountInput(e.target.value)}
            />
            <span className={styles.usdTag}>RUB</span>
          </div>

          <div className={styles.quick}>
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q}
                type="button"
                className={activeQuick === q ? styles.quickActive : ""}
                onClick={() => setAmountInput(q.toFixed(2))}
              >
                ₽{q.toLocaleString("en-US")}
              </button>
            ))}
          </div>

          <div className={styles.sectionSpacer} />
          <span className={styles.fieldLabel}>Pay with</span>
          <div className={styles.cryptoGrid}>
            {CRYPTO_OPTIONS.map((c) => {
              const isActive = c.id === selectedCryptoId;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={
                    isActive
                      ? `${styles.crypto} ${styles.cryptoActive}`
                      : styles.crypto
                  }
                  onClick={() => setSelectedCryptoId(c.id)}
                >
                  <span className={`${styles.cryptoLogo} ${c.logoClass}`}>
                    {c.logo}
                  </span>
                  <span className={styles.cryptoMeta}>
                    <span className={styles.cryptoName}>{c.name}</span>
                    <span className={styles.cryptoTicker}>{c.ticker}</span>
                  </span>
                  <span className={styles.cryptoTick}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 12l5 5L20 6" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>

          <div className={styles.summary}>
            <span className={styles.summaryLabel}>You will pay</span>
            <span className={styles.cryptoAmount}>
              {formatCrypto(cryptoAmount, selectedCrypto.rate)}
              <span className={styles.tk}>{selectedCrypto.ticker}</span>
            </span>
          </div>

          <button
            type="button"
            className={styles.deposit}
            disabled={amount <= 0 || submitting}
            onClick={handleDeposit}
          >
            {submitting ? "Creating…" : `Deposit ₽${formatRub(amount)}`}
          </button>

          {feedback && (
            <p
              className={
                feedbackKind === "error"
                  ? `${styles.feedback} ${styles.feedbackError}`
                  : styles.feedback
              }
            >
              {feedback}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
