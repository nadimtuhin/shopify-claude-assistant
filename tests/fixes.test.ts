import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { MultiStoreShopifyManager } from "../src/shopify_manager";
import { ProductDraftSchema, SHOPIFY_CLAUDE_TOOLS, ShopifyStoreConfigSchema } from "../src/types";

function makeManager() {
  const manager = new MultiStoreShopifyManager();
  manager.registerStore(
    ShopifyStoreConfigSchema.parse({ storeId: "a", shopDomain: "a.myshopify.com", adminAccessToken: "shpat_a" })
  );
  manager.registerStore(
    ShopifyStoreConfigSchema.parse({ storeId: "b", shopDomain: "b.myshopify.com", adminAccessToken: "shpat_b" })
  );
  return manager;
}

const draft = ProductDraftSchema.parse({
  title: "T",
  descriptionHtml: "<p>x</p>",
  vendor: "V",
  productType: "P",
  tags: [],
  price: 1,
  targetStores: ["a", "b"]
});

describe("dispatchProductToStores resilience", () => {
  it("isolates a throwing store instead of rejecting the whole dispatch", async () => {
    const manager = makeManager();
    const results = await manager.dispatchProductToStores(draft, async (domain) => {
      if (domain.startsWith("a.")) throw new Error("502 Bad Gateway");
      return { id: "gid://shopify/Product/1", success: true };
    });
    expect(results).toEqual([
      { storeId: "a", success: false, error: "502 Bad Gateway" },
      { storeId: "b", success: true, shopifyProductId: "gid://shopify/Product/1" }
    ]);
  });

  it("times out a hung store client instead of hanging forever", async () => {
    const manager = makeManager();
    const results = await manager.dispatchProductToStores(
      draft,
      (domain) =>
        domain.startsWith("a.")
          ? new Promise(() => {})
          : Promise.resolve({ id: "gid://shopify/Product/2", success: true }),
      { timeoutMs: 50 }
    );
    expect(results[0]).toMatchObject({ storeId: "a", success: false });
    expect(results[0].error).toContain("timed out");
    expect(results[1]).toMatchObject({ storeId: "b", success: true });
  });
});

describe("store config validation", () => {
  it("rejects shop domains that are not *.myshopify.com (admin token would be sent there)", () => {
    for (const shopDomain of ["evil.example.com", "brand.myshopify.com.evil.io", "https://brand.myshopify.com", ""]) {
      expect(() =>
        ShopifyStoreConfigSchema.parse({ storeId: "x", shopDomain, adminAccessToken: "shpat_x" })
      ).toThrow();
    }
    expect(
      ShopifyStoreConfigSchema.parse({ storeId: "x", shopDomain: "Brand-US.myshopify.com", adminAccessToken: "shpat_x" })
        .shopDomain
    ).toBe("Brand-US.myshopify.com");
  });
});

describe("generate_liquid_section tool", () => {
  it("only advertises section types the generator implements", () => {
    const tool = SHOPIFY_CLAUDE_TOOLS.find((t) => t.name === "generate_liquid_section")!;
    const manager = new MultiStoreShopifyManager();
    const placeholder = `<div class="custom-section"><h3>Custom Liquid Section</h3></div>`;
    for (const sectionType of tool.input_schema.properties.sectionType.enum as string[]) {
      expect(manager.generateLiquidSectionTemplate(sectionType as any)).not.toBe(placeholder);
    }
  });

  it("FAQ accordion ships a schema defining its blocks and escapes questions", () => {
    const liquid = new MultiStoreShopifyManager().generateLiquidSectionTemplate("faq_accordion");
    expect(liquid).toContain("{% schema %}");
    const schema = JSON.parse(liquid.split("{% schema %}")[1].split("{% endschema %}")[0]);
    const block = schema.blocks.find((b: any) => b.type === "faq_item");
    expect(block.settings.map((s: any) => s.id).sort()).toEqual(["answer", "question"]);
    expect(schema.settings.map((s: any) => s.id)).toContain("title");
    expect(schema.presets).toBeDefined();
    expect(liquid).toContain("{% for block in section.blocks %}");
    expect(liquid).toContain("block.settings.question | escape");
    expect(liquid).toContain("{{ block.shopify_attributes }}");
  });
});

describe("CI reproducibility", () => {
  it("CI installs with a frozen lockfile and dev deps are not pinned to 'latest'", () => {
    const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
    expect(ci).toMatch(/bun install --frozen-lockfile/);
    expect(ci).not.toMatch(/bun-version:\s*latest/);
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    for (const [name, range] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      expect(`${name}@${range}`).not.toMatch(/@latest$/);
    }
  });
});
