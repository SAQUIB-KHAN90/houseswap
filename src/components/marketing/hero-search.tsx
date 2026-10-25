"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const cities = ["Delhi", "Chandigarh", "Jaipur"];

const cell =
  "flex flex-col justify-center gap-0.5 border-line px-5 py-3.5 text-left sm:border-r last:sm:border-r-0";
const control =
  "w-full appearance-none border-0 bg-transparent p-0 text-[15px] font-semibold text-ink focus:outline-none";

export function HeroSearch() {
  const router = useRouter();
  const [to, setTo] = useState("Chandigarh");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [type, setType] = useState("any");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/search?${new URLSearchParams({ to, start, end, type })}`);
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Find a stay"
      className="grid divide-y divide-line rounded-xl bg-surface shadow-bar sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-[1.1fr_1fr_1fr_1.1fr_auto] lg:rounded-2xl"
    >
      <label className={cell} htmlFor="hs-to">
        <span className="text-xs font-medium text-muted">Where to</span>
        <select id="hs-to" className={control} value={to} onChange={(e) => setTo(e.target.value)}>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>

      <label className={cell} htmlFor="hs-start">
        <span className="text-xs font-medium text-muted">Check in</span>
        <input
          id="hs-start"
          type="date"
          className={control}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>

      <label className={cell} htmlFor="hs-end">
        <span className="text-xs font-medium text-muted">Check out</span>
        <input
          id="hs-end"
          type="date"
          className={control}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>

      <label className={cell} htmlFor="hs-type">
        <span className="text-xs font-medium text-muted">Stay type</span>
        <select
          id="hs-type"
          className={control}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="any">Any</option>
          <option value="home">Entire home</option>
          <option value="room_kitchen">Room + kitchen</option>
          <option value="room">Private room</option>
        </select>
      </label>

      <div className="flex items-center p-3 sm:col-span-2 lg:col-span-1">
        <Button type="submit" size="lg" className="w-full lg:w-auto">
          <Search aria-hidden />
          Search
        </Button>
      </div>
    </form>
  );
}
