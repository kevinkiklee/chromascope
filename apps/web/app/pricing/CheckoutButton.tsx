'use client';

export default function CheckoutButton({
  priceId,
  label,
  highlight = false,
}: {
  priceId: string;
  label: string;
  highlight?: boolean;
}) {
  async function handleClick() {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full text-center py-2.5 rounded-lg text-sm font-medium transition-all ${
        highlight ? 'btn-primary text-white' : 'btn-ghost text-zinc-300'
      }`}
    >
      {label}
    </button>
  );
}
