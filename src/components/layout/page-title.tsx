export function PageTitle({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold sm:text-[32px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}
