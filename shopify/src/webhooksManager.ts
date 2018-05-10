import "source-map-support/register";

import { SNSEvent } from "aws-lambda";
import Shopify = require("shopify-api-node");
import { IWebhook } from "shopify-api-node";

import { config } from "./config";
import { IAuthCompleteMessage, IWebhookConfig } from "./interfaces";
import { Log } from "./lib/log";
import { shopifyClientFactory } from "./lib/shopifyClientFactory";

function hasWebhookChanged(existingWebhook: IWebhook, newWebhook: IWebhookConfig): boolean {
    return existingWebhook.address !== newWebhook.address
        || existingWebhook.format !== newWebhook.format;
}

export async function handlerAsync(
    event: SNSEvent,
    webhooks: IWebhookConfig[],
    clientFactory: (accessToken: string, shopDomain: string) => Shopify,
): Promise<boolean> {
    for (const record of event.Records) {
        Log.info(record.Sns);
        const data = JSON.parse(record.Sns.Message) as IAuthCompleteMessage;
        Log.info("Data", data);

        const shopify = clientFactory(data.accessToken, data.shopDomain);

        const currentWebhooks = await shopify.webhook.list();

        for (const existingWebhook of currentWebhooks) {
            const newWebhook = webhooks.find((w) => w.topic === existingWebhook.topic);
            if (newWebhook === undefined) {
                Log.info("Removing webhook", existingWebhook);
                await shopify.webhook.delete(existingWebhook.id);
            } else {
                if (hasWebhookChanged(existingWebhook, newWebhook)) {
                    Log.info("Updating webhook", newWebhook);
                    const { snsTopicArn, ...updateWebhook } = newWebhook;
                    await shopify.webhook.update(existingWebhook.id, updateWebhook);
                }
            }
        }

        for (const newWebhook of webhooks) {
            const existingWebhook = currentWebhooks.find((w) => w.topic === newWebhook.topic);
            if (existingWebhook === undefined) {
                Log.info("Adding webhook", newWebhook);
                const { snsTopicArn, ...createWebhook } = newWebhook;
                await shopify.webhook.create(createWebhook);
            }
        }

        Log.info("Webhooks updated");
    }

    return true;
}

export async function handler(event: SNSEvent): Promise<boolean> {
    return await handlerAsync(event, config.webhooks, shopifyClientFactory);
}
