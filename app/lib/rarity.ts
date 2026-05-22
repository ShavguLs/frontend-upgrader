export function getSkinRarityKey(rarity?: string | null): string {
  if (!rarity) return "milspec";
  const v = rarity.toLowerCase();
  if (v.includes("consumer")) return "consumer";
  if (v.includes("industrial")) return "industrial";
  if (v.includes("mil-spec") || v.includes("milspec")) return "milspec";
  if (v.includes("restricted")) return "restricted";
  if (v.includes("classified")) return "classified";
  if (v.includes("covert")) return "covert";
  if (v.includes("contraband")) return "contraband";
  if (
    v.includes("extraordinary") ||
    v.includes("knife") ||
    v.includes("gloves") ||
    v.includes("special") ||
    v.includes("★")
  ) {
    return "special";
  }
  return "milspec";
}

export function getSkinRarityColor(color?: string | null): string | null {
  if (!color) return null;
  const value = color.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(value) ? value : null;
}
