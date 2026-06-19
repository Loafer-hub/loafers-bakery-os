import {
  CheckCircle2,
  ChevronLeft,
  LockKeyhole,
  Minus,
  Plus,
  ShoppingBag,
  UserRound,
  Wheat,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  loadPublicStorefront,
  signInWithEmail,
  signOutCloud,
  signUpCustomer,
  submitPublicOrder,
} from "../lib/cloud";

function dollars(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

export default function CustomerOrderPortal({ cloudAccount, fallbackRecipes, slug }) {
  const [storefront, setStorefront] = useState(null);
  const [loading, setLoading] = useState(cloudAccount.configured);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMode, setAccountMode] = useState("signin");
  const [accountForm, setAccountForm] = useState({ name: "", email: "", password: "" });
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    pickupAt: "",
    notes: "",
  });

  useEffect(() => {
    if (!cloudAccount.configured) {
      setStorefront({
        bakery: {
          name: "Loafers",
          slug,
          ordering_intro: "Fresh sourdough, made in small batches. Choose a loaf and preview the customer request flow.",
        },
        products: fallbackRecipes.map((recipe, index) => ({
          id: `preview-${recipe.id}`,
          recipe_id: recipe.id,
          name: recipe.name,
          description: recipe.note,
          price_cents: Math.round(Number(recipe.price || 0) * 100),
          sort_order: index,
        })),
      });
      setLoading(false);
      return;
    }

    let active = true;
    loadPublicStorefront(slug)
      .then((nextStorefront) => {
        if (!active) return;
        setStorefront(nextStorefront);
        if (!nextStorefront) setError("This bakery order page is not available.");
      })
      .catch((nextError) => {
        if (active) setError(nextError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cloudAccount.configured, fallbackRecipes, slug]);

  useEffect(() => {
    const email = cloudAccount.session?.user?.email;
    if (email) setForm((current) => ({ ...current, email: current.email || email }));
  }, [cloudAccount.session?.user?.email]);

  const selectedItems = useMemo(() => (storefront?.products || [])
    .filter((product) => Number(quantities[product.id] || 0) > 0)
    .map((product) => ({ ...product, quantity: Number(quantities[product.id]) })), [quantities, storefront]);
  const total = selectedItems.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  const loafCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  function changeQuantity(productId, change) {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(0, Math.min(24, Number(current[productId] || 0) + change)),
    }));
  }

  async function submitAccount(event) {
    event.preventDefault();
    setError("");
    try {
      if (accountMode === "signin") {
        await signInWithEmail(accountForm.email, accountForm.password);
      } else {
        const result = await signUpCustomer({
          email: accountForm.email,
          password: accountForm.password,
          fullName: accountForm.name,
        });
        if (!result.session) {
          setError("Account created. Confirm the email we sent you, then sign in. You can still order as a guest.");
        }
      }
      setForm((current) => ({
        ...current,
        name: current.name || accountForm.name,
        email: current.email || accountForm.email,
      }));
      setAccountOpen(false);
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function submitOrder(event) {
    event.preventDefault();
    setError("");
    if (!cloudAccount.configured) {
      setError("This is the preview. Connect cloud storage before sharing the page with customers.");
      return;
    }
    if (!selectedItems.length) {
      setError("Choose at least one loaf.");
      return;
    }
    try {
      const result = await submitPublicOrder({
        slug,
        customer: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        },
        items: selectedItems.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
        })),
        pickupAt: form.pickupAt ? new Date(form.pickupAt).toISOString() : null,
        notes: form.notes.trim(),
      });
      setSuccess(result);
      setQuantities({});
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  if (loading) {
    return <main className="customer-portal customer-loading"><Wheat size={31} /><p>Opening the bread shelf…</p></main>;
  }

  if (!storefront) {
    return (
      <main className="customer-portal customer-loading">
        <Wheat size={31} />
        <h1>Order page unavailable</h1>
        <p>{error}</p>
        <a href={window.location.pathname}><ChevronLeft size={15} /> Return to Loafers</a>
      </main>
    );
  }

  if (success) {
    return (
      <main className="customer-portal customer-success-page">
        <span><CheckCircle2 size={36} /></span>
        <span className="eyebrow-label dark">Request received</span>
        <h1>Thank you, {form.name.split(" ")[0]}.</h1>
        <p>{storefront.bakery.name} received your bread request. The baker will confirm availability and pickup details.</p>
        <div><small>Request code</small><strong>{success.request_code}</strong><span>{dollars(success.subtotal_cents)}</span></div>
        <button className="primary-button" type="button" onClick={() => setSuccess(null)}>Make another request</button>
      </main>
    );
  }

  return (
    <main className="customer-portal">
      <header className="customer-header">
        <div className="brand-lockup"><span className="brand-mark"><Wheat size={23} /></span><span className="brand-name">{storefront.bakery.name}</span></div>
        {cloudAccount.session ? (
          <button type="button" onClick={signOutCloud}><UserRound size={17} /><span>{cloudAccount.session.user.email}</span></button>
        ) : (
          <button type="button" onClick={() => setAccountOpen((value) => !value)}><UserRound size={17} /> Customer account</button>
        )}
      </header>

      {!cloudAccount.configured ? <div className="portal-preview-banner"><LockKeyhole size={15} /> Preview only · cloud connection still needed</div> : null}

      {accountOpen ? (
        <section className="customer-account-card">
          <div className="cloud-mode-switch">
            <button type="button" className={accountMode === "signin" ? "selected" : ""} onClick={() => setAccountMode("signin")}>Sign in</button>
            <button type="button" className={accountMode === "signup" ? "selected" : ""} onClick={() => setAccountMode("signup")}>Create account</button>
          </div>
          <form className="form-stack" onSubmit={submitAccount}>
            {accountMode === "signup" ? <label>Name<input required value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} /></label> : null}
            <label>Email<input required type="email" value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })} /></label>
            <label>Password<input required minLength="8" type="password" value={accountForm.password} onChange={(event) => setAccountForm({ ...accountForm, password: event.target.value })} /></label>
            <button className="primary-button" type="submit">{accountMode === "signin" ? "Sign in" : "Create account"}</button>
          </form>
          <small>Accounts make it easier to see order history later. Guest requests are welcome too.</small>
        </section>
      ) : null}

      <section className="customer-hero">
        <span className="eyebrow-label dark">Small-batch sourdough</span>
        <h1>Bread worth planning for.</h1>
        <p>{storefront.bakery.ordering_intro}</p>
      </section>

      <form onSubmit={submitOrder}>
        <section className="customer-menu">
          <div className="customer-section-heading"><span>01</span><div><h2>Choose your loaves</h2><p>Requests are confirmed by the baker before they become final orders.</p></div></div>
          <div className="customer-product-list">
            {storefront.products.map((product) => (
              <article className={quantities[product.id] ? "customer-product selected" : "customer-product"} key={product.id}>
                <div><h3>{product.name}</h3><p>{product.description}</p><strong>{dollars(product.price_cents)}</strong></div>
                <div className="customer-quantity">
                  <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product.id, -1)}><Minus size={15} /></button>
                  <span>{quantities[product.id] || 0}</span>
                  <button type="button" aria-label={`Add one ${product.name}`} onClick={() => changeQuantity(product.id, 1)}><Plus size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="customer-details">
          <div className="customer-section-heading"><span>02</span><div><h2>Pickup & contact</h2><p>Leave enough information for the baker to confirm your request.</p></div></div>
          <div className="form-stack">
            <label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" /></label>
            <div className="form-grid">
              <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label>
              <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Optional if email entered" /></label>
            </div>
            <label>Preferred pickup<input type="datetime-local" value={form.pickupAt} onChange={(event) => setForm({ ...form, pickupAt: event.target.value })} /></label>
            <label>Request notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Scoring preference, timing, or anything the baker should know. Please discuss allergies directly." /></label>
          </div>
        </section>

        <footer className="customer-order-footer">
          <div><ShoppingBag size={18} /><span><strong>{loafCount} {loafCount === 1 ? "loaf" : "loaves"}</strong><small>Estimated total {dollars(total)}</small></span></div>
          <button className="primary-button" type="submit">Send request</button>
        </footer>
        {error ? <p className="form-error customer-form-error" role="alert">{error}</p> : null}
      </form>
    </main>
  );
}
