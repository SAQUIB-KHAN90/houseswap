import { Photo } from "@/components/ui/photo";

export function PhotoMosaic({
  cover,
  gallery,
  alt,
}: {
  cover: string;
  gallery: string[];
  alt: string;
}) {
  return (
    <div className="grid gap-2 overflow-hidden rounded-lg md:grid-cols-2">
      <div className="aspect-[4/3] md:aspect-auto md:min-h-[360px]">
        <Photo src={cover} alt={alt} priority sizes="(max-width: 768px) 100vw, 50vw" />
      </div>
      <div className="hidden grid-cols-2 gap-2 md:grid">
        {gallery.slice(0, 4).map((src, i) => (
          <div key={src} className="min-h-[176px]">
            <Photo src={src} alt={`${alt}, photo ${i + 2}`} sizes="25vw" />
          </div>
        ))}
      </div>
    </div>
  );
}
