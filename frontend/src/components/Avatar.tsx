interface Props {
  name: string;
  src?: string | null;
  size?: number;
  online?: boolean;
}

// Leans into the violet/pink mockup palette (was a generic rainbow set).
const COLORS = [
  "bg-accent-200 text-accent-800", "bg-brand-200 text-brand-700",
  "bg-violet-200 text-violet-700", "bg-fuchsia-200 text-fuchsia-700",
  "bg-accent-100 text-accent-700", "bg-brand-100 text-brand-800",
  "bg-pink-200 text-pink-800", "bg-purple-200 text-purple-800",
];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Avatar({ name, src, size = 40, online }: Props) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} className="rounded-full object-cover w-full h-full" />
      ) : (
        <div
          className={`rounded-full w-full h-full flex items-center justify-center font-semibold ${colorFor(name)}`}
          style={{ fontSize: size * 0.4 }}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-white ${online ? "bg-emerald-500" : "bg-gray-300"}`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
