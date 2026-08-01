export default function Card({ title, description, children, className = '' }) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
