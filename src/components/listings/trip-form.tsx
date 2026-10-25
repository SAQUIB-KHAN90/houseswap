"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const cities = ["Delhi", "Chandigarh", "Jaipur"];
const types = [
  { v: "any", l: "Any" },
  { v: "home", l: "Entire home" },
  { v: "room_kitchen", l: "Room + kitchen" },
  { v: "room", l: "Private room" },
];

export function TripForm() {
  const router = useRouter();
  const [from, setFrom] = useState("Delhi");
  const [to, setTo] = useState("Chandigarh");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [type, setType] = useState("any");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/search?${new URLSearchParams({ from, to, start, end, type })}`);
  }

  return (
    <form onSubmit={submit} className="space-y-7 rounded-lg border bg-surface p-6 shadow-card">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="from">Where you live</Label>
          <Select id="from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">Where you're going</Label>
          <Select id="to" value={to} onChange={(e) => setTo(e.target.value)}>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="start">Check in</Label>
          <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end">Check out</Label>
          <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2.5 text-sm font-semibold">What kind of stay</legend>
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <label
              key={t.v}
              className={cn(
                "cursor-pointer rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                type === t.v
                  ? "border-brand bg-brand-tint text-brand"
                  : "border-field hover:bg-ink/[0.04]"
              )}
            >
              <input
                type="radio"
                name="type"
                value={t.v}
                checked={type === t.v}
                onChange={() => setType(t.v)}
                className="sr-only"
              />
              {t.l}
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" size="lg" className="w-full sm:w-auto">
        <Search aria-hidden />
        Find stays
      </Button>
    </form>
  );
}
