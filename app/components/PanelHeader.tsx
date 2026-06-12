/**
 * Unified panel anatomy: title row (+ optional right meta) and an ALWAYS
 * visible one-line subtitle that explains what the panel shows. The subtitle
 * is the explanation layer — every panel carries one.
 */
export function PanelHeader({
  title,
  sub,
  meta,
}: {
  title: React.ReactNode;
  sub: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className="panel-head">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="panel-title">{title}</h2>
        {meta && <div className="panel-meta">{meta}</div>}
      </div>
      <p className="panel-sub">{sub}</p>
    </header>
  );
}
