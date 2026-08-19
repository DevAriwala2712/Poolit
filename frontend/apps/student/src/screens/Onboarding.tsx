import { useStore } from "@poolit/domain";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui";
import { useProfile } from "../state/ProfileContext";

const SLIDES = [
  {
    art: "🛒",
    accent: "#EAF9C4",
    title: "Your hostel store,\nin 10 minutes",
    body: "Maggi at midnight, milk before class, or a full grocery run — delivered straight to your room.",
  },
  {
    art: "🤝",
    accent: "#FDF0C4",
    title: "Order together,\npay less together",
    body: "When your hostel mates order in the same window, the delivery fee splits down — from ₹20 all the way to free.",
  },
  {
    art: "📍",
    accent: "#FFE4E1",
    title: "Straight to\nyour door",
    body: "Set your block and room once. Every order after that is two taps away.",
  },
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [locationAsked, setLocationAsked] = useState(false);
  const navigate = useNavigate();
  const { profile, update } = useProfile();
  const { hostels } = useStore();

  const hostel = hostels.find((h) => h.id === profile.hostelId) ?? hostels[0];
  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  function finish() {
    update({ onboarded: true, name: profile.name.trim() || "Student" });
    navigate("/", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+20px)]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[15px] font-extrabold tracking-tight text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime text-[13px]">
            ⚡
          </span>
          Poolit
        </span>
        {!isLast && (
          <button onClick={finish} className="text-[13px] font-semibold text-ink-soft">
            Skip
          </button>
        )}
      </div>

      <div key={step} className="animate-rise flex flex-1 flex-col items-center justify-center text-center">
        <div
          className="flex h-44 w-44 items-center justify-center rounded-[44px] text-[76px] shadow-[var(--shadow-soft)]"
          style={{ background: `radial-gradient(120% 100% at 30% 20%, #fff, ${slide.accent})` }}
        >
          {slide.art}
        </div>
        <h1 className="mt-8 whitespace-pre-line text-[30px] font-extrabold leading-[1.15] tracking-tight text-ink">
          {slide.title}
        </h1>
        <p className="mt-3 max-w-[19rem] text-[15px] leading-relaxed text-ink-soft">{slide.body}</p>
      </div>

      {isLast && (
        <div className="mb-6 space-y-3">
          <label className="block">
            <span className="text-[12px] font-semibold text-ink-soft">Your name</span>
            <input
              value={profile.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. Priya"
              className="mt-1 min-h-[48px] w-full rounded-2xl bg-surface px-4 text-[15px] font-medium text-ink shadow-[var(--shadow-soft)] outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-lime"
            />
          </label>

          <button
            onClick={() => setLocationAsked(true)}
            className={`flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition ${
              locationAsked ? "bg-lime-soft ring-1 ring-lime" : "bg-surface shadow-[var(--shadow-soft)]"
            }`}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                locationAsked ? "bg-lime text-ink" : "bg-cream-deep text-ink-soft"
              }`}
            >
              <Icon name={locationAsked ? "check" : "pin"} className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-ink">
                {locationAsked ? "Location confirmed" : "Use my hostel location"}
              </span>
              <span className="block truncate text-[12.5px] text-ink-soft">
                {hostel.name} · {profile.block} · Room {profile.room}
              </span>
            </span>
          </button>
        </div>
      )}

      <div className="mb-5 flex justify-center gap-1.5">
        {SLIDES.map((s, i) => (
          <span
            key={s.title}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? "w-6 bg-ink" : "w-1.5 bg-line"
            }`}
          />
        ))}
      </div>

      <Button full onClick={() => (isLast ? finish() : setStep((s) => s + 1))}>
        {isLast ? "Start ordering" : "Continue"}
        <Icon name="arrowRight" className="h-4 w-4" strokeWidth={2.4} />
      </Button>
    </div>
  );
}
