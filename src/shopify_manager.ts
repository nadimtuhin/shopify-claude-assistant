import type { ProductDraft, ShopifyStoreConfig } from "./types";

export const DEFAULT_DISPATCH_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Dispatch to ${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

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
    clientMock?: (domain: string, payload: any) => Promise<{ id: string; success: boolean }>,
    options: { timeoutMs?: number } = {}
  ): Promise<{ storeId: string; success: boolean; shopifyProductId?: string; error?: string }[]> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_DISPATCH_TIMEOUT_MS;
    const results: { storeId: string; success: boolean; shopifyProductId?: string; error?: string }[] = [];

    for (const targetStoreId of draft.targetStores) {
      const store = this.stores.get(targetStoreId);
      if (!store) {
        results.push({ storeId: targetStoreId, success: false });
        continue;
      }

      if (clientMock) {
        // One failing or hung store must not abort the dispatch to the others,
        // otherwise products already created elsewhere go unreported.
        try {
          const res = await withTimeout(clientMock(store.shopDomain, draft), timeoutMs, store.shopDomain);
          results.push({
            storeId: store.storeId,
            success: res.success,
            shopifyProductId: res.id
          });
        } catch (err) {
          results.push({
            storeId: store.storeId,
            success: false,
            error: err instanceof Error ? err.message : String(err)
          });
        }
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
  <h2>{{ section.settings.title | default: 'Frequently Asked Questions' | escape }}</h2>
  <div class="faq-list">
    {% for block in section.blocks %}
      <details class="faq-item" {{ block.shopify_attributes }}>
        <summary>{{ block.settings.question | escape }}</summary>
        <div class="faq-answer">{{ block.settings.answer }}</div>
      </details>
    {% endfor %}
  </div>
</div>
{% schema %}
{
  "name": "Claude FAQ Accordion",
  "settings": [
    { "type": "text", "id": "title", "label": "Title", "default": "Frequently Asked Questions" }
  ],
  "blocks": [
    {
      "type": "faq_item",
      "name": "FAQ Item",
      "settings": [
        { "type": "text", "id": "question", "label": "Question", "default": "Question" },
        { "type": "richtext", "id": "answer", "label": "Answer", "default": "<p>Answer</p>" }
      ]
    }
  ],
  "presets": [{ "name": "Claude FAQ Accordion" }]
}
{% endschema %}`;
      default:
        return `<div class="custom-section"><h3>Custom Liquid Section</h3></div>`;
    }
  }
}
