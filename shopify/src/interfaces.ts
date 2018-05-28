import { ICreateScriptTag, ICreateWebhook, IShop, WebhookTopic } from "./lib/shopify";

export interface IWebhookConfig extends ICreateWebhook {
    snsTopicArn?: string;
    stateMachineArn?: string;
}

export interface IShopifyConfig {
    scriptTags: ICreateScriptTag[];
    webhooks: IWebhookConfig[];
}

export interface IBaseMessage {
    shopDomain: string;
    event: WebhookTopic | "app/auth_complete" | "app/installed";
    data: object | null;
}

export interface IAppUninstalledMessage extends IBaseMessage {
    data: IShop;
}

export interface IShopUpdateMessage extends IBaseMessage {
    data: { [pname: string]: string | number | boolean };
}

export interface IStoredShopData {
    [pname: string]: string | number | boolean | undefined;
    accessToken: string;
    country: string;
    email: string;
    installedAt: string;
    name: string;
    planDisplayName: string;
    planName: string;
    platform: string;
    shopDomain: string;
    shopifyId?: number;
    timezone: string;
}
