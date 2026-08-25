import { describe, expect, it } from "bun:test";
import { MultiStoreShopifyManager } from "../src/shopify_manager";
import { ProductDraftSchema, SHOPIFY_CLAUDE_TOOLS, ShopifyStoreConfigSchema } from "../src/types";

describe("Shopify + Claude Multi-Store Assistant", () => {
  const manager = new MultiStoreShopifyManager();

  const store1 = ShopifyStoreConfigSchema.parse({
    storeId: "us-store",
    shopDomain: "brand-us.myshopify.com",
    adminAccessToken: "shpat_test_123"
  });

  const store2 = ShopifyStoreConfigSchema.parse({
    storeId: "eu-store",
    shopDomain: "brand-eu.myshopify.com",
    adminAccessToken: "shpat_test_456",
    currency: "EUR"
  });

  manager.registerStore(store1);
  manager.registerStore(store2);

  it("registers and lists stores correctly", () => {
    expect(manager.listStores()).toHaveLength(2);
    expect(manager.getStore("us-store")?.shopDomain).toBe("brand-us.myshopify.com");
  });

  it("dispatches product drafts across multiple registered stores", async () => {
    const draft = ProductDraftSchema.parse({
      title: "Limited Edition Leather Jacket",
      descriptionHtml: "<p>Premium Italian leather</p>",
      vendor: "BrandCo",
      productType: "Outerwear",
      tags: ["leather", "winter-2026"],
      price: 299,
      targetStores: ["us-store", "eu-store"]
    });

    const results = await manager.dispatchProductToStores(draft);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
    expect(results[0].shopifyProductId).toContain("gid://shopify/Product/");
  });

  it("exposes valid Claude tool definitions for Shopify management", () => {
    expect(SHOPIFY_CLAUDE_TOOLS).toHaveLength(3);
    const syncTool = SHOPIFY_CLAUDE_TOOLS.find((t) => t.name === "sync_product_to_stores");
    expect(syncTool).toBeDefined();
    expect(syncTool?.input_schema.properties.targetStores).toBeDefined();
  });

  it("generates valid Shopify Liquid sections with settings schema", () => {
    const liquid = manager.generateLiquidSectionTemplate("hero_banner");
    expect(liquid).toContain("{% schema %}");
    expect(liquid).toContain("Claude Hero Banner");
    expect(liquid).toContain("section.settings.heading");
  });
});
