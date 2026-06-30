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
import { productTypeMap, productTypeSettingsFor } from "../lib/productTypes";

// product-type-settings-v1
// customer-options-v1
// compact-customer-cards-v1
// checkout-flow-v1

const DEFAULT_PICKUP_LOCATION = "Three Bears, Delta Junction, AK";
const DEFAULT_PAYMENT_METHODS = ["Venmo", "Zelle", "Cash"];
const PAYMENT_DETAILS = {
  Venmo: "@Joshua-Ellis-162",
  Zelle: "9076161025",
  Cash: "Pay at pickup",
};
const CHECKOUT_STEPS = [
  { id: "browse", label: "Browse menu" },
  { id: "cart", label: "Review cart" },
  { id: "pickup", label: "Choose pickup" },
  { id: "contact", label: "Contact + payment" },
  { id: "submit", label: "Send request" },
];
const PRODUCT_BADGE_LABELS = {
  preorder: "Preorder",
  ready_now: "Ready now",
  spicy: "Spicy",
  dairy: "Contains dairy",
  gluten: "Gluten",
  limited_batch: "Limited batch",
};

function dollars(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function checkoutPickupLabel(date, time) {
  if (!date) return "Pickup not chosen yet";
  const pickup = new Date(`${date}T${time || "00:00"}`);
  if (Number.isNaN(pickup.getTime())) return `${date} ${time || ""}`.trim();
  return pickup.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function productSalesOptions(product) {
  if (Array.isArray(product.sales_options) && product.sales_options.length) {
    return product.sales_options.map((option, index) => ({
      id: String(option.id || `option-${index + 1}`),
      label: option.label || `Option ${index + 1}`,
      units: Math.max(0.5, Number(option.units || 1)),
      price_cents: Math.max(0, Number(option.price_cents ?? product.price_cents ?? 0)),
      capacity_units: Math.max(0, Math.min(6, Number(option.capacity_units ?? 1))),
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

function productTypeLabel(product, settings) {
  return productTypeSettingsFor(settings, productTypeValue(product)).label;
}

function productTypeIcon(product, settings) {
  return productTypeSettingsFor(settings, productTypeValue(product)).icon;
}

function productTypeValue(product) {
  return product?.recipe_details?.productType || "bread";
}

function productPhotoUrl(product) {
  return String(product?.recipe_details?.photoUrl || "").trim();
}

function productBadges(product) {
  return (Array.isArray(product?.recipe_details?.badges) ? product.recipe_details.badges : [])
    .map((badge) => String(badge || "").trim())
    .filter((badge) => PRODUCT_BADGE_LABELS[badge])
    .map((badge) => ({ id: badge, label: PRODUCT_BADGE_LABELS[badge] }));
}

function productUnavailable(product) {
  return product?.recipe_details?.available === false
    || product?.recipe_details?.soldOut === true
    || product?.recipe_details?.unavailableThisWeek === true;
}

function productAvailabilityLabel(product) {
  const note = String(product?.recipe_details?.availabilityNote || "").trim();
  if (note) return note;
  return productUnavailable(product) ? "Unavailable this week" : "Available this week";
}

function productStartingPrice(product) {
  const prices = productSalesOptions(product).map((option) => option.price_cents);
  return Math.min(...prices);
}

function productSelectedPackageCount(product, quantities) {
  return productSalesOptions(product).reduce((sum, option) => (
    sum + Number(quantities[`product-${product.id}-${option.id}`] || 0)
  ), 0);
}

function enabledCustomerOptions(typeSettings) {
  return (typeSettings?.customerOptions || []).filter((option) => option.enabled !== false);
}

function selectedCustomerChoices(product, typeSettings, selections = {}) {
  return enabledCustomerOptions(typeSettings)
    .map((option) => ({
      id: option.id,
      label: option.label,
      required: option.required === true,
      value: String(selections[option.id] || "").trim(),
    }))
    .filter((choice) => choice.value);
}

function customerChoiceNote(items) {
  const lines = items
    .filter((item) => item.customerChoices?.length)
    .map((item) => {
      const packageLabel = item.saleOption?.label ? ` (${item.saleOption.label})` : "";
      const choices = item.customerChoices
        .map((choice) => `${choice.label}: ${choice.value}`)
        .join("; ");
      return `${item.name}${packageLabel}: ${choices}`;
    });
  return lines.length ? `Customer choices:\n${lines.join("\n")}` : "";
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
  const [productOptionSelections, setProductOptionSelections] = useState({});
  const [activeCatalogTab, setActiveCatalogTab] = useState("all");
  const [checkoutStep, setCheckoutStep] = useState("browse");
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
            available: recipe.available !== false,
            availabilityNote: recipe.availabilityNote || "",
            badges: Array.isArray(recipe.badges) ? recipe.badges : [],
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
            capacity_units: option.capacityUnits ?? 1,
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

  const rules = normalizedBakerySettings(storefront?.settings || bakerySettings);
  const productTypes = rules.productTypes.filter((type) => type.enabled !== false);
  const productSettingsByValue = productTypeMap(rules);
  const visibleProductTypeValues = new Set(productTypes.map((type) => type.value));
  const storefrontProducts = (storefront?.products || []).filter((product) => (
    visibleProductTypeValues.has(productTypeValue(product))
  ));
  const selectedItems = useMemo(() => [
    ...storefrontProducts.flatMap((product) => productSalesOptions(product)
      .filter((option) => Number(quantities[`product-${product.id}-${option.id}`] || 0) > 0)
      .map((option) => {
        const typeSettings = productSettingsByValue.get(productTypeValue(product))
          || productTypeSettingsFor(rules, productTypeValue(product));
        const selections = productOptionSelections[product.id] || {};
        return {
          ...product,
          itemType: "product",
          saleOption: option,
          quantityKey: `product-${product.id}-${option.id}`,
          quantity: Number(quantities[`product-${product.id}-${option.id}`]),
          price_cents: option.price_cents,
          customerChoices: selectedCustomerChoices(product, typeSettings, selections),
          missingCustomerChoices: enabledCustomerOptions(typeSettings)
            .filter((choice) => choice.required === true && !String(selections[choice.id] || "").trim())
            .map((choice) => choice.label),
        };
      })),
    ...(storefront?.shelf || [])
      .filter((item) => Number(quantities[`shelf-${item.id}`] || 0) > 0)
      .map((item) => ({
        ...item,
        itemType: "shelf",
        quantityKey: `shelf-${item.id}`,
        availableQuantity: Number(item.quantity || 0),
        quantity: Number(quantities[`shelf-${item.id}`]),
      })),
  ], [productOptionSelections, productSettingsByValue, quantities, rules, storefront, storefrontProducts]);
  const total = selectedItems.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  const readyShelfItems = rules.readyShelfEnabled ? (storefront?.shelf || []) : [];
  const catalogTabs = useMemo(() => {
    const availableTypes = new Set(storefrontProducts.map(productTypeValue));
    const orderedTypes = productTypes.filter((type) => availableTypes.has(type.value));
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
        id: type.value,
        icon: type.icon,
        label: type.label,
        description: type.description,
        safetyNotes: type.safetyNotes,
        count: storefrontProducts.filter((product) => productTypeValue(product) === type.value).length,
      })),
    ].filter((tab) => tab.count > 0 || tab.id === "all");
  }, [productTypes, readyShelfItems, storefrontProducts]);
  const visibleShelfItems = activeCatalogTab === "all" || activeCatalogTab === "ready"
    ? readyShelfItems
    : [];
  const visibleProducts = activeCatalogTab === "all"
    ? storefrontProducts
    : activeCatalogTab === "ready"
      ? []
      : storefrontProducts.filter((product) => productTypeValue(product) === activeCatalogTab);
  const activeCatalogInfo = catalogTabs.find((tab) => tab.id === activeCatalogTab);
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
    .reduce((sum, item) => sum + item.quantity * Number(item.saleOption?.capacity_units ?? 1), 0);
  const shelfLoafCount = selectedItems
    .filter((item) => item.itemType === "shelf")
    .reduce((sum, item) => sum + item.quantity, 0);
  const pickupOptions = pickupTimeOptions(form.pickupDate, rules);
  const urlParams = new URLSearchParams(window.location.search);
  const trackedCode = urlParams.get("track") || "";
  const trackedContact = urlParams.get("contact") || "";
  const ownerPreview = urlParams.get("preview") === "owner" || urlParams.get("ownerPreview") === "1";
  const checkoutStepIndex = CHECKOUT_STEPS.findIndex((step) => step.id === checkoutStep);

  useEffect(() => {
    if (!catalogTabs.some((tab) => tab.id === activeCatalogTab)) {
      setActiveCatalogTab("all");
    }
  }, [activeCatalogTab, catalogTabs]);

  function changeQuantity(item, change) {
    const quantityKey = item.quantityKey || `${item.itemType}-${item.id}`;
    const currentQuantity = Number(quantities[quantityKey] || 0);
    const capacityChange = Number(item.saleOption?.capacity_units ?? 1);
    if (item.itemType === "product" && change > 0 && productUnavailable(item)) {
      setError(`${item.name} is ${productAvailabilityLabel(item).toLowerCase()}.`);
      return;
    }
    if (item.itemType === "product" && change > 0 && bakeLoafCount + capacityChange > rules.dailyCapacity) {
      setError(`That package would exceed the ${rules.dailyCapacity}-slot daily bake capacity.`);
      return;
    }
    const maximum = item.itemType === "shelf" ? Number(item.availableQuantity ?? item.quantity ?? 0) : 6;
    setError("");
    setQuantities((current) => ({
      ...current,
      [quantityKey]: Math.max(0, Math.min(maximum, currentQuantity + change)),
    }));
  }

  function editCartItem(item) {
    if (item.itemType !== "product") return;
    setSelectedOptions((current) => ({ ...current, [item.id]: item.saleOption?.id || current[item.id] }));
    setSelectedProduct(item);
  }

  function validateCartChoices() {
    const missingChoiceItem = selectedItems.find((item) => item.missingCustomerChoices?.length);
    if (missingChoiceItem) {
      setError(`Choose ${missingChoiceItem.missingCustomerChoices[0]} for ${missingChoiceItem.name}.`);
      setCheckoutStep("cart");
      return false;
    }
    return true;
  }

  function validatePickup() {
    if (!form.pickupDate) {
      setError("Choose an available pickup date.");
      return false;
    }
    if (!isPickupTimeAllowed(form.pickupDate, form.pickupTime, rules)) {
      setError(`Choose a pickup time between ${pickupHoursLabel(form.pickupDate, rules)}.`);
      return false;
    }
    if (selectedCapacity && bakeLoafCount > selectedCapacity.remaining) {
      setError(`Only ${selectedCapacity.remaining} bake slot${selectedCapacity.remaining === 1 ? "" : "s"} remain for that pickup day.`);
      return false;
    }
    return true;
  }

  function validateContact() {
    if (!form.name.trim()) {
      setError("Add your name so the baker can confirm the request.");
      return false;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      setError("Add an email or phone number so the baker can reach you.");
      return false;
    }
    return true;
  }

  function advanceCheckout() {
    setError("");
    if (checkoutStep === "browse") {
      if (!selectedItems.length) {
        setError("Choose at least one item.");
        return;
      }
      setCheckoutStep("cart");
      return;
    }
    if (checkoutStep === "cart") {
      if (!selectedItems.length) {
        setError("Your cart is empty.");
        return;
      }
      if (!validateCartChoices()) return;
      setCheckoutStep("pickup");
      return;
    }
    if (checkoutStep === "pickup") {
      if (!validatePickup()) return;
      setCheckoutStep("contact");
      return;
    }
    if (checkoutStep === "contact") {
      if (!validateContact()) return;
      setCheckoutStep("submit");
    }
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
    if (ownerPreview) {
      setError("Owner preview mode is read-only. Turn off preview to place a real request.");
      return;
    }
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
    if (!validateCartChoices() || !validatePickup() || !validateContact()) {
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
        notes: [form.notes.trim(), customerChoiceNote(selectedItems)].filter(Boolean).join("\n\n"),
        notifications: {
          email: Boolean(rules.emailNotifications && form.notifyEmail && form.email.trim()),
          sms: Boolean(rules.smsNotifications && form.notifySms && form.phone.trim()),
        },
      });
      setSuccess(result);
      setQuantities({});
      setProductOptionSelections({});
      setCheckoutStep("browse");
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
          initialContact={trackedContact || form.email}
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
      {ownerPreview ? <div className="portal-preview-banner owner-preview-banner"><Info size={15} /> Owner preview · this is what customers see before you publish</div> : null}
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

      <form className="customer-checkout-flow" onSubmit={submitOrder}>
        <CustomerCheckoutSteps
          currentStep={checkoutStep}
          currentStepIndex={checkoutStepIndex}
          onSelectStep={(stepId, stepIndex) => {
            if (stepIndex <= checkoutStepIndex) setCheckoutStep(stepId);
          }}
          steps={CHECKOUT_STEPS}
        />

        {checkoutStep === "browse" ? <section className="customer-menu">
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
              {activeCatalogInfo?.description || activeCatalogInfo?.safetyNotes ? (
                <aside className="customer-product-type-note">
                  <span>{activeCatalogInfo.icon}</span>
                  <div>
                    {activeCatalogInfo.description ? <strong>{activeCatalogInfo.description}</strong> : null}
                    {activeCatalogInfo.safetyNotes ? <small>{activeCatalogInfo.safetyNotes}</small> : null}
                  </div>
                </aside>
              ) : null}
              <div className="customer-product-list">
                {visibleProducts.map((product) => {
                  const typeSettings = productSettingsByValue.get(productTypeValue(product))
                    || productTypeSettingsFor(rules, productTypeValue(product));
                  return (
                    <CustomerProductCard
                      key={product.id}
                      product={product}
                      quantities={quantities}
                      typeSettings={typeSettings}
                      onOpenItem={() => setSelectedProduct(product)}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          {!visibleShelfItems.length && !visibleProducts.length ? (
            <div className="customer-empty-tab">
              <strong>Nothing in this tab yet.</strong>
              <span>Try All goods or check back after the baker republishes the menu.</span>
            </div>
          ) : null}
        </section> : null}

        {checkoutStep === "cart" ? (
          <CustomerCartReview
            items={selectedItems}
            total={total}
            onChangeQuantity={changeQuantity}
            onEditItem={editCartItem}
            onBackToMenu={() => setCheckoutStep("browse")}
          />
        ) : null}

        {checkoutStep === "pickup" ? (
          <section className="customer-details customer-flow-panel">
            <div className="customer-section-heading"><div><h2>Choose pickup</h2><p>Select a date and pickup time before entering contact details.</p></div></div>
            <div className="form-stack">
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
              <aside className="pickup-location-card"><Store size={18} /><span><small>Pickup location</small><strong>{storefront.bakery.pickup_location || DEFAULT_PICKUP_LOCATION}</strong></span></aside>
            </div>
          </section>
        ) : null}

        {checkoutStep === "contact" ? (
          <section className="customer-details customer-flow-panel">
            <div className="customer-section-heading"><div><h2>Contact + payment</h2><p>Leave enough information for the baker to confirm your request.</p></div></div>
            <div className="form-stack">
              <label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" /></label>
              <div className="form-grid">
                <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label>
                <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Optional if email entered" /></label>
              </div>
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
              <span><small>{form.paymentMethod} payment</small><strong>{PAYMENT_DETAILS[form.paymentMethod] || "Pay as arranged with the baker"}</strong></span>
            </aside>
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
        ) : null}

        {checkoutStep === "submit" ? (
          <CustomerCheckoutReview
            form={form}
            items={selectedItems}
            pickupLocation={storefront.bakery.pickup_location || DEFAULT_PICKUP_LOCATION}
            rules={rules}
            total={total}
          />
        ) : null}

        <footer className="customer-order-footer">
          <div><ShoppingBag size={18} /><span><strong>{packageCount} {packageCount === 1 ? "package" : "packages"} · {itemCount} {itemCount === 1 ? "item" : "items"}</strong><small>Estimated total {dollars(total)}</small></span></div>
          <button
            className="primary-button"
            type={checkoutStep === "submit" ? "submit" : "button"}
            onClick={checkoutStep === "submit" ? undefined : advanceCheckout}
          >
            {checkoutStep === "submit"
              ? "Send request"
              : checkoutStep === "contact"
                ? "Review request"
                : CHECKOUT_STEPS[Math.min(CHECKOUT_STEPS.length - 1, checkoutStepIndex + 1)]?.label || "Continue"}
          </button>
        </footer>
        {error ? <p className="form-error customer-form-error" role="alert">{error}</p> : null}
      </form>

      <CustomerOrderLookup
        configured={cloudAccount.configured}
        feedbackEnabled={rules.feedbackEnabled}
        initialCode={trackedCode}
        initialContact={trackedContact || form.email}
        slug={slug}
      />

      {selectedProduct ? (
        <CustomerProductOrderModal
          customerOptionSelections={productOptionSelections[selectedProduct.id] || {}}
          product={selectedProduct}
          quantities={quantities}
          selectedOptionId={selectedOptions[selectedProduct.id]}
          typeSettings={productSettingsByValue.get(productTypeValue(selectedProduct)) || productTypeSettingsFor(rules, productTypeValue(selectedProduct))}
          onChangeCustomerOption={(optionId, value) => setProductOptionSelections((current) => ({
            ...current,
            [selectedProduct.id]: {
              ...(current[selectedProduct.id] || {}),
              [optionId]: value,
            },
          }))}
          onChangeOption={(optionId) => setSelectedOptions((current) => ({ ...current, [selectedProduct.id]: optionId }))}
          onChangeQuantity={changeQuantity}
          onClose={() => setSelectedProduct(null)}
        />
      ) : null}
    </main>
  );
}

function CustomerCheckoutSteps({ currentStep, currentStepIndex, onSelectStep, steps }) {
  return (
    <nav className="customer-checkout-steps" aria-label="Checkout steps">
      {steps.map((step, index) => (
        <button
          className={[
            currentStep === step.id ? "active" : "",
            index < currentStepIndex ? "complete" : "",
          ].filter(Boolean).join(" ")}
          disabled={index > currentStepIndex}
          key={step.id}
          onClick={() => onSelectStep(step.id, index)}
          type="button"
        >
          <span>{index + 1}</span>
          <strong>{step.label}</strong>
        </button>
      ))}
    </nav>
  );
}

function ProductBadgeRow({ product }) {
  const badges = productBadges(product);
  const unavailable = productUnavailable(product);
  if (!badges.length && !unavailable) return null;
  return (
    <span className="customer-product-badges">
      {unavailable ? <small className="product-badge soldout">{productAvailabilityLabel(product)}</small> : null}
      {badges.map((badge) => <small className={`product-badge badge-${badge.id}`} key={badge.id}>{badge.label}</small>)}
    </span>
  );
}

function CustomerCartReview({ items, onBackToMenu, onChangeQuantity, onEditItem, total }) {
  return (
    <section className="customer-details customer-flow-panel customer-cart-panel">
      <div className="customer-section-heading">
        <div><h2>Review cart</h2><p>Change quantities here, or reopen a product to adjust package and options.</p></div>
      </div>
      {items.length ? (
        <div className="customer-cart-list">
          {items.map((item) => (
            <article className="customer-cart-row" key={item.quantityKey}>
              <div>
                <small>{item.itemType === "shelf" ? "Ready now" : item.saleOption?.label || "Package"}</small>
                <strong>{item.name}</strong>
                <span>
                  {item.itemType === "shelf"
                    ? dollars(item.price_cents)
                    : `${item.saleOption?.units || 1} ${pluralUnit(item.recipe_details?.unitName || "item", item.saleOption?.units || 1)} · ${dollars(item.price_cents)}`}
                </span>
                {item.customerChoices?.length ? (
                  <em>{item.customerChoices.map((choice) => `${choice.label}: ${choice.value}`).join(" · ")}</em>
                ) : null}
                {item.missingCustomerChoices?.length ? <b>Needs {item.missingCustomerChoices.join(", ")}</b> : null}
              </div>
              <div className="customer-cart-actions">
                {item.itemType === "product" ? <button type="button" onClick={() => onEditItem(item)}>Edit options</button> : null}
                <span className="customer-quantity horizontal">
                  <button type="button" aria-label={`Remove one ${item.name}`} onClick={() => onChangeQuantity(item, -1)}><Minus size={15} /></button>
                  <span>{item.quantity}</span>
                  <button type="button" aria-label={`Add one ${item.name}`} onClick={() => onChangeQuantity(item, 1)}><Plus size={15} /></button>
                </span>
                <strong>{dollars(item.price_cents * item.quantity)}</strong>
              </div>
            </article>
          ))}
          <div className="customer-cart-total"><span>Estimated total</span><strong>{dollars(total)}</strong></div>
        </div>
      ) : (
        <div className="customer-cart-empty">
          <ShoppingBag size={24} />
          <strong>Your cart is empty.</strong>
          <span>Add something from the menu to keep going.</span>
        </div>
      )}
      <button className="secondary-button customer-back-to-menu" type="button" onClick={onBackToMenu}>Browse menu</button>
    </section>
  );
}

function CustomerCheckoutReview({ form, items, pickupLocation, rules, total }) {
  return (
    <section className="customer-details customer-flow-panel customer-review-panel">
      <div className="customer-section-heading">
        <div><h2>Send request</h2><p>Final check before the baker receives it. This is still a request until accepted.</p></div>
      </div>
      <div className="checkout-review-grid">
        <article>
          <small>Cart</small>
          <strong>{items.length} package{items.length === 1 ? "" : "s"}</strong>
          <span>{items.map((item) => `${item.quantity} × ${item.saleOption?.label ? `${item.saleOption.label} ${item.name}` : item.name}`).join(" · ")}</span>
        </article>
        <article>
          <small>Pickup</small>
          <strong>{checkoutPickupLabel(form.pickupDate, form.pickupTime)}</strong>
          <span>{pickupLocation}</span>
        </article>
        <article>
          <small>Contact</small>
          <strong>{form.name || "Name needed"}</strong>
          <span>{[form.email, form.phone].filter(Boolean).join(" · ") || "Email or phone needed"}</span>
        </article>
        <article>
          <small>Payment</small>
          <strong>{form.paymentMethod}</strong>
          <span>{PAYMENT_DETAILS[form.paymentMethod] || "Pay as arranged with the baker"}</span>
        </article>
      </div>
      {form.allergies ? <aside className="allergy-warning"><strong>Allergy note</strong><span>{form.allergies}</span></aside> : null}
      {form.notes ? <aside className="customer-request-note"><strong>Request note</strong><span>{form.notes}</span></aside> : null}
      <div className="checkout-review-total">
        <span><small>Order status updates</small><strong>{[
          rules.emailNotifications && form.notifyEmail && form.email.trim() ? "Email" : "",
          rules.smsNotifications && form.notifySms && form.phone.trim() ? "Text" : "",
        ].filter(Boolean).join(" + ") || "No automatic updates selected"}</strong></span>
        <span><small>Estimated total</small><strong>{dollars(total)}</strong></span>
      </div>
    </section>
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
  onOpenItem,
  product,
  quantities,
  typeSettings,
}) {
  const selectedCount = productSelectedPackageCount(product, quantities);
  const selected = selectedCount > 0;
  const photoUrl = productPhotoUrl(product);
  const unavailable = productUnavailable(product);
  return (
    <article className={[
      "customer-product compact-product",
      selected ? "selected" : "",
      unavailable ? "unavailable" : "",
    ].filter(Boolean).join(" ")}>
      <button className="customer-product-card-button" type="button" onClick={onOpenItem} aria-label={`Open options for ${product.name}`}>
        <span className={photoUrl ? "customer-product-photo" : "customer-product-photo empty"}>
          {photoUrl ? <img src={photoUrl} alt={product.recipe_details?.photoAlt || product.name} /> : typeSettings?.icon || productTypeIcon(product)}
        </span>
        <span className="customer-product-card-body">
          <span className="customer-product-card-meta"><Info size={12} /> {typeSettings?.label || productTypeLabel(product)}</span>
          <ProductBadgeRow product={product} />
          <h3>{product.name}</h3>
          <p>{product.description}</p>
          <span className="customer-product-card-footer">
            <strong>From {dollars(productStartingPrice(product))}</strong>
            <small>{unavailable ? "Details only" : selected ? `${selectedCount} package${selectedCount === 1 ? "" : "s"} selected` : "Tap for details"}</small>
          </span>
        </span>
      </button>
    </article>
  );
}

function CustomerProductOrderModal({
  customerOptionSelections,
  onChangeCustomerOption,
  onChangeOption,
  onChangeQuantity,
  onClose,
  product,
  quantities,
  selectedOptionId,
  typeSettings,
}) {
  const details = product.recipe_details || {};
  const ingredients = Array.isArray(details.ingredients) ? details.ingredients : [];
  const baseYield = Math.max(1, Number(details.yield || 1));
  const unitName = details.unitName || "item";
  const loafStyle = unitName.toLowerCase().includes("loaf");
  const formulaMode = details.formulaMode || "bakers";
  const photoUrl = productPhotoUrl(product);
  const salesOptions = productSalesOptions(product);
  const selectedOption = salesOptions.find((option) => option.id === selectedOptionId) || salesOptions[0];
  const quantityKey = `product-${product.id}-${selectedOption.id}`;
  const quantity = Number(quantities[quantityKey] || 0);
  const customerOptions = enabledCustomerOptions(typeSettings);
  const unavailable = productUnavailable(product);
  const nutrition = ingredients.length ? estimateRecipeNutrition({
    yield: baseYield,
    ingredients,
  }) : null;

  return (
    <Modal title={product.name} onClose={onClose}>
      <div className="customer-recipe-detail customer-item-window">
        <div className={photoUrl ? "customer-recipe-photo" : "customer-recipe-photo empty"}>
          {photoUrl ? <img src={photoUrl} alt={details.photoAlt || product.name} /> : typeSettings?.icon || productTypeIcon(product)}
        </div>
        <div className="customer-recipe-summary">
          <span><small>Starting price</small><strong>{dollars(Math.min(...salesOptions.map((option) => option.price_cents)))}</strong></span>
          <span><small>Category</small><strong>{typeSettings?.label || productTypeLabel(product)}</strong></span>
          <span><small>Availability</small><strong>{productAvailabilityLabel(product)}</strong></span>
        </div>
        <ProductBadgeRow product={product} />
        <p>{product.description || "Small-batch naturally leavened bread."}</p>
        {unavailable ? (
          <aside className="customer-recipe-safety-note unavailable-note">
            <Info size={15} />
            <span><strong>Not orderable right now</strong><small>{productAvailabilityLabel(product)}</small></span>
          </aside>
        ) : null}
        {typeSettings?.safetyNotes ? (
          <aside className="customer-recipe-safety-note">
            <Info size={15} />
            <span><strong>Safety & storage</strong><small>{typeSettings.safetyNotes}</small></span>
          </aside>
        ) : null}
        <section className="customer-item-order-panel" aria-label={`Order options for ${product.name}`}>
          <div className="customer-recipe-heading"><h3>Choose package & quantity</h3><small>Saved to your request</small></div>
          <label className="customer-modal-package-choice">
            Package
            <select value={selectedOption.id} onChange={(event) => onChangeOption(event.target.value)}>
              {salesOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} · {option.units} {pluralUnit(unitName, option.units)} · {dollars(option.price_cents)}
                </option>
              ))}
            </select>
          </label>
          <div className="customer-modal-quantity-row">
            <span>
              <strong>Quantity</strong>
              <small>{selectedOption.units} {pluralUnit(unitName, selectedOption.units)} per package · {selectedOption.capacity_units} bake slot{selectedOption.capacity_units === 1 ? "" : "s"}</small>
            </span>
            <div className="customer-quantity horizontal">
              <button type="button" aria-label={`Remove one ${selectedOption.label} of ${product.name}`} onClick={() => onChangeQuantity({
                ...product,
                itemType: "product",
                saleOption: selectedOption,
                quantityKey,
              }, -1)}><Minus size={15} /></button>
              <span>{quantity}</span>
              <button type="button" aria-label={`Add one ${selectedOption.label} of ${product.name}`} onClick={() => onChangeQuantity({
                ...product,
                itemType: "product",
                saleOption: selectedOption,
                quantityKey,
              }, 1)} disabled={unavailable}><Plus size={15} /></button>
            </div>
          </div>
          <div className="customer-item-modal-total">
            <span><small>Selected package</small><strong>{dollars(selectedOption.price_cents)}</strong></span>
            <span><small>Line estimate</small><strong>{dollars(selectedOption.price_cents * quantity)}</strong></span>
          </div>
          {customerOptions.length ? (
            <div className="customer-product-options modal-options">
              <strong>Customer choices</strong>
              {customerOptions.map((option) => (
                <label className="customer-product-option" key={option.id}>
                  <span>{option.label}{option.required ? " *" : ""}</span>
                  {option.type === "text" ? (
                    <input
                      value={customerOptionSelections[option.id] || ""}
                      onChange={(event) => onChangeCustomerOption(option.id, event.target.value)}
                      placeholder="Leave a note"
                    />
                  ) : (
                    <select
                      value={customerOptionSelections[option.id] || ""}
                      onChange={(event) => onChangeCustomerOption(option.id, event.target.value)}
                    >
                      <option value="">{option.required ? "Choose one" : "No preference"}</option>
                      {(option.choices || []).map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                    </select>
                  )}
                  {option.help ? <small>{option.help}</small> : null}
                </label>
              ))}
            </div>
          ) : null}
        </section>

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
