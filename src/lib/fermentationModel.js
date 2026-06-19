import {
  FLOUR_TYPES,
  getFlourProfile,
  weightedFlourMetric,
} from "../data/flourProfiles";

export { FLOUR_TYPES };

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function fahrenheitToCelsius(value) {
  return (Number(value) - 32) * 5 / 9;
}

export function recipeFlourBlend(recipe) {
  if (!recipe) return [{ type: "Bread flour", percent: 100 }];
  const flourIngredients = recipe.ingredients.filter((item) => {
    const name = item.name.toLowerCase();
    return item.category === "flour"
      || name.includes("flour")
      || FLOUR_TYPES.some((type) => {
        const profile = getFlourProfile(type);
        return [profile.name, ...profile.aliases].some((alias) => name.includes(alias.toLowerCase()));
      });
  });
  const total = flourIngredients.reduce((sum, item) => sum + Number(item.percent || 0), 0) || 100;
  return flourIngredients.length ? flourIngredients.map((item) => ({
    type: getFlourProfile(item.flourType || item.name).name,
    percent: Math.round(Number(item.percent || 0) / total * 100),
  })) : [{ type: "Bread flour", percent: 100 }];
}

function starterPercent(recipe) {
  return Number(recipe?.ingredients.find((item) => item.name.toLowerCase().includes("starter"))?.percent || 20);
}

export function parseRatio(ratio = "1:2:2") {
  const parts = String(ratio).split(":").map(Number);
  return {
    starter: parts[0] > 0 ? parts[0] : 1,
    flour: parts[1] > 0 ? parts[1] : 2,
    water: parts[2] >= 0 ? parts[2] : 2,
  };
}

export function starterCalibration(logs, starterId) {
  const samples = logs
    .filter((log) => log.starterId === starterId && Number(log.peakHours) > 0)
    .slice(0, 8)
    .map((log) => {
      const predicted = estimateStarterPeak({
        ratio: log.ratio,
        temperature: log.temperature,
        flourBlend: log.flourBlend,
        calibration: 1,
      }).hours;
      return clamp(Number(log.peakHours) / predicted, 0.65, 1.45);
    })
    .sort((a, b) => a - b);
  if (!samples.length) return 1;
  return samples[Math.floor(samples.length / 2)];
}

export function estimateStarterPeak({
  ratio = "1:2:2",
  temperature = 76,
  flourBlend = [{ type: "Bread flour", percent: 100 }],
  hydration = 100,
  calibration = 1,
}) {
  const parsed = parseRatio(ratio);
  const foodPerStarter = ((parsed.flour + parsed.water) / 2) / parsed.starter;
  const ratioHours = 4 + 1.6 * Math.log2(Math.max(1, foodPerStarter));
  const temperatureRate = clamp(
    Math.pow(1.9, (fahrenheitToCelsius(temperature) - 24) / 10),
    0.48,
    2.2,
  );
  const flourRate = clamp(weightedFlourMetric(flourBlend, "starterActivity"), 0.9, 1.22);
  const visibleRiseRate = clamp(weightedFlourMetric(flourBlend, "starterLift"), 0.42, 1.15);
  const waterDemandRate = clamp(weightedFlourMetric(flourBlend, "waterDemand"), 0.9, 1.22);
  const hydrationRate = clamp(1 + (Number(hydration) - 100) * 0.0025, 0.82, 1.18);
  const hours = clamp(ratioHours / (temperatureRate * flourRate * hydrationRate) * calibration, 2.5, 18);
  return {
    hours,
    temperatureRate,
    flourRate,
    visibleRiseRate,
    waterDemandRate,
    hydrationRate,
    ratioHours,
  };
}

