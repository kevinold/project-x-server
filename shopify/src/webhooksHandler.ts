import "source-map-support/register";

import { APIGatewayEvent, ProxyResult } from "aws-lambda";
import * as AWS from "aws-sdk";
import * as crypto from "crypto";

import { config } from "./config";
import { IBaseMessage, IWebhookConfig } from "./interfaces";
import { badRequest, noContent } from "./lib/http";

export async function handlerAsync(
    event: APIGatewayEvent,
    allWebhooks: IWebhookConfig[],
    sns: AWS.SNS): Promise<ProxyResult> {
    console.log("Event", event);

    // If the body is missing the return a bad request
    const body = event.body;
    if (body === null) {
        console.log("Body was null");
        return badRequest("Body was null");
    }

    // Check the HMAC header and return a bad request if it doesn't match
    const {
        "X-Shopify-Hmac-Sha256": hmacHeader,
        "X-Shopify-Shop-Domain": shopDomainHeader,
        "X-Shopify-Topic": topicHeader,
    } = event.headers;
    const calculatedHmac
        = crypto.createHmac("SHA256", process.env.SHOPIFY_API_SECRET || "").update(body).digest("base64");
    if (hmacHeader !== calculatedHmac) {
        console.log("X-Shopify-Hmac-Sha256 header validation failed", hmacHeader, calculatedHmac);
        return badRequest("X-Shopify-Hmac-Sha256 header validation failed");
    }

    console.log("Received webhook store " + shopDomainHeader + " ; topic " + topicHeader);

    // Find any webhooks for this topic
    const webhooks = allWebhooks.filter((webhookConfig) => webhookConfig.topic === topicHeader);

    // If there are no configured webhooks then log it and return successfully
    if (webhooks.length === 0) {
        console.log("No SNS ARN configured for topic", topicHeader);
        return noContent();
    }

    // Loop through each of the matching webhooks and publish a message to the relevant topic
    for (const webhookConfig of webhooks) {
        const topicArn = webhookConfig.snsTopicArn;

        const message: IBaseMessage = {
            data: JSON.parse(body),
            event: webhookConfig.topic,
            shopDomain: shopDomainHeader,
        };

        const params: AWS.SNS.PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: topicArn,
        };

        const result = await sns.publish(params).promise();
        console.log(`SNS ARN ${topicArn}; Message ID ${result.MessageId}`);
    }

    return noContent();
}

export async function handler(event: APIGatewayEvent): Promise<ProxyResult> {
    const sns = new AWS.SNS({ apiVersion: "2010-03-31" });

    return await handlerAsync(event, config.webhooks, sns);
}
