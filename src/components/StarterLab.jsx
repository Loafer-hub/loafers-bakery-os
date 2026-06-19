import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  Plus,
  Thermometer,
  Trash2,
  TrendingUp,
  Wheat,
} from "lucide-react";
import { useMemo, useState } from "react";
import { FlourBlendScience } from "./FlourScience";
import { EmptyState, Modal } from "./Primitives";
import { getFlourProfile, liftLabel, rateLabel } from "../data/flourProfiles";
import {
  curvePath,
  estimateStarterPeak,
  FLOUR_TYPES,
  starterCalibration,
} from "../lib/fermentationModel";

function localDateTimeValue(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function feedCalendarCells(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - first.getDay() + 1;
    return day >= 1 && day <= days ? day : null;
  });
}

function emptyProfile() {
  return {
    id: `starter-${Date.now()}`,
    name: "",
    hydration: 100,
    primaryFlour: "Bread flour",
    primaryPercent: 70,
    secondaryFlour: "Whole wheat",
    secondaryPercent: 30,
    hasSecondaryFlour: true,
    notes: "",
    isNew: true,
  };
}

function profileForm(starter) {
  return {
    ...starter,
    primaryFlour: getFlourProfile(starter.flourBlend?.[0]?.type || "Bread flour").name,
    primaryPercent: starter.flourBlend?.[0]?.percent ?? 100,
    secondaryFlour: getFlourProfile(starter.flourBlend?.[1]?.type || "Whole wheat").name,
    secondaryPercent: starter.flourBlend?.[1]?.percent ?? 0,
    hasSecondaryFlour: Boolean(starter.flourBlend?.[1]),
    isNew: false,
  };
}

