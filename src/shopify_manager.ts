import type { ProductDraft, ShopifyStoreConfig } from "./types";

export class MultiStoreShopifyManager {
  private stores: Map<string, ShopifyStoreConfig> = new Map();

  registerStore(store: ShopifyStoreConfig): void {
    this.stores.set(store.storeId, store);
  }

  getStore(storeId: string): ShopifyStoreConfig | undefined {
    return this.stores.get(storeId);
  }

  listStores(): ShopifyStoreConfig[] {
    return Array.from(this.stores.values());
  }

  async dispatchProductToStores(
    draft: ProductDraft,
    clientMock?: (domain: string, payload: any) => Promise<{ id: string; success: boolean }>
  ): Promise<{ storeId: string; success: boolean; shopifyProductId?: string }[]> {
    const results: { storeId: string; success: boolean; shopifyProductId?: string }[] = [];

    for (const targetStoreId of draft.targetStores) {
      const store = this.stores.get(targetStoreId);
      if (!store) {
        results.push({ storeId: targetStoreId, success: false });
        continue;
      }

      if (clientMock) {
        const res = await clientMock(store.shopDomain, draft);
        results.push({
          storeId: store.storeId,
          success: res.success,
          shopifyProductId: res.id
        });
      } else {
        // Default simulated dispatch
        results.push({
          storeId: store.storeId,
          success: true,
          shopifyProductId: `gid://shopify/Product/${Math.floor(Math.random() * 900000 + 100000)}`
        });
      }
    }

    return results;
  }

  generateLiquidSectionTemplate(type: "hero_banner" | "product_grid" | "faq_accordion"): string {
    switch (type) {
      case "hero_banner":
        return `{% comment %} Claude-Generated Hero Banner Section {% endcomment %}
<section class="shopify-section-hero" style="background: {{ section.settings.bg_color }};">
  <div class="page-width">
    <h1>{{ section.settings.heading | escape }}</h1>
    <p>{{ section.settings.subheading | escape }}</p>
    {% if section.settings.button_link != blank %}
      <a href="{{ section.settings.button_link }}" class="button button--primary">
        {{ section.settings.button_label | default: 'Shop Now' }}
      </a>
    {% endif %}
  </div>
</section>
{% schema %}
{
  "name": "Claude Hero Banner",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "Elevate Your Style" },
    { "type": "textarea", "id": "subheading", "label": "Subheading", "default": "Exclusive multi-store drops" },
    { "type": "color", "id": "bg_color", "label": "Background Color", "default": "#f4f4f5" },
    { "type": "url", "id": "button_link", "label": "Button Link" },
    { "type": "text", "id": "button_label", "label": "Button Label", "default": "Explore Collection" }
  ],
  "presets": [{ "name": "Claude Hero Banner" }]
}
{% endschema %}`;

      case "faq_accordion":
        return `{% comment %} Claude-Generated FAQ Accordion {% endcomment %}
<div class="faq-accordion page-width">
  <h2>{{ section.settings.title | default: 'Frequently Asked Questions' }}</h2>
  <div class="faq-list">
    {% for block in section.blocks %}
      <details class="faq-item">
        <summary>{{ block.settings.question }}</summary>
        <div class="faq-answer">{{ block.settings.answer }}</div>
      </details>
    {% endfor %}
  </div>
</div>`;
      default:
        return `<div class="custom-section"><h3>Custom Liquid Section</h3></div>`;
    }
  }
}
