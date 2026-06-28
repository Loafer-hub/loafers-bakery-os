import {
  Banknote,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Info,
  LockKeyhole,
  Megaphone,
  Minus,
  PackageCheck,
  Plus,
  ShoppingBag,
  Star,
  Store,
  UserRound,
  Wheat,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CustomerPickupCalendar } from "../components/CustomerPickupCalendar";
import { CustomerOrderLookup } from "../components/CustomerOrderLookup";
import { Modal } from "../components/Primitives";
import {
  loadPublicStorefront,
  signInWithEmail,
  signOutCloud,
  signUpCustomer,
  submitPublicOrder,
} from "../lib/cloud";
import { normalizedBakerySettings } from "../lib/bakerySettings";
import {
  isPickupTimeAllowed,
  pickupDateTimeIso,
  pickupHoursLabel,
  pickupTimeOptions,
  shelfAgeLabel,
} from "../lib/pickupHours";
import { estimateRecipeNutrition } from "../lib/nutrition";
import { pluralUnit } from "../lib/salesOptions";

const DEFAULT_PICKUP_LOCATION = "Three Bears, Delta Junction, AK";
const DEFAULT_PAYMENT_METHODS = ["Venmo", "Zelle", "Cash"];
const PAYMENT_DETAILS = {
  Venmo: "@Joshua-Ellis-162",
  Zelle: "9076161025",
  Cash: "Pay at pickup",
};
const PRODUCT_TYPE_LABELS = {
  bread: "Bread",
  bagel: "Bagels",
  bun: "Buns / rolls",
  cake: "Cakes",
  pastry: "Pastries",
  hot_sauce: "Hot sauces",
  vinegar: "Vinegars",
  infused_oil: "Infused oils",
  other: "Small-batch item",
};
const PRODUCT_TYPE_ICONS = {
  bread: "🥖",
  bagel: "🥯",
  bun: "🍞",
  cake: "🍰",
  pastry: "🥐",
  hot_sauce: "🌶️",
  vinegar: "🍾",
  infused_oil: "🫒",
  other: "🏷️",
};
const PRODUCT_TYPE_ORDER = [
  "bread",
  "bagel",
  "bun",
  "cake",
  "pastry",
  "hot_sauce",
  "vinegar",
  "infused_oil",
  "other",
];