export function StarterLab({
  starters,
  starterLogs,
  onSaveStarter,
  onDeleteStarter,
  onStarterLogged,
}) {
  const [selectedId, setSelectedId] = useState(starters[0]?.id || "");
  const [profileModal, setProfileModal] = useState(null);
  const [feedModal, setFeedModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const selected = starters.find((starter) => starter.id === selectedId) || starters[0];
  const logs = useMemo(() => [...starterLogs]
    .filter((log) => log.starterId === selected?.id || (!log.starterId && selected?.id === starters[0]?.id))
    .sort((a, b) => new Date(b.dateTime || 0) - new Date(a.dateTime || 0)), [selected?.id, starterLogs, starters]);
  const latest = logs[0];
  const calibration = starterCalibration(starterLogs, selected?.id);
  const peak = estimateStarterPeak({
    ratio: latest?.ratio || "1:2:2",
    temperature: latest?.temperature || 76,
    flourBlend: latest?.flourBlend || selected?.flourBlend,
    hydration: selected?.hydration,
    calibration,
  });
  const starterCurve = curvePath(peak.hours, "starter");
  const cells = feedCalendarCells(calendarMonth);
  const logsByDate = new Map();

  logs.forEach((log) => {
    const key = dateKey(log.dateTime);
    const items = logsByDate.get(key) || [];
    items.push(log);
    logsByDate.set(key, items);
  });

  function openFeed(date) {
    const dateTime = date
      ? `${date}T08:00`
      : localDateTimeValue();
    setFeedModal({
      starterId: selected?.id,
      dateTime,
      ratio: latest?.ratio || "1:2:2",
      temperature: latest?.temperature || 76,
      rise: "",
      peakHours: "",
      flourBlend: selected?.flourBlend || [],
      note: "",
    });
  }

  function saveProfile(event) {
    event.preventDefault();
    const secondaryValue = profileModal.hasSecondaryFlour ? Number(profileModal.secondaryPercent) : 0;
    const total = Number(profileModal.primaryPercent) + secondaryValue;
    const primaryPercent = total ? Math.round(Number(profileModal.primaryPercent) / total * 100) : 100;
    const secondaryPercent = profileModal.hasSecondaryFlour ? 100 - primaryPercent : 0;
    const saved = {
      id: profileModal.id,
      name: profileModal.name.trim(),
      hydration: Number(profileModal.hydration),
      flourBlend: [
        { type: profileModal.primaryFlour, percent: primaryPercent },
        ...(secondaryPercent > 0 ? [{ type: profileModal.secondaryFlour, percent: secondaryPercent }] : []),
      ],
      notes: profileModal.notes.trim(),
      isNew: profileModal.isNew,
    };
    if (!saved.name) return;
    onSaveStarter(saved);
    setSelectedId(saved.id);
    setProfileModal(null);
  }

  function saveFeed(event) {
    event.preventDefault();
    onStarterLogged({
      ...feedModal,
      temperature: Number(feedModal.temperature),
      rise: feedModal.rise === "" ? null : Number(feedModal.rise),
      peakHours: feedModal.peakHours === "" ? null : Number(feedModal.peakHours),
      dateTime: new Date(feedModal.dateTime).toISOString(),
    });
    setFeedModal(null);
  }

  if (!selected) {
    return (
      <section className="starter-lab">
        <EmptyState title="No starters yet" body="Create a starter profile to begin tracking feeds and fermentation." />
        <button className="primary-button" type="button" onClick={() => setProfileModal(emptyProfile())}>Create a starter</button>
        {profileModal ? (
          <StarterProfileModal form={profileModal} setForm={setProfileModal} onClose={() => setProfileModal(null)} onSubmit={saveProfile} />
        ) : null}
      </section>
    );
  }

  return (
    <section className="starter-lab">
      <div className="starter-profile-switcher">
        <label>
          Starter
          <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
            {starters.map((starter) => <option key={starter.id} value={starter.id}>{starter.name}</option>)}
          </select>
        </label>
        <button type="button" className="icon-button subtle" onClick={() => setProfileModal(profileForm(selected))} aria-label={`Edit ${selected.name}`}>
          <Pencil size={17} />
        </button>
        <button type="button" className="round-action small" onClick={() => setProfileModal(emptyProfile())} aria-label="Add starter">
          <Plus size={18} />
        </button>
      </div>

      <div className="starter-hero">
        <span className="starter-jar"><Wheat size={46} /></span>
        <div>
          <p>Your starter</p>
          <h2>{selected.name}</h2>
          <span className="starter-live"><i /> {selected.flourBlend.map((item) => `${item.percent}% ${item.type}`).join(" · ")}</span>
        </div>
      </div>
      {selected.notes ? <p className="starter-profile-note">{selected.notes}</p> : null}

      <div className="starter-reading-grid">
        <div><TrendingUp /><strong>{latest?.rise ? `${latest.rise}×` : "—"}</strong><span>last logged rise</span></div>
        <div><Thermometer /><strong>{latest?.temperature ? `${latest.temperature}°F` : "—"}</strong><span>last jar temp</span></div>
        <div><Clock3 /><strong>{peak.hours.toFixed(1)}h</strong><span>estimated peak</span></div>
      </div>

      <div className="starter-curve">
        <div className="section-title-line">
          <h3>Rise estimate</h3>
          <span>{latest?.ratio || "1:2:2"} feed · {calibration === 1 ? "uncalibrated" : `${calibration.toFixed(2)}× calibrated`}</span>
        </div>
        <svg viewBox="0 0 300 100" role="img" aria-label={`Estimated starter rise peaking in ${peak.hours.toFixed(1)} hours`}>
          <path className="chart-fill starter-estimate-fill" d={starterCurve.fill} />
          <path className="chart-line" d={starterCurve.line} />
        </svg>
        <div className="chart-labels"><span>Feed</span><span>{(peak.hours / 2).toFixed(1)}h</span><span>Peak {peak.hours.toFixed(1)}h</span></div>
        <div className="starter-flour-signals">
          <span><b>{peak.flourRate.toFixed(2)}×</b> {rateLabel(peak.flourRate)} flour-fed activity</span>
          <span><b>{peak.visibleRiseRate.toFixed(2)}×</b> {liftLabel(peak.visibleRiseRate)} visible jar lift</span>
          <span><b>{peak.waterDemandRate.toFixed(2)}×</b> water demand</span>
        </div>
        <p className="model-note">Estimate uses feed ratio, temperature, flour blend, and your logged peak history. Jar height reflects both gas production and the flour’s ability to hold that gas.</p>
      </div>

      <section className="starter-flour-science">
        <div className="section-title-line"><h3>Starter flour science</h3><span>Growth + rise</span></div>
        <FlourBlendScience compact flours={selected.flourBlend.map((item) => item.type)} />
      </section>

      <section className="feed-calendar" aria-label={`${selected.name} feed calendar`}>
        <div className="calendar-heading compact">
          <button type="button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="Previous feed month"><ChevronLeft size={18} /></button>
          <h2>{calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
          <button type="button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="Next feed month"><ChevronRight size={18} /></button>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="feed-calendar-grid">
          {cells.map((day, index) => {
            if (!day) return <span className="calendar-blank" key={`feed-blank-${index}`} />;
            const key = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayLogs = logsByDate.get(key) || [];
            return (
              <button type="button" className={dayLogs.length ? "feed-day has-feed" : "feed-day"} key={key} onClick={() => openFeed(key)} aria-label={`${key}: ${dayLogs.length ? dayLogs.map((log) => log.ratio).join(", ") : "log feed"}`}>
                <span>{day}</span>
                {dayLogs.length ? <small>{dayLogs[0].ratio}</small> : <Plus size={11} />}
                {dayLogs.length > 1 ? <i>+{dayLogs.length - 1}</i> : null}
              </button>
            );
          })}
        </div>
      </section>

      <div className="starter-history">
        <div className="section-title-line"><h3>Feed history</h3><button onClick={() => openFeed()}><CalendarDays size={15} /> Log feed</button></div>
        {logs.length ? logs.slice(0, 8).map((log) => (
          <div className="history-row detailed" key={log.id}>
            <span className="feed-ratio-badge">{log.ratio}</span>
            <span>
              <strong>{new Date(log.dateTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</strong>
              <small>{log.flourBlend?.map((item) => `${item.percent}% ${item.type}`).join(" · ") || selected.flourBlend.map((item) => `${item.percent}% ${item.type}`).join(" · ")}</small>
            </span>
            <small>{log.peakHours ? `${log.peakHours}h peak` : log.rise ? `${log.rise}× rise` : `${log.temperature}°F`}</small>
          </div>
        )) : <EmptyState title="No feed history" body="Log a feed to start calibrating this starter’s rise estimate." />}
      </div>

      {profileModal ? (
        <StarterProfileModal form={profileModal} setForm={setProfileModal} onClose={() => setProfileModal(null)} onSubmit={saveProfile}>
          {!profileModal.isNew && starters.length > 1 ? confirmDelete ? (
            <div className="delete-confirmation">
              <span>Delete this starter profile?</span>
              <div>
                <button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>Keep it</button>
                <button type="button" className="danger-button" onClick={() => {
                  onDeleteStarter(profileModal.id);
                  setSelectedId(starters.find((item) => item.id !== profileModal.id)?.id || "");
                  setProfileModal(null);
                  setConfirmDelete(false);
                }}>Delete starter</button>
              </div>
            </div>
          ) : (
            <button className="delete-order-button" type="button" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={15} /> Delete starter profile
            </button>
          ) : null}
        </StarterProfileModal>
      ) : null}

      {feedModal ? (
        <Modal title={`Log ${selected.name} feed`} onClose={() => setFeedModal(null)}>
          <form className="form-stack" onSubmit={saveFeed}>
            <label>Date and time<input type="datetime-local" value={feedModal.dateTime} onChange={(event) => setFeedModal({ ...feedModal, dateTime: event.target.value })} /></label>
            <div className="form-grid">
              <label>Feed ratio<input value={feedModal.ratio} onChange={(event) => setFeedModal({ ...feedModal, ratio: event.target.value })} placeholder="1:2:2" /></label>
              <label>Jar temp °F<input type="number" min="45" max="105" value={feedModal.temperature} onChange={(event) => setFeedModal({ ...feedModal, temperature: event.target.value })} /></label>
            </div>
            <div className="form-grid">
              <label>Rise multiple<input type="number" min="0" step="0.1" value={feedModal.rise} onChange={(event) => setFeedModal({ ...feedModal, rise: event.target.value })} placeholder="2.1" /></label>
              <label>Hours to peak<input type="number" min="0" step="0.1" value={feedModal.peakHours} onChange={(event) => setFeedModal({ ...feedModal, peakHours: event.target.value })} placeholder="Optional" /></label>
            </div>
            <label>Notes<textarea value={feedModal.note} onChange={(event) => setFeedModal({ ...feedModal, note: event.target.value })} placeholder="Aroma, bubbles, texture, feeding change…" /></label>
            <button className="primary-button" type="submit">Save feed log</button>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}

function StarterProfileModal({ form, setForm, onClose, onSubmit, children }) {
  return (
    <Modal title={form.isNew ? "Add a starter" : `Edit ${form.name}`} onClose={onClose}>
      <form className="form-stack" onSubmit={onSubmit}>
        <label>Starter name<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Mabel" /></label>
        <div className="form-grid">
          <label>Primary flour<select value={form.primaryFlour} onChange={(event) => setForm({ ...form, primaryFlour: event.target.value })}>{FLOUR_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label>Percent<input type="number" min="0" max="100" value={form.primaryPercent} onChange={(event) => setForm({ ...form, primaryPercent: event.target.value })} /></label>
        </div>
        {form.hasSecondaryFlour ? (
          <div className="starter-secondary-flour">
            <div className="form-grid">
              <label>Second flour<select value={form.secondaryFlour} onChange={(event) => setForm({ ...form, secondaryFlour: event.target.value })}>{FLOUR_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>Percent<input type="number" min="0" max="100" value={form.secondaryPercent} onChange={(event) => setForm({ ...form, secondaryPercent: event.target.value })} /></label>
            </div>
            <button type="button" onClick={() => setForm({ ...form, hasSecondaryFlour: false, secondaryPercent: 0 })}><Trash2 size={14} /> Remove second flour</button>
          </div>
        ) : (
          <button className="storage-file-button starter-add-flour" type="button" onClick={() => setForm({ ...form, hasSecondaryFlour: true, secondaryPercent: 20 })}><Plus size={15} /> Add second flour</button>
        )}
        <div className="starter-profile-science">
          <div className="section-title-line"><h3>How this feed behaves</h3><span>Research-informed</span></div>
          <FlourBlendScience compact flours={[form.primaryFlour, form.hasSecondaryFlour && Number(form.secondaryPercent) > 0 ? form.secondaryFlour : null]} />
        </div>
        <label>Starter hydration %<input type="number" min="50" max="200" value={form.hydration} onChange={(event) => setForm({ ...form, hydration: event.target.value })} /></label>
        <label>Profile notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Aroma, personality, maintenance routine…" /></label>
        <button className="primary-button" type="submit">Save starter profile</button>
        {children}
      </form>
    </Modal>
  );
}
