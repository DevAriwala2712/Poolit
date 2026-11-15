import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { LEGAL, LEGAL_ORDER, hasPlaceholders } from "../lib/legalText";

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 bg-cream/95 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur">
      <button
        onClick={onBack}
        aria-label="Back"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink shadow-[var(--shadow-soft)]"
      >
        <Icon name="chevronLeft" className="h-4 w-4" strokeWidth={2.4} />
      </button>
      <h1 className="text-[19px] font-extrabold tracking-tight text-ink">{title}</h1>
    </header>
  );
}

/** Index of the policies, and each policy's text. Public: no sign-in needed. */
export function Legal() {
  const { doc } = useParams<{ doc?: string }>();
  const navigate = useNavigate();
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/profile", { replace: true }));

  const current = doc ? LEGAL[doc] : undefined;
  if (!current) {
    return (
      <div className="pb-8">
        <Header title="Help, terms and privacy" onBack={back} />
        <section className="mx-4 mt-2 overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-soft)]">
          {LEGAL_ORDER.map((id, i) => (
            <button
              key={id}
              onClick={() => navigate(`/legal/${id}`)}
              className={`flex w-full items-center gap-3 p-4 text-left ${i > 0 ? "border-t border-line" : ""}`}
            >
              <span className="min-w-0 flex-1 text-body font-bold text-ink">{LEGAL[id].title}</span>
              <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2.4} />
            </button>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <Header title={current.title} onBack={back} />
      {hasPlaceholders(current) && (
        <p className="mx-4 mb-3 rounded-xl bg-sun-soft px-3 py-2 text-small text-ink">
          Draft: some details are still being finalised.
        </p>
      )}
      <div className="space-y-5 px-4">
        {current.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lead font-bold text-ink">{s.heading}</h2>
            {s.body.map((p) => (
              <p key={p} className="mt-1.5 text-body leading-relaxed text-ink-soft">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