export function estimateDoughFermentation({
  recipe,
  doughTemperature = 76,
  starterStrength = 1,
}) {
  const hydration = Number(recipe?.hydration || 75);
  const inoculation = starterPercent(recipe);
  const blend = recipeFlourBlend(recipe);
  const temperatureRate = clamp(
    Math.pow(1.9, (fahrenheitToCelsius(doughTemperature) - 24) / 10),
    0.45,
    2.3,
  );
  const hydrationRate = clamp(1 + (hydration - 75) * 0.012, 0.8, 1.25);
  const flourRate = clamp(weightedFlourMetric(blend, "activity"), 0.9, 1.2);
  const structureRate = clamp(weightedFlourMetric(blend, "doughLift"), 0.18, 1.16);
  const waterDemandRate = clamp(weightedFlourMetric(blend, "waterDemand"), 0.9, 1.22);
  const inoculationRate = clamp(Math.pow(inoculation / 20, 0.45), 0.58, 1.55);
  const activityRate = temperatureRate * hydrationRate * flourRate * inoculationRate * clamp(starterStrength, 0.75, 1.25);
  const bulkHours = clamp(4.75 / activityRate, 2.25, 11);
  const roomProofHours = clamp(1.05 / Math.pow(activityRate, 0.55), 0.55, 2.25);
  return {
    activityRate,
    bulkHours,
    roomProofHours,
    temperatureRate,
    hydrationRate,
    flourRate,
    structureRate,
    waterDemandRate,
    inoculationRate,
    hydration,
    inoculation,
    flourBlend: blend,
  };
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function subtractHours(date, hours) {
  return addHours(date, -hours);
}

export function buildBakeSchedule({
  recipe,
  loaves,
  doughTemperature,
  coldProofHours,
  anchorMode,
  anchorDateTime,
  starter,
  ratio,
  starterLogs,
}) {
  const latestLog = starterLogs.find((log) => log.starterId === starter?.id)
    || starterLogs.find((log) => !log.starterId);
  const starterStrength = latestLog?.rise ? clamp(Number(latestLog.rise) / 2, 0.78, 1.22) : 1;
  const dough = estimateDoughFermentation({ recipe, doughTemperature, starterStrength });
  const calibration = starterCalibration(starterLogs, starter?.id);
  const starterPeak = estimateStarterPeak({
    ratio,
    temperature: latestLog?.temperature || doughTemperature,
    flourBlend: starter?.flourBlend,
    hydration: starter?.hydration,
    calibration,
  });
  const bakeDuration = 0.65 + Math.ceil(Number(loaves || 1) / 10) * 0.55;
  const coldProof = Number(coldProofHours);
  const anchor = new Date(anchorDateTime);
  let mix;
  let bakeEnd;

  if (anchorMode === "finish") {
    bakeEnd = anchor;
    const bakeStart = subtractHours(bakeEnd, bakeDuration);
    const preheat = subtractHours(bakeStart, 0.75);
    const coldStart = subtractHours(preheat, coldProof);
    const shape = subtractHours(coldStart, 0.5);
    mix = subtractHours(shape, dough.bulkHours);
  } else {
    mix = anchor;
    const shape = addHours(mix, dough.bulkHours);
    const coldStart = addHours(shape, 0.5);
    const preheat = addHours(coldStart, coldProof);
    const bakeStart = addHours(preheat, 0.75);
    bakeEnd = addHours(bakeStart, bakeDuration);
  }

  const shape = addHours(mix, dough.bulkHours);
  const coldStart = addHours(shape, 0.5);
  const preheat = addHours(coldStart, coldProof);
  const bakeStart = addHours(preheat, 0.75);
  const foldEnd = addHours(mix, Math.min(2.25, dough.bulkHours * 0.58));
  const starterFeed = subtractHours(mix, starterPeak.hours);

  return {
    starterPeak,
    dough,
    bakeDuration,
    mix,
    bakeEnd,
    steps: [
      { id: "feed", label: `Feed ${starter?.name || "starter"}`, start: starterFeed, detail: ratio },
      { id: "mix", label: "Mix dough", start: mix, detail: `${doughTemperature}°F dough` },
      { id: "folds", label: "Folds", start: addHours(mix, 0.5), end: foldEnd, detail: "Bulk development" },
      { id: "shape", label: "Shape", start: shape, detail: `${dough.bulkHours.toFixed(1)}h bulk estimate` },
      { id: "cold", label: "Cold proof", start: coldStart, end: preheat, detail: `${coldProof}h` },
      { id: "preheat", label: "Preheat oven", start: preheat, detail: "Load oven after 45 min" },
      { id: "bake", label: "Bake", start: bakeStart, end: bakeEnd, detail: `${Math.ceil(Number(loaves || 1) / 10)} oven load${Number(loaves || 1) > 10 ? "s" : ""}` },
    ],
  };
}

export function curvePath(hours, kind = "dough") {
  const width = 300;
  const height = 92;
  const points = Array.from({ length: 31 }, (_, index) => {
    const progress = index / 30;
    let value;
    if (kind === "starter") {
      value = Math.exp(-Math.pow((progress - 0.78) / 0.31, 2));
    } else {
      const logistic = 1 / (1 + Math.exp(-9 * (progress - 0.58)));
      value = (logistic - 0.005) / 0.984;
    }
    return {
      x: progress * width,
      y: height - clamp(value, 0, 1) * 72 - 8,
    };
  });
  return {
    line: points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" "),
    fill: `${points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ")} L${width} ${height} L0 ${height} Z`,
    hours,
  };
}
