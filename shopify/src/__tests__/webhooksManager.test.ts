import { SNSEvent } from "aws-lambda";
import * as fetch from "jest-fetch-mock";

import { IWebhookConfig } from "../interfaces";
import { handlerAsync } from "../webhooksManager";

test("Adds new webhooks", async () => {
    const webhooks: IWebhookConfig[] = [
        {
            address: "https://app.example.com/app/uninstalled",
            format: "json",
            snsTopicArn: "app-uninstalled-topic-arn",
            topic: "app/uninstalled",
        },
        {
            address: "https://app.example.com/shop/update",
            format: "json",
            snsTopicArn: "shop-update-topic-arn",
            topic: "shop/update",
        },
    ];

    const event: SNSEvent = {
        Records: [{
            EventSource: "",
            EventSubscriptionArn: "",
            EventVersion: "",
            Sns: {
                Message: JSON.stringify({
                    accessToken: "accessToken",
                    data: null,
                    event: "app/auth_complete",
                    shopDomain: "example.myshopify.com",
                }),
                MessageAttributes: {},
                MessageId: "",
                Signature: "",
                SignatureVersion: "",
                SigningCertUrl: "",
                Subject: "",
                Timestamp: "",
                TopicArn: "",
                Type: "",
                UnsubscribeUrl: "",
            },
        }],
    };

    fetch.resetMocks();
    fetch.mockResponseOnce(JSON.stringify({
        data: {
            webhooks: [
                {
                    address: "https://app.example.com/app/uninstalled",
                    created_at: "created_at",
                    fields: [],
                    format: "json",
                    id: 1,
                    metafield_namespaces: [],
                    topic: "app/uninstalled",
                    updated_at: "updated_at",
                },
            ],
        },
    }));
    fetch.mockResponseOnce(JSON.stringify({
        data: {
            webhook: {
                address: "https://app.example.com/shop/update",
                created_at: "created_at",
                fields: [],
                format: "json",
                id: 2,
                metafield_namespaces: [],
                topic: "shop/update",
                updated_at: "updated_at",
            },
        },
    }));

    const result = await handlerAsync(
        event,
        webhooks,
        // @ts-ignore
        fetch,
    );

    expect(result).toBe(true);
    // @ts-ignore
    expect(fetch.mock.calls.length).toBe(2);
    // @ts-ignore
    expect(fetch.mock.calls[0][0]).toEqual("https://example.myshopify.com/admin/webhooks.json");
    // @ts-ignore
    expect(fetch.mock.calls[0][1]).toEqual({
        body: "",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": "accessToken",
        },
        method: "GET",
    });
    // @ts-ignore
    expect(fetch.mock.calls[1][0]).toEqual("https://example.myshopify.com/admin/webhooks.json");
    // @ts-ignore
    expect(fetch.mock.calls[1][1]).toEqual({
        // tslint:disable-next-line:max-line-length
        body: "{\"webhook\":{\"address\":\"https://app.example.com/shop/update\",\"format\":\"json\",\"topic\":\"shop/update\"}}",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": "accessToken",
        },
        method: "POST",
    });
});

