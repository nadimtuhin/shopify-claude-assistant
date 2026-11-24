import { z } from "zod";

export const ShopifyStoreConfigSchema = z.object({
  storeId: z.string(),
  // Admin API calls must target the shop's canonical *.myshopify.com host; anything
  // else would send the admin access token to a third-party server.
  shopDomain: z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/, "shopDomain must be a <shop>.myshopify.com hostname"),
  adminAccessToken: z.string(),
  currency: z.string().default("USD")
});
export type ShopifyStoreConfig = z.infer<typeof ShopifyStoreConfigSchema>;

export const ProductDraftSchema = z.object({
  title: z.string(),
  descriptionHtml: z.string(),
  vendor: z.string(),
  productType: z.string(),
  tags: z.array(z.string()),
  price: z.number(),
  targetStores: z.array(z.string())
});
export type ProductDraft = z.infer<typeof ProductDraftSchema>;

export interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

export const SHOPIFY_CLAUDE_TOOLS: ClaudeToolDefinition[] = [
  {
    name: "sync_product_to_stores",
    description: "Publish or update a product across multiple connected Shopify stores simultaneously",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        descriptionHtml: { type: "string" },
        price: { type: "number" },
        targetStores: { type: "array", items: { type: "string" } }
      },
      required: ["title", "descriptionHtml", "price", "targetStores"]
    }
  },
  {
    name: "generate_liquid_section",
    description: "Generate clean, high-converting Shopify Liquid section schemas based on brand guidelines",
    input_schema: {
      type: "object",
      properties: {
        sectionType: { type: "string", enum: ["hero_banner", "faq_accordion"] },
        themeTarget: { type: "string", default: "Dawn" }
      },
      required: ["sectionType"]
    }
  },
  {
    name: "audit_store_inventory",
    description: "Audit low stock variants and sync threshold alerts across stores",
    input_schema: {
      type: "object",
      properties: {
        storeId: { type: "string" },
        threshold: { type: "number", default: 10 }
      },
      required: ["storeId"]
    }
  }
];
