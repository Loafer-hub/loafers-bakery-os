import { Beaker, Droplets, Sprout, TrendingUp, Wheat } from "lucide-react";
import {
  getFlourProfile,
  liftLabel,
  rateLabel,
} from "../data/flourProfiles";

export function FlourScienceCard({ flour, compact = false }) {
  const profile = getFlourProfile(flour);
  return (
    <article className={compact ? "flour-science-card compact" : "flour-science-card"}>
      <div className="flour-science-heading">
        <span><Wheat size={18} /></span>
        <div>
          <strong>{profile.name}</strong>
          <small>{rateLabel(profile.activity)} dough · {liftLabel(profile.doughLift)} lift</small>
        </div>
      </div>
      <div className="flour-science-metrics">
        <span><Beaker size={13} /><b>{profile.activity.toFixed(2)}×</b> ferment</span>
        <span><TrendingUp size={13} /><b>{profile.doughLift.toFixed(2)}×</b> dough lift</span>
        <span><Sprout size={13} /><b>{profile.starterActivity.toFixed(2)}×</b> starter</span>
        <span><Droplets size={13} /><b>{profile.waterDemand.toFixed(2)}×</b> water</span>
      </div>
      {!compact ? (
        <>
          <p><b>Dough:</b> {profile.doughScience}</p>
          <p><b>Starter:</b> {profile.starterScience}</p>
          <p className="flour-watch"><b>Watch:</b> {profile.watch}</p>
        </>
      ) : (
        <p><b>Dough:</b> {profile.doughScience}<br /><b>Starter:</b> {profile.starterScience}</p>
      )}
    </article>
  );
}

export function FlourBlendScience({ flours, compact = false }) {
  const unique = [...new Set(flours.filter(Boolean))];
  if (!unique.length) return null;
  return (
    <section className={compact ? "flour-science-list compact" : "flour-science-list"} aria-label="Flour science">
      {unique.map((flour) => <FlourScienceCard flour={flour} compact={compact} key={flour} />)}
    </section>
  );
}
