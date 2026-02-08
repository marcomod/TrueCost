export type ProductType =
  | "console"
  | "audio"
  | "appliance"
  | "coffee"
  | "shoes"
  | "phone"
  | "other";

export type Product = {
  id: string;
  name: string;
  type: ProductType;
  defaultPrice: number;
  imageUrl: string;
  aliases?: string[];
};

export const PRODUCTS: Product[] = [
  {
    id: "ps5",
    name: "PlayStation 5",
    type: "console",
    defaultPrice: 499.99,
    imageUrl: "/products/ps5.png",
    aliases: ["ps5", "playstation 5", "play station 5"],
  },
  {
    id: "airpods-pro",
    name: "AirPods Pro",
    type: "audio",
    defaultPrice: 249.0,
    imageUrl: "/products/airpods.png",
    aliases: ["airpods", "airpods pro", "air pods"],
  },
  {
    id: "nike-dunks",
    name: "Nike Dunk Low",
    type: "shoes",
    defaultPrice: 115.0,
    imageUrl: "/products/nikedunk.png",
    aliases: ["dunks", "nike dunks", "dunk low"],
  },
  {
    id: "keurig",
    name: "Keurig Coffee Maker",
    type: "coffee",
    defaultPrice: 129.99,
    imageUrl: "/products/coffee.png",
    aliases: ["keurig", "coffee maker", "coffee machine"],
  },
  {
    id: "iphone-15",
    name: "iPhone",
    type: "phone",
    defaultPrice: 799.0,
    imageUrl: "/products/iphone.png",
    aliases: ["iphone", "iphone 15", "iphone 14", "iphone 13"],
  },
  {
    id: "dyson-vacuum",
    name: "Dyson Vacuum",
    type: "appliance",
    defaultPrice: 499.99,
    imageUrl: "/products/dyson.png",
    aliases: ["dyson", "vacuum", "vacuum cleaner"],
  },
  {
    id: "spotify",
    name: "Spotify Premium (Monthly)",
    type: "other",
    defaultPrice: 11.99,
    imageUrl: "/placeholder.svg",
    aliases: ["spotify", "spotify premium"],
  },
  {
    id: "netflix",
    name: "Netflix (Monthly)",
    type: "other",
    defaultPrice: 15.49,
    imageUrl: "/placeholder.svg",
    aliases: ["netflix"],
  },
];

function normalize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ProductLookupResult = {
  product: Product | null;
  displayName: string;
  imageUrl: string;
  type: ProductType;
  defaultPrice: number | null;
};

export function lookupProduct(query: string): ProductLookupResult {
  const q = normalize(query);

  let best: { product: Product; score: number } | null = null;

  for (const product of PRODUCTS) {
    const candidates = [product.name, ...(product.aliases ?? [])].map(normalize);
    for (const candidate of candidates) {
      if (!candidate) continue;

      const exact = q === candidate;
      const contains = q.includes(candidate) || candidate.includes(q);
      if (!exact && !contains) continue;

      const score = exact ? 1000 : candidate.length;
      if (!best || score > best.score) best = { product, score };
    }
  }

  if (best) {
    return {
      product: best.product,
      displayName: best.product.name,
      imageUrl: best.product.imageUrl,
      type: best.product.type,
      defaultPrice: best.product.defaultPrice,
    };
  }

  const displayName = query.trim() || "Unknown item";
  return {
    product: null,
    displayName,
    imageUrl: "/placeholder.svg",
    type: "other",
    defaultPrice: null,
  };
}