function dollars(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function productSalesOptions(product) {
  if (Array.isArray(product.sales_options) && product.sales_options.length) {
    return product.sales_options.map((option, index) => ({
      id: String(option.id || `option-${index + 1}`),
      label: option.label || `Option ${index + 1}`,
      units: Math.max(0.5, Number(option.units || 1)),
      price_cents: Math.max(0, Number(option.price_cents ?? product.price_cents ?? 0)),
      capacity_units: Math.max(1, Math.min(6, Number(option.capacity_units || 1))),
    }));
  }
  return [{
    id: "default",
    label: "Loaf",
    units: 1,
    price_cents: Number(product.price_cents || 0),
    capacity_units: 1,
  }];
}

function productTypeLabel(product) {
  const value = productTypeValue(product);
  return PRODUCT_TYPE_LABELS[value] || PRODUCT_TYPE_LABELS.other;
}

function productTypeIcon(product) {
  const value = productTypeValue(product);
  return PRODUCT_TYPE_ICONS[value] || PRODUCT_TYPE_ICONS.other;
}

function productTypeValue(product) {
  return product?.recipe_details?.productType || "bread";
}

function productPhotoUrl(product) {
  return String(product?.recipe_details?.photoUrl || "").trim();
}

export default function CustomerOrderPortal({
  bakerySettings,
  cloudAccount,
  fallbackRecipes,
  slug,
}) {
  const [storefront, setStorefront] = useState(null);
  const [loading, setLoading] = useState(cloudAccount.configured);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [selectedOptions, setSelectedOptions] = useState({});
  const [activeCatalogTab, setActiveCatalogTab] = useState("all");
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMode, setAccountMode] = useState("signin");
  const [accountForm, setAccountForm] = useState({ name: "", email: "", password: "" });
  const [selectedCapacity, setSelectedCapacity] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    pickupDate: "",
    pickupTime: "07:00",
    paymentMethod: "Venmo",
    notifyEmail: true,
    notifySms: false,
    allergies: "",
    notes: "",
  });

  useEffect(() => {
    if (!cloudAccount.configured) {
      setStorefront({
        bakery: {
          name: "Loafers",
          slug,
          ordering_intro: "Fresh sourdough, made in small batches. Choose a loaf and preview the customer request flow.",
          pickup_location: DEFAULT_PICKUP_LOCATION,
          payment_methods: DEFAULT_PAYMENT_METHODS,
        },
        settings: normalizedBakerySettings(bakerySettings),
        products: fallbackRecipes.map((recipe, index) => ({
          id: `preview-${recipe.id}`,
          recipe_id: recipe.id,
          name: recipe.name,
          description: recipe.note,
          price_cents: Math.round(Number(recipe.price || 0) * 100),
          recipe_details: {
            yield: recipe.yield,
            unitName: recipe.unitName || "loaf",
            productType: recipe.productType || "bread",
            formulaMode: recipe.formulaMode || "bakers",
            photoUrl: recipe.photoUrl || "",
            photoAlt: recipe.photoAlt || recipe.name || "",
            hydration: recipe.hydration,
            ingredients: recipe.ingredients,
          },
          sales_options: (recipe.salesOptions || [{
            id: "default",
            label: "Loaf",
            units: 1,
            price: recipe.price,
            capacityUnits: 1,
          }]).map((option) => ({
            id: option.id,
            label: option.label,
            units: option.units,
            price_cents: Math.round(Number(option.price || 0) * 100),
            capacity_units: option.capacityUnits || 1,
          })),
          sort_order: index,
        })),
        shelf: [],
        reviews: [],
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
  }, [bakerySettings, cloudAccount.configured, fallbackRecipes, slug]);

  useEffect(() => {
    const email = cloudAccount.session?.user?.email;
    if (email) setForm((current) => ({ ...current, email: current.email || email }));
  }, [cloudAccount.session?.user?.email]);

  const selectedItems = useMemo(() => [
    ...(storefront?.products || []).flatMap((product) => productSalesOptions(product)
      .filter((option) => Number(quantities[`product-${product.id}-${option.id}`] || 0) > 0)
      .map((option) => ({
        ...product,
        itemType: "product",
        saleOption: option,
        quantityKey: `product-${product.id}-${option.id}`,
        quantity: Number(quantities[`product-${product.id}-${option.id}`]),
        price_cents: option.price_cents,
      }))),
    ...(storefront?.shelf || [])
      .filter((item) => Number(quantities[`shelf-${item.id}`] || 0) > 0)
      .map((item) => ({
        ...item,
        itemType: "shelf",
        quantityKey: `shelf-${item.id}`,
        quantity: Number(quantities[`shelf-${item.id}`]),
      })),
  ], [quantities, storefront]);
  const total = selectedItems.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  const rules = normalizedBakerySettings(storefront?.settings || bakerySettings);
  const storefrontProducts = storefront?.products || [];
  const readyShelfItems = rules.readyShelfEnabled ? (storefront?.shelf || []) : [];
  const catalogTabs = useMemo(() => {
    const availableTypes = new Set(storefrontProducts.map(productTypeValue));
    const orderedTypes = [
      ...PRODUCT_TYPE_ORDER.filter((type) => availableTypes.has(type)),
      ...[...availableTypes].filter((type) => !PRODUCT_TYPE_ORDER.includes(type)),
    ];
    return [
      {
        id: "all",
        icon: "🧺",
        label: "All goods",
        count: storefrontProducts.length + readyShelfItems.length,
      },
      ...(readyShelfItems.length ? [{
        id: "ready",
        icon: "✅",
        label: "Ready now",
        count: readyShelfItems.length,
      }] : []),
      ...orderedTypes.map((type) => ({
        id: type,
        icon: PRODUCT_TYPE_ICONS[type] || PRODUCT_TYPE_ICONS.other,
        label: PRODUCT_TYPE_LABELS[type] || PRODUCT_TYPE_LABELS.other,
        count: storefrontProducts.filter((product) => productTypeValue(product) === type).length,
      })),
    ].filter((tab) => tab.count > 0 || tab.id === "all");
  }, [readyShelfItems, storefrontProducts]);
  const visibleShelfItems = activeCatalogTab === "all" || activeCatalogTab === "ready"
    ? readyShelfItems
    : [];
  const visibleProducts = activeCatalogTab === "all"
    ? storefrontProducts
    : activeCatalogTab === "ready"
      ? []
      : storefrontProducts.filter((product) => productTypeValue(product) === activeCatalogTab);
  const customerAnnouncement = rules.announcementEnabled && rules.announcementText
    ? {
      title: rules.announcementTitle || "From the baker",
      text: rules.announcementText,
    }
    : null;
  const packageCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const itemCount = selectedItems.reduce((sum, item) => (
    sum + item.quantity * Number(item.saleOption?.units || 1)
  ), 0);
  const bakeLoafCount = selectedItems
    .filter((item) => item.itemType === "product")
    .reduce((sum, item) => sum + item.quantity * Number(item.saleOption?.capacity_units || 1), 0);
  const shelfLoafCount = selectedItems
    .filter((item) => item.itemType === "shelf")
    .reduce((sum, item) => sum + item.quantity, 0);
  const pickupOptions = pickupTimeOptions(form.pickupDate, rules);
  const trackedCode = new URLSearchParams(window.location.search).get("track") || "";

  useEffect(() => {
    if (!catalogTabs.some((tab) => tab.id === activeCatalogTab)) {
      setActiveCatalogTab("all");
    }
  }, [activeCatalogTab, catalogTabs]);

  function changeQuantity(item, change) {
    const quantityKey = item.quantityKey || `${item.itemType}-${item.id}`;
    const currentQuantity = Number(quantities[quantityKey] || 0);
    const capacityChange = Number(item.saleOption?.capacity_units || 1);
    if (item.itemType === "product" && change > 0 && bakeLoafCount + capacityChange > rules.dailyCapacity) {
      setError(`That package would exceed the ${rules.dailyCapacity}-slot daily bake capacity.`);
      return;
    }
    const maximum = item.itemType === "shelf" ? Number(item.quantity || 0) : 6;
    setError("");
    setQuantities((current) => ({
      ...current,
      [quantityKey]: Math.max(0, Math.min(maximum, currentQuantity + change)),
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
      setError("Choose at least one item.");
      return;
    }
    if (!form.pickupDate) {
      setError("Choose an available pickup date.");
      return;
    }
    if (!isPickupTimeAllowed(form.pickupDate, form.pickupTime, rules)) {
      setError(`Choose a pickup time between ${pickupHoursLabel(form.pickupDate, rules)}.`);
      return;
    }
    if (selectedCapacity && bakeLoafCount > selectedCapacity.remaining) {
      setError(`Only ${selectedCapacity.remaining} bake slot${selectedCapacity.remaining === 1 ? "" : "s"} remain for that pickup day.`);
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
          ...(item.itemType === "shelf"
            ? { shelf_item_id: item.id }
            : { product_id: item.id, sale_option_id: item.saleOption.id }),
          quantity: item.quantity,
        })),
        pickupAt: pickupDateTimeIso(form.pickupDate, form.pickupTime),
        paymentMethod: form.paymentMethod,
        allergies: form.allergies.trim(),
        notes: form.notes.trim(),
        notifications: {
          email: Boolean(rules.emailNotifications && form.notifyEmail && form.email.trim()),
          sms: Boolean(rules.smsNotifications && form.notifySms && form.phone.trim()),
        },
      });
      setSuccess(result);
      setQuantities({});
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  if (loading) {
    return <main className="customer-portal customer-loading"><Wheat size={31} /><p>Opening the order shelf…</p></main>;
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
        <p>{storefront.bakery.name} received your bread request. The baker will confirm availability and pickup details for {storefront.bakery.pickup_location || DEFAULT_PICKUP_LOCATION}.</p>
        <div><small>Request code</small><strong>{success.request_code}</strong><span>{dollars(success.subtotal_cents)}</span></div>
        <aside className="success-payment-detail"><small>{form.paymentMethod}</small><strong>{PAYMENT_DETAILS[form.paymentMethod]}</strong></aside>
        <CustomerOrderLookup
          configured={cloudAccount.configured}
          feedbackEnabled={rules.feedbackEnabled}
          initialCode={success.request_code}
          initialContact={form.email.trim() || form.phone.trim()}
          slug={slug}
        />
        <button className="primary-button" type="button" onClick={() => setSuccess(null)}>Make another request</button>
      </main>
    );
  }

  if (!rules.onlineOrdering) {
    return (
      <main className="customer-portal customer-ordering-paused">
        <header className="customer-header">
          <div className="brand-lockup"><span className="brand-mark"><Wheat size={23} /></span><span className="brand-name">{storefront.bakery.name}</span></div>
        </header>
        {customerAnnouncement ? <CustomerAnnouncement announcement={customerAnnouncement} /> : null}
        <section className="customer-hero">
          <span className="eyebrow-label dark">Small-batch sourdough</span>
          <h1>Online ordering is paused.</h1>
          <p>The baker is not accepting new requests right now. Existing customers can still track an order below.</p>
          <div className="customer-fulfillment-strip">
            <span><Store size={17} /><span><small>Pickup</small><strong>{rules.pickupLocation}</strong></span></span>
          </div>
        </section>
        <CustomerOrderLookup
          configured={cloudAccount.configured}
          feedbackEnabled={rules.feedbackEnabled}
          initialCode={trackedCode}
          initialContact={form.email}
          slug={slug}
        />
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
      {customerAnnouncement ? <CustomerAnnouncement announcement={customerAnnouncement} /> : null}

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
        <div className="customer-fulfillment-strip">
          <span><Store size={17} /><span><small>Pickup</small><strong>{storefront.bakery.pickup_location || DEFAULT_PICKUP_LOCATION}</strong></span></span>
          <span><Banknote size={17} /><span><small>Payment</small><strong>{(storefront.bakery.payment_methods || DEFAULT_PAYMENT_METHODS).join(", ")}</strong></span></span>
          <span><Clock3 size={17} /><span><small>Pickup hours</small><strong>Weekdays {pickupHoursLabel("2026-06-22", rules)} · Weekends {pickupHoursLabel("2026-06-21", rules)}</strong></span></span>
        </div>
      </section>

      {rules.reviewsVisible && (storefront.reviews || []).length ? (
        <section className="customer-reviews" aria-label="Customer reviews">
          <div className="customer-section-heading"><div><h2>From the bread table</h2><p>Recent reviews from verified Loafers orders.</p></div></div>
          <div className="customer-review-list">
            {storefront.reviews.map((review) => (
              <article className="customer-review-card" key={review.id}>
                <span className="customer-review-stars" aria-label={`${review.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, index) => <Star key={index} size={14} fill={index < review.rating ? "currentColor" : "none"} />)}
                </span>
                <p>“{review.message}”</p>
                <small>{review.customer_name} · {new Date(review.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <CustomerOrderLookup
        configured={cloudAccount.configured}
        feedbackEnabled={rules.feedbackEnabled}
        initialCode={trackedCode}
        initialContact={form.email}
        slug={slug}
      />

      <form onSubmit={submitOrder}>
        <section className="customer-menu">
          <div className="customer-section-heading"><div><h2>Choose your items</h2><p>Browse by category, ready shelf, or all goods. Requests are confirmed by the baker before they become final orders.</p></div></div>
          <div className="customer-menu-tabs" role="tablist" aria-label="Goods categories">
            {catalogTabs.map((tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeCatalogTab === tab.id}
                className={activeCatalogTab === tab.id ? "selected" : ""}
                key={tab.id}
                onClick={() => setActiveCatalogTab(tab.id)}
              >
                <span>{tab.icon}</span>
                <strong>{tab.label}</strong>
                <small>{tab.count}</small>
              </button>
            ))}
          </div>

          {visibleShelfItems.length ? (
            <div className="customer-tab-panel">
              <div className="customer-tab-heading"><PackageCheck size={16} /><span><strong>Ready-to-go shelf</strong><small>Already baked and available while quantity lasts. These do not use future bake capacity.</small></span></div>
              <div className="customer-product-list">
                {visibleShelfItems.map((item) => {
                  const quantityKey = `shelf-${item.id}`;
                  const orderItem = { ...item, itemType: "shelf" };
                  return (
                    <article className={quantities[quantityKey] ? "customer-product shelf-product selected" : "customer-product shelf-product"} key={item.id}>
                      <div>
                        <span className="shelf-product-label"><PackageCheck size={14} /> {shelfAgeLabel(item.baked_on)} · {item.quantity} ready</span>
                        <h3>{item.name}</h3>
                        <p>{item.description || "Freshly baked and ready for pickup."}</p>
                        <strong>{dollars(item.price_cents)}</strong>
                      </div>
                      <div className="customer-quantity">
                        <button type="button" aria-label={`Remove one ${item.name}`} onClick={() => changeQuantity(orderItem, -1)}><Minus size={15} /></button>
                        <span>{quantities[quantityKey] || 0}</span>
                        <button type="button" aria-label={`Add one ${item.name}`} onClick={() => changeQuantity(orderItem, 1)} disabled={Number(quantities[quantityKey] || 0) >= Number(item.quantity || 0)}><Plus size={15} /></button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {visibleProducts.length ? (
            <div className="customer-tab-panel">
              <div className="customer-product-list">
                {visibleProducts.map((product) => (
                  <CustomerProductCard
                    key={product.id}
                    product={product}
                    quantities={quantities}
                    selectedOptionId={selectedOptions[product.id]}
                    onChangeOption={(optionId) => setSelectedOptions((current) => ({ ...current, [product.id]: optionId }))}
                    onChangeQuantity={changeQuantity}
                    onShowDetails={() => setSelectedProduct(product)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {!visibleShelfItems.length && !visibleProducts.length ? (
            <div className="customer-empty-tab">
              <strong>Nothing in this tab yet.</strong>
              <span>Try All goods or check back after the baker republishes the menu.</span>
            </div>
          ) : null}
        </section>

        <section className="customer-details">
          <div className="customer-section-heading"><div><h2>Pickup & contact</h2><p>Leave enough information for the baker to confirm your request.</p></div></div>
          <div className="form-stack">
            <label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" /></label>
            <div className="form-grid">
              <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label>
              <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Optional if email entered" /></label>
            </div>
            <CustomerPickupCalendar
              configured={cloudAccount.configured}
              loafCount={bakeLoafCount}
              shelfOnly={shelfLoafCount > 0 && bakeLoafCount === 0}
              selectedDate={form.pickupDate}
              slug={slug}
              settings={rules}
              onSelectDate={(pickupDate, capacity) => {
                const nextOptions = pickupTimeOptions(pickupDate, rules);
                setSelectedCapacity(capacity);
                setForm((current) => ({
                  ...current,
                  pickupDate,
                  pickupTime: isPickupTimeAllowed(pickupDate, current.pickupTime, rules)
                    ? current.pickupTime
                    : nextOptions[0]?.value || "",
                }));
                setError("");
              }}
            />
            <label>
              Preferred pickup time
              <select required disabled={!form.pickupDate} value={form.pickupTime} onChange={(event) => setForm({ ...form, pickupTime: event.target.value })}>
                {!form.pickupDate ? <option value="07:00">Choose a pickup date first</option> : null}
                {pickupOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            {form.pickupDate ? <p className="pickup-hours-note"><Clock3 size={14} /> Pickup hours for this day: {pickupHoursLabel(form.pickupDate, rules)}</p> : null}
            <fieldset className="payment-choice">
              <legend>How would you like to pay?</legend>
              <div>
                {(storefront.bakery.payment_methods || DEFAULT_PAYMENT_METHODS).map((method) => (
                  <label className={form.paymentMethod === method ? "selected" : ""} key={method}>
                    <input
                      type="radio"
                      name="payment-method"
                      value={method}
                      checked={form.paymentMethod === method}
                      onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}
                    />
                    <span>{method}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <aside className="payment-instructions">
              <Banknote size={18} />
              <span><small>{form.paymentMethod} payment</small><strong>{PAYMENT_DETAILS[form.paymentMethod]}</strong></span>
            </aside>
            <aside className="pickup-location-card"><Store size={18} /><span><small>Pickup location</small><strong>{storefront.bakery.pickup_location || DEFAULT_PICKUP_LOCATION}</strong></span></aside>
            <label>Allergies or food sensitivities<textarea value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} placeholder="List allergies, sensitivities, or write “None.” The baker will confirm before accepting." /></label>
            <aside className="allergy-warning"><strong>Home bakery notice</strong><span>Loafers handles wheat and may handle dairy, seeds, and other allergens. An allergy note is a request for review, not a guarantee against cross-contact.</span></aside>
            <label>Request notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Scoring preference, timing, or anything else the baker should know." /></label>
            <fieldset className="notification-preferences">
              <legend>Order status notifications</legend>
              <label className={!rules.emailNotifications || !form.email.trim() ? "disabled" : ""}>
                <input type="checkbox" disabled={!rules.emailNotifications || !form.email.trim()} checked={rules.emailNotifications && form.notifyEmail && Boolean(form.email.trim())} onChange={(event) => setForm({ ...form, notifyEmail: event.target.checked })} />
                <span><strong>Email updates</strong><small>Order acceptance, bake progress, comments, and pickup readiness.</small></span>
              </label>
              <label className={!rules.smsNotifications || !form.phone.trim() ? "disabled" : ""}>
                <input type="checkbox" disabled={!rules.smsNotifications || !form.phone.trim()} checked={rules.smsNotifications && form.notifySms && Boolean(form.phone.trim())} onChange={(event) => setForm({ ...form, notifySms: event.target.checked })} />
                <span><strong>Text updates</strong><small>Message and data rates may apply. You can ask the baker to stop updates at any time.</small></span>
              </label>
            </fieldset>
          </div>
        </section>

        <footer className="customer-order-footer">
          <div><ShoppingBag size={18} /><span><strong>{packageCount} {packageCount === 1 ? "package" : "packages"} · {itemCount} {itemCount === 1 ? "item" : "items"}</strong><small>Estimated total {dollars(total)}</small></span></div>
          <button className="primary-button" type="submit">Send request</button>
        </footer>
        {error ? <p className="form-error customer-form-error" role="alert">{error}</p> : null}
      </form>

      {selectedProduct ? <CustomerRecipeDetails product={selectedProduct} onClose={() => setSelectedProduct(null)} /> : null}
    </main>
  );
}

function CustomerAnnouncement({ announcement }) {
  return (
    <section className="customer-announcement" aria-label="Bakery announcement">
      <span><Megaphone size={19} /></span>
      <div>
        <small>{announcement.title}</small>
        <p>{announcement.text}</p>
      </div>
    </section>
  );
}

function CustomerProductCard({
  onChangeOption,
  onChangeQuantity,
  onShowDetails,
  product,
  quantities,
  selectedOptionId,
}) {
  const options = productSalesOptions(product);
  const selectedOption = options.find((option) => option.id === selectedOptionId) || options[0];
  const quantityKey = `product-${product.id}-${selectedOption.id}`;
  const selected = options.some((option) => Number(quantities[`product-${product.id}-${option.id}`] || 0) > 0);
  const unitName = product.recipe_details?.unitName || "item";
  const unitsLabel = pluralUnit(unitName, selectedOption.units);
  const photoUrl = productPhotoUrl(product);
  return (
    <article className={selected ? "customer-product selected" : "customer-product"}>
      <div className="customer-product-main">
        <span className={photoUrl ? "customer-product-photo" : "customer-product-photo empty"}>
          {photoUrl ? <img src={photoUrl} alt={product.recipe_details?.photoAlt || product.name} /> : productTypeIcon(product)}
        </span>
        <button className="customer-product-info" type="button" onClick={onShowDetails} aria-label={`View details for ${product.name}`}>
          <span><Info size={13} /> {productTypeLabel(product)} · View details</span>
          <h3>{product.name}</h3>
          <p>{product.description}</p>
        </button>
        <label className="customer-package-choice">
          Package
          <select value={selectedOption.id} onChange={(event) => onChangeOption(event.target.value)}>
            {options.map((option) => <option key={option.id} value={option.id}>{option.label} · {option.units} {pluralUnit(unitName, option.units)} · {dollars(option.price_cents)}</option>)}
          </select>
        </label>
        <span className="customer-package-price"><strong>{dollars(selectedOption.price_cents)}</strong><small>{selectedOption.label} · {selectedOption.units} {unitsLabel}</small></span>
      </div>
      <div className="customer-quantity">
        <button type="button" aria-label={`Remove one ${selectedOption.label} of ${product.name}`} onClick={() => onChangeQuantity({
          ...product,
          itemType: "product",
          saleOption: selectedOption,
          quantityKey,
        }, -1)}><Minus size={15} /></button>
        <span>{quantities[quantityKey] || 0}</span>
        <button type="button" aria-label={`Add one ${selectedOption.label} of ${product.name}`} onClick={() => onChangeQuantity({
          ...product,
          itemType: "product",
          saleOption: selectedOption,
          quantityKey,
        }, 1)}><Plus size={15} /></button>
      </div>
    </article>
  );
}

function CustomerRecipeDetails({ product, onClose }) {
  const details = product.recipe_details || {};
  const ingredients = Array.isArray(details.ingredients) ? details.ingredients : [];
  const baseYield = Math.max(1, Number(details.yield || 1));
  const unitName = details.unitName || "item";
  const loafStyle = unitName.toLowerCase().includes("loaf");
  const formulaMode = details.formulaMode || "bakers";
  const photoUrl = productPhotoUrl(product);
  const salesOptions = productSalesOptions(product);
  const nutrition = ingredients.length ? estimateRecipeNutrition({
    yield: baseYield,
    ingredients,
  }) : null;

  return (
    <Modal title={product.name} onClose={onClose}>
      <div className="customer-recipe-detail">
        <div className={photoUrl ? "customer-recipe-photo" : "customer-recipe-photo empty"}>
          {photoUrl ? <img src={photoUrl} alt={details.photoAlt || product.name} /> : productTypeIcon(product)}
        </div>
        <div className="customer-recipe-summary">
          <span><small>Starting price</small><strong>{dollars(Math.min(...salesOptions.map((option) => option.price_cents)))}</strong></span>
          <span><small>Category</small><strong>{productTypeLabel(product)}</strong></span>
          <span><small>Published formula</small><strong>{baseYield} {pluralUnit(unitName, baseYield)}</strong></span>
        </div>
        <p>{product.description || "Small-batch naturally leavened bread."}</p>
        <div className="customer-recipe-heading"><h3>Package sizes</h3><small>Choose on the order card</small></div>
        <div className="customer-recipe-packages">
          {salesOptions.map((option) => (
            <div key={option.id}>
              <span><strong>{option.label}</strong><small>{option.units} {pluralUnit(unitName, option.units)} · {option.capacity_units} bake slot{option.capacity_units === 1 ? "" : "s"}</small></span>
              <strong>{dollars(option.price_cents)}</strong>
            </div>
          ))}
        </div>

        {ingredients.length ? (
          <>
            <div className="customer-recipe-heading"><h3>Ingredients & formula</h3><small>Weights shown per {unitName}</small></div>
            <div className="customer-formula-table">
              <div><strong>Ingredient</strong><strong>Weight</strong><strong>{formulaMode === "batch" ? "Batch %" : "Baker’s %"}</strong></div>
              {ingredients.map((ingredient, index) => (
                <div key={`${ingredient.name}-${index}`}>
                  <span>{ingredient.name}</span>
                  <span>{Math.round(Number(ingredient.weight || 0) / baseYield)} g</span>
                  <span>{Number(ingredient.percent || 0).toFixed(Number(ingredient.percent || 0) % 1 ? 1 : 0)}%</span>
                </div>
              ))}
            </div>

            <div className="customer-recipe-heading"><h3>Estimated nutrition</h3><small>{loafStyle ? "Per loaf · per 1/12 loaf slice" : `Per ${unitName}`}</small></div>
            <div className="customer-nutrition-grid">
              {[
                ["Calories", "calories", ""],
                ["Carbohydrates", "carbs", "g"],
                ["Protein", "protein", "g"],
                ["Fat", "fat", "g"],
                ["Fiber", "fiber", "g"],
                ["Sodium", "sodium", "mg"],
              ].map(([label, key, unit]) => (
                <div key={key}>
                  <span>{label}</span>
                  <strong>{nutrition.perLoaf[key]}{unit}</strong>
                  {loafStyle ? <small>{nutrition.perSlice[key]}{unit} / slice</small> : <small>per {unitName}</small>}
                </div>
              ))}
            </div>
            <p className="nutrition-disclaimer">Nutrition is an estimate based on standard ingredient averages and a 100%-hydration starter{loafStyle ? ", with 12 slices per loaf" : ""}. Ingredient brands, fermentation, moisture loss, and serving size change the final values.</p>
          </>
        ) : (
          <p className="customer-formula-unavailable">The baker has not republished this recipe’s full formula yet.</p>
        )}
      </div>
    </Modal>
  );
}
