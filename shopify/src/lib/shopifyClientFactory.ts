
import * as Shopify from "shopify-api-node";

export function shopifyClientFactory(accessToken: string, shopDomain: string): Shopify {
    return new Shopify({
        accessToken,
        shopName: shopDomain.replace(".myshopify.com", ""),
        timeout: 6000,
    });
}
