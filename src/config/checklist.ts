/**
 * The fixed room-by-room checklist, used for both check-in and check-out.
 *
 * It is the same list every time on purpose: the check-out record is only
 * comparable with the baseline if both cover the same items.
 */
export const checklistRooms = [
  {
    id: "living",
    name: "Living room",
    items: ["Walls and ceiling", "Sofa and chairs", "TV and remote", "Floor"],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    items: ["Counter and sink", "Stove and chimney", "Fridge", "Utensils"],
  },
  { id: "bedroom", name: "Bedroom", items: ["Bed and mattress", "Wardrobe", "Windows", "Floor"] },
  { id: "bath", name: "Bathroom", items: ["Tiles and fittings", "Geyser", "Mirror"] },
] as const;

export const checklistItemCount = checklistRooms.reduce((n, r) => n + r.items.length, 0);
