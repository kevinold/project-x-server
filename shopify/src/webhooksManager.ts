import "source-map-support/register";

import fetch, { Request, RequestInit, Response } from "node-fetch";

import { config } from "./config";
import { IOAuthCompleteStepFunction, IWebhookConfig } from "./interfaces";
import { IWebhook } from "./lib/shopify";

async function updateOrRemoveExistingWebhooks(
    shopDomain: string,
    accessToken: string,
    webhooks: IWebhookConfig[],
    currentWebhooks: IWebhook[],
    fetchFn: (url: string | Request, init?: RequestInit) => Promise<Response>,
): Promise<void> {
    // Check the existing webhooks
    for (const existingWebhook of currentWebhooks) {
        const newWebhook = webhooks.find((w) => w.topic === existingWebhook.topic);
        if (newWebhook === undefined) {
            // Removing any that should no longer be installed
            console.log("Removing webhook", existingWebhook);
            await fetchFn(`https://${shopDomain}/admin/webhooks/${existingWebhook.id}.json`, {
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": accessToken,
                },
                method: "DELETE",
            });
        } else {
            // Updating existing webhooks if they have changed
            if (existingWebhook.address !== newWebhook.address || existingWebhook.format !== newWebhook.format) {
                console.log("Updating webhook", newWebhook);
                const { snsTopicArn, ...updateWebhook } = newWebhook;
                await fetchFn(`https://${shopDomain}/admin/webhooks/${existingWebhook.id}.json`, {
                    body: JSON.stringify({ webhook: updateWebhook }),
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "X-Shopify-Access-Token": accessToken,
                    },
                    method: "PUT",
                });
            } else {
                console.log("Existing webhook [1]", existingWebhook);
          }
        }
    }
}

async function addNewWebhooks(
    shopDomain: string,
    accessToken: string,
    webhooks: IWebhookConfig[],
    currentWebhooks: IWebhook[],
    fetchFn: (url: string | Request, init?: RequestInit) => Promise<Response>,
): Promise<void> {
    // Check the new webhooks and add them if they don't exist
    for (const newWebhook of webhooks) {
        console.log("New Webhook", newWebhook);

        const existingWebhook = currentWebhooks.find((w) => w.topic === newWebhook.topic);
        if (existingWebhook === undefined) {
            console.log("Adding webhook", newWebhook);
            const { snsTopicArn, ...createWebhook } = newWebhook;
            await fetchFn(`https://${shopDomain}/admin/webhooks.json`, {
                body: JSON.stringify({ webhook: createWebhook }),
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": accessToken,
                },
                method: "POST",
            });
        } else {
            console.log("Existing webhook [2]", existingWebhook);
        }
    }
}

export async function handlerAsync(
    event: IOAuthCompleteStepFunction,
    webhooks: IWebhookConfig[],
    fetchFn: (url: string | Request, init?: RequestInit) => Promise<Response>,
): Promise<IOAuthCompleteStepFunction> {
    console.log("Event", event);

    const { accessToken, shopDomain } = event;

    // Get a list of all existing webhooks
    // TODO - Should this be paginated?
    const resp = await fetchFn(`https://${shopDomain}/admin/webhooks.json`, {
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
        },
        method: "GET",
    });
    console.log("Response", resp);
    const json = await resp.json();
    console.log("JSON", json);
    const currentWebhooks = json.webhooks as IWebhook[];

    console.log("Configured webhooks", webhooks);

    await updateOrRemoveExistingWebhooks(shopDomain, accessToken, webhooks, currentWebhooks, fetchFn);
    await addNewWebhooks(shopDomain, accessToken, webhooks, currentWebhooks, fetchFn);

    console.log("Webhooks updated");

    return event;
}

export async function handler(event: IOAuthCompleteStepFunction): Promise<IOAuthCompleteStepFunction> {
    return await handlerAsync(event, config.webhooks, fetch);
}
