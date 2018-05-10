import "source-map-support/register";

import { APIGatewayEvent, ProxyResult } from "aws-lambda";
import * as AWS from "aws-sdk";
import * as crypto from "crypto";

import { config } from "./config";
import { IBaseMessage, IWebhookConfig } from "./interfaces";
import { Log } from "./lib/log";

export async function handlerAsync(
    event: APIGatewayEvent,
    webhooks: IWebhookConfig[],
    sns: AWS.SNS): Promise<ProxyResult> {
    const shopifyHmac = event.headers["X-Shopify-Hmac-Sha256"];
    const shopifyShopDomain = event.headers["X-Shopify-Shop-Domain"];
    const webhook = event.headers["X-Shopify-Topic"];
    const body = event.body;
    if (body === null) {
        Log.info("Body was null");
        return {
            body: JSON.stringify({ error: 400, message: "Body was null" }),
            headers: {
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            },
            statusCode: 400,
        };
    }

    const calculatedHmac
        = crypto.createHmac("SHA256", process.env.SHOPIFY_API_SECRET || "").update(body).digest("base64");

    if (shopifyHmac !== calculatedHmac) {
        Log.info("X-Shopify-Hmac-Sha256 header validation failed", shopifyHmac, calculatedHmac);
        return {
            body: JSON.stringify({ error: 400, message: "X-Shopify-Hmac-Sha256 header validation failed" }),
            headers: {
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            },
            statusCode: 400,
        };
    }

    Log.info("Received webhook store " + shopifyShopDomain + " ; topic " + webhook);
    let webhookFound = false;

    for (const webhookConfig of webhooks) {
        if (webhookConfig.topic === webhook) {
            webhookFound = true;
            const topicArn = webhookConfig.snsTopicArn;

            Log.info("Using SNS ARN", topicArn);

            const message: IBaseMessage = {
                data: JSON.parse(body),
                event: webhook,
                shopDomain: shopifyShopDomain,
            };

            const params: AWS.SNS.PublishInput = {
                Message: JSON.stringify(message),
                TopicArn: topicArn,
            };

            const result = await sns.publish(params).promise();
            Log.info("Message ID", result.MessageId);
        }
    }

    if (!webhookFound) {
        Log.info("No SNS ARN configured for topic", webhook);
    }

    return {
        body: "",
        headers: {
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
        statusCode: 204,
    };
}

export async function handler(event: APIGatewayEvent): Promise<ProxyResult> {
    const sns = new AWS.SNS({ apiVersion: "2010-03-31" });

    return await handlerAsync(event, config.webhooks, sns);
}