test("Deletes old webhooks", async () => {
    const webhooks: IWebhookConfig[] = [
        {
            address: "https://app.example.com/app/uninstalled",
            format: "json",
            snsTopicArn: "app-uninstalled-topic-arn",
            topic: "app/uninstalled",
        },
    ];

    const event: SNSEvent = {
        Records: [{
            EventSource: "",
            EventSubscriptionArn: "",
            EventVersion: "",
            Sns: {
                Message: JSON.stringify({
                    accessToken: "accessToken",
                    data: null,
                    event: "app/auth_complete",
                    shopDomain: "example.myshopify.com",
                }),
                MessageAttributes: {},
                MessageId: "",
                Signature: "",
                SignatureVersion: "",
                SigningCertUrl: "",
                Subject: "",
                Timestamp: "",
                TopicArn: "",
                Type: "",
                UnsubscribeUrl: "",
            },
        }],
    };

    fetch.resetMocks();
    fetch.mockResponseOnce(JSON.stringify({
        data: {
            webhooks: [
                {
                    address: "https://app.example.com/app/uninstalled",
                    created_at: "created_at",
                    fields: [],
                    format: "json",
                    id: 1,
                    metafield_namespaces: [],
                    topic: "app/uninstalled",
                    updated_at: "updated_at",
                },
                {
                    address: "https://app.example.com/shop/update",
                    created_at: "created_at",
                    fields: [],
                    format: "json",
                    id: 2,
                    metafield_namespaces: [],
                    topic: "shop/update",
                    updated_at: "updated_at",
                },
            ],
        },
    }));
    fetch.mockResponseOnce(JSON.stringify({}));

    const result = await handlerAsync(
        event,
        webhooks,
        // @ts-ignore
        fetch,
    );

    expect(result).toBe(true);
    // @ts-ignore
    expect(fetch.mock.calls.length).toBe(2);
    // @ts-ignore
    expect(fetch.mock.calls[0][0]).toEqual("https://example.myshopify.com/admin/webhooks.json");
    // @ts-ignore
    expect(fetch.mock.calls[0][1]).toEqual({
        body: "",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": "accessToken",
        },
        method: "GET",
    });
    // @ts-ignore
    expect(fetch.mock.calls[1][0]).toEqual("https://example.myshopify.com/admin/webhooks/2.json");
    // @ts-ignore
    expect(fetch.mock.calls[1][1]).toEqual({
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": "accessToken",
        },
        method: "DELETE",
    });
});

test("Update existing webhooks", async () => {
    const webhooks: IWebhookConfig[] = [
        {
            address: "https://app.example.com/new/app/uninstalled",
            format: "json",
            snsTopicArn: "app-uninstalled-topic-arn",
            topic: "app/uninstalled",
        },
    ];

    const event: SNSEvent = {
        Records: [{
            EventSource: "",
            EventSubscriptionArn: "",
            EventVersion: "",
            Sns: {
                Message: JSON.stringify({
                    accessToken: "accessToken",
                    data: null,
                    event: "app/auth_complete",
                    shopDomain: "example.myshopify.com",
                }),
                MessageAttributes: {},
                MessageId: "",
                Signature: "",
                SignatureVersion: "",
                SigningCertUrl: "",
                Subject: "",
                Timestamp: "",
                TopicArn: "",
                Type: "",
                UnsubscribeUrl: "",
            },
        }],
    };

    fetch.resetMocks();
    fetch.mockResponseOnce(JSON.stringify({
        data: {
            webhooks: [{
                address: "https://app.example.com/app/uninstalled",
                created_at: "created_at",
                fields: [],
                format: "json",
                id: 1,
                metafield_namespaces: [],
                topic: "app/uninstalled",
                updated_at: "updated_at",
            }],
        },
    }));
    fetch.mockResponseOnce(JSON.stringify({
        data: {
            webhook: {
                address: "https://app.example.com/new/app/uninstalled",
                created_at: "created_at",
                fields: [],
                format: "json",
                id: 1,
                metafield_namespaces: [],
                topic: "app/uninstalled",
                updated_at: "updated_at",
            },
        },
    }));

    const result = await handlerAsync(
        event,
        webhooks,
        // @ts-ignore
        fetch,
    );

    expect(result).toBe(true);
    // @ts-ignore
    expect(fetch.mock.calls.length).toBe(2);
    // @ts-ignore
    expect(fetch.mock.calls[0][0]).toEqual("https://example.myshopify.com/admin/webhooks.json");
    // @ts-ignore
    expect(fetch.mock.calls[0][1]).toEqual({
        body: "",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": "accessToken",
        },
        method: "GET",
    });
    // @ts-ignore
    expect(fetch.mock.calls[1][0]).toEqual("https://example.myshopify.com/admin/webhooks/1.json");
    // @ts-ignore
    expect(fetch.mock.calls[1][1]).toEqual({
        // tslint:disable-next-line:max-line-length
        body: "{\"webhook\":{\"address\":\"https://app.example.com/new/app/uninstalled\",\"format\":\"json\",\"topic\":\"app/uninstalled\"}}",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": "accessToken",
        },
        method: "PUT",
    });
});
